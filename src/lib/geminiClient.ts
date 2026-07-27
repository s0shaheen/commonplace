import type { ExtractorResult, ExtractorOutput } from "./types.js";
import { isNamedEntityType, isChannel, isAssertionMode, isFacetName } from "./ontology.js";
import rawSchema from "../../schema/json/extractor-output.schema.json";

export interface MediaPart {
  mimeType: string;
  data: string; // base64
}

// Vendor-aligned decoding config for gemini-3.x (extractor-v2). Field names are the v1beta REST
// camelCase forms VERIFIED against Google's live docs (thinkingConfig.thinkingLevel; mediaResolution;
// maxOutputTokens; fileData/fileUri/mimeType). NO temperature/top_p/top_k: Gemini 3 is optimized for
// its default sampling, and temp-0 under constrained decoding is the documented degenerate-loop trigger.
export interface GeminiGenerationConfig {
  responseMimeType: "application/json";
  responseSchema: object;
  thinkingConfig: { thinkingLevel: "low" };
  maxOutputTokens: number;
  mediaResolution: "MEDIA_RESOLUTION_HIGH";
}

/** A File API reference part — the native-video path (inline base64 breaks above ~20MB). */
export interface FileDataPart {
  fileUri: string;
  mimeType: string;
}

/**
 * Inference service tier (DEC-036). `flex` is 50% off standard at a 1–15 min target latency and is
 * "sheddable" (may 503 under load) — the right default for analysis, which is inherently background
 * work, because the resumable job queue already owns retry/backoff/checkpointing. Batch is the same
 * 50% but asynchronous with 24h turnaround + job/polling management, which buys us nothing here.
 * Benchmarks and experiments run at `standard` for clean, unthrottled comparison.
 */
export type ServiceTier = "standard" | "flex";

export interface GeminiBody {
  contents: { parts: Array<{ text: string } | { inlineData: MediaPart } | { fileData: FileDataPart }> }[];
  generationConfig: GeminiGenerationConfig;
  /** Omitted for `standard` (the API default); emitted only to opt into flex. */
  serviceTier?: "flex";
}

// ── Generation config (constrained decoding is best-effort; the parser is the gate) ──

// Keywords Gemini's OpenAPI-subset `response_schema` rejects. Everything else
// (type/enum/items/properties/required/minItems/minimum/maximum/…) is preserved.
const GEMINI_UNSUPPORTED_KEYS = new Set(["additionalProperties", "$schema", "$id"]);

function stripGeminiUnsupported(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(stripGeminiUnsupported);
  if (node && typeof node === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
      if (GEMINI_UNSUPPORTED_KEYS.has(k)) continue;
      out[k] = stripGeminiUnsupported(v);
    }
    return out;
  }
  return node;
}

// A documented transform of the FROZEN extractor-output.schema.json into a
// Gemini-safe response schema: strips the OpenAPI-subset-rejected keywords, keeps
// the constraint keywords (enums, required, minItems, min/max) intact.
export function toGeminiResponseSchema(): object {
  return stripGeminiUnsupported(rawSchema) as object;
}

export function buildGenerationConfig(): GeminiGenerationConfig {
  return {
    responseMimeType: "application/json",
    responseSchema: toGeminiResponseSchema(),
    // Extraction is classification-shaped — "low" thinking is cheaper and curbs the 3.x over-analysis
    // tendency while still leaving the model room to read the video. (Legacy thinkingBudget is deprecated.)
    thinkingConfig: { thinkingLevel: "low" },
    // Bounded output cap: a backstop so no single run can spew a tens-of-thousands-token runaway (the
    // pilot's one loop was ~70k). 8192 is generous for the five-array JSON; a legit rich extraction fits
    // well under it, and a genuine truncation now degrades to an honest partial (parseExtractorResponse).
    maxOutputTokens: 8192,
    // HIGH resolution: the extractor leans hard on reading fine on-screen text (menus, signs, prices,
    // overlays) where entities the audio never names live. On 3.6-flash native video this is cents;
    // quality/trust > cost per the product bar. (MEDIUM would halve per-frame tokens if cost bit.)
    mediaResolution: "MEDIA_RESOLUTION_HIGH",
  };
}

export function buildTextBody(prompt: string, tier: ServiceTier = "standard"): GeminiBody {
  return { contents: [{ parts: [{ text: prompt }] }], generationConfig: buildGenerationConfig(), ...tierField(tier) };
}

export function buildMediaBody(prompt: string, media: MediaPart[], tier: ServiceTier = "standard"): GeminiBody {
  const parts = [...media.map((m) => ({ inlineData: m })), { text: prompt }];
  return { contents: [{ parts }], generationConfig: buildGenerationConfig(), ...tierField(tier) };
}

/** `standard` is the API default, so it is expressed by OMITTING the field (never sending "standard"). */
function tierField(tier: ServiceTier): { serviceTier?: "flex" } {
  return tier === "flex" ? { serviceTier: "flex" } : {};
}

/** Native-video body: the File API `fileData` part FIRST, then the prompt (media-before-text is the
 *  documented best practice). Used instead of inline base64, which fails on larger videos. */
export function buildFileDataBody(prompt: string, file: FileDataPart, tier: ServiceTier = "standard"): GeminiBody {
  return {
    contents: [{ parts: [{ fileData: file }, { text: prompt }] }],
    generationConfig: buildGenerationConfig(),
    ...tierField(tier),
  };
}

// Shared with the Ollama lane: strip a ```json … ``` fence the model may wrap output in.
export function stripFences(text: string): string {
  return text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();
}

// ── Hard gate: invalid extractor output is rejected, never silently repaired ───────

// Allowed-key allowlists per shape — mirror the frozen schema's `properties` keys
// EXACTLY (extractor-output.schema.json). The schema pins `additionalProperties:false`
// on each of these shapes; the runtime gate reproduces that backstop so an element
// carrying a leaked field (e.g. a mention with `mbid`/`externalId`) is rejected. This
// enforces the iron rule structurally: the model never emits IDs.
const MENTION_KEYS = ["surface", "type", "aliases", "evidence"];
const CONCEPT_KEYS = ["surface", "evidence"];
const FACET_KEYS = ["facet", "value", "evidence"];
const CLAIM_KEYS = ["statement", "evidence"];
const STRUCTURED_KEYS = ["schemaOrgType", "slots", "steps", "evidence"];
const EVIDENCE_KEYS = ["channel", "source_role", "quote", "t_start", "t_end", "assertion_mode", "confidence"];

// True iff `obj` carries no key outside `allowed` (additionalProperties:false backstop).
function hasOnlyKeys(obj: Record<string, unknown>, allowed: readonly string[]): boolean {
  return Object.keys(obj).every((k) => allowed.includes(k));
}

function isEvidenceArray(ev: unknown): boolean {
  if (!Array.isArray(ev) || ev.length < 1) return false;
  for (const e of ev) {
    if (!e || typeof e !== "object" || Array.isArray(e)) return false;
    const o = e as Record<string, unknown>;
    if (!hasOnlyKeys(o, EVIDENCE_KEYS)) return false;
    if (typeof o.channel !== "string" || !isChannel(o.channel)) return false;
    if (typeof o.assertion_mode !== "string" || !isAssertionMode(o.assertion_mode)) return false;
    if (typeof o.confidence !== "number" || o.confidence < 0 || o.confidence > 1) return false;
    // rc.7: video-native timestamps are MM:SS STRINGS, not float seconds. Enforce the type here so a
    // legacy numeric timestamp (the old contract) is rejected structurally; exact MM:SS format is checked
    // by the schema (constrained decoding) and tolerated by the media-fragment parser (mmssToSeconds).
    if (o.t_start !== undefined && typeof o.t_start !== "string") return false;
    if (o.t_end !== undefined && typeof o.t_end !== "string") return false;
  }
  return true;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

// Shape-checks all five top-level arrays, every mention type via isNamedEntityType,
// every facet axis via isFacetName, the no-unknown-keys backstop per element, and every
// evidence array (non-empty, valid channel/assertion_mode, 0<=confidence<=1).
function validateExtractorOutput(v: unknown): v is ExtractorOutput {
  if (!isRecord(v)) return false;
  const { mentions, concepts, facets, claims, structured } = v;
  if (![mentions, concepts, facets, claims, structured].every(Array.isArray)) return false;

  for (const m of mentions as unknown[]) {
    if (!isRecord(m)) return false;
    if (!hasOnlyKeys(m, MENTION_KEYS)) return false;
    if (typeof m.surface !== "string") return false;
    if (typeof m.type !== "string" || !isNamedEntityType(m.type)) return false;
    if (!isEvidenceArray(m.evidence)) return false;
  }
  for (const c of concepts as unknown[]) {
    if (!isRecord(c)) return false;
    if (!hasOnlyKeys(c, CONCEPT_KEYS)) return false;
    if (typeof c.surface !== "string") return false;
    if (!isEvidenceArray(c.evidence)) return false;
  }
  for (const f of facets as unknown[]) {
    if (!isRecord(f)) return false;
    if (!hasOnlyKeys(f, FACET_KEYS)) return false;
    if (typeof f.facet !== "string" || !isFacetName(f.facet)) return false;
    if (typeof f.value !== "string") return false;
    if (!isEvidenceArray(f.evidence)) return false;
  }
  for (const cl of claims as unknown[]) {
    if (!isRecord(cl)) return false;
    if (!hasOnlyKeys(cl, CLAIM_KEYS)) return false;
    if (typeof cl.statement !== "string") return false;
    if (!isEvidenceArray(cl.evidence)) return false;
  }
  for (const s of structured as unknown[]) {
    if (!isRecord(s)) return false;
    if (!hasOnlyKeys(s, STRUCTURED_KEYS)) return false;
    if (typeof s.schemaOrgType !== "string") return false;
    if (!isEvidenceArray(s.evidence)) return false;
  }
  return true;
}

// The validation core, SHARED by both lane clients (Gemini + Ollama). Given an already
// JSON-parsed value, apply the hard gate: valid → ok; anything else → schema_invalid.
// Invalid output is rejected, never silently repaired (the iron rule is structural).
export function gateExtractorOutput(parsed: unknown): ExtractorResult {
  if (!validateExtractorOutput(parsed)) return { ok: false, error: "schema_invalid" };
  return { ok: true, output: parsed };
}

// ── Truncation salvage (honest partial, never a silent drop) ───────────────────────
// The extractor output is one object of five array-valued keys, each element an object. When a run
// is cut off (finishReason MAX_TOKENS / an unterminated JSON), the tail is a half-written element and
// the later keys were never emitted. We recover each key's COMPLETE-element prefix independently and
// backfill the unreached keys as []. Bounded + total: a scan that finds no complete element returns [].

const OUTPUT_KEYS = ["mentions", "concepts", "facets", "claims", "structured"] as const;

// Recover the complete object-elements of the array bound to `"key"` from a (possibly truncated) text.
// Tracks string state + nesting so braces/brackets inside quotes or nested arrays (e.g. `aliases`) don't
// mislead it; the trailing incomplete element (opened but never balanced) is dropped.
function salvageArray(text: string, key: string): unknown[] {
  const keyIdx = text.indexOf(`"${key}"`);
  if (keyIdx < 0) return [];
  const open = text.indexOf("[", keyIdx);
  if (open < 0) return [];
  const elements: unknown[] = [];
  let depth = 0, inStr = false, esc = false, start = -1;
  for (let i = open + 1; i < text.length; i++) {
    const c = text[i]!;
    if (inStr) {
      if (esc) esc = false;
      else if (c === "\\") esc = true;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') { inStr = true; continue; }
    if (c === "{" || c === "[") { if (depth === 0) start = i; depth++; continue; }
    if (c === "}" || c === "]") {
      if (depth === 0) break; // the array's own closing ']' → prefix complete
      depth--;
      if (depth === 0 && start >= 0) {
        try { elements.push(JSON.parse(text.slice(start, i + 1))); } catch { /* incomplete → skip */ }
        start = -1;
      }
      continue;
    }
  }
  return elements;
}

// Build a five-key output object from whatever complete elements survive the truncation.
function salvagePartialOutput(text: string): { output: Record<string, unknown>; recovered: number } {
  const output: Record<string, unknown> = {};
  let recovered = 0;
  for (const k of OUTPUT_KEYS) {
    const arr = salvageArray(text, k);
    recovered += arr.length;
    output[k] = arr;
  }
  return { output, recovered };
}

export function parseExtractorResponse(json: unknown): ExtractorResult {
  const candidate = (json as { candidates?: { finishReason?: string; content?: { parts?: { text?: string }[] } }[] })
    ?.candidates?.[0];
  const text = candidate?.content?.parts?.[0]?.text;
  if (!text) return { ok: false, error: "empty_response" };
  const stripped = stripFences(text);
  try {
    // A response that parses cleanly is complete (truncation cuts mid-token, so it would not parse).
    return gateExtractorOutput(JSON.parse(stripped));
  } catch {
    // Unterminated JSON (typically finishReason MAX_TOKENS): salvage the valid prefix into a partial.
    const { output, recovered } = salvagePartialOutput(stripped);
    if (recovered === 0) return { ok: false, error: "parse_fail" }; // nothing complete to salvage
    const gated = gateExtractorOutput(output);
    if (!gated.ok) return { ok: false, error: "parse_fail" };
    return { ok: true, output: gated.output, partial: true };
  }
}
