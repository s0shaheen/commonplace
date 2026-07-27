# Design — extractor-v2-gemini3

Verify every exact Gemini-3.x API field name against Google's live docs while implementing (video-understanding, structured-output, thinking, migration) — the shapes below are the intent; the field names must match the current API.

## 1. Decoding config (`geminiClient.ts`)

`buildGenerationConfig()` returns (no `temperature`/`top_p`/`top_k`):
```
{
  responseMimeType: "application/json",
  responseSchema: toGeminiResponseSchema(),
  thinkingConfig: { thinkingLevel: "low" },   // verify field; legacy thinking_budget is deprecated
  maxOutputTokens: <bounded, e.g. 8192>,       // account for the JSON size; thinking is separate/low
  mediaResolution: <"MEDIA_RESOLUTION_HIGH" for on-screen text, or medium for cost — pick + comment>
}
```
Update the `GeminiGenerationConfig` type accordingly. Removing `temperature` is the primary loop fix; the rest are alignment + a cost/robustness backstop.

## 2. JSON-repair on truncation (`parseExtractorResponse`)

Read `candidates[0].finishReason`. On `MAX_TOKENS` (or an unterminated parse), attempt a bounded repair: trim the text to the last complete top-level array element / balanced brace, parse, then run the existing `gateExtractorOutput`. If it gates valid, return it **marked as a partial** (a flag on the result the caller persists — never a silent full-quality claim). If repair fails, `parse_fail` as today. Honest incompleteness, not a drop. Pure + unit-tested with truncated fixtures.

## 3. Timestamps → `MM:SS` (frozen schema bump)

- `schema/json/extractor-output.schema.json`: `t_start`/`t_end` become `{ "type": "string", "pattern": "^\\d{1,2}:\\d{2}$" }` (or drop the pattern if Gemini's schema subset rejects it — then validate in the gate). Bump the schema version + `schema/CHANGELOG.md` (DEC-007). Regenerate `src/lib/generated/validators.js` via `scripts/build-validators.mjs`.
- `types.ts`: `t_start?: string; t_end?: string`.
- `openSchema.ts` (media-fragment): parse `MM:SS` → seconds to build `t=<start>,<end>` (was raw numbers). A tiny pure `mmssToSeconds`.
- `eval` schema-gate + `schemaConformance.test.ts`: update fixtures to `MM:SS`.
- The runtime evidence gate (`isEvidenceArray`) doesn't type-check `t_start`/`t_end` today; optionally add a light `MM:SS` string check. Keep them optional.
- If the schema-subset `pattern` fights the model, the fallback is to DROP `t_start`/`t_end` from the responseSchema entirely (they're optional; the media-fragment feature degrades) — but MM:SS-string is preferred (keeps the feature, aligns with the model). Decide empirically in the pilot re-run.

## 4. Native video via the File API (`lanes.ts`)

The native branch currently inlines `videoBytes` (`buildMediaBody([videoBytes])`) — breaks >20MB. Replace with the File API:
- Inject a `fileUpload(bytes, mimeType) → { fileUri }` dep into `createGeminiLane` (glue; network + poll-until-ACTIVE lives in the offscreen/background glue, not the pure core). The pure body-builder gets a `fileData:{fileUri, mimeType}` part instead of `inlineData`.
- Keyframe images (keyframes_vtt path) stay `inlineData` (small).
- Place the video part BEFORE the text prompt (best practice — already the order).
- The offscreen glue owns: fetch video bytes (from the enriched item's media) → `fileUpload` → poll ACTIVE → analyze. Reuse the resumable-queue checkpoint discipline (a mid-upload SW death reverts to pending).

## 5. Ingestion default → native (`routeIngestion` + `config.ts`)

- `config.ts`: default `ingestion: "native"` (was `keyframes_vtt`); the `escalateNative` heuristic is retired/moot.
- `routeIngestion`: managed lane → `native` by default; local lane → always `keyframes_vtt` (deaf VLMs, unchanged).
- Native needs the video bytes available (from capture playUrl or enrichment). If bytes are unavailable, fall back to keyframes_vtt (or caption-only) with an honest marker — never fail silently.

## 6. Prompt → `prompts/extract_v2.md`

Author v2: tighter, direct (3.x over-analyzes on verbose prompts), framed for a model that WATCHES + LISTENS to the video (not "subtitles"/"frames"); timestamps in `MM:SS`. Keep verbatim: the 9 entity types, the 9 facet axes + allowed values, the evidence channel/assertion_mode taxonomy, and the iron rule (emit surface+type, never an ID). Wire the loader to `extract_v2.md`; keep `extract_v1.md` for rollback.

## 7. Acceptance (the "on judgment" proof)

- `npm test` + `npm run typecheck` green; schema validators regenerated; `eval` schema-gate + conformance tests updated and passing.
- **The pilot re-run** (a scratchpad script, keys from `.env.local`, tikwm → download → File API → v2 config + v2 prompt) on the SAME 6 videos, especially the 4 that looped: **zero numeric loops, every run parses, extractions at least as rich as v1's salvaged prefixes.** Report a token tally (should be far below the pilot's 174k — thinking:low + the loop gone). This is the judgment-time proof; the gold-set quality comparison is the next change.
