# Tasks — extractor-v2-gemini3

## 1. Decoding config (vendor-aligned) + repair
- [x] 1.1 `geminiClient.ts` `buildGenerationConfig`: drop temperature/top_p/top_k; add thinkingLevel:low, maxOutputTokens, mediaResolution (verify exact field names vs Google docs); update `GeminiGenerationConfig` type
- [x] 1.2 `parseExtractorResponse`: JSON-repair-on-truncation (finishReason MAX_TOKENS → salvage valid prefix → gate → mark partial); tests with truncated fixtures
- [x] 1.3 Thread a `partial` marker through the result so a repaired extraction is persisted as partial, never fake-complete

## 2. MM:SS timestamps (frozen schema bump)
- [x] 2.1 `extractor-output.schema.json`: t_start/t_end number → MM:SS string; bump version + `schema/CHANGELOG.md` (1.0.0-rc.7)
- [x] 2.2 Regenerate `src/lib/generated/validators.js` (`scripts/build-validators.mjs`); `types.ts` → string
- [x] 2.3 `openSchema.ts`: pure `mmssToSeconds` for the media-fragment selector; update its tests
- [x] 2.4 Update `eval` schema-gate + `schemaConformance.test.ts` fixtures to MM:SS
      (eval needed NO fixture change — no gold/pred fixture carried an evidence timestamp; its 198 tests
      pass unchanged against the new schema, which they read from disk)

## 3. Native video via File API + ingestion default
- [x] 3.1 `lanes.ts`: inject `fileUpload` dep; native path builds a `fileData` part (video), keyframes stay inline
- [x] 3.2 Offscreen glue: fetch video bytes → upload → poll ACTIVE → analyze; resumable (checkpoint discipline)
- [x] 3.3 `config.ts` default `ingestion: "native"`; `routeIngestion` managed→native, local→keyframes_vtt; honest fallback when no bytes

## 4. Prompt v2
- [x] 4.1 `prompts/extract_v2.md`: tighter, native-video-framed, MM:SS; keep the 9 entity types, 9 facet axes, iron rule; wire the loader to v2 (keep v1)

## 5. Green + the on-judgment proof
- [x] 5.1 `npm test` + `npm run typecheck` green; validators regenerated; eval schema-gate + conformance updated
      (718 vitest green — 694 baseline + 24 new; typecheck clean; eval 198 green; `npm run build` clean)
- [x] 5.2 Pilot re-run script (keys from .env.local; tikwm→download→File API→v2 config+prompt) on the SAME 6 videos incl. the 4 that looped: ZERO loops, all parse, extractions ≥ v1 salvaged; report a token tally
      **RESULT: 6/6 zero numeric loops · 6/6 parsed (every finishReason STOP, zero partials) · 69,666 tokens
      vs the v1 pilot's ~174k (−60%).** MM:SS timestamps were emitted and passed the gate, so the schema
      `pattern` did NOT fight the model (the design's drop-the-pattern fallback was not needed).
      v1's two documented anchors reproduced: #4 UPS + ORION; #6 eight steakhouse places (audit recorded 7).
      NOTE: v1's per-video entity COUNTS were never recorded in the repo, so the richness check asserts the
      audit's named anchors rather than an invented numeric baseline. The real v1-vs-v2 quality comparison
      is the gold set (next change). Script + report: `.scratch/` (gitignored).
- [x] 5.3 `openspec validate extractor-v2-gemini3 --strict` passes
