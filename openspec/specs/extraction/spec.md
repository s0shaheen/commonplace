# extraction Specification

## Purpose
TBD - created by archiving change extractor-v2-gemini3. Update Purpose after archive.
## Requirements
### Requirement: Vendor-aligned decoding for the production model
The extractor SHALL configure generation per the production model's guidance — not
setting `temperature`/`top_p`/`top_k`, using a low thinking level, and bounding output
tokens — so that constrained JSON decoding cannot degenerate into an unbounded numeric loop.

#### Scenario: The fake-done-of-analysis (numeric loop) does not occur
- WHEN the extractor analyzes a video that previously drove a repeating-decimal timestamp loop under temperature-0
- THEN the response SHALL terminate normally and parse as valid JSON (no tens-of-thousands-of-token runaway)

### Requirement: Truncated output degrades to an honest partial
The extractor SHALL, when a response is truncated (finish reason MAX_TOKENS or an
unterminated JSON), salvage the valid prefix into a partial extraction marked as partial,
and SHALL never present a truncated result as complete nor silently drop the item.

#### Scenario: Output hits the token cap
- WHEN a generation is cut off at the output cap mid-array
- THEN the extractor SHALL return the valid completed elements marked partial, not an empty/failed drop presented as done

### Requirement: Video-native timestamps
Evidence timestamps SHALL be represented in the model's native `MM:SS` form, and any
downstream media-fragment selector SHALL be derived by parsing that form.

#### Scenario: An evidence span carries a timestamp
- WHEN the model localizes evidence to a moment in the video
- THEN the emitted `t_start`/`t_end` SHALL be `MM:SS` strings, and the export's media-fragment selector SHALL parse them to seconds

### Requirement: Native video ingestion via the File API is the managed default
The managed lane SHALL analyze the video natively by default, uploading it via the File API
(not inline base64, which fails on larger videos), while the local lane keeps keyframe+VTT
ingestion; when video bytes are unavailable the managed lane SHALL fall back honestly.

#### Scenario: A large video is analyzed
- WHEN the managed lane analyzes a video whose bytes exceed the inline limit
- THEN it SHALL upload via the File API and analyze successfully, not fail on an inline-size limit

#### Scenario: Video bytes unavailable
- WHEN the managed lane has no video bytes for an item
- THEN it SHALL fall back to keyframes/caption analysis with an honest marker, never silently produce nothing

