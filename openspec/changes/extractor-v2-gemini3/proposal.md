# Proposal — extractor-v2-gemini3

## Why

The extractor (prompt, output schema, decoding config, ingestion) was built for gemini-2.5 fed frames+VTT and never re-evaluated for gemini-3.6-flash native video. The pilot's numeric-loop bug (temp-0 + unbounded number timestamps → `0.0101…` → truncated JSON → dropped analysis, 4/6 runs) is a symptom, not an isolated defect. Google's current Gemini 3.x guidance makes several current choices explicit anti-patterns. Founder decision (2026-07-27): ship the full v2 on judgment now, build the gold set and measure after. Full audit: `docs/research/2026-07-27-extraction-stack-audit.md`.

## What changes

**Decoding config (`geminiClient.ts`)** — align to Gemini 3.x:
- **Remove `temperature`** (and any top_p/top_k). Gemini 3.x is "optimized for the default settings"; temp-0 + constrained decoding is the loop trigger.
- **Add `thinking_level: "low"`** (via the current API field; the legacy `thinking_budget` is deprecated). Extraction is classification-shaped — low thinking is cheaper and reduces over-analysis.
- **Add `maxOutputTokens`** (a bounded cap so no run can spew tens of thousands of tokens).
- **Add `media_resolution`** (a tunable; default toward reading on-screen text, e.g. high, or a cost-balanced medium — pick and note it).
- **JSON-repair-on-truncation** in `parseExtractorResponse`: on `finishReason: MAX_TOKENS`, salvage the valid JSON prefix into an honest, marked partial rather than dropping the item.

**Timestamps (frozen schema bump)** — `t_start`/`t_end` change from `number` (seconds) to an **`MM:SS` string**, matching how Gemini 3 natively refers to video time. This removes the loop at the representation level. Touches `schema/json/extractor-output.schema.json` (version bump per DEC-007 + CHANGELOG), `types.ts`, the regenerated validators, `openSchema.ts` (parse `MM:SS` → media-fragment seconds), and the eval schema-gate. No shipped data to migrate.

**Video ingestion (`lanes.ts` native path)** — use the **Gemini File API** for native video (upload → poll ACTIVE → `fileData`), not inline base64 (inline breaks above ~20MB). Keyframe images stay inline. Make **native the managed-lane default** (`routeIngestion` + config default flip): native is ~300 tok/sec on 3.6-flash (cents), richer and simpler than sampled frames + VTT. The local/Ollama lane stays keyframes_vtt (deaf VLMs, unchanged).

**Prompt** — author **`extract_v2.md`**: tighter and more direct (3.x over-analyzes on verbose prompts), reframed for a model that watches+listens to the video, timestamps as `MM:SS`. Keep the closed vocabularies (9 entity types, 9 facet axes) and the iron rule (no model-emitted IDs).

Non-goals: the ontology/output structure is kept (it held up in the pilot); grounding/capture/enrichment/search unchanged; the v1-vs-v2 QUALITY comparison is deferred to the gold set (next change).

## Capabilities

- **New capability**: `extraction` — how the analysis extractor is configured, prompted, fed, and made robust for the production model.

## Impact

- Modified: `geminiClient.ts` (config + repair), `lanes.ts` (File API native path, ingestion default), `config.ts` (default ingestion), `prompts/extract_v2.md` (new), `schema/json/extractor-output.schema.json` + `schema/CHANGELOG.md` (timestamp bump), `types.ts`, `openSchema.ts` (MM:SS parse), regenerated `generated/validators.js`, `eval` schema-gate, and the affected tests.
- Invariants preserved: the iron rule (no model IDs — the `additionalProperties:false` gate stays), honest incompleteness (a repaired/truncated extraction is a marked partial, never a silent drop or fake-complete), determinism where it matters (the parser is the gate, not model sampling).
- Acceptance includes a **real re-run on the 6 pilot videos** (esp. the 4 that looped): zero numeric loops, all parse, extractions at least as rich as the salvaged v1 prefixes.
