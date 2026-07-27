# Design — mcp-server

## Boundary: the export file IS the interface

The MCP server does NOT touch the extension's IndexedDB. It loads the open-schema export
JSON (`{ schemaVersion, exportedAt, items[] }` from `toOpenSchemaExport`) at a configured
path. This is deliberate: it's the "leave anytime" proof and the privacy boundary (the
server sees only what the user chose to export). A future live bridge is a separate change.

## Reuse the pure search core via an adapter

`src/lib/search` (buildIndex/query) is pure TS and runs in node. But it indexes the internal
`IndexableItem` (CapturedItem + analysis), while the export is the frozen open-schema shape.
Write a small pure adapter `openSchemaToIndexable(exportItem) → IndexableItem-shaped` that maps
the searchable layers back: entity surfaces from the item's mentions/referents, caption from
the post text, on-screen/transcript from the evidence quotes (VISUAL_TEXT / VERBAL_AUDIO), etc.
Then reuse `buildIndex` + `query` unchanged — same ranking (entity > caption > transcript) the
UI uses, so the agent and the UI agree. Unit-test the adapter against an export fixture.

## The four tools (read-only, provenance-carrying)

- `search_library(query, limit=20)` → `[{ id, title, why_it_matched, provenance, url }]` — reuses `query()`.
- `get_entity(name | id)` → the resolved entity (type, durable id if grounded, confidence/NIL) + the items referencing it.
- `list_by_type(type)` → entities of a NamedEntity type, with counts.
- `resolve_item(id)` → the full item: text layers, entities, facets, claims, provenance.
All return structured JSON; each includes the provenance so Claude can cite why an item surfaced.

## Shipped prompts

MCP prompts (not tools) that pre-compose the good demos so a first run sings: restaurant-map,
recipe-collect, topic-pull, quote-find. These are the "map every restaurant in my saves" beat.

## Distribution: a paid, closed product that still speaks standard MCP (DEC-037)

The server is part of the managed/SaaS offering — not published open source. It remains a
standard MCP server, so it drops into any client that speaks stdio MCP with a normal config
block; the change is commercial (licensed, closed source), not protocol-level. An `.mcpb`
wrapper provides Claude Desktop one-click install.

**The open architectural fork — flag, do not silently pick.** "Managed MCP" has two very
different shapes, and they trade the product's core trust commitment against reach:

| | **A. Local + licensed (default)** | **B. Hosted / remote** |
|---|---|---|
| Where the library lives | the user's machine | our servers |
| Works in desktop/IDE MCP clients | yes | yes |
| Works in web clients (claude.ai browser, ChatGPT web) | **no** (they require a remote server) | **yes** |
| "We cannot read your library" (SPEC v5 commitment) | **intact** | **broken** — server-side search requires readable plaintext |
| Billing | license key gates the local binary | natural subscription |

Default to **A**: it preserves local-first, which is the product's trust argument and a
differentiator no incumbent can copy. **B** is the only way to reach web-only clients, and it
cannot be reconciled with client-side encryption (a server that can search the library can read
it). If web/mobile reach becomes a real requirement, B is a deliberate, separately-ratified
decision with a rewritten privacy promise — never a quiet drift.

## Testing

- Adapter: open-schema fixture → indexable shape → `query` returns the expected ranked items (incl. a transcript-only "dark matter" hit), reusing the search-core guarantees.
- Each tool: given a small export fixture, returns the right shape + provenance; `get_entity`/`list_by_type` group correctly; `resolve_item` round-trips.
- The server boots on a fixture export and answers a `search_library` call end to end (integration).
- `npm test` + `npm run typecheck` green; no new runtime dep beyond an MCP SDK for the server package.
