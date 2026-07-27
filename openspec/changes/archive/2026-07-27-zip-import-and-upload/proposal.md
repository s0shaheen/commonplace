# Proposal — zip-import-and-upload

## Why

The ZIP export is the completeness backstop: it is the one source that lists **every** saved item, including the tail the live scroller cannot reach (the fake-done shortfall). But today it is not a real front door. The TikTok DYD lane (`dydImport.ts`) works yet forces the user to unzip and hunt for `user_data.json` (`options.ts` literally tells them "pick the extracted json, not the .zip"). There is no Instagram lane at all, even though the IG export is content-rich (caption/title/hashtags/owner) and would be searchable on import. And nothing reconciles an import against what capture already holds, so the user cannot see what the ZIP recovered.

## What changes

- **ADD raw `.zip` acceptance.** The user drops the file the platform gave them; we decompress in the options page (off the service-worker thread) and route by entry path — `user_data*.json` → the TikTok DYD parser, `your_instagram_activity/saved/saved_posts.json` → the new IG parser. `DecompressionStream` cannot parse a zip *container* (central directory, multiple entries), so this needs a real unzip; recommend **fflate** (~8KB, zero-dependency) as the one new runtime dep. This is the repo's standing dep-minimalism call to make — the alternative is keeping the extract-json-first friction.
- **ADD the Instagram importer** (`igImport.ts`, pure, mirrors `dydImport.ts`): `saved_posts[].label_values` → URL, caption, title, hashtags, owner; `saved_collections` → collection membership; tagged `platform: "instagram"`. IG items land text-searchable immediately (no enrichment needed for search).
- **ADD a `platform` tag** to `CapturedItem` (optional, default `"tiktok"`) and thread it through the store and the export schema (the XPLAT-01 adapter seam from capture-resilience.md §6.4, done minimally and additively — schema is versioned).
- **ADD an import reconciliation report:** imported vs already-in-library (added / merged / already-present), and imported-count vs the ZIP's own list length (the declared index). The permalink is the join key so a later live capture or enrichment can deepen an imported item.

Non-goals: no content enrichment (that is `enrichment-lane` — imports arrive as index + whatever text the export carries); no live-capture changes; no new platforms beyond TikTok + Instagram.

## Capabilities

- **New capability**: `import` — how a platform data-export becomes library items, across platforms, with reconciliation.

## Impact

- New: `src/lib/capture/igImport.ts` (+ test); zip-decode glue in `options.ts`; the reconciliation reducer (pure, tested).
- Modified: `src/lib/types.ts` (`platform?` field), the store upsert + open-schema export (carry `platform`), `background.ts` import handler (generalize `import_dyd` to carry platform, or add `import_items`).
- One new dep: `fflate` (the decision above).
- Invariants preserved: import is a local file read — no network, no session, no forged requests; honest reconciliation (never claim more imported than parsed).
