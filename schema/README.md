# Commonplace measurement-contract schemas

The frozen measurement contract for Commonplace: the JSON Schemas (and, from
Task 3, the SHACL shapes + JSON-LD context) that every captured item and every
extraction is validated against. Derived from the governing ontology,
`docs/product/_ONTOLOGY.md` v3, and its teaching companion
`docs/product/_SCHEMA-DERIVATION.html`.

## Layout

| Path | What it is |
|------|------------|
| `json/item.schema.json` | The cross-platform **base container** (ontology v3 §2). One base object; each platform is an Application Profile that touches zero base fields. Draft 2020-12. |
| `fixtures/valid/*.json` | Items that MUST validate — the contract's positive examples (minimal item, full-fat TikTok video, self-authored note, carousel, text post). |
| `fixtures/invalid/*.json` | Items that MUST fail — the admission-rule guards (missing identity handle, empty saves). |
| `CHANGELOG.md` | The semver history of the contract. |
| `LICENSE` | MIT. |

Later Phase-1 tasks add `json/extraction.schema.json`, gold/pred schemas, the
facet vocabulary, `shacl/`, and the JSON-LD context alongside these.

## The admission rule (write-time)

The **only** required fields on an item are:

1. `identity` — with at least one handle among `permalink`, `canonicalId`,
   `contentHash` (RFC 6920 `ni:///sha-256;…`), and a `status`.
2. `saves` — at least one save, each carrying at least one source with an `at`
   timestamp.

Everything else is optional or profile-level ("honest absence" throughout).
This is what lets the base shape pass on 100% of items — TikTok video, Reddit
thread, PDF, or camera-roll screenshot — which is what makes a pooled library
and a pooled benchmark possible.

## Versioning policy

- **Semver**, one line for all contract files together. Current: `1.0.0-rc.1`
  (release-candidate freeze from ontology v3). Formal `1.0.0` is cut at
  eval-sequence step 6 per `_EVAL-METHOD.md` §1.
- **Additive and durable.** Fields are **never deleted, only deprecated.** A
  field that leaves active use is marked deprecated in the CHANGELOG and kept in
  the schema so historical data stays valid. Breaking removals would force a new
  major and re-labeling of the benchmark — the ontology was designed
  pre-ingestion specifically so that every future change is additive.
- New enum values and new optional fields are **minor** bumps; a change that can
  invalidate previously-valid data is **major**.

## Validating

From the repo root:

```sh
npm run schema:check     # runs the schema-fixture + SHACL pytest gates
# or directly:
cd eval && uv run pytest -q tests/test_schema_fixtures.py
```

The Python gate lives in `eval/src/commonplace_eval/schema_gate.py`
(`validate_item`, `load_schema`).
