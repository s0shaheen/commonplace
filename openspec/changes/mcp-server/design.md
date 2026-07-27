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

## Distribution: npm first (any MCP client), MCPB second (Claude Desktop one-click)

MCP is an open protocol, so the goal is "works in any AI tool that speaks MCP," not "works in
Claude." Two artifacts, one server:

1. **npm package with a `bin` entrypoint (PRIMARY).** Published as e.g. `@commonplace/mcp`,
   bundled to a single node file. Any client that supports local stdio MCP servers adds it with
   a standard config block — `{"command":"npx","args":["-y","@commonplace/mcp","--library","<path>"]}`.
   That covers Claude Desktop, Claude Code, Cursor, VS Code, Cline, Windsurf, Zed, and anything
   else that speaks stdio MCP. This is the universal path and the one the README documents.
2. **`.mcpb` desktop extension (SECONDARY).** The same server wrapped for Claude Desktop's
   one-click install + the desktop-extension gallery: `readOnlyHint: true` on all four tools, a
   privacy policy (local, read-only), setup docs, working examples. Convenience, not a
   requirement. Directory submission is a founder step (account + submit click).

**Honest scope limit:** a *local* stdio server cannot be used by web-only clients (claude.ai in
a browser, ChatGPT web), which need a remote HTTP server. We are not shipping a hosted version:
that would mean the user's library living on our servers, which contradicts the local-first
commitment. A user who wants remote access can self-host the same package. Revisit only if there
is real demand, and only as a self-host story.

## Testing

- Adapter: open-schema fixture → indexable shape → `query` returns the expected ranked items (incl. a transcript-only "dark matter" hit), reusing the search-core guarantees.
- Each tool: given a small export fixture, returns the right shape + provenance; `get_entity`/`list_by_type` group correctly; `resolve_item` round-trips.
- The server boots on a fixture export and answers a `search_library` call end to end (integration).
- `npm test` + `npm run typecheck` green; no new runtime dep beyond an MCP SDK for the server package.
