# Design — content-search

## v1 is local tokenized retrieval, not vectors

The framing verdict is explicit: content-*understanding* is done by the engine (analysis) and the user's agent (MCP); *search* is fast retrieval over the text those produce. So v1 builds an in-memory inverted index over the analyzed text layers — no embedding model, no vector store. This keeps it instant, offline, and dependency-free, and it is honestly sufficient for "find the thing I saved." A semantic/vector layer is a later change if retrieval quality demands it.

## Fields + ranking

Index these layers per item, highest weight first:
1. resolved entity/referent names (from `MentionIndexEntry` — the moat surface: "that restaurant", "that song")
2. caption / `desc`
3. on-screen text (from the analysis `ExtractorOutput`)
4. transcript
5. hashtags, author

`query(index, q)`: tokenize + normalize (fold case/punctuation, same discipline as the eval matcher), match tokens across fields (prefix + substring), rank by summed field-weight × match density, tiebreak on recency (`savedAt`/`createTime`). Return ranked item ids + which field(s) matched (for snippet highlighting). PURE and deterministic → unit-tested.

## The minimal surface (`library.ts` / `library.html`)

- A search box (cmdk-style: type, live results). 
- A ranked results list: poster thumbnail, caption snippet with the matched span highlighted, the resolved entity chips, and a compact provenance mark.
- An item-detail view: the full record + the provenance strip (the signature component, in plain form here).
- Reads `getAll("items")` once, builds the index in memory, queries on keystroke. On a 5k library this is sub-second; if profiling later shows cost, memoize the index in the store.

This surface is intentionally unstyled beyond legibility — the G2 design system lands in `library-ui`. It exists so the product is usable and the MCP demo has a face.

## Testing (TDD)

- `query` ranking: an entity-name match outranks a caption match outranks a transcript match; multi-token AND; prefix + substring.
- The dark-matter case: an item whose ONLY match is in the transcript (no caption/hashtag) is found — the thing tag-search misses.
- No-match → empty, honest. Empty query → recent items.
- A perf assertion/note that a 5k-item index build + query stays well under a second.
- `npm test` + `npm run typecheck` green; existing tests unaffected.
