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

## Packaging (MCPB → Connectors Directory)

Local stdio server bundled to a single node file (esbuild), wrapped as an `.mcpb` desktop
extension per the directory requirements (verified 2026-07-21): tool annotations with
`readOnlyHint: true` on all four tools, a privacy policy (local-only, read-only), setup docs,
working examples. Directory submission is a founder step (an account + the submit click);
the package is prepared here.

## Testing

- Adapter: open-schema fixture → indexable shape → `query` returns the expected ranked items (incl. a transcript-only "dark matter" hit), reusing the search-core guarantees.
- Each tool: given a small export fixture, returns the right shape + provenance; `get_entity`/`list_by_type` group correctly; `resolve_item` round-trips.
- The server boots on a fixture export and answers a `search_library` call end to end (integration).
- `npm test` + `npm run typecheck` green; no new runtime dep beyond an MCP SDK for the server package.
