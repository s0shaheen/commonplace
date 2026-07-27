# Proposal — content-search

## Why

This is the hero of the product (the 2026-07-22 backtest): a library of thousands is worthless if you cannot find the one thing, and the corpus is ~51% "dark matter" that title/hashtag search misses — the value is searching what is actually IN each video (caption, transcript, on-screen text) and the resolved entity names, not titles. Today nothing is searchable: the store exposes only `getAll("items")`, and `popup-view` is the capture HUD, not a library. Content-search is what turns the analyzed corpus into something a person actually uses — and it is the retrieval surface the MCP demo (`mcp-server`) reads.

## What changes

- **ADD a pure search index + ranked query** over each item's text layers: resolved entity/referent names (via the existing `MentionIndexEntry`), caption/`desc`, on-screen text, transcript, hashtags, author — weighted so an entity-name hit outranks a transcript hit. Sub-second on a ~5,000-item library. This is LOCAL, in-memory, tokenized retrieval — NOT a vector database (the "understanding" happens at analysis + MCP time; search itself is fast retrieval over the produced text). A vector index is a later, separately-justified bet.
- **ADD a minimal library surface** (`library.html`/`library.ts`): a search box, a ranked results list (poster + caption snippet + which field matched + provenance), and an item-detail view with the provenance strip. This is the deliberately-plain UI from the release plan — enough to use the product and record the demo. It is NOT the full "Paper & Proof" library (that is `library-ui`, behind the G2 design gate).

Non-goals: no design system / final visual language (that is `library-ui`); no vector/semantic index in v1; no new store schema (reads analyzed items + the mention index as they already exist).

## Capabilities

- **New capability**: `search` — how a person finds a saved item by its content and resolved entities.

## Impact

- New: `src/lib/search/` — `index.ts` (`buildIndex(items)`), `query.ts` (`query(index, q) → ranked ids`), both PURE + unit-tested; a new `library.html` + `library.ts` glue surface.
- Reads: the store's analyzed `items` + `MentionIndexEntry`; no schema change.
- Invariants: search is fully local (no network); results show provenance; a no-match is an honest empty state.
