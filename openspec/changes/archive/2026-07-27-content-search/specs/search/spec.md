# Search — delta spec (change: content-search)

## ADDED Requirements

### Requirement: Search over content, not titles
The system SHALL let a person find a saved item by matching against its content text layers —
resolved entity/referent names, caption, on-screen text, transcript, hashtags, and author —
ranked so a resolved-entity match outranks a body-text match, with results returned locally
and sub-second on a multi-thousand-item library.

#### Scenario: Find a transcript-only item (the dark matter)
- WHEN the query matches words spoken in a video but absent from its caption and hashtags
- THEN that item SHALL appear in the results (a title/tag search would miss it)

#### Scenario: Entity match ranks first
- WHEN the query matches a resolved entity name on one item and only a transcript word on another
- THEN the entity-match item SHALL rank above the transcript-match item

#### Scenario: No match is honest
- WHEN the query matches nothing
- THEN the system SHALL show an explicit empty state, never a fabricated or unrelated result

### Requirement: A minimal library surface with provenance
The system SHALL provide a library view with a search box, a ranked results list showing each
item's poster, a matched-text snippet, and its provenance, and an item-detail view — all local,
with no network calls for search.

#### Scenario: Result carries provenance
- WHEN a result is shown
- THEN it SHALL display which field matched and the item's provenance, so the user can trust why it surfaced
