# Tasks — zip-import-and-upload

## 1. Instagram parser
- [x] 1.1 `src/lib/capture/igImport.ts` — pure `parseInstagramSaved(json, collections?) → { items, ... counts }`, mirroring dydImport.ts
- [x] 1.2 `igImport.test.ts` against `fixtures/ig-saved-sample.json` (id/permalink/caption/hashtags/owner, collections, dedup, savedAt, skips)

## 2. Platform tagging (XPLAT-01 seam)
- [x] 2.1 Add optional `platform?: "tiktok" | "instagram"` to `CapturedItem` (default tiktok); thread through store upsert
- [x] 2.2 Additive open-schema bump to carry `platform`; existing TikTok fixtures still validate
- [x] 2.3 Ensure per-platform id namespacing (no TikTok-id vs IG-shortcode collision)

## 3. Zip acceptance + routing
- [x] 3.1 Add `fflate` dep; decode the raw `.zip` in options.ts (off-SW)
- [x] 3.2 Route by entry path (user_data*.json → DYD; .../saved/saved_posts.json → IG); keep bare-json path working
- [x] 3.3 Generalize the background import handler to carry platform (or add `import_items`)

## 4. Reconciliation
- [x] 4.1 Pure `reconcile(parsed, existingIds) → { added, merged, alreadyPresent, parsed, declaredInZip }` + tests
- [x] 4.2 Surface the report in the options UI (imported vs library vs declared)

## 5. Green
- [x] 5.1 `npm test` + `npm run typecheck` green; existing 519 unaffected
- [x] 5.2 `openspec validate zip-import-and-upload --strict` passes
