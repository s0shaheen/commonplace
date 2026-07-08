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
| `json/extraction.schema.json` | A single **extraction** the engine emits (ontology v3 §3–4): a `oneOf` on `kind` over the four Referent kinds (NamedEntity, Concept, Claim, StructuredContent) + FacetAssignment. Every extraction owns non-empty `evidence[]`; NamedEntity carries the grounding nil/externalId invariant. `item.schema.json`'s `extractions[]` validates against this. |
| `json/extractor-output.schema.json` | The flat, **Gemini `response_schema`-safe** model-facing schema (no `$ref`/`oneOf`/`allOf`, string enums). Carries no grounding fields — grounding is a downstream resolver step. |
| `json/gold.schema.json` | The human-verified **gold record** (one per item, JSONL) the metric harness scores against. Mentions enforce `gold_id` XOR `nil` and `nil="NIL_NO_ID"` ⇒ non-empty `failed_queries`. |
| `json/pred.schema.json` | The system **prediction record** scored against gold; mentions carry grounding. |
| `vocab/facets.json` | The frozen v1.0 **facet vocabulary** — the closed enum source kept out of the JSON Schemas so it evolves additively. Enforced at runtime by `schema_gate`. |
| `vocab/named-entity-anchors.json` | The 9 groundable NamedEntity **types + KB anchors** (from `_EVAL-METHOD.md` §2). Reference table, not a validated schema. |
| `context/commonplace.context.jsonld` | The **JSON-LD context** that lifts item JSON into RDF (`@vocab` = `cpl:`, with schema.org / W3C Web Annotation / PROV-O overrides). The bridge from the JSON layer to the SHACL layer; every field a SHACL shape keys off is mapped here. |
| `shacl/base.shape.ttl` | The **base SHACL shape** (`sh:targetClass cpl:Item` / `cpl:Extraction`): the KOE cross-analyzability gate. Enforces the admission rule (≥1 identity handle, ≥1 dated save), the evidence-provenance gate (every extraction ≥1 evidence), and the assertion_mode/channel/mediaKind enums. **Must conform on 100% of `fixtures/valid/` regardless of platform.** |
| `shacl/profile-tiktok.shape.ttl` | The **TikTok application profile** (DCTAP → SHACL). Targets `origin.platform == "tiktok"` via a SPARQL-based target and tightens base optional fields (canonicalId required, identity.status = platform_verified, mediaKind ∈ {video, photo}) — touching zero base fields for any other platform. |
| `profiles/tiktok.dctap.csv` | The **DCTAP** table mirroring the TikTok profile, one row per constraint. The human-editable source-of-truth convention for application profiles. |
| `fixtures/valid/*.json` | Items that MUST validate — the contract's positive examples (minimal item, full-fat TikTok video, self-authored note, carousel, text post, grounded-extraction item). |
| `fixtures/invalid/*.json` | Items that MUST fail — the admission-rule guards (missing identity handle, empty saves) and extraction guards (zero-evidence, bad assertion mode, bad entity type). |
| `CHANGELOG.md` | The semver history of the contract. |
| `LICENSE` | MIT. |

The Python gates live in `eval/src/commonplace_eval/`: `schema_gate.py`
(JSON Schema) and `shacl_gate.py` (`validate_shacl(item, profile=None)` — RDF/SHACL).

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

- **Semver**, one line for all contract files together. Current: `1.0.0-rc.6`
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
cd eval && uv run pytest -q tests/test_schema_fixtures.py tests/test_shacl.py
```

The Python gates live in `eval/src/commonplace_eval/`: `schema_gate.py`
(`validate_item`, `load_schema`) and `shacl_gate.py` (`validate_shacl`).
