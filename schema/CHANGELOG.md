# Changelog — Commonplace measurement-contract schemas

All schemas in `schema/json/` (and their SHACL/JSON-LD companions) are versioned
together under one semver line. Format follows [Keep a Changelog](https://keepachangelog.com/).

## [1.0.0-rc.2] — 2026-07-08

Additive fidelity pass on `item.schema.json` to close three ontology v3 §2 gaps
the base container omitted. All changes are purely additive — every rc.1 fixture
and `$def` still validates unchanged; no field removed or narrowed.

### Added
- Root `gates` (ontology §2.6 context) via new `$defs/ContextGates` —
  `{ replyControls?: string, quoteControls?: string }`, `additionalProperties:
  false`. Captures reply/quote controls for X Communities, subreddits, Discord
  guilds. Distinct from the `gates[]` enum inside `CaptureFidelity` (capture
  obstacles); this one is context, not capture state.
- Root `captureStatus` (ontology §2.5) — optional free-form `{ "type":
  "string" }`. The ontology names the field without pinning a shape, so an open
  string is the deliberate minimal-commitment encoding; it will be tightened
  when the ontology defines a value set. (`item.schema.json`'s `description` now
  notes this instead of claiming §2 is encoded "exactly".)

### Changed
- Root `capturedAt` is now repeatable (ontology §2.5 "repeatable `capturedAt`
  on re-capture") — an `anyOf` of a single `Timestamped` **or** a non-empty
  array of `Timestamped`. Back-compatible: an existing single-object
  `capturedAt` still validates.

## [1.0.0-rc.1] — 2026-07-08

Initial freeze from `_ONTOLOGY.md` v3; formal 1.0.0 at eval-sequence step 6
(freeze) per `_EVAL-METHOD.md` §1.

### Added
- `item.schema.json` — the cross-platform base container (ontology v3 §2). Draft
  2020-12. Admission rule (write-time): the only required fields are `identity`
  (≥1 handle among `permalink` / `canonicalId` / `contentHash`) and ≥1 `save`
  with a source `at`; everything else optional.
- `$defs`: `Identity`, `Timestamped`, `Origin`, `Creator`, `Save`, `Asset`,
  `TimelineEntry`, `Interactive`, `ContentCredentials`, `ChildRef`, `Collection`,
  `Reference`, `Depicts`, `WorkRef`, `Version`, `Lifecycle`, `CaptureFidelity`,
  `Scope`, `Metrics` (Observation-shaped), `Annotation`.
- `additionalProperties: false` at root and in every `$defs` object, except
  `platformExtras` (free namespaced proxy) and the selector objects
  (`Save.targetSelector`, `Annotation.selector`) which stay open until the
  Selector schema lands.
- `extractions[]` references `extraction.schema.json` via a cross-schema `$ref`;
  until that file exists the eval gate resolves it to a permissive stub.
- Fixtures: `fixtures/valid/{minimal-item,tiktok-video,self-note,carousel,text-post}.json`,
  `fixtures/invalid/{no-identity,no-save}.json`.
