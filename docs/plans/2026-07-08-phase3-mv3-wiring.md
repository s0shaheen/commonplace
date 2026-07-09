# Phase 3 — Wire the Engine into the Extension (MV3 wiring)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A fresh TikTok capture flows capture → analyze → ground → library-data → export untouched by hand, emitting items that validate against the frozen `schema/` contract, surviving a service-worker kill mid-run, with the eval slice running in CI and a submit-ready (NOT submitted) CWS listing package.

**Architecture:** The existing MAIN-world/ISOLATED-world capture shell stays; a new esbuild build step compiles the TypeScript engine (`src/lib`) into the MV3 entrypoints. Canonical library data moves to IndexedDB (items + eager posters + jobs); a resumable, checkpointed queue runs in an **offscreen document** (it needs DOM for `<video>`/`<canvas>` keyframe extraction and blob-URL export) and drives each item through analyze (lane adapter: Gemini managed / Ollama local, over keyframes+VTT or native-video ingestion) → ground (MusicBrainz + Wikidata + flag-gated Places, LLM-select, NIL abstention) → open-schema record. Export, promptfoo replay eval in CI, and the CWS dry-run package sit on top.

**Tech Stack:** TypeScript 5.9 / vitest 2 (existing) · esbuild (new, build) · ajv + ajv-formats (new, schema validation: runtime Ajv in tests, **precompiled standalone validators** in the shipped extension — MV3 CSP bans `eval`/`new Function`) · idb + fake-indexeddb (new, storage + tests) · promptfoo (new devDep, CI eval slice) · GitHub Actions (new, CI). Python eval harness (`eval/`) is untouched.

## Normative sources (implementers MUST read the ones named in their task)

- `docs/specs/product-specification.md` §13–15 (engine lanes, grounding, measurement), §7 (capture), §10 (open schema), §18 (CWS), §25 (security posture). **SPEC governs on any conflict; flag conflicts in your report.**
- `docs/specs/knowledge-ontology.md` v3 — what emitted objects mean.
- `schema/json/*.schema.json` + `schema/vocab/*.json` — **the FROZEN contract (1.0.0-rc.5). It governs over `src/lib` types wherever they disagree.**
- `spikes/pipeline/RESULT.md` — feasibility evidence ONLY (the cascade decision is RETRACTED; see Global Constraints).

## Known SPEC-vs-roadmap conflicts (SPEC governs — encoded below)

1. **Cascade:** `roadmap.md` Phase 3 says "confidence-routed cascade per SPEC §13: keyframes+VTT default → native escalation", but SPEC §13/§15 **retracts** the cascade as a decision (invalid instrument) and defers the ingestion pick to the post-eval ablation (Phase 4). Resolution here: build **both ingestion paths behind a config flag** with `keyframes_vtt` as the *provisional* default (feasibility: ~8× cheaper, no reliability tail) and the native-escalation router present but **default OFF**. Phase 4's ablation sets the policy; no code change needed then, only config.
2. **CWS submission:** roadmap says "submit the early minimal listing"; the founder gate (assignment) says **prepared-not-submitted** ($5 dev account is founder provisioning). This plan prepares; submission is a founder click.

## Global Constraints (exact values; violations are review-rejects)

- **Model ID (managed lane), pinned:** `gemini-2.5-flash-lite` (SPEC §15: "the Block-0 pipeline experiment and early build run on `gemini-2.5-flash-lite` (pinned), migrating to 3.1 Flash-Lite the day it ships (zero code change)"). The model ID lives ONLY in `src/lib/config.ts` defaults. Local lane default model: `qwen3-vl:8b` via Ollama `http://localhost:11434` (SPEC §13: "Qwen3-VL … 8B default").
- **The iron rule (SPEC §13, verbatim): "the model never emits external IDs."** The extractor emits typed mentions; only `src/lib/grounding.ts` + resolvers produce external IDs. The extractor prompt and the extractor-output schema carry NO grounding fields.
- **NamedEntity `type` enum (exactly 9, frozen):** `music_recording · place · screen_work · book · person · product · brand_org · software_app · game`. `restaurant` is NOT a type (schema/vocab/named-entity-anchors.json: "absorbs 'restaurant' as a facet/subtype"). The old 10-type `EntityType` in `src/lib/types.ts` is retired by Task 1.
- **Channel enum (closed, 6):** `VERBAL_AUDIO · VERBAL_TEXT · VISUAL_SCENE · VISUAL_TEXT · NONVERBAL_AUDIO · STRUCTURED_METADATA`. **assertion_mode (4):** `STATED · SHOWN · REPORTED · INFERRED`.
- **Provenance rule:** every extraction carries `evidence[]` with `minItems: 1`; zero-evidence extractions are rejected (schema-validity is a **hard gate**, not a metric — invalid extractor output fails the item, it is never "repaired" silently).
- **Grounding invariant (extraction.schema.json):** `nil=false ⇒ externalId` is a non-null string; `nil=true ⇒ externalId` is null. A mention whose resolver is **unavailable** (Places key absent) gets `grounding` **absent** + a `regroundPending` marker — never a fake NIL (NIL means "we looked and abstain"; it is a measured headline metric).
- **Places behind interface + flag:** `google_places` resolver implements the existing `KbResolver` interface; constructed ONLY when `config.placesEnabled === true` AND a key is present in `chrome.storage.local`. Default `placesEnabled: false`. SKU discipline (SPEC §14): Text Search with `X-Goog-FieldMask: places.id,places.displayName` only; no Details calls in this phase; cache by `(normalizedQuery, type)` in IndexedDB.
- **Never commit secrets:** keys live in `chrome.storage.local` (set via the options page), never in source, never in `web_accessible_resources` (SPEC §25 — the closed key-exposure bug class gets a **named regression test**: `scripts/audit-dist.mjs`, Task 9). `src/secrets.js` + `src/gemini.js` are deleted. `.gitignore` keeps `src/secrets.js` as a tombstone guard.
- **Rate limits, client-side (SPEC §14):** MusicBrainz **1 request/second** (hard); Wikidata and Places behind the same `createRateLimiter(minIntervalMs)` at 200 ms. Every KB call sends `User-Agent`/api etiquette headers: `Commonplace/0.1 (https://commonplacehq.com)`.
- **Storage keys (canonical):** IndexedDB database `commonplace`, version `1`, object stores `items` (keyPath `id`), `posters` (keyPath `id`), `jobs` (keyPath `id`), `meta` (keyPath `key`). `chrome.storage.local` keys: `cp_config` (typed config), `count` (legacy scroll-progress counter — content.js reads it; keep). The legacy `items` key in `chrome.storage.local` is retired by Task 3 (IndexedDB is canonical).
- **Ingestion default is PROVISIONAL, not a decision:** `config.ingestion: "keyframes_vtt" | "native"` defaults to `"keyframes_vtt"`; `config.escalateNative` defaults to `false`. Comment in code MUST say the Phase-4 ablation sets policy (SPEC §15 retraction).
- **Bundler decision (defended):** **esbuild**, not WXT/Vite. Rationale: Phase 3 needs exactly "compile TS → MV3-loadable JS" with zero framework churn to the proven shell files; esbuild is one devDependency, one 60-line build script, CSP-safe output. WXT is SPEC §18's named multi-store tool — adopting it belongs to the multi-store phase (roadmap Phase 11 / Block 7) as its own decision; adopting it now would restructure every entrypoint mid-wiring. Flagged for controller ratification.
- **Schema validation choice (defended):** **ajv** (draft 2020-12 via `ajv/dist/2020`), not hand-rolled — the frozen schemas use `$ref` across files, `oneOf`/`allOf`, `unevaluatedProperties: false`, and conditional (`if/then`) grounding invariants; hand-rolling that is a correctness liability. In vitest/Node, Ajv runs normally. In the shipped extension, MV3 CSP forbids Ajv's runtime codegen → `scripts/build-validators.mjs` precompiles **standalone** validator modules at build time.
- **Test/TDD/commit conventions:** vitest for `src/**/*.test.ts` (existing include glob unchanged); the shell's `src/capture.test.js` stays on `node --test`. TDD (failing test first). One commit per task minimum, conventional-commit style (`feat(ext): …`, `feat(engine): …`, `chore(ci): …`). Never claim green without running the command and pasting output.
- **No blended numbers:** any metric surface added here (promptfoo slice) reports per-layer/per-assertion results only; never a single blended score (SPEC §15 / ontology §8).
- **No synthetic provenance:** every facet assignment (like every other extraction) carries REAL model-emitted `evidence[]` (schema rc.6, pre-Task-1). The pipeline never stamps invented channel/confidence values onto evidence; the only pipeline-stamped evidence field is `extractor_ref` (which records the pipeline itself — that's what it's for).

## File structure (end state; ★ = new)

```
manifest.json                     # rewritten: Commonplace dev shell, offscreen, options, dist/ paths
scripts/
  build.mjs                     ★ # esbuild bundling + static copy → dist/
  build-validators.mjs          ★ # ajv standalone precompile → src/lib/generated/
  package-cws.mjs               ★ # dist/ → commonplace-cws.zip
  audit-dist.mjs                ★ # named key-exposure regression audit
src/
  background.ts                 ★ # replaces background.js (capture intake, queue mgmt, export)
  content.js                      # modified: enrichment hotkey now triggers the queue
  main-world.js                   # unchanged
  capture.js / capture.test.js    # unchanged (pure normalize/dedupe)
  offscreen.html / offscreen.ts ★ # the pipeline runtime
  options.html / options.ts     ★ # BYO-key + lane/ingestion/places config
  lib/
    types.ts                      # migrated to the frozen contract (Task 1)
    ontology.ts                   # 9 types + facet vocab re-exported from schema/vocab
    prompts.ts                    # extractor prompt builder (extract@v1)
    geminiClient.ts               # ExtractorOutput parsing + hard schema gate
    ollamaClient.ts             ★ # local lane client
    lanes.ts                    ★ # EngineLane interface + router
    ingest.ts                   ★ # keyframe planning + offscreen extraction
    config.ts                   ★ # typed config over chrome.storage.local `cp_config`
    store.ts                    ★ # IndexedDB: items/posters/jobs/meta
    queue.ts                    ★ # pure resumable queue state machine
    rateLimiter.ts              ★
    selector.ts                 ★ # LLM "select" disambiguation
    groundItem.ts               ★ # mentions → grounded extractions for one item
    grounding.ts                  # types migrated; MusicBrainz moved out
    resolvers/
      musicbrainz.ts            ★ # moved from grounding.ts
      wikidata.ts               ★
      places.ts                 ★ # interface + flag; key drops in later
    exporters/
      openSchema.ts             ★ # → frozen item.schema.json records
      json.ts / csv.ts / obsidian.ts  # retyped to AnalyzedItem
    generated/                    # build artifact (gitignored): standalone validators
prompts/extract_v1.md           ★ # the extractor prompt (output = extractor-output.schema.json)
eval-promptfoo/                 ★ # replay provider + frozen fixtures + config
.github/workflows/ci.yml        ★
store/cws/                      ★ # listing.md, permissions.md, privacy-policy.md, checklist.md
```

---

### Task 1: Contract migration — retire the 10-type ontology; `src/lib` speaks the frozen schema

The frozen schema (9 NamedEntity types + referent kinds + required evidence) replaces the old 10-type `EntityType`/`Enrichment` world. Everything downstream depends on this. **Parallel-safe with Task 2.**

**Files:**
- Modify: `src/lib/types.ts`, `src/lib/ontology.ts`, `src/lib/geminiClient.ts`, `src/lib/prompts.ts`, `src/lib/grounding.ts`, `src/lib/entities.ts`, `src/lib/enrich.ts` (renamed export surface; file becomes `analyze` orchestration in Task 4 — here only types compile), `src/lib/exporters/{json,csv,obsidian}.ts`
- Create: `prompts/extract_v1.md`
- Test: `src/lib/ontology.test.ts` (new), `src/lib/geminiClient.test.ts` (rewrite), `src/lib/prompts.test.ts` (rewrite), `src/lib/entities.test.ts` (update), `src/lib/grounding.test.ts` (update), `src/lib/exporters/*.test.ts` (update), `src/lib/schemaConformance.test.ts` (new — validates against the REAL `schema/json` files with Ajv)
- **Old tests' disposition (explicit):** `enrich.test.ts` — DELETE (its `Enrichment`-shape orchestration is replaced by Task 4's `lanes.test.ts`; the merge/tier semantics it tested no longer exist). `geminiClient.test.ts`, `prompts.test.ts` — REWRITE against `ExtractorOutput`. `entities.test.ts`, `grounding.test.ts` — UPDATE type names only (`"media"` → `"music_recording"`, `"restaurant"` cases become `"place"`); their behavioral assertions stand. `mediaFetch.test.ts`, `capture.test.js` — UNTOUCHED.

**Interfaces:**
- Produces (in `types.ts`; these mirror `schema/json/extractor-output.schema.json` exactly — field names are the schema's, not new inventions):
```ts
export type NamedEntityType = "music_recording"|"place"|"screen_work"|"book"|"person"|"product"|"brand_org"|"software_app"|"game";
export type Channel = "VERBAL_AUDIO"|"VERBAL_TEXT"|"VISUAL_SCENE"|"VISUAL_TEXT"|"NONVERBAL_AUDIO"|"STRUCTURED_METADATA";
export type AssertionMode = "STATED"|"SHOWN"|"REPORTED"|"INFERRED";
export interface EvidenceOut { channel: Channel; assertion_mode: AssertionMode; confidence: number; source_role?: string; quote?: string; t_start?: number; t_end?: number; }
export interface MentionOut { surface: string; type: NamedEntityType; aliases?: string[]; evidence: EvidenceOut[]; }
export interface ConceptOut { surface: string; evidence: EvidenceOut[]; }
export interface ClaimOut { statement: string; evidence: EvidenceOut[]; }
export interface StructuredOut { schemaOrgType: string; slots?: {name:string; value:string}[]; steps?: {order:number; text:string}[]; evidence: EvidenceOut[]; }
export type FacetName = "affect"|"topic"|"genre"|"intent"|"creator_role"|"viewer_orientation"|"presentation"|"content_provenance"|"actionability";
export interface FacetAssignmentOut { facet: FacetName; value: string; evidence: EvidenceOut[]; }   // rc.6: facets carry REAL model evidence
export interface ExtractorOutput { mentions: MentionOut[]; concepts: ConceptOut[]; facets: FacetAssignmentOut[]; claims: ClaimOut[]; structured: StructuredOut[]; }
export interface Analysis { output: ExtractorOutput; lane: "managed"|"local"; ingestion: "keyframes_vtt"|"native"; model: string; promptVersion: string; analyzedAt: string; }
export interface AnalyzedItem extends CapturedItem { analysis: Analysis; }
export type ExtractorResult = { ok: true; output: ExtractorOutput } | { ok: false; error: string };  // result-object convention preserved
```
`CapturedItem` is unchanged. Delete `EntityType`, `Entity`, `Enrichment`, `EnrichedItem`, `EnrichmentTier`, `GeminiResult`, `EntityIndexEntry` (replaced by `MentionIndexEntry { key; type: NamedEntityType; surface; itemIds: string[] }`).
- Produces (`ontology.ts`): `NAMED_ENTITY_TYPES: readonly NamedEntityType[]` (9, in schema order) · `isNamedEntityType(v: string): v is NamedEntityType` · `typeToAuthority(t: NamedEntityType): "musicbrainz"|"google_places"|"wikidata"` (from `schema/vocab/named-entity-anchors.json`: music_recording→musicbrainz, place→google_places, everything else→wikidata; `book` primary wikidata) · `FACETS` re-exported by reading `schema/vocab/facets.json` (resolveJsonModule is on).
- Produces (`geminiClient.ts`): `parseExtractorResponse(json: unknown): ExtractorResult` — extracts `candidates[0].content.parts[0].text`, strips fences, `JSON.parse`, then **hard-gates**: shape-checks all five top-level arrays/object, every mention type via `isNamedEntityType`, every evidence array non-empty with valid channel/assertion_mode and `0 ≤ confidence ≤ 1`. Any violation ⇒ `{ ok:false, error:"schema_invalid" }`. Also `buildGenerationConfig(): { temperature: 0; responseMimeType: "application/json"; responseSchema: object }` where `responseSchema` is produced by `toGeminiResponseSchema()` — a documented transform of `schema/json/extractor-output.schema.json` that strips keywords Gemini's OpenAPI subset rejects (`additionalProperties`, `$schema`, `$id`) and keeps `type/enum/items/properties/required/minItems/minimum/maximum`. Constrained decoding is best-effort; `parseExtractorResponse` is the enforcement.
- Produces (`prompts.ts`): `buildExtractorPrompt(base: string, item: CapturedItem, transcript: string): string` — appends a `CONTEXT` block (caption, hashtags, creator, music name/author, transcript-if-present) to `prompts/extract_v1.md`. `PROMPT_VERSION = "extract@v1"`.
- Modify (`grounding.ts`): `Mention` becomes `{ surface: string; type: NamedEntityType; hints?: Record<string,string> }`; `KbSource = "musicbrainz"|"wikidata"|"places"` (drop `tmdb` — SPEC §14: TMDB's API is never called; screen_work grounds to Wikidata QID). MusicBrainz resolver + parser MOVE to `src/lib/resolvers/musicbrainz.ts` with `handles: (t) => t === "music_recording"`. Everything else in `grounding.ts` (groundMention, abstain, Selector, GroundingDeps) is unchanged.

**Steps:**

- [ ] 1. Write `prompts/extract_v1.md`. Content requirements (full prompt text is written in this step, not referenced): role = precise content analyst for a personal archive; **emit ONLY JSON matching the five-key shape** `{mentions, concepts, facets, claims, structured}`; the 9 mention types listed with one-line definitions ("place — a specific named venue/locale; a restaurant is a place"); every element MUST carry ≥1 evidence `{channel, assertion_mode, confidence, quote?, source_role?, t_start?, t_end?}` with the 6 channels + 4 assertion modes enumerated and defined; **NEVER output external IDs (no MBID/QID/place_id)** — the "never emit IDs" line appears verbatim; NIL-honesty instruction ("omit rather than guess; confidence reflects evidence, use the full 0–1 range"); facets as a single flat object using only values from `schema/vocab/facets.json` (paste the value lists inline); claims = the video's takeaway theses grounded to evidence spans, never world-truth; structured content = schema.org type + slots/steps. Port the good CRITICAL INSTRUCTIONS from `prompts/observe_video.md` (specificity, on-screen-text verbatim, non-English transcribe+translate, honest self-assessment) — but the output shape is ONLY the new five-key object. Mark old `prompts/observe_video*.md` files with a first-line `> SUPERSEDED by extract_v1.md (Phase 3)` (do not delete — Phase-2 pilot may reference them).
- [ ] 2. Write `src/lib/ontology.test.ts` FIRST (failing):
```ts
import { describe, it, expect } from "vitest";
import { NAMED_ENTITY_TYPES, isNamedEntityType, typeToAuthority, FACETS } from "./ontology.js";

describe("frozen ontology", () => {
  it("has exactly the 9 frozen NamedEntity types, in schema order", () => {
    expect(NAMED_ENTITY_TYPES).toEqual([
      "music_recording","place","screen_work","book","person","product","brand_org","software_app","game",
    ]);
  });
  it("rejects the retired types", () => {
    expect(isNamedEntityType("restaurant")).toBe(false); // absorbed into place (anchors vocab)
    expect(isNamedEntityType("media")).toBe(false);
    expect(isNamedEntityType("recipe")).toBe(false);     // recipe is StructuredContent, not an entity
    expect(isNamedEntityType("place")).toBe(true);
  });
  it("routes types to the frozen authorities", () => {
    expect(typeToAuthority("music_recording")).toBe("musicbrainz");
    expect(typeToAuthority("place")).toBe("google_places");
    expect(typeToAuthority("screen_work")).toBe("wikidata");
    expect(typeToAuthority("book")).toBe("wikidata");
    expect(typeToAuthority("game")).toBe("wikidata");
  });
  it("facet vocab comes from the frozen file", () => {
    expect(FACETS.topic).toContain("food");
    expect(FACETS.actionability).toContain("ragebait_suspect");
    expect(Object.keys(FACETS)).toHaveLength(9);
  });
});
```
- [ ] 3. Write `src/lib/schemaConformance.test.ts` — the REAL-schema gate (add devDeps first: `npm i -D ajv ajv-formats`):
```ts
import { describe, it, expect } from "vitest";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { ExtractorOutput } from "./types.js";

const root = join(__dirname, "..", "..");
const load = (f: string) => JSON.parse(readFileSync(join(root, "schema", "json", f), "utf8"));
const ajv = new Ajv2020({ strict: false });
addFormats(ajv);
const validate = ajv.compile(load("extractor-output.schema.json"));

const minimal: ExtractorOutput = { mentions: [], concepts: [], facets: [], claims: [], structured: [] };
const grounded: ExtractorOutput = {
  mentions: [{ surface: "Kill Bill", type: "music_recording",
    evidence: [{ channel: "VERBAL_AUDIO", assertion_mode: "SHOWN", confidence: 0.9, t_start: 12, t_end: 19 }] }],
  concepts: [], claims: [], structured: [],
  facets: [{ facet: "topic", value: "entertainment",
    evidence: [{ channel: "VISUAL_SCENE", assertion_mode: "INFERRED", confidence: 0.8 }] }],
};

describe("ExtractorOutput conforms to the FROZEN extractor-output.schema.json", () => {
  it("accepts the empty-but-complete output", () => expect(validate(minimal)).toBe(true));
  it("accepts a typed mention with evidence", () => expect(validate(grounded)).toBe(true));
  it("rejects a zero-evidence mention (hard gate)", () => {
    expect(validate({ ...minimal, mentions: [{ surface: "x", type: "place", evidence: [] }] })).toBe(false);
  });
  it("rejects the retired 'restaurant' type", () => {
    expect(validate({ ...minimal, mentions: [{ surface: "x", type: "restaurant",
      evidence: [{ channel: "VISUAL_TEXT", assertion_mode: "SHOWN", confidence: 1 }] }] })).toBe(false);
  });
});
```
- [ ] 4. Implement `types.ts` + `ontology.ts` per Interfaces; run `npx vitest run src/lib/ontology.test.ts src/lib/schemaConformance.test.ts` → expect `2 passed` test files, 8 tests.
- [ ] 5. Rewrite `geminiClient.ts` (`parseExtractorResponse`, `buildGenerationConfig`, `toGeminiResponseSchema`, keep `buildTextBody`/`buildMediaBody`/`stripFences`) and `geminiClient.test.ts`: cases = happy path (a full Gemini envelope whose text is `JSON.stringify(grounded)` from step 3 → `ok:true`, `output.mentions[0].type === "music_recording"`); fenced JSON accepted; `empty_response`; `parse_fail`; mention with type `"restaurant"` ⇒ `{ok:false, error:"schema_invalid"}`; evidence confidence `1.5` ⇒ `schema_invalid`; `toGeminiResponseSchema()` output contains no `additionalProperties` key anywhere (recursive scan) and keeps the 9-value type enum.
- [ ] 6. Rewrite `prompts.ts` + tests (prompt contains the base text, caption, `#ironman` hashtag rendering, transcript block present/absent); update `grounding.ts` types + create `src/lib/resolvers/musicbrainz.ts` (move `parseMusicBrainzRecordings` + `createMusicBrainzResolver`, `handles: t => t === "music_recording"`); update `grounding.test.ts` imports and every `"media"` literal → `"music_recording"`; update `entities.ts` (`mentionKey(m: {type,surface})`, `dedupeMentions` merges aliases, `buildMentionIndex(items: AnalyzedItem[])`) + tests; retype exporters (`json.ts`: bundle `{version: 2, schema: "commonplace/1.0.0-rc.5", items, mentions: buildMentionIndex(items)}`; `csv.ts` entity columns from `analysis.output.mentions` as `type:surface`; `obsidian.ts` front-matter `lane:` instead of `tier:`) + update their tests' fixtures to `AnalyzedItem` with hand-built `ExtractorOutput`s.
- [ ] 7. Full gate: `npm run typecheck && npm test` → expect all vitest files green (0 failures; enrich.test.ts deleted this task); `npm run test:spike -- src/capture.test.js` → `pass 8`. Commit `feat(engine): migrate src/lib to the frozen 9-type schema contract`.

---

### Task 2: Build toolchain (esbuild) + manifest + options/config

**Parallel-safe with Task 1** (touches no `src/lib` types except new `config.ts`).

**Files:**
- Create: `scripts/build.mjs`, `scripts/build-validators.mjs`, `src/options.html`, `src/options.ts`, `src/lib/config.ts`
- Modify: `manifest.json`, `package.json`, `.gitignore` (add `dist/`, `src/lib/generated/`), `src/content.js` (drop `runEnrichment` + the dynamic `src/gemini.js` import; Alt+Shift+E now sends `{kind:"queue_start"}`)
- Delete: `src/gemini.js`, `src/secrets.example.js` (BYO-key moves to options; `.gitignore` keeps the `src/secrets.js` line)
- Test: `src/lib/config.test.ts`

**Interfaces:**
- Produces (`config.ts`):
```ts
export interface CpConfig {
  geminiKey: string | null;
  engineLane: "managed" | "local";        // default "managed"
  localModel: string;                      // default "qwen3-vl:8b"
  localEndpoint: string;                   // default "http://localhost:11434"
  managedModel: string;                    // default "gemini-2.5-flash-lite" (pinned, SPEC §15)
  ingestion: "keyframes_vtt" | "native";  // default "keyframes_vtt" — PROVISIONAL (Phase-4 ablation decides)
  escalateNative: boolean;                 // default false — cascade retracted (SPEC §13)
  placesEnabled: boolean;                  // default false — key not provisioned
  placesKey: string | null;                // default null
  concurrency: number;                     // default 2
}
export const DEFAULT_CONFIG: CpConfig;
export async function loadConfig(storage: StorageLike): Promise<CpConfig>;   // merge stored partial over defaults
export async function saveConfig(storage: StorageLike, patch: Partial<CpConfig>): Promise<CpConfig>;
export interface StorageLike { get(k: string): Promise<Record<string, unknown>>; set(o: Record<string, unknown>): Promise<void>; } // chrome.storage.local satisfies this
```
- Produces (`scripts/build.mjs`): esbuild `build()` with entryPoints `{ background: "src/background.ts", offscreen: "src/offscreen.ts", options: "src/options.ts" }` (format `esm`, bundle, target `chrome120`, outdir `dist/`), plus `content.js`/`main-world.js`/`capture.js` bundled iife → `dist/`, plus static copies: `manifest.json`, `rules.json`, `src/options.html`, `src/offscreen.html`, `prompts/extract_v1.md` → `dist/prompts/`. Runs `build-validators.mjs` first. `--watch` flag supported.
- Produces (`scripts/build-validators.mjs`): Ajv2020 + `ajv/dist/standalone` compiling `schema/json/item.schema.json` (with `extraction.schema.json` pre-registered via `ajv.addSchema`) and `extractor-output.schema.json` → `src/lib/generated/validators.js` exporting `validateItem(o): boolean` (+`validateItem.errors`) and `validateExtractorOutput(o): boolean`. No `eval` in output (that is the point).
- Modify (`manifest.json`): `"name": "Commonplace (dev)"`, `"version": "0.1.0"`, permissions `["storage","downloads","unlimitedStorage","declarativeNetRequest","offscreen","alarms"]`, background `dist/background.js` (`"type":"module"`), content scripts → `dist/main-world.js` / `dist/content.js` (same worlds/run_at), `options_page: "dist/options.html"`, **`web_accessible_resources` REMOVED entirely** (prompt is bundled; SPEC §25), host_permissions unchanged + `https://musicbrainz.org/*`, `https://www.wikidata.org/*`, `https://places.googleapis.com/*` (Places host declared now so the key drop-in needs no re-review), `https://generativelanguage.googleapis.com/*` kept, `http://localhost/*` for Ollama.
- Modify (`package.json` scripts): `"build": "node scripts/build-validators.mjs && node scripts/build.mjs"`, `"dev": "npm run build -- --watch"`, devDeps + `esbuild`, `ajv`, `ajv-formats`.

**Steps:**

- [ ] 1. Write `src/lib/config.test.ts` FIRST:
```ts
import { describe, it, expect } from "vitest";
import { DEFAULT_CONFIG, loadConfig, saveConfig, type StorageLike } from "./config.js";

function memStorage(seed: Record<string, unknown> = {}): StorageLike & { data: Record<string, unknown> } {
  const data = { ...seed };
  return { data,
    async get(k) { return k in data ? { [k]: data[k] } : {}; },
    async set(o) { Object.assign(data, o); } };
}

describe("cp_config", () => {
  it("pins the frozen defaults", () => {
    expect(DEFAULT_CONFIG.managedModel).toBe("gemini-2.5-flash-lite");
    expect(DEFAULT_CONFIG.ingestion).toBe("keyframes_vtt");
    expect(DEFAULT_CONFIG.escalateNative).toBe(false);
    expect(DEFAULT_CONFIG.placesEnabled).toBe(false);
    expect(DEFAULT_CONFIG.concurrency).toBe(2);
  });
  it("loadConfig merges a stored partial over defaults", async () => {
    const s = memStorage({ cp_config: { engineLane: "local", geminiKey: "k" } });
    const c = await loadConfig(s);
    expect(c.engineLane).toBe("local");
    expect(c.geminiKey).toBe("k");
    expect(c.managedModel).toBe("gemini-2.5-flash-lite"); // default survives
  });
  it("saveConfig round-trips a patch under the cp_config key", async () => {
    const s = memStorage();
    await saveConfig(s, { placesEnabled: true, placesKey: "pk" });
    expect((s.data.cp_config as any).placesEnabled).toBe(true);
    expect((await loadConfig(s)).placesKey).toBe("pk");
  });
});
```
- [ ] 2. Implement `config.ts`; `npx vitest run src/lib/config.test.ts` → 3 tests pass.
- [ ] 3. Write `scripts/build-validators.mjs` + `scripts/build.mjs` per Interfaces; write `src/options.html` (a plain form: Gemini key password input, lane radio, ingestion radio, escalate checkbox (disabled + "set by Phase-4 ablation" label), Places key + enable checkbox, Save button — no framework, no styling beyond `<style>` basics) and `src/options.ts` (loadConfig → populate; submit → saveConfig via real `chrome.storage.local`).
- [ ] 4. Temporary bridge so build succeeds before Tasks 3–6 land: create `src/background.ts` as a direct TS port of today's `background.js` (same message handlers, still `chrome.storage.local` items — Task 3 replaces the internals) and an empty-shell `src/offscreen.ts`/`offscreen.html` (logs "offscreen ready"). Update `src/content.js` per Files.
- [ ] 5. Run `npm run build` → expect `dist/` containing `background.js, content.js, main-world.js, offscreen.html, offscreen.js, options.html, options.js, manifest.json, rules.json, prompts/extract_v1.md` and `src/lib/generated/validators.js` created. Run `node -e "const v=require('./src/lib/generated/validators.js'); console.log(typeof v.validateItem)"` → `function`.
- [ ] 6. Manual smoke (evidence, not vibes): load `dist/` unpacked in Chrome → service worker console shows no errors; options page saves and reloads config. Paste console output in the task report. Commit `feat(ext): esbuild toolchain, Commonplace manifest, BYO-key options page`.

---

### Task 3: Storage layer — IndexedDB library + eager posters

**Depends on Tasks 1–2.**

**Files:**
- Create: `src/lib/store.ts`
- Modify: `src/background.ts` (capture intake writes through the store; eager poster fetch), `package.json` (deps `idb`; devDeps `fake-indexeddb`)
- Test: `src/lib/store.test.ts`

**Interfaces:**
- Produces (`store.ts`; DB `commonplace` v1, stores per Global Constraints):
```ts
export interface LibraryRecord { id: string; item: CapturedItem; status: "raw"|"analyzed"|"grounded"; analysis?: Analysis;
  groundings?: GroundedEntity[]; regroundPending?: NamedEntityType[]; posterRef?: string; updatedAt: string; }
export interface JobRecord { id: string; itemId: string; status: "pending"|"analyzing"|"grounding"|"done"|"failed";
  attempts: number; nextAttemptAt: number; lastError?: string; }
export function openStore(dbName?: string): Promise<CpStore>;
export interface CpStore {
  upsertItems(items: CapturedItem[], nowIso: string): Promise<{ added: number; merged: number }>; // mergeDedupe semantics: union sources, keep freshest
  getRecord(id: string): Promise<LibraryRecord | undefined>;
  allRecords(): Promise<LibraryRecord[]>;
  saveAnalysis(id: string, analysis: Analysis): Promise<void>;                  // status → "analyzed"
  saveGroundings(id: string, g: GroundedEntity[], pending: NamedEntityType[]): Promise<void>; // status → "grounded"
  putPoster(id: string, blob: Blob): Promise<string>;   // returns posterRef `poster:${id}`; also sets record.posterRef
  getPoster(id: string): Promise<Blob | undefined>;
  putJobs(jobs: JobRecord[]): Promise<void>; getJobs(): Promise<JobRecord[]>; putJob(j: JobRecord): Promise<void>;
  getMeta<T>(key: string): Promise<T | undefined>; setMeta<T>(key: string, v: T): Promise<void>; // grounding cache lives here
  count(): Promise<number>;
}
```
- Modify (`background.ts`): on `{kind:"item_list"}` → `extractItems` (unchanged pure fn) → `store.upsertItems` → `chrome.storage.local.set({ count })` (content.js contract preserved) → for each NEW id with a `cover` URL, fetch the poster eagerly (`fetch(cover)` → `store.putPoster`; failures logged, non-fatal — signed URLs expire in hours, this is the whole point). The legacy `chrome.storage.local` `items` array is no longer written; a one-shot migration on startup imports any existing `items` array into the store then deletes the key.

**Steps:**

- [ ] 1. Write `src/lib/store.test.ts` FIRST (vitest, `import "fake-indexeddb/auto";` at top; fresh DB name per test via `openStore("test-" + crypto.randomUUID())`). Cases with hand-computed expectations:
```ts
// (imports + a mkItem(id, over?) helper building a minimal CapturedItem)
it("upsertItems dedupes by id and unions sources", async () => {
  const s = await openStore("t1");
  await s.upsertItems([mkItem("a", { sources: ["favorites"] })], "2026-07-08T00:00:00Z");
  const r = await s.upsertItems([mkItem("a", { sources: ["likes"] }), mkItem("b", { sources: ["likes"] })], "2026-07-08T00:01:00Z");
  expect(r).toEqual({ added: 1, merged: 1 });
  expect((await s.getRecord("a"))!.item.sources.sort()).toEqual(["favorites", "likes"]);
  expect(await s.count()).toBe(2);
});
it("saveAnalysis advances status raw→analyzed; saveGroundings →grounded with pending types", async () => { /* asserts status transitions + regroundPending === ["place"] */ });
it("putPoster stores the blob and stamps posterRef", async () => {
  const s = await openStore("t3");
  await s.upsertItems([mkItem("a")], "2026-07-08T00:00:00Z");
  const ref = await s.putPoster("a", new Blob(["x"], { type: "image/jpeg" }));
  expect(ref).toBe("poster:a");
  expect((await s.getPoster("a"))!.type).toBe("image/jpeg");
  expect((await s.getRecord("a"))!.posterRef).toBe("poster:a");
});
it("jobs and meta round-trip", async () => { /* putJobs 2 → getJobs length 2; setMeta/getMeta typed round-trip */ });
```
- [ ] 2. `npm i idb && npm i -D fake-indexeddb`; implement `store.ts` (idb `openDB` with `upgrade` creating the 4 stores); `npx vitest run src/lib/store.test.ts` → 4 tests pass.
- [ ] 3. Rewire `background.ts` per Interfaces (poster fetch bounded: max 3 concurrent, skip if poster exists). Keep `exportData` for now (Task 7 replaces it).
- [ ] 4. `npm run typecheck && npm test && npm run build` → green. Manual smoke on a real TikTok favorites scroll (founder session): service-worker console shows `+N from favorites` and `posters stored: N`; DevTools → Application → IndexedDB shows `commonplace/items` + `posters` rows. Paste evidence. Commit `feat(ext): IndexedDB library store + eager poster capture`.

---

### Task 4: Engine lanes + ingestion (keyframes+VTT default, native behind flag)

**Depends on Task 1. Parallel-safe with Tasks 3 and 5.**

**Files:**
- Create: `src/lib/lanes.ts`, `src/lib/ingest.ts`, `src/lib/ollamaClient.ts`
- Modify: `src/lib/enrich.ts` → DELETE (superseded; its subtitle-fallback behavior moves into `lanes.ts`), `src/lib/mediaFetch.ts` (add `fetchPosterFrames` no changes to existing fns)
- Test: `src/lib/lanes.test.ts`, `src/lib/ingest.test.ts`, `src/lib/ollamaClient.test.ts`

**Interfaces:**
```ts
// ingest.ts — pure planning is tested; DOM extraction runs only in the offscreen document.
export function keyframeTimes(durationSec: number | null, n?: number): number[];
// n default 6. duration d>0: [(i+0.5)*d/n] for i in 0..n-1, rounded to 3 dp. duration null/0: [1] (poster-adjacent single frame).
export async function extractKeyframes(videoBlob: Blob, times: number[], doc: Document): Promise<MediaPart[]>;
// offscreen-only: blob URL → <video> seek → <canvas> drawImage → toDataURL("image/jpeg", 0.7) → base64 MediaPart. Returns [] on decode failure.

// lanes.ts
export interface AnalyzeInput { item: CapturedItem; transcript: string; keyframes: MediaPart[]; videoBytes: MediaPart | null; }
export interface EngineLane { id: "managed"|"local"; analyze(input: AnalyzeInput, ingestion: "keyframes_vtt"|"native"): Promise<ExtractorResult>; }
export function createGeminiLane(deps: { fetchJson(url: string, init: RequestInit): Promise<unknown>; key: string; model: string; basePrompt: string }): EngineLane;
// keyframes_vtt → buildMediaBody(prompt(with transcript), keyframes); native → buildMediaBody(prompt(no transcript inline — audio is in the video), [videoBytes]).
// URL: https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent — key sent via `x-goog-api-key` HEADER, never query string (keys in URLs leak into logs).
export function createOllamaLane(deps: { fetchJson(url: string, init: RequestInit): Promise<unknown>; endpoint: string; model: string; basePrompt: string }): EngineLane;
// POST ${endpoint}/api/chat, { model, stream:false, format: <toGeminiResponseSchema()-equivalent plain JSON schema>, messages:[{role:"user", content: prompt, images: keyframes.map(k=>k.data)}] }.
// native ingestion on local lane → { ok:false, error:"native_unsupported_local" } (open VLMs are deaf; SPEC §13).
export function routeIngestion(item: CapturedItem, cfg: CpConfig): "keyframes_vtt"|"native";
// cfg.ingestion === "native" → "native" (managed lane only; local falls back keyframes_vtt).
// else "keyframes_vtt"; if cfg.escalateNative && !item.hasSubtitles && cfg.engineLane==="managed" → "native"  (the ONLY heuristic; default flag false).
export async function analyzeItem(input: AnalyzeInput, cfg: CpConfig, lanes: Record<"managed"|"local", EngineLane>): Promise<{ result: ExtractorResult; lane: "managed"|"local"; ingestion: "keyframes_vtt"|"native" }>;
```

**Steps:**

- [ ] 1. `src/lib/ingest.test.ts` FIRST — hand-computed:
```ts
it("keyframeTimes spaces n midpoints over the duration", () => {
  expect(keyframeTimes(29, 6)).toEqual([2.417, 7.25, 12.083, 16.917, 21.75, 26.583]); // (i+0.5)*29/6
  expect(keyframeTimes(10, 2)).toEqual([2.5, 7.5]);
  expect(keyframeTimes(null)).toEqual([1]);
  expect(keyframeTimes(0)).toEqual([1]);
});
```
- [ ] 2. `src/lib/lanes.test.ts` FIRST — with a `fetchJson` fake capturing `(url, init)` and returning a canned Gemini envelope whose text is a valid `ExtractorOutput`:
  - Gemini keyframes_vtt: body parts = 6 `inlineData` images then 1 text part; the text contains the transcript; `generationConfig.temperature === 0`; URL ends `/models/gemini-2.5-flash-lite:generateContent`; `init.headers["x-goog-api-key"] === "k"`; result `ok:true`.
  - Gemini native: exactly 1 `inlineData` (mimeType `video/mp4`) + 1 text part; the text does NOT contain the transcript string.
  - Gemini invalid model text (`"restaurant"` mention) → `ok:false, error:"schema_invalid"` (hard gate holds through the lane).
  - Ollama keyframes_vtt: URL `http://localhost:11434/api/chat`; body `model:"qwen3-vl:8b"`, `stream:false`, `format.properties.mentions` present, `messages[0].images.length === 6`.
  - Ollama native → `{ok:false, error:"native_unsupported_local"}` without calling fetchJson (`expect(calls).toHaveLength(0)`).
  - `routeIngestion`: default cfg → `"keyframes_vtt"` (with and without subtitles — escalation OFF is the retraction made testable); `{...DEFAULT_CONFIG, escalateNative:true}` + `hasSubtitles:false` → `"native"`; `{...DEFAULT_CONFIG, ingestion:"native", engineLane:"local"}` → `"keyframes_vtt"`.
- [ ] 3. `src/lib/ollamaClient.test.ts`: `parseOllamaResponse({message:{content: JSON.stringify(validOutput)}})` → `ok:true`; garbage content → `parse_fail`; schema-violating content → `schema_invalid` (reuses the same hard gate as Gemini — export a shared `gateExtractorOutput(parsed: unknown): ExtractorResult` from `geminiClient.ts` and call it from both clients).
- [ ] 4. Implement `ingest.ts`, `lanes.ts`, `ollamaClient.ts`; delete `enrich.ts` + `enrich.test.ts`. `npm run typecheck && npm test` → green. Commit `feat(engine): lane adapters (Gemini managed / Ollama local) + provisional keyframes_vtt ingestion router`.

---

### Task 5: Resolvers — Wikidata + flag-gated Places join MusicBrainz; LLM select; per-item grounding

**Depends on Task 1. Parallel-safe with Tasks 3 and 4.**

**Files:**
- Create: `src/lib/resolvers/wikidata.ts`, `src/lib/resolvers/places.ts`, `src/lib/selector.ts`, `src/lib/groundItem.ts`, `src/lib/rateLimiter.ts`
- Test: `src/lib/resolvers/wikidata.test.ts`, `src/lib/resolvers/places.test.ts`, `src/lib/selector.test.ts`, `src/lib/groundItem.test.ts`, `src/lib/rateLimiter.test.ts`

**Interfaces:**
```ts
// wikidata.ts — free, keyless. Candidate generator = the KB search endpoint (SPEC §14).
export function createWikidataResolver(deps: { fetchJson(url: string, headers?: Record<string,string>): Promise<unknown> }): KbResolver;
// handles: screen_work | book | person | product | brand_org | software_app | game
// URL: https://www.wikidata.org/w/api.php?action=wbsearchentities&search=<surface>&language=en&format=json&type=item&limit=5&origin=*
export function parseWikidataSearch(json: unknown): Candidate[]; // {search:[{id,label,description}]} → {id, source:"wikidata", name:label, meta:{description}}

// places.ts — the drop-in-later resolver. NEVER constructed without a key (Global Constraints).
export function createPlacesResolver(deps: { fetchJson(url: string, init: RequestInit): Promise<unknown>; key: string }): KbResolver;
// handles: place. POST https://places.googleapis.com/v1/places:searchText
// headers: { "Content-Type":"application/json", "X-Goog-Api-Key": key, "X-Goog-FieldMask": "places.id,places.displayName" }
// body: { textQuery: surface + (hints.locale ? ", "+hints.locale : ""), pageSize: 5 }
export function parsePlacesSearch(json: unknown): Candidate[]; // {places:[{id, displayName:{text}}]} → {id, source:"places", name}

// selector.ts — SPEC §14: "one batched LLM select over candidates with clip context".
export function createLlmSelector(callModel: (prompt: string) => Promise<string>): Selector;
// Prompt: mention {surface,type,hints} + numbered candidates (name + meta) + clip caption; instruct: reply ONLY {"index": <int>, "confidence": <0..1>} or {"index": null} to abstain.
// Parse: index null|out-of-range|NaN → null (abstain). Malformed reply → null (abstain — never throw).

// rateLimiter.ts
export function createRateLimiter(minIntervalMs: number): <T>(fn: () => Promise<T>) => Promise<T>; // serializes; enforces spacing

// groundItem.ts — the per-item orchestration.
export interface GroundItemResult { groundings: GroundedEntity[]; regroundPending: NamedEntityType[]; }
export async function groundItemMentions(item: CapturedItem, mentions: MentionOut[], deps: GroundingDeps & { cacheGet(k:string):Promise<GroundedEntity|undefined>; cachePut(k:string,g:GroundedEntity):Promise<void>; }): Promise<GroundItemResult>;
// mention → Mention {surface, type, hints}: music_recording gets hints.artist from item.music?.author; place gets hints.locale from caption geo words if present (v1: none — hints optional).
// dedupe by mentionKey before resolving (50 saves of one song = 1 lookup). Cache key: `${type}:${normalizeName(surface)}`.
// type with no available resolver (place while Places disabled) → collect in regroundPending, DO NOT emit a GroundedEntity.
```

**Steps:**

- [ ] 1. `wikidata.test.ts` FIRST: `parseWikidataSearch({search:[{id:"Q3577037",label:"Dune",description:"2021 film by Denis Villeneuve"}]})` → one candidate `{id:"Q3577037",source:"wikidata",name:"Dune",meta:{description:"2021 film by Denis Villeneuve"}}`; empty/missing `search` → `[]`; resolver `handles("screen_work")===true`, `handles("place")===false`, `handles("music_recording")===false`; `search({surface:"Dune", type:"screen_work"})` calls a URL containing `wbsearchentities` and `search=Dune`.
- [ ] 2. `places.test.ts` FIRST: `parsePlacesSearch({places:[{id:"ChIJN1t_tDeuEmsRUsoyG83frY4",displayName:{text:"Lucali"}}]})` → `{id:"ChIJN1t_tDeuEmsRUsoyG83frY4",source:"places",name:"Lucali"}`; `search` sends POST with `X-Goog-FieldMask: "places.id,places.displayName"` and `X-Goog-Api-Key: "pk"` (assert BOTH headers verbatim — this is the SKU discipline made testable); `handles("place")===true` only.
- [ ] 3. `selector.test.ts` FIRST: reply `'{"index":0,"confidence":0.85}'` → `{index:0,confidence:0.85}`; `'{"index":null}'` → `null`; `'not json'` → `null`; `'{"index":7,"confidence":0.9}'` with 3 candidates → `null` (out of range = abstain).
- [ ] 4. `rateLimiter.test.ts` FIRST (vi.useFakeTimers): two calls through a 1000 ms limiter — second resolves only after `vi.advanceTimersByTime(1000)`; results preserve order.
- [ ] 5. `groundItem.test.ts` FIRST — fakes for resolvers/selector/cache; hand-computed:
  - mentions `[music "Kill Bill" (×2 duplicate), screen_work "Dune", place "Lucali"]`, Places DISABLED, MB resolver returns 1 candidate id `"mbid-1"`, selector picks `{index:0, confidence:0.93}`, Wikidata returns 0 candidates:
    `groundings.length === 2`; the music grounding `{resolved:true, id:"mbid-1", confidence:0.93}`; the Dune grounding `{resolved:false, id:null}` (honest NIL, `candidateCount:0`); `regroundPending === ["place"]`; MB resolver `search` called ONCE (dedupe) ; cachePut called for both resolved+NIL.
  - second run with cache seeded → resolver never called (`calls === 0`), same groundings from cache.
  - selector confidence `0.3` (< default gate 0.5) → NIL with `confidence: 0.3` recorded (calibration needs it).
- [ ] 6. Implement all five modules. `npm run typecheck && npm test` → green. Commit `feat(engine): wikidata + flag-gated places resolvers, LLM select, per-item grounding with cache + reground markers`.

---

### Task 6: The resumable offscreen queue — end-to-end wiring

**Depends on Tasks 2, 3, 4, 5.** The Block-1 done-when lives here: "a 500-item batch survives a service-worker kill mid-run."

**Files:**
- Create: `src/lib/queue.ts`
- Modify: `src/offscreen.ts` (the runtime), `src/offscreen.html`, `src/background.ts` (ensureOffscreen + alarms + message protocol), `src/content.js` (Alt+Shift+E → `{kind:"queue_start"}`; add Alt+Shift+Q → `{kind:"queue_status"}` logged)
- Test: `src/lib/queue.test.ts`

**Interfaces:**
```ts
// queue.ts — PURE state machine; all I/O injected. This is what makes "survives a kill" a unit test.
export interface QueueDeps {
  store: Pick<CpStore, "getJobs"|"putJob"|"putJobs"|"getRecord"|"saveAnalysis"|"saveGroundings">;
  processItem(itemId: string): Promise<{ ok: true } | { ok: false; error: string; rateLimited?: boolean }>;
  now(): number; jitter(): number; // jitter ∈ [0,1); injected for determinism
  concurrency: number;
}
export function backoffMs(attempts: number, jitter: number): number;
// 1000 * 2^(attempts-1), capped at 60_000, times (1 + 0.1*jitter). attempts:1→1000, 2→2000, 3→4000, 4→8000, 5→16000, 6→32000, 7→60000 (cap), all ×1 when jitter=0.
export async function reviveJobs(store: QueueDeps["store"], now: number): Promise<{ revived: number }>;
// any job in "analyzing"|"grounding" (in-flight when the process died) → status "pending", nextAttemptAt = now. Idempotent.
export async function enqueueMissing(store: CpStore, now: number): Promise<{ enqueued: number }>;
// every LibraryRecord with status "raw" and no job → a pending JobRecord {id: `job:${itemId}`, attempts: 0, nextAttemptAt: now}.
export async function runQueue(deps: QueueDeps, opts?: { maxTicks?: number }): Promise<{ done: number; failed: number }>;
// loop: take ≤concurrency due pending jobs (nextAttemptAt ≤ now) → mark "analyzing" (checkpoint BEFORE work) → processItem →
//   ok → "done"; rateLimited → back to "pending", attempts+1, nextAttemptAt = now + backoffMs(attempts, jitter());
//   error → attempts+1; attempts ≥ 5 → "failed" (lastError kept) else "pending" with backoff. Memory-bounded: never holds >concurrency items' media.
```
- `offscreen.ts` runtime: on `{kind:"queue_start"}` → `loadConfig` → build lanes (Gemini needs `geminiKey`; absent → post `{kind:"queue_blocked", reason:"no_key"}` and stop) → resolvers per config (MusicBrainz always; Wikidata always; Places iff enabled+key) with rate limiters (MB 1000 ms, others 200 ms) → `reviveJobs` → `enqueueMissing` → `runQueue` where `processItem` = `getRecord` → `fetchVideoBytes`/`fetchSubtitles` (existing `mediaFetch.ts`) → `extractKeyframes` (real DOM here) → `analyzeItem` → `saveAnalysis` → `groundItemMentions` (selector's `callModel` = the managed lane's raw text call; local lane uses Ollama) → `saveGroundings`. Progress posts `{kind:"queue_progress", done, total}` → background → console.
- `background.ts`: `ensureOffscreen()` via `chrome.offscreen.createDocument({url:"offscreen.html", reasons:["DOM_SCRAPING","BLOBS"], justification:"video keyframe extraction + export blobs"})` guarded by `hasDocument`; `chrome.alarms.create("cp_queue_revive", {periodInMinutes: 1})` → on alarm, if jobs pending, ensureOffscreen + `{kind:"queue_start"}` (this is the service-worker-death revival path).

**Steps:**

- [ ] 1. `src/lib/queue.test.ts` FIRST (fake-indexeddb store or an in-memory `store` fake implementing the Pick):
```ts
it("backoff schedule is exponential, capped at 60s", () => {
  expect([1,2,3,4,5,6,7,9].map(a => backoffMs(a, 0))).toEqual([1000,2000,4000,8000,16000,32000,60000,60000]);
  expect(backoffMs(1, 0.5)).toBe(1050); // 1000 * (1 + 0.1*0.5)
});
it("a 500-item batch survives a mid-run kill with zero loss and zero double-processing", async () => {
  // seed 500 raw records + enqueueMissing → 500 pending
  // run with processItem that succeeds, but STOP the loop after 137 completions with 2 jobs left in "analyzing" (simulated kill: maxTicks)
  // assert: done 137, analyzing 2, pending 361
  // reviveJobs → revived 2 → pending 363, done 137  (500 = 137 + 363; nothing lost)
  // runQueue to completion → done 500, failed 0; processItem invocation count === 502 (2 in-flight retried once) — no item processed twice to "done"
});
it("429 backs off and retries; hard errors fail after 5 attempts", async () => {
  // processItem returns {ok:false, rateLimited:true} twice then ok → job done, attempts 2, nextAttemptAt gaps 1000 then 2000 (jitter 0, injected now)
  // processItem always {ok:false,error:"boom"} → after runQueue: status "failed", attempts 5, lastError "boom"
});
it("respects concurrency", async () => { /* concurrency 2, processItem records max in-flight; expect ≤ 2 */ });
```
- [ ] 2. Implement `queue.ts`; `npx vitest run src/lib/queue.test.ts` → 4 tests pass (paste the 500-item numbers in the report).
- [ ] 3. Implement `offscreen.ts` + `background.ts` wiring per Interfaces; `npm run build` green.
- [ ] 4. Live end-to-end smoke (founder session, BYO key in options): capture a handful of favorites → Alt+Shift+E → console shows `queue_progress` advancing; kill the service worker in `chrome://serviceworker-internals` mid-run; within one alarm minute the queue resumes; IndexedDB shows records at `grounded` with `analysis.output.mentions` populated and at least one MusicBrainz grounding or honest NIL. Paste console evidence. Commit `feat(ext): resumable offscreen queue — capture→analyze→ground end-to-end`.

---

### Task 7: Open-schema export — the frozen contract, emitted and validated

**Depends on Tasks 1, 3 (types + store). Export wiring finalizes after Task 6 but is independently testable.**

**Files:**
- Create: `src/lib/exporters/openSchema.ts`
- Modify: `src/background.ts` + `src/offscreen.ts` (export runs in offscreen: build JSON → `URL.createObjectURL(new Blob([json]))` → `chrome.downloads.download` — data-URLs choke on multi-MB libraries), `src/content.js` (Alt+Shift+S label update)
- Test: `src/lib/exporters/openSchema.test.ts`

**Interfaces:**
```ts
export interface ExportDeps { nowIso: string; extractorRef: { model: string; version: string; prompt: string; run: string }; }
export function toOpenSchemaItem(rec: LibraryRecord, deps: ExportDeps): object; // one item.schema.json-valid object
export function toOpenSchemaExport(recs: LibraryRecord[], deps: ExportDeps): string; // JSON of { schemaVersion:"1.0.0-rc.5", exportedAt, items:[...] }
```
Mapping contract (every line is a test assertion; frozen-schema field names):
- `identity`: `{ status:"platform_verified", permalink: item.url, permalinkStatus:"live", canonicalId: item.id }`; item with `url === null` → `{ status:"platform_verified", canonicalId: item.id }` (canonicalId is a sufficient handle).
- `origin`: `{ platform:"tiktok", profile:"tiktok/1.0" }` · `creator`: `{ handle:"@"+item.author, name: item.authorName }` or `"UNKNOWN"` when author null · `createdAt`: `{ value: ISO(item.createTime*1000), source:"platform", confidence:1 }` when present · `capturedAt`: `{ value: rec.updatedAt, source:"inferred", confidence:0.9 }`.
- `title` from first line of desc? NO — TikTok has no title: omit. `body`: item.desc (omit when "") · `mediaKind`: `"photo"` if isSlideshow else `"video"`.
- `assets`: playUrl → `{url, declaredMime:"video/mp4", role:"rendition"}`; subtitleUrl → `{url, declaredMime:"text/vtt", role:"sidecar"}`; posterRef → `{blobRef: rec.posterRef, role:"rendition", declaredMime:"image/jpeg"}` (blobRef is a valid Asset handle — the export documents that poster bytes ship separately in a later phase).
- `saves`: `[{ sources: item.sources.map(kind → favorites|likes: same; posts:"upload"; reposts:"repost"; else "other").map(k => ({kind: k, at: deps.nowIso})) }]` — the capture time is the honest `at` we have (platform save-times are not in item_list).
- `metrics`: one Observation `{likes, shares, comments, views: stats.plays, observedAt: deps.nowIso}` with null stats omitted · `platformExtras`: `{ musicName, musicAuthor, hashtags }`.
- `extractions` (the load-bearing part): mentions → `{kind:"named_entity", surface, type, aliases?, evidence: mapEvidence(...), rollup}` + `grounding` from `rec.groundings` matched by `mentionKey`: resolved → `{authority: typeToAuthority(type) mapped to vocab casing (musicbrainz|google_places|wikidata), externalId: g.id, nil:false, grounding_confidence: g.confidence}`; NIL → `{authority, externalId:null, nil:true, grounding_confidence: g.confidence}`; in `regroundPending` → NO grounding key. concepts → `{kind:"concept", surface, evidence}`; claims → `{kind:"claim", statement, evidence}`; structured → `{kind:"structured_content", schemaOrgType, slots: slots.map(s=>({name, value:{value: s.value, observedAt: deps.nowIso}})), steps, evidence}` (extractor slot strings become Observations here); facets array → one `{kind:"facet", facet, value, evidence: mapEvidence(assignment.evidence)}` per assignment (REAL model-emitted evidence per rc.6 — never pipeline-stamped; Q4 resolved by controller). `mapEvidence` copies channel/source_role/quote/assertion_mode/confidence, converts `t_start`/`t_end` → `selector: {type:"FragmentSelector", value:"t=<start>,<end>", conformsTo:"http://www.w3.org/TR/media-frags/"}`, and stamps `extractor_ref: deps.extractorRef`. `rollup` = strongest assertion mode (STATED>SHOWN>REPORTED>INFERRED) + max confidence.

**Steps:**

- [ ] 1. `openSchema.test.ts` FIRST. Build one `LibraryRecord` fixture by hand (the Task-1 `grounded` ExtractorOutput + a resolved MB grounding `{id:"5a7c1234-0000-4000-8000-000000000000", confidence:0.93}` + a place mention with `regroundPending:["place"]`). Assertions:
  - **The emitted object validates against the REAL frozen schema:** Ajv2020 with `addSchema(extraction.schema.json)` then `compile(item.schema.json)`; `expect(validateItem(out)).toBe(true)` and on failure print `validateItem.errors` (hard requirement — this is the Phase-3 contract test).
  - Field spot-checks, hand-computed: `identity.canonicalId === "7578265440993199126"`; `saves[0].sources[0]` `{kind:"favorites", at:"2026-07-08T12:00:00Z"}` (injected nowIso); music extraction `grounding.externalId === "5a7c1234-0000-4000-8000-000000000000"`, `nil === false`; the place extraction has NO `grounding` key (`"grounding" in placeExt === false`); facet extraction evidence carries the model-emitted channel from the fixture (e.g. `VISUAL_SCENE`), never a pipeline stamp; every extraction's `evidence[0].extractor_ref.model === "gemini-2.5-flash-lite"`; t_start/t_end 12/19 → selector value `"t=12,19"`.
  - Invalid-by-construction guard: hand-corrupt a copy (`nil:false, externalId:null`) → `validateItem` false (proves the test would catch invariant violations).
- [ ] 2. Implement `openSchema.ts`; `npx vitest run src/lib/exporters/openSchema.test.ts` → all pass.
- [ ] 3. Wire export: offscreen handles `{kind:"export_open_schema"}` → `allRecords()` → `toOpenSchemaExport` → blob download `commonplace-export.json`; the shipped extension validates each record with the **precompiled** `validateItem` before writing and reports `{valid, invalid}` counts to console (never blocks export — invalid records are included + logged; export is the user's data either way).
- [ ] 4. `npm run typecheck && npm test && npm run build` green; live smoke: Alt+Shift+S on the captured library → file downloads; `npx tsx -e` one-liner (or node script) validating the downloaded file against the schema → `items valid: N / N`. Commit `feat(engine): open-schema export validated against the frozen contract`.

---

### Task 8: promptfoo eval slice + CI

**Depends on Task 1 (schema + types); fixture shapes from Task 5. Parallel-safe with Tasks 6, 7.**

**Files:**
- Create: `eval-promptfoo/promptfooconfig.yaml`, `eval-promptfoo/replay-provider.mjs`, `eval-promptfoo/frozen/{clip-song.json, clip-place-nil.json, clip-slideshow.json}` (synthetic — NO real usernames, per SPEC §23 debt note), `eval-promptfoo/asserts/{schema-valid.mjs, grounding-exact.mjs}`, `.github/workflows/ci.yml`
- Modify: `package.json` (devDep `promptfoo`, script `"eval:promptfoo": "promptfoo eval -c eval-promptfoo/promptfooconfig.yaml --no-cache"`)

**Interfaces:**
- `replay-provider.mjs`: a promptfoo custom JS provider `callApi(prompt, context)` that ignores the live model and returns the frozen extractor output for `context.vars.clipId` from `eval-promptfoo/frozen/<clipId>.json` — SPEC §15's **zero-cost replay harness**: deterministic, keyless, $0, runs on every commit. Each frozen file: `{ clipId, extractorOutput: <ExtractorOutput>, expectedGrounding: [{surface, type, externalId|null, nil}] }` (frozen KB candidate sets inline).
- `asserts/schema-valid.mjs`: JS assertion — Ajv-validates `output` (the extractor output) against `schema/json/extractor-output.schema.json`; returns `{pass, score: pass?1:0, reason}`. Runs per-test (per-layer; no blending).
- `asserts/grounding-exact.mjs`: replays `groundItemMentions` with a frozen-candidate fake resolver + a deterministic top-candidate selector, then asserts grounding-ID **exact match** + NIL-accuracy against `expectedGrounding`. Reports per-clip pass/fail with per-mention reasons.
- `ci.yml` (three independent jobs; each fails independently — no blended status):
  1. `node`: actions/setup-node@v4 (node 22) → `npm ci` → `npm run typecheck` → `npm test` (vitest) → `node --test src/capture.test.js` → `npm run build` → `node scripts/audit-dist.mjs`.
  2. `python-eval`: astral-sh/setup-uv@v5 → `cd eval && uv sync && uv run pytest -q` (the untouched Phase-1 harness keeps gating the schemas).
  3. `promptfoo-replay`: `npm ci` → `npm run eval:promptfoo` (keyless — the provider is the replay).

**Steps:**

- [ ] 1. Write the three frozen fixtures by hand: `clip-song` (one music_recording mention → expected MBID exact match), `clip-place-nil` (one place mention with zero frozen candidates → expected `nil:true`), `clip-slideshow` (photo item; concepts + facets only, no mentions → grounding assert passes vacuously, schema assert does the work). Hand-compute every expected value into the files.
- [ ] 2. Write provider + asserts + `promptfooconfig.yaml` (3 tests, vars `clipId`, both asserts on each). Run `npm run eval:promptfoo` → expected output contains `Successes: 6` / `Failures: 0` (2 asserts × 3 clips). Then flip one frozen `externalId` and re-run → `Failures: 1` (prove the gate bites); flip back.
- [ ] 3. Write `ci.yml`; validate with `npx action-validator .github/workflows/ci.yml` if available, else YAML-parse check `node -e "require('js-yaml')..."` — or simply push to a branch is NOT allowed (no commits by planner; the implementer commits per convention). Implementer runs the three job command sequences locally and pastes outputs.
- [ ] 4. Commit `chore(ci): promptfoo replay slice + node/python/eval CI`.

---

### Task 9: CWS dry-run listing package — prepared, NOT submitted

**Depends on Tasks 2, 6 (final manifest + working build). Founder gate: the $5 dev account + the submit click.**

**Files:**
- Create: `store/cws/listing.md`, `store/cws/permissions.md`, `store/cws/privacy-policy.md`, `store/cws/checklist.md`, `scripts/package-cws.mjs`, `scripts/audit-dist.mjs`
- Modify: `package.json` (scripts `"package": "npm run build && node scripts/package-cws.mjs"`, `"audit": "node scripts/audit-dist.mjs"`)

**Interfaces / content contracts:**
- `listing.md`: name `Commonplace — Export & Search Your TikTok Favorites` (SPEC §18: relevance-loaded on the favorites/saved/export cluster); 132-char summary containing "export", "favorites", "free"; full description leading with free-forever export + local-first + provenance (no "downloader", no "AI-powered" — SPEC §21 banned words); category Productivity; screenshots TODO list (5 annotated shots specced by scene, produced in Phase 5 when the library UI exists — the dry-run listing ships with capture-HUD + options + export shots).
- `permissions.md`: one defended paragraph per manifest permission/host (storage/unlimitedStorage → the library; downloads → export; declarativeNetRequest → CDN Referer for the user's own media; offscreen/alarms → resumable analysis; each host named to its API) — this is the CWS reviewer's questionnaire pre-answered.
- `privacy-policy.md`: SPEC §25 telemetry posture verbatim ("three planes that never touch extension content"), local-first architecture, BYO-key disclosure, no data sale, contact.
- `scripts/audit-dist.mjs` — **the named key-exposure regression test (SPEC §25)**: fails (exit 1) if (a) built `dist/manifest.json` contains a `web_accessible_resources` key, (b) any file in `dist/` matches `/AIza[0-9A-Za-z_\-]{30,}/` or `/sk-[A-Za-z0-9]{20,}/` or the literal `secrets.js`, (c) `dist/manifest.json` requests a permission not in the allowlist `["storage","downloads","unlimitedStorage","declarativeNetRequest","offscreen","alarms"]`. Prints `AUDIT PASS` on success.
- `scripts/package-cws.mjs`: zips `dist/` → `commonplace-cws-v<version>.zip` after running the audit; refuses to package if audit fails.
- `checklist.md`: the founder's 10-minute submit path (create dev account $5 → upload zip → paste listing.md fields → paste privacy policy URL → visibility "unlisted" for the dry-run → submit) + the "what starts the clock" note (review queue + rating clock, SPEC §18).

**Steps:**

- [ ] 1. Write `audit-dist.mjs` + a red test first: temporarily plant `const k="AIza` + `0123456789012345678901234567890"` in a dist file, run `npm run audit` → exits 1 naming the file; remove plant; `npm run build && npm run audit` → `AUDIT PASS`.
- [ ] 2. Write the four store docs per the content contracts (complete prose, no TODO markers except the explicitly-specced screenshot list).
- [ ] 3. `npm run package` → `commonplace-cws-v0.1.0.zip` produced; unzip listing shows manifest at root (CWS requirement). Commit `chore(store): submit-ready CWS dry-run package + key-exposure audit`.

---

## Sequencing

```
T1 (contract) ──┬─→ T3 (storage)* ──┐
T2 (toolchain) ─┘   T4 (lanes)      ├─→ T6 (queue, e2e) ─→ T9 (CWS pkg)
                    T5 (resolvers) ─┘
T1 ─→ T7 (export; wiring finalized after T6)
T1 ─→ T8 (promptfoo/CI; runs any time after T1, add T5's groundItem to the replay when it lands)
```
Parallel-safe sets: {T1, T2} · {T3, T4, T5} (after T1+T2) · {T7, T8} with T6. (*T3 needs T2's build only for the background.ts wiring step, not its lib/tests.)

## Self-review

**Phase-3 scope → task mapping (roadmap Phase 3 / SPEC Block 1):**
| Scope item | Task |
|---|---|
| Wire `src/lib` into MV3 end-to-end (capture→analyze→ground→library-data→export) | T1–T7 (e2e proof in T6 step 4, T7 step 4) |
| Resumable offscreen queue (checkpoint, SW-death revival, 429 backoff, bounded concurrency) | T6 |
| Storage + eager posters | T3 |
| Both engine lanes; ingestion default keyframes+VTT, native behind flag (cascade NOT decided — SPEC §13) | T4 |
| Wikidata + Places resolvers join MusicBrainz (Places behind interface+flag, key later) | T5 |
| Open-schema export (frozen contract, validated) | T7 |
| promptfoo eval slice in CI | T8 |
| Submit-ready CWS dry-run listing (prepared-not-submitted) | T9 |
| Contract migration (old 10-type → frozen 9-type), old tests dispositioned | T1 |

**Type-consistency check:** `ExtractorOutput` (T1) is consumed by lanes (T4), groundItem takes `MentionOut[]` (T5), `LibraryRecord` (T3) carries `Analysis` + `GroundedEntity[]` + `regroundPending: NamedEntityType[]`, and `toOpenSchemaItem` (T7) consumes exactly `LibraryRecord` + stamps `extractor_ref` — one type chain, no parallel shapes. `Mention.type` and `MentionOut.type` are both `NamedEntityType`; `mentionKey` (T1) is the join key used by both grounding cache (T5) and export matching (T7). Result-object convention (`{ok:true,…}|{ok:false,error}`) preserved everywhere (`ExtractorResult`, `processItem`).

**Known gaps deliberately out of scope:** library UI (Phase 5), prompt tuning + ingestion ablation (Phase 4), IG/X adapters (Phase 9), whisper/audio for the local lane (see Q3), poster bytes inside the export file (blobRef documented instead).

**Open questions — ALL RESOLVED by controller (2026-07-08):**
1. **(Q1 — RATIFIED)** esbuild now, WXT deferred to the multi-store phase.
2. **(Q2 — RATIFIED)** Native-escalation router ships default-OFF (`escalateNative:false`); SPEC §13 retraction governs; Phase 4 flips config, not code.
3. **(Q3 — RATIFIED (a))** Local lane ships VTT-only with honest `captureFidelity`; whisper-WASM rejected for Phase 3 (40MB model, MV3 friction); managed lane covers no-VTT items. The gap is *measured* by the instrument's has_vtt stratification — revisit after pilot data.
4. **(Q4 — OVERRULED → schema rc.6, pre-Task-1)** Pipeline-stamped facet evidence is synthetic provenance and is forbidden (founder directive: provenance first-class). `extractor-output.schema.json` rc.6 changes `facets` from a flat object to an array of `{facet, value, evidence[≥1]}` assignments with REAL model-emitted evidence; extraction.schema.json's FacetAssignment already matches. rc.6 lands as a pre-Task-1 schema dispatch (eval fixtures/tests updated; CHANGELOG entry; pred/gold records unchanged — the pipeline flattens assignments → `{facet: value}` when emitting pred records for eval). Task 1/7 interfaces in this plan are already amended to the array form.
5. **(Q5 — RATIFIED)** Grounding select routes through the ACTIVE lane (local → Ollama): the local lane's promise is that nothing leaves the machine; a silent managed-select would break it. Ollama down ⇒ job retries per queue backoff.
