# MCP — delta spec (change: mcp-server)

## ADDED Requirements

### Requirement: The user's agent reads the library over MCP, locally, from the export
The system SHALL provide a local, read-only MCP server that loads the user's open-schema
export and exposes tools to search and read the library, making no network calls and
seeing nothing the user did not export.

#### Scenario: Search returns ranked, provenance-carrying results
- WHEN the agent calls `search_library` with a content query
- THEN the server SHALL return items ranked by content (entity > caption > transcript, reusing the library's own ranking), each carrying provenance, with no network access

#### Scenario: A transcript-only item is findable by the agent
- WHEN the query matches only a video's spoken words (absent from caption/hashtags)
- THEN `search_library` SHALL still return that item (the dark matter), consistent with the in-app search

### Requirement: Entity and item tools
The server SHALL expose `get_entity`, `list_by_type`, and `resolve_item` so the agent can
navigate resolved entities and read a full item, each result carrying provenance and any
durable id / NIL state faithfully.

#### Scenario: List places
- WHEN the agent calls `list_by_type("place")`
- THEN the server SHALL return the place entities in the library with the items that reference them

### Requirement: Directory-ready, read-only packaging
The server SHALL be packaged as an MCPB desktop extension with read-only tool annotations
and a local-only privacy policy, submission-ready to the Connectors Directory.

#### Scenario: Tools are annotated read-only
- WHEN the package is inspected for directory submission
- THEN every tool SHALL declare `readOnlyHint` and the package SHALL include a privacy policy stating local, read-only operation
