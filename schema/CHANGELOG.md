# Changelog — Commonplace measurement-contract schemas

All schemas in `schema/json/` (and their SHACL/JSON-LD companions) are versioned
together under one semver line. Format follows [Keep a Changelog](https://keepachangelog.com/).

## [1.0.0-rc.5] — 2026-07-08

Phase-1 close-out housekeeping — namespace unification, vocab version sync, and a
stale-comment reword. Purely cosmetic/identifier changes: no schema shape, `$def`,
constraint, or fixture is added, removed, or narrowed; every rc.4 fixture still
validates unchanged.

### Changed
- **Namespace unified.** All five `schema/json/*.schema.json` `$id`s move from
  `https://commonplace.tools/schema/…` to `https://commonplace.app/schema/…`, so
  the JSON Schema `$id` host now matches the JSON-LD context namespace
  (`cpl:` = `https://commonplace.app/ns#`). Cross-schema `$ref`s are relative
  filenames and the eval registry resolves by filename, so resolution is
  unaffected (verified: the full suite still validates every fixture). **The FINAL
  domain is confirmed at the 1.0.0 freeze — rc identifiers (host and version) may
  still churn before then; 1.0.0 may not.**
- `vocab/facets.json` and `vocab/named-entity-anchors.json` — `version` bumped
  `1.0.0-rc.1` → `1.0.0-rc.5` to rejoin the single measurement-contract semver
  line (they had been left at the rc.1 freeze while the schemas advanced).
- `item.schema.json` — reworded the two open-selector `description`s
  (`Save.targetSelector`, `Annotation.selector`) from the stale "Open until Task 2
  defines the Selector schema" to "kept open deliberately; the extraction-layer
  Selector lives in extraction.schema.json" (the Selector `$def` has shipped in
  `extraction.schema.json` since rc.3; these base-container selectors stay open by
  design).

## [1.0.0-rc.4] — 2026-07-08

The RDF/standards **conformance layer** — the machine-checkable form of the
KOE-STANDARD validation checklist (`_KOE-STANDARD.md`). Purely additive: no JSON
Schema, `$def`, or fixture changes; every rc.3 item still validates unchanged.
This turns the "Cross-platform" and "Provenance & evidence" checklist items into
CI-enforceable SHACL.

### Added
- `context/commonplace.context.jsonld` — the JSON-LD context that lifts item
  JSON into RDF. `@vocab` = `cpl:` (`https://commonplace.app/ns#`) so no field is
  silently dropped; overrides map to reused standard vocabularies where clean —
  `title`→`schema:name`, `body`→`schema:text`, `permalink`→`schema:url`,
  `creator`→`schema:creator`, evidence `selector`→W3C Web Annotation (`oa:`),
  `wasDerivedFrom`→`prov:wasDerivedFrom` — and `cpl:` terms elsewhere
  (`children`, etc.) where no clean standard term exists. `saves[].sources[].at`
  is renamed to `cpl:savedAt`; `evidence`/`saves`/`sources` are `@container:@set`.
- `shacl/base.shape.ttl` — the base shape, the **cross-analyzability gate**.
  `cpl:ItemShape` (`sh:targetClass cpl:Item`): `sh:or` over the three identity
  handles; a `saves→sources→savedAt` sequence-path `minCount 1`; `mediaKind`
  `sh:in` the 7 kinds when present. `cpl:ExtractionShape`
  (`sh:targetClass cpl:Extraction`): `cpl:evidence minCount 1` (the zero-evidence
  provenance gate), and `sh:in` on evidence `assertion_mode` (4) / `channel` (6).
  **Conforms on 100% of `fixtures/valid/` regardless of platform.**
- `shacl/profile-tiktok.shape.ttl` — the TikTok application profile. A
  SPARQL-based target on `origin.platform == "tiktok"` selects the item; three
  constraints TIGHTEN base optional fields (canonicalId required,
  identity.status = platform_verified, mediaKind ∈ {video, photo}) and touch zero
  base fields for any other platform (verified: a Reddit item that breaks every
  TikTok rule still passes under the profile).
- `profiles/tiktok.dctap.csv` — the DCTAP table mirroring the profile, one row
  per constraint (`shapeID,propertyID,propertyLabel,mandatory,repeatable,valueDataType,valueConstraint,note`).

### Changed
- `shacl_gate.py` (new module) — `validate_shacl(item, profile=None) ->
  (conforms, report)`. Lifts the item through the context (stamping
  `@type cpl:Item` on the root and `cpl:Extraction` on each extraction node in
  context-processing code), parses to an rdflib graph, and runs pyshacl
  (`advanced=True` for the profile's SPARQL target) against the base shape (+ the
  profile shape when given). Mirrors `schema_gate.py`'s cached-loader patterns.
- `tests/test_shacl.py` (new) — the base shape parametrized across every
  `fixtures/valid/*.json` (the headline gate), the zero-evidence negative (proves
  the shape fires — no vacuous pass), and the TikTok profile.

## [1.0.0-rc.3] — 2026-07-08

Additive extraction layer: the schemas the engine emits, the model-facing
extractor schema, the gold/pred record shapes the metric harness consumes, and
the frozen facet vocabulary (ontology v3 §3–4, `_EVAL-METHOD.md` §2). Purely
additive — every rc.2 fixture and `$def` still validates unchanged. This
replaces the permissive stub that `item.schema.json`'s `extractions[]` resolved
to; base-container fixtures without `extractions` are unaffected.

### Added
- `extraction.schema.json` — a single extraction, a `oneOf` discriminated on
  `kind` over the four Referent kinds + FacetAssignment. `$defs`: `Evidence`,
  `Selector` (W3C WA suite: TextQuote/TextPosition/Fragment/Cfi/Range,
  recursive `refinedBy`), `Grounding` (nil/externalId `if/then` invariant),
  `NamedEntityExtraction`, `ConceptExtraction`, `ClaimExtraction`,
  `StructuredContentExtraction` (slot values are Observations), `FacetAssignment`,
  plus `Common`/`Observation`/enum defs. Every extraction requires non-empty
  `evidence[]` (minItems 1); channel enum (6), assertion_mode enum (4),
  NamedEntity `type` enum (9). Kind branches close with
  `unevaluatedProperties: false`; selectors stay open (extensible registry).
- `extractor-output.schema.json` — the flat, Gemini `response_schema`-safe
  model-facing schema. NO `$ref`, NO `oneOf`/`allOf`; string enums; the Evidence
  object inlined at each of the four extraction arrays; carries **no grounding
  fields** (grounding is the downstream resolver's job). Every extraction
  element requires ≥1 evidence.
- `gold.schema.json` — the human-verified gold record (one per item, JSONL). All
  layer blocks optional except `item_id`. mentions enforce `gold_id` XOR `nil`
  (`oneOf`) and `nil="NIL_NO_ID"` ⇒ non-empty `failed_queries` (`if/then`); two
  distinct NIL labels `NIL_NO_ID` / `NON_ENTITY`. `GoldMention` also carries an
  optional structured `verification` object (`{name?, address?, lat?, lng?,
  url?}`, `additionalProperties: false`) — the `_EVAL-METHOD.md` §3 staleness
  guard: store a Place's name + address + lat/lng (Google Place IDs go stale, so
  the human-readable anchor is what keeps the label reproducible). Additive and
  optional; every prior fixture still validates.
- `pred.schema.json` — the system-prediction record. mentions carry `grounding`
  with the same nil/externalId invariant.
- `vocab/facets.json` (v1.0) — the frozen 9-facet vocabulary, kept out of the
  JSON Schemas so it evolves additively; enforced at runtime by `schema_gate`.
  `topic`/`presentation` ported, the rest `v1.0-proposal`.
- `vocab/named-entity-anchors.json` — the 9 groundable types + KB anchors,
  copied from `_EVAL-METHOD.md` §2. `restaurant` is absorbed into `place`.
- Fixtures: `fixtures/valid/extraction-grounded.json` (a TikTok item with a
  grounded `music_recording` + FragmentSelector evidence and a facet assignment);
  `fixtures/invalid/{zero-evidence-extraction,bad-assertion-mode,bad-entity-type}.json`.

### Changed
- `schema_gate.py` — added `validate_extraction`, `validate_extractor_output`,
  `validate_gold_record`, `validate_pred_record` (the last three enforce facet
  values against `vocab/facets.json`; extraction/gold/pred also enforce the
  structural invariants above). The ref-resolution registry now resolves refs
  strictly from disk; an unknown/typo'd `$ref` raises `NoSuchResource` (fails
  loudly) instead of resolving to a permissive `{"type":"object"}` stub.

### Fixed
- `extraction.schema.json` — `extractor_ref` (`{model, version?, prompt?, run?}`)
  now lives on **Evidence**, not at the extraction (`Common`) level. Ontology v3
  §4 places it on Evidence: each evidence span records which extractor produced
  it, which is load-bearing for fused multi-extractor cascades (one extraction can
  carry spans from different extractors). Corrected before any consumer read the
  extraction-level field (rc.3 is unreleased; no fixture or test exercised it). The
  `extraction-grounded` fixture moves its `extractor_ref` into `evidence[0]`
  accordingly. **`extractor-output.schema.json` is deliberately left untouched:** it
  is what the model itself emits under constrained decoding, and the model cannot
  know its own runtime ref (model/version/prompt/run are stamped by the pipeline
  downstream, not the extractor) — so evidence there carries no `extractor_ref`.
- `test_extractor_output_schema.py` — added two negative regression tests guarding
  load-bearing constraints that previously had no committed guard: a mention
  carrying a `grounding` object is rejected (`additionalProperties: false` — the
  model never emits grounding), and a mention with `evidence: []` is rejected
  (`minItems 1`).

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
