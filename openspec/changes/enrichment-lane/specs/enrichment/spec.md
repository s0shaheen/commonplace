# Enrichment — delta spec (change: enrichment-lane)

## ADDED Requirements

### Requirement: Skeleton items are enriched before analysis
The system SHALL, before analyzing a content-poor imported item, fill its content fields via
an enrichment stage, and SHALL skip enrichment for items that already carry content (live captures).

#### Scenario: Imported TikTok skeleton
- WHEN a raw item has an empty description, no transcript, and no poster (the DYD-skeleton signature)
- THEN it SHALL be enriched before it is analyzed

#### Scenario: Live-captured item skips enrichment
- WHEN a raw item already has a description and poster from live capture
- THEN it SHALL proceed straight to analysis without any enrichment network call

### Requirement: Free-default enrichment via official oEmbed
The system SHALL, on the free default path, enrich a TikTok item using the platform's official
oEmbed endpoint (caption, author, poster, hashtags) with no third party and no cost.

#### Scenario: oEmbed fills a skeleton
- WHEN a skeleton item is enriched on the default path
- THEN its description, author, poster, and hashtags SHALL be populated from oEmbed and it becomes searchable

### Requirement: Transcript depth via the user's own session
The system SHALL, when the user opts into depth enrichment and a transcript is still missing,
obtain the full item envelope by opening the permalink in the user's own logged-in session and
intercepting the platform's own response, driven through the capture control plane (paced,
resumable, halting on any ban/challenge signal) — never via forged requests.

#### Scenario: Own-session depth run hits a challenge
- WHEN the own-session enrichment run encounters a captcha/ban signal
- THEN it SHALL pause and halt per the control plane, never bot-hammer the permalink sweep

### Requirement: Paid fast lane with provider fallback
The system SHALL, when the user enables the paid fast lane, use tikwm as the primary provider
and fall back to Apify when tikwm errors or is quota-exhausted, and SHALL keep paid lanes
opt-in and off the free/default path.

#### Scenario: tikwm quota exhausted
- WHEN tikwm returns a quota/error signal for an item on the paid lane
- THEN the system SHALL retry that item via Apify

#### Scenario: Both paid providers fail
- WHEN tikwm and Apify both fail for an item
- THEN the item SHALL retain any oEmbed-filled fields and be marked enriched-partial, never fake-complete

### Requirement: Enrichment never overwrites present data with absent
The system SHALL fill only absent fields during merge, and SHALL never replace an existing
value with an empty one, regardless of which lane produced the result.

#### Scenario: A poorer lane after a richer one
- WHEN a later lane returns no value for a field the item already has
- THEN the existing value SHALL be preserved
