# Design — zip-import-and-upload

## Zip handling (options page, off the SW thread)

`fflate.unzipSync(bytes)` → a map of `{ entryPath: Uint8Array }`. Detect platform by entry path:
- `user_data*.json` (or a nested `.../user_data_tiktok.json`) → decode → `parseTikTokDydResult` (existing).
- `.../saved/saved_posts.json` (+ optional `.../saved/saved_collections.json`) → decode → `parseInstagramSaved` (new).

Keep the current extracted-`.json` drop working too (detect a bare JSON file and route by shape). fflate is chosen over `DecompressionStream` because the export is a multi-file zip archive, not a single gzip stream — `DecompressionStream('gzip'|'deflate')` cannot read the central directory. fflate is ~8KB, dependency-free, and widely used.

## `igImport.ts` (pure parser, mirrors `dydImport.ts`)

Input: the parsed `saved_posts.json` object (and optionally `saved_collections.json`). The fixture at `fixtures/ig-saved-sample.json` is the structure-faithful reference.

- Each `saved_posts[]` entry: read `label_values[]` by `label` — `URL`, `Caption`, `Title`, `Hashtags`, `Owner` (nested dict → username). `timestamp` → `savedAt`.
- Parse the shortcode from the URL (`/reel/<code>/` or `/p/<code>/`) as the id; keep the permalink as the join key.
- Emit `CapturedItem` with `platform: "instagram"`, `desc` = caption, `hashtags` parsed from the Hashtags string, `author` = owner username, and the media/stat fields null (same as DYD — enrichment fills them later).
- `saved_collections`: map each post URL → collection name(s); surface as the item's collection membership (the store already models collections).
- Dedup by id, union `sources`, earliest `savedAt` wins — same discipline as `dydImport.ts`.
- PURE: no `Date.now`/DOM/`console`; counts returned, glue logs. Fully unit-tested against the fixture.

## The `platform` field (XPLAT-01 seam, minimal)

Add `platform?: "tiktok" | "instagram"` to `CapturedItem` (optional → existing TikTok items and tests default to `"tiktok"`). Thread it: the store carries it; the open-schema export includes it (additive schema bump, per DEC-007 never-delete-only-add); the id namespace stays per-platform so a TikTok id and an IG shortcode never collide (prefix the store key with platform if needed).

## Reconciliation report (pure reducer + glue)

`reconcile(parsedItems, existingIds) → { added, merged, alreadyPresent, parsed, declaredInZip }` where `declaredInZip` is the raw list length from the export (the index size). The glue shows: "Imported N (added A, merged M, already had P) — your export listed L." This is how the user sees the ZIP recover the fake-done tail: `declaredInZip − (what live capture got)` is the gap the import closes.

## Testing (TDD)

- `igImport.test.ts` against `fixtures/ig-saved-sample.json`: correct id/permalink/caption/hashtags/owner, collection membership, dedup + source-union, savedAt from timestamp, empty/malformed entries skipped with a returned count.
- `reconcile` reducer: added/merged/already-present math; `declaredInZip` vs parsed.
- A zip-routing test: a fixture zip (or a mocked fflate map) routes TikTok vs Instagram entries correctly, and a bare `.json` still works.
- `platform` field: an IG item round-trips through store + export with `platform:"instagram"`; existing TikTok fixtures still validate against the (bumped) schema.
- `npm test` + `npm run typecheck` green; existing 519 unaffected (the `platform` field is optional).
