# Changelog — Commonplace measurement-contract schemas

All schemas in `schema/json/` (and their SHACL/JSON-LD companions) are versioned
together under one semver line. Format follows [Keep a Changelog](https://keepachangelog.com/).

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
