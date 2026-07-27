# Tasks — content-search

## 1. Pure search core
- [x] 1.1 `src/lib/search/index.ts` — `buildIndex(items)` over the weighted text layers (entity names, caption, on-screen text, transcript, hashtags, author)
- [x] 1.2 `src/lib/search/query.ts` — `query(index, q) → { id, matchedFields }[]` ranked; tokenize/normalize like the eval matcher
- [x] 1.3 Tests: entity>caption>transcript ranking; transcript-only (dark-matter) hit; multi-token AND; prefix+substring; no-match; empty-query→recent; 5k perf note

## 2. Minimal library surface
- [x] 2.1 `src/library.html` + `src/library.ts` — search box, ranked results (poster + snippet + matched-field + provenance), item detail with the provenance strip
- [x] 2.2 Build the index from `getAll("items")` in memory; query on keystroke; honest empty state
- [x] 2.3 Wire the surface into the extension (open from the popup/action)

## 3. Green
- [x] 3.1 `npm test` + `npm run typecheck` green; existing tests unaffected
- [x] 3.2 `openspec validate content-search --strict` passes
