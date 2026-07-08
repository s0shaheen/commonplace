import type { ExtractorResult, ExtractorOutput } from "./types.js";
import { isNamedEntityType, isChannel, isAssertionMode, isFacetName } from "./ontology.js";
import rawSchema from "../../schema/json/extractor-output.schema.json";

export interface MediaPart {
  mimeType: string;
  data: string; // base64
}

export interface GeminiGenerationConfig {
  temperature: 0;
  responseMimeType: "application/json";
  responseSchema: object;
}

export interface GeminiBody {
  contents: { parts: Array<{ text: string } | { inlineData: MediaPart }> }[];
  generationConfig: GeminiGenerationConfig;
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
    temperature: 0,
    responseMimeType: "application/json",
    responseSchema: toGeminiResponseSchema(),
  };
}

export function buildTextBody(prompt: string): GeminiBody {
  return { contents: [{ parts: [{ text: prompt }] }], generationConfig: buildGenerationConfig() };
}

export function buildMediaBody(prompt: string, media: MediaPart[]): GeminiBody {
  const parts = [...media.map((m) => ({ inlineData: m })), { text: prompt }];
  return { contents: [{ parts }], generationConfig: buildGenerationConfig() };
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

export function parseExtractorResponse(json: unknown): ExtractorResult {
  const text = (json as { candidates?: { content?: { parts?: { text?: string }[] } }[] })
    ?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) return { ok: false, error: "empty_response" };
  let parsed: unknown;
  try {
    parsed = JSON.parse(stripFences(text));
  } catch {
    return { ok: false, error: "parse_fail" };
  }
  return gateExtractorOutput(parsed);
}
