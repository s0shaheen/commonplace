# import Specification

## Purpose
TBD - created by archiving change zip-import-and-upload. Update Purpose after archive.
## Requirements
### Requirement: Raw export-zip acceptance with platform routing
The system SHALL accept the platform's raw data-export `.zip` file, decompress it in the
options page (off the service-worker thread), and route each recognized entry to the correct
parser by its path, while still accepting a bare extracted `.json`.

#### Scenario: TikTok export zip
- WHEN the user drops a `.zip` containing `user_data_tiktok.json`
- THEN the system SHALL decode that entry and import it via the TikTok DYD parser

#### Scenario: Instagram export zip
- WHEN the user drops a `.zip` containing `your_instagram_activity/saved/saved_posts.json`
- THEN the system SHALL decode that entry and import it via the Instagram saved-posts parser

#### Scenario: Bare extracted json still works
- WHEN the user drops an already-extracted `user_data.json`
- THEN the system SHALL import it as today, without requiring a zip

### Requirement: Instagram saved-posts import
The system SHALL parse `saved_posts.json` into library items tagged `platform: "instagram"`,
carrying URL, caption, title, hashtags, owner, and save timestamp, and SHALL attach collection
membership from `saved_collections.json` when present.

#### Scenario: A saved reel with a caption
- WHEN a `saved_posts` entry has a `/reel/<code>/` URL and a Caption label value
- THEN the imported item SHALL have that shortcode as id, the permalink as join key, the caption as its description, and be text-searchable

#### Scenario: Collection membership
- WHEN a post URL appears under a `saved_collections` entry named "Recipes"
- THEN the imported item SHALL record membership in the "Recipes" collection

### Requirement: Cross-platform item tagging
The system SHALL tag every item with its source platform and carry that tag through storage
and the open-schema export, without breaking existing TikTok items (which default to `"tiktok"`).

#### Scenario: Existing TikTok item unaffected
- WHEN an item has no explicit platform (a pre-existing TikTok capture)
- THEN it SHALL be treated as `platform: "tiktok"` and continue to validate and export

### Requirement: Import reconciliation report
The system SHALL report, after an import, how the parsed items reconcile against the current
library and against the export's own declared list size, and SHALL never claim more imported
than were parsed.

#### Scenario: Import recovers the un-scrolled tail
- WHEN an export lists L items and the library already held fewer
- THEN the report SHALL surface added, merged, already-present, parsed, and the export's declared L, so the recovered gap is visible

