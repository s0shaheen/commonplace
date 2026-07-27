# Proposal — mcp-server

## Why

This is the agent surface and the payoff the founder cares about: the point of an owned, understood archive is that the user's OWN AI (Claude) can query it and act on it. It's also the living proof of "leave anytime" — the MCP server reads the portable open-schema EXPORT the extension already produces (`toOpenSchemaExport`), not any private internals, so the schema literally is the interface a third party consumes. And it's the demo: "point Claude at my library and pull the professional-development thread / every restaurant / every recipe," which runs in Claude Desktop against the real corpus.

## What changes

- **A standalone Node MCP server** (TypeScript, compiled) that loads the user's exported open-schema library JSON, builds an in-memory search index over it (reusing the pure `src/lib/search` core via an open-schema→searchable adapter — no re-implementation), and exposes read-only tools:
  - `search_library(query, limit?)` — ranked items by content (transcript/caption/on-screen/entities), each with its provenance.
  - `get_entity(name | id)` — a resolved entity and the items that reference it.
  - `list_by_type(type)` — entities of a NamedEntity type (place, music_recording, product, …).
  - `resolve_item(id)` — one item's full record + analysis.
- **Shipped MCP prompts** (curated deep queries so the demo works out of the box): "map every restaurant in my saves," "pull every recipe into one list," "what did I save about <topic>," "find the video where someone said <X>."
- **Packaged as an MCPB desktop extension** for Claude Desktop, directory-submission-ready: mandatory tool annotations (`readOnlyHint`), a privacy note (reads only the local export file — no network), setup docs.

Non-goals: no server that sees plaintext internals (the export file is the boundary); no write tools; no hosted/remote server in v1 (local stdio only); no ChatGPT app (weak discovery today — deferred).

## Capabilities

- **New capability**: `mcp` — how the user's own agent reads the library over MCP.

## Impact

- New: an `mcp/` package — the server, the four tools, the shipped prompts, an open-schema→searchable adapter, and the MCPB manifest + build. Reuses `src/lib/search` (pure) and the open-schema types.
- Consumes: the open-schema export (whatever the current schema version emits — including v2's MM:SS timestamps; the MCP layer is version-tolerant on optional fields).
- Invariants: fully local (no network), read-only, results carry provenance; the server never sees anything the user didn't export.
