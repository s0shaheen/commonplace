# Tasks — mcp-server

## 1. Adapter + search reuse
- [ ] 1.1 Pure `openSchemaToIndexable(exportItem)` mapping the searchable layers from the frozen export shape
- [ ] 1.2 Tests: adapter + reused `buildIndex`/`query` return expected ranked results incl. a transcript-only hit, against an export fixture

## 2. The MCP server + tools
- [ ] 2.1 `mcp/` package: a local stdio MCP server (MCP SDK) that loads the export at a configured path, builds the index once
- [ ] 2.2 `search_library` / `get_entity` / `list_by_type` / `resolve_item` — read-only, provenance-carrying; per-tool tests against a fixture
- [ ] 2.3 Shipped MCP prompts: restaurant-map, recipe-collect, topic-pull, quote-find

## 3. Packaging
- [ ] 3.1 esbuild bundle to a single node file; MCPB manifest with readOnlyHint on all tools + a local-only privacy policy + setup docs + working examples
- [ ] 3.2 Boot-on-fixture integration test: server answers a search_library call end to end

## 4. Green
- [ ] 4.1 `npm test` + `npm run typecheck` green
- [ ] 4.2 `openspec validate mcp-server --strict` passes
- [ ] 4.3 (founder step) Directory submission — account + submit click; note it, don't block
