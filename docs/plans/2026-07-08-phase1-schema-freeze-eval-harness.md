# Phase 1 — Schema Freeze + Eval Harness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce the frozen measurement contract everything else builds on: JSON Schemas + SHACL shapes generated from ontology v3, the open-source matcher + per-layer metric harness, and the annotation guidelines (`construct.md` + `guidelines.md`).

**Architecture:** Two new top-level directories. `schema/` holds the frozen contract (JSON Schema draft 2020-12 files, JSON-LD context, SHACL shapes in Turtle, DCTAP profile tables, facet vocabularies, fixtures, CHANGELOG). `eval/` holds the open-source Python harness (`commonplace_eval` package via `uv`): normalization → matcher (Hungarian alignment, MUC-5 categories) → per-layer metrics (NamedEntity flagship, Concept, Facets, StructuredContent) → calibration → cluster bootstrap → scorecard matrix CLI. Schema conformance (fixtures vs JSON Schema, SHACL base-shape-passes-on-100%-of-items) is tested inside the Python harness — one toolchain for the whole instrument.

**Tech Stack:** Python ≥3.12 via `uv`; `jsonschema`, `rdflib`, `pyshacl`, `rapidfuzz`, `scipy`, `numpy`, `relplot` (smECE), `pytest`. No TypeScript changes in this phase except `package.json` bridge scripts.

**Normative sources (implementers MUST read the ones named in their task):**
- `docs/specs/knowledge-ontology.md` (v3) — the ontology. The schemas encode it. On any conflict between this plan and the ontology doc, **the ontology doc governs**; flag the conflict in your report.
- `docs/specs/evaluation-methodology.md` — metric definitions, matcher rules, gold-set rules.
- `docs/specs/knowledge-organization-standard.md` — the validation checklist the schemas must pass.
- `docs/specs/knowledge-ontology-hierarchy.txt` — the type hierarchy reference.
- Raw material only (NOT contracts): `src/lib/types.ts`, `src/lib/ontology.ts`, `prompts/observe_video.md`, `docs/archive/dossier/03-engine-classification-methodology-prior-art.md` §"facets".

## Global Constraints

- **Schema versioning:** semver, starts at `1.0.0-rc.1`; never-delete-only-deprecate; every change logged in `schema/CHANGELOG.md`. (KOE tenet 7.)
- **Admission rule (write-time):** the ONLY required item fields are `identity` (≥1 handle among `permalink`/`canonicalId`/`contentHash`) + ≥1 save with `at` (savedAt). Everything else optional. (Ontology §2.1.)
- **Provenance rule:** every extraction carries `evidence[]` with `minItems: 1`. A zero-evidence extraction MUST fail schema validation AND SHACL. (Ontology §4.)
- **NamedEntity `type` enum (exactly 9):** `music_recording · place · screen_work · book · person · product · brand_org · software_app · game`. `restaurant` is NOT a type (it broke the retracted matcher); it is a `place` subtype facet. (Eval method §2.)
- **NIL is two distinct gold labels:** `NIL_NO_ID` (real entity, KB lacks it) vs `NON_ENTITY` (extraction error). (Eval method §2.)
- **assertion_mode enum (4):** `STATED · SHOWN · REPORTED · INFERRED`. **channel enum (closed, 6):** `VERBAL_AUDIO · VERBAL_TEXT · VISUAL_SCENE · VISUAL_TEXT · NONVERBAL_AUDIO · STRUCTURED_METADATA`. `source_role` is an open string. (Ontology §4.)
- **Exact-string matching is BANNED** in the matcher; matching uses normalized + fuzzy tiers with Hungarian bipartite alignment; **headline scheme = strict (normalized mention + type)**. (Eval method §4.)
- **The scorecard is a per-layer MATRIX; the code MUST NOT compute or emit any blended cross-layer number.** (Ontology §8, eval method §4.)
- **Φ_c default c = 10.** (Eval method §4.)
- **Cluster bootstrap:** resample per-video (item_id) clusters, B=10,000 default, 95% percentile CI, seedable. (Eval method §3.)
- **All Python code:** typed (mypy-clean not required, but annotate signatures), stdlib `argparse` for CLI, no deps beyond the listed stack.
- **Tests:** pytest; every module has a test file; TDD (write failing test first).
- **Commits:** one per task minimum, conventional-commit style (`feat(schema): …`, `feat(eval): …`, `docs(eval): …`).
- **License headers/files:** `eval/` and `schema/` each get `LICENSE` (MIT) — they are destined for the public open-core repo (roadmap Phase 7).

## File Structure (end state)

```
schema/
  CHANGELOG.md
  LICENSE
  README.md
  json/
    item.schema.json            # base container (ontology §2)
    extraction.schema.json      # referents + evidence (ontology §3–4)
    extractor-output.schema.json# flat model-facing schema (Gemini response_schema-safe)
    gold.schema.json            # gold-set record format
    pred.schema.json            # prediction record format
  vocab/
    facets.json                 # 8 facets + actionability, v1.0 value enums
    named-entity-anchors.json   # 9 types → KB target + Wikidata P31/P279 anchors
  context/
    commonplace.context.jsonld  # JSON-LD context (schema.org/AS2/PROV-O/OA/SKOS + cpl: namespace)
  shacl/
    base.shape.ttl              # MUST pass on 100% of valid fixtures
    profile-tiktok.shape.ttl    # TikTok application profile (touches zero base fields)
  profiles/
    tiktok.dctap.csv            # DCTAP table for the TikTok profile
  fixtures/
    valid/    (tiktok-video.json, minimal-item.json, self-note.json, carousel.json, text-post.json)
    invalid/  (no-identity.json, no-save.json, zero-evidence-extraction.json, bad-assertion-mode.json, bad-entity-type.json)
eval/
  LICENSE
  README.md
  construct.md                  # Phase-0 construct: "an entity worth grounding" (1 page)
  guidelines.md                 # the annotation codebook (MATTER: written before any label)
  pyproject.toml                # uv project: commonplace-eval
  src/commonplace_eval/
    __init__.py
    normalize.py                # unicode/casefold/article-strip normalization
    matcher.py                  # tiers, Hungarian alignment, COR/INC/PAR/MIS/SPU, 4 schemes
    extraction_metrics.py       # micro/macro P/R/F1, per-type, per-scheme
    grounding_metrics.py        # disambiguation acc, InKB F1, NIL-F1, Φ_c, risk–coverage/AURC
    calibration.py              # Brier, smECE (relplot), reliability bins
    bootstrap.py                # cluster bootstrap CIs + paired bootstrap deltas
    concept_metrics.py          # hierarchical P/R/F1@k (ancestor closure), R-precision@k
    facet_metrics.py            # per-facet macro-F1 + Cohen's κ
    structured_metrics.py       # field accuracy, document accuracy, step recall + order
    schema_gate.py              # JSON Schema validation as a hard gate (not a metric)
    matcher_validation.py       # score the matcher itself vs human-judged pairs
    scorecard.py                # the per-layer matrix (JSON + markdown)
    io.py                       # gold/pred JSONL loading + validation against gold/pred schemas
    cli.py                      # `commonplace-eval score|validate-matcher|check-schemas`
  tests/
    test_normalize.py  test_matcher.py  test_extraction_metrics.py
    test_grounding_metrics.py  test_calibration.py  test_bootstrap.py
    test_concept_metrics.py  test_facet_metrics.py  test_structured_metrics.py
    test_schema_fixtures.py  test_shacl.py  test_scorecard.py  test_io.py
    test_matcher_validation.py
    fixtures/ (gold_sample.jsonl, pred_sample.jsonl, hierarchy_sample.json, matcher_pairs.jsonl)
package.json                    # + "eval:test", "schema:check" scripts
```

---

### Task 1: Scaffold + the base container JSON Schema (`item.schema.json`) + fixtures

**Files:**
- Create: `eval/pyproject.toml`, `eval/LICENSE`, `eval/src/commonplace_eval/__init__.py`, `eval/src/commonplace_eval/schema_gate.py`
- Create: `schema/json/item.schema.json`, `schema/CHANGELOG.md`, `schema/LICENSE`, `schema/README.md`
- Create: `schema/fixtures/valid/{tiktok-video,minimal-item,self-note,carousel,text-post}.json`
- Create: `schema/fixtures/invalid/{no-identity,no-save}.json`
- Test: `eval/tests/test_schema_fixtures.py`
- Modify: `package.json` (add `"eval:test": "cd eval && uv run pytest -q"`, `"schema:check": "cd eval && uv run pytest -q tests/test_schema_fixtures.py tests/test_shacl.py"`), `.gitignore` (add `eval/.venv/`, `__pycache__/`)

**Interfaces:**
- Produces: `schema_gate.validate_item(obj: dict) -> list[str]` (empty list = valid; else JSON-pointer-ish error strings). `schema_gate.load_schema(name: str) -> dict` loading from `schema/json/` by stem (`"item"`, `"extraction"`, …), resolving the repo root relative to the module file (`Path(__file__).resolve()`, walk up until a dir containing `schema/json` is found).
- Produces: the `item.schema.json` `$defs` names later tasks reference: `Identity`, `Timestamped` (the `{value, source, confidence}` timestamp object), `Asset`, `ChildRef`, `Reference`, `Depicts`, `WorkRef`, `Lifecycle`, `CaptureFidelity`, `Scope`, `Metrics` (Observation-shaped), `Save`, `Annotation`, `Origin`.

The base container encodes ontology v3 §2 **exactly**. Field-by-field contract (all optional unless stated):

- Root: `identity` (required), `saves` (required, array of `Save`, minItems 1), `origin { platform: string, profile: string }`, `creator` (oneOf: object `{handle?, name?, id?}` | const `"SELF"` | const `"ASSERTED_NONE"` | const `"UNKNOWN"`), `createdAt`/`capturedAt`/`lastCheckedAt` (each `Timestamped`), `title`, `body`, `mediaKind` (enum `photo|video|audio|document|rich|link|file`, nullable), `contentForm` (string), `assets[]`, `timeline[]`, `interactive`, `contentCredentials`, `children[]`, `collections[]` (membership edges: `{postRef, collectionKind: enum carousel|playlist|album|board|series|course|thread|list, order?, addedAt?, memberAnnotation?}`), `references[]`, `depicts[]`, `workRef`, `versionRef`, `versions[]`, `lifecycle`, `captureFidelity`, `status` (enum `live|removed|author_deleted|locked|archived|unavailable`) + `statusObservedAt`, `scope`, `visibility` (enum `public|gated|private`), `metrics`, `platformExtras` (object, free), `extractions[]` (each a `$ref` to `extraction.schema.json` — use a remote `$ref` string; Task 2 creates that file; until then fixtures omit `extractions`).
- `Identity`: `{ status: enum platform_verified|inferred|synthetic (required), permalink?: uri, permalinkStatus?: enum live|login_gated|expired|none, canonicalId?: string, contentHash?: string (pattern `^ni:///sha-256;`), givenUrl?: uri, resolvedUrl?: uri, resolutionStatus?: string }` + JSON Schema `anyOf` requiring at least one of `permalink|canonicalId|contentHash`.
- `Timestamped`: `{ value: string (date-time), source: enum platform|exif|file_mtime|http_header|user|inferred, confidence?: number 0..1 }` (all timestamps except the raw `at` inside `Save.sources` use this shape).
- `Save`: `{ sources: [{kind: enum favorites|likes|bookmark|upload|repost|watch_later|screenshot|manual|other, at: date-time}] (required, minItems 1), scope?: {kind: enum post|thread|tree|container|fragment, materializedMembers?: [{postId, order}], materializedAt?}, targetSelector?: object, annotations?: Annotation[], collections?: string[], note?: string }`.
- `Asset`: `{ url?: uri, blobRef?: string, declaredMime?: string, sniffedFormat?: string, role: enum rendition|attachment|sidecar|export, contentHash?: string, perceptualHash?: string }` (anyOf url|blobRef).
- `Metrics` (Observation pattern §6): `{ likes?, shares?, views?, score?, comments?: integer, observedAt: date-time (required) }` — repeatable (array at root: `metrics: Metrics[]`).
- `Lifecycle`: `{ state: enum scheduled|live|changed|archived|expired|highlighted|delisted|deleted, stateTimestamps?: {scheduledStart?, actualStart?, endedAt?, archiveExpiresAt?, expiresAt?}, capturedDuringState?: string, lastCheckedAt?: date-time }`.
- `CaptureFidelity`: `{ level: enum complete|partial|metadata_only|reference_only, gates?: [enum paywall|regwall|login_wall|vote_gate|js_required|drm|expired] }`.
- `Reference`: `{ rel: string, target: string|object, targetSnapshotRef?, resolutionStatus: enum resolved|tombstone_deleted|tombstone_unavailable|never_resolved, lastCheckedAt? }`.
- `Depicts`: `{ target: object, resolutionStatus: enum unresolved|candidate|resolved|offline_referent|dead, assertion_mode: const "INFERRED", confidence?: number }`.
- `WorkRef`: `{ scheme: enum doi|isbn|arxiv|podcast_guid|isrc|iswc|issn|platform, id: string }`.
- `Scope`: `{ containerType: enum community|channel|group|none, containerId?: string, name?: string }`.
- `ChildRef`: `{ order: integer, post: object (recursive item — use `"$dynamicRef"`-free plain `{"$ref": "#"}`), ownTimestamp?, perChildAnnotations?: Annotation[] }`.
- `Annotation` (W3C WA-shaped, minimal): `{ body?: string, selector?: object, createdAt?: date-time }`.
- `interactive`: `{ kind: enum poll|quiz|form, options?: [{name, count?, isViewerChoice?}], closesAt?, resultsFinal?, resultsGated?, snapshotAt? }`.
- `contentCredentials`: `{ c2paManifestRef?, generator?: {name?, model?}, isAIGenerated?: enum declared|detected|none, remixParentRef? }`.
- `timeline[]`: `{ tStart: number, tEnd?: number, title: string, author: enum creator|platform|derived }`.
- `additionalProperties: false` at root and in every `$defs` object EXCEPT `platformExtras` (free object) and `targetSelector`/`selector` (open until Task 2 defines Selector).

Fixture contract:
- `minimal-item.json`: ONLY `identity {status: "inferred", contentHash: "ni:///sha-256;abc123"}` + `saves [{sources:[{kind:"manual", at:"2026-07-08T00:00:00Z"}]}]` — MUST validate.
- `tiktok-video.json`: full-fat — platform_verified identity w/ permalink + canonicalId, origin `{platform:"tiktok", profile:"tiktok/1.0"}`, creator handle, mediaKind video, one rendition asset + one sidecar (VTT), metrics observation, platformExtras `{musicName, musicAuthor, soundId}` — MUST validate.
- `self-note.json`: `creator: "SELF"`, body, no permalink (contentHash handle) — MUST validate.
- `carousel.json`: `children[]` with 2 ordered slides — MUST validate.
- `text-post.json`: mediaKind absent, title+body only — MUST validate.
- `invalid/no-identity.json` (identity object missing all three handles), `invalid/no-save.json` (empty `saves`) — MUST fail with the anyOf/minItems error.

- [ ] **Step 1:** `uv init` the eval package: write `eval/pyproject.toml`:

```toml
[project]
name = "commonplace-eval"
version = "0.1.0"
description = "Commonplace eval instrument: schema gates, matcher, per-layer metrics"
requires-python = ">=3.12"
dependencies = [
  "jsonschema>=4.23",
  "rdflib>=7.0",
  "pyshacl>=0.30",
  "rapidfuzz>=3.9",
  "scipy>=1.14",
  "numpy>=2.0",
  "relplot>=1.0",
]
[project.scripts]
commonplace-eval = "commonplace_eval.cli:main"
[dependency-groups]
dev = ["pytest>=8.3"]
[build-system]
requires = ["hatchling"]
build-backend = "hatchling.build"
[tool.hatch.build.targets.wheel]
packages = ["src/commonplace_eval"]
```

Run `cd eval && uv sync` — if `relplot` is not installable from PyPI, remove it from deps and note it (Task 7 then implements smECE directly; its formula is given in Task 7).

- [ ] **Step 2:** Write failing test `eval/tests/test_schema_fixtures.py`:

```python
import json
from pathlib import Path
import pytest
from commonplace_eval.schema_gate import validate_item

FIXTURES = Path(__file__).resolve().parents[2] / "schema" / "fixtures"

@pytest.mark.parametrize("p", sorted((FIXTURES / "valid").glob("*.json")), ids=lambda p: p.stem)
def test_valid_fixtures_pass(p):
    errors = validate_item(json.loads(p.read_text()))
    assert errors == [], f"{p.name} should validate: {errors}"

@pytest.mark.parametrize("p", sorted((FIXTURES / "invalid").glob("*.json")), ids=lambda p: p.stem)
def test_invalid_fixtures_fail(p):
    assert validate_item(json.loads(p.read_text())) != []

def test_minimal_admission_rule():
    item = {"identity": {"status": "inferred", "contentHash": "ni:///sha-256;abc"},
            "saves": [{"sources": [{"kind": "manual", "at": "2026-07-08T00:00:00Z"}]}]}
    assert validate_item(item) == []
```

- [ ] **Step 3:** Run `cd eval && uv run pytest -q` — expect FAIL (module/schema missing).
- [ ] **Step 4:** Write `schema/json/item.schema.json` per the field contract above; write `schema_gate.py` (`load_schema` with a `functools.cache`, `validate_item` using `jsonschema.Draft202012Validator` with a registry that maps the `extraction.schema.json` `$ref` to a permissive `{"type": "object"}` stub until Task 2 replaces it — implement as: registry loads every `schema/json/*.schema.json` that exists on disk, stubs any missing).
- [ ] **Step 5:** Write the 7 fixtures per the fixture contract.
- [ ] **Step 6:** Run `cd eval && uv run pytest -q` — expect PASS.
- [ ] **Step 7:** Write `schema/CHANGELOG.md` (entry: `1.0.0-rc.1 — initial freeze from knowledge-ontology.md v3; formal 1.0.0 at eval-sequence step 6 (freeze) per evaluation-methodology.md §1`), `schema/README.md` (what each file is, versioning policy: semver, never-delete-only-deprecate), MIT `LICENSE` in both `schema/` and `eval/`, `package.json` scripts, `.gitignore` entries.
- [ ] **Step 8:** Commit: `feat(schema): base container JSON Schema (ontology v3 §2) + fixtures + eval scaffold`

### Task 2: Extraction + extractor-output + gold/pred schemas + facet vocab

**Files:**
- Create: `schema/json/extraction.schema.json`, `schema/json/extractor-output.schema.json`, `schema/json/gold.schema.json`, `schema/json/pred.schema.json`
- Create: `schema/vocab/facets.json`, `schema/vocab/named-entity-anchors.json`
- Create: `schema/fixtures/valid/extraction-grounded.json` (an item WITH `extractions[]`), `schema/fixtures/invalid/{zero-evidence-extraction,bad-assertion-mode,bad-entity-type}.json`
- Test: extend `eval/tests/test_schema_fixtures.py` (new tests below); Create `eval/tests/test_extractor_output_schema.py`
- Modify: `eval/src/commonplace_eval/schema_gate.py` (add `validate_extraction`, `validate_extractor_output`, `validate_gold_record`, `validate_pred_record`)

**Interfaces:**
- Produces: `extraction.schema.json` `$defs`: `Evidence`, `Selector`, `Grounding`, `NamedEntityExtraction`, `ConceptExtraction`, `ClaimExtraction`, `StructuredContentExtraction`, `FacetAssignment`.
- Produces: the **gold record** and **pred record** shapes every later task consumes (verbatim below).
- Produces: `schema_gate.validate_gold_record(obj) -> list[str]`, `validate_pred_record(obj) -> list[str]`.

**Extraction schema** (ontology §3–4), one `oneOf` discriminated on `kind`:
- Common (all kinds): `kind: enum named_entity|concept|claim|structured_content|facet`, `evidence: Evidence[] (required, minItems 1)`, `rollup?: { assertion_mode: <strongest>, confidence: number }`, `extractor_ref?: {model, version?, prompt?, run?}` at rollup level.
- `Evidence`: `{ signal_ref?: string, selector?: Selector, quote?: string, channel: enum <the 6> (required), source_role?: string, assertion_mode: enum <the 4> (required), confidence: number 0..1 (required), source_polarity?: string, source_certainty?: string }`.
- `Selector` (W3C WA suite, `oneOf` on `type`): `TextQuoteSelector {exact, prefix?, suffix?}`, `TextPositionSelector {start, end}`, `FragmentSelector {value, conformsTo?}` (Media Fragments `#t=`/`#xywh=`, RFC 8118 `#page=`), `CfiSelector {value}`, `RangeSelector` — each may carry `refinedBy: Selector` (recursive).
- `NamedEntityExtraction`: `surface: string (required)`, `type: <9-enum> (required)`, `aliases?: string[]`, `grounding?: Grounding`, `referentLocator?: {scheme: enum page|chapter|timestamp|cfi, value: string}`.
- `Grounding`: `{ authority: string (e.g. musicbrainz|google_places|wikidata|openlibrary|platform:tiktok), externalId: string|null, nil: boolean, grounding_confidence: number 0..1 }` — invariant (JSON Schema `if/then`): `nil=false` ⇒ `externalId` is a non-null string; `nil=true` ⇒ `externalId` is null.
- `ConceptExtraction`: `surface`, `conceptId?: string`, `authority?: string`, `isCulturalReference?: boolean`.
- `ClaimExtraction`: `statement: string (required)`, `about?: [{kind: enum named_entity|concept, ref: string}]`.
- `StructuredContentExtraction`: `schemaOrgType: string (required, e.g. Recipe|HowTo|ItemList|ExercisePlan|Product|Event|LocalBusiness|NewsArticle|Menu|SoftwareSourceCode|Trip)`, `slots: [{name: string, value: <Observation: {value, observedAt?, source?}>}]`, `steps?: [{order: integer, text: string}]`.
- `FacetAssignment`: `{ facet: enum affect|topic|genre|intent|creator_role|viewer_orientation|presentation|content_provenance|actionability, value: string }` — value validated against `vocab/facets.json` at runtime by `schema_gate` (JSON Schema keeps it a string; the vocab file is the closed enum source so vocab evolves without schema bumps).

**`schema/vocab/facets.json`** — freeze v1.0 values (sources: `FACET_TOPICS` in `src/lib/ontology.ts` for topic; doc-03 §268 for intent; `observe_video.md` `presentation_style.primary_format` for presentation; propose the rest, marked `"status": "v1.0-proposal"` per facet, additive-only):

```json
{
  "version": "1.0.0-rc.1",
  "facets": {
    "topic":   {"values": ["food","travel","fitness","fashion","tech","finance","home","entertainment","education","other"], "status": "ported"},
    "intent":  {"values": ["how_to","review","recommendation","haul","demo","meme","explainer","storytime","news","inspiration","other"], "status": "v1.0-proposal"},
    "genre":   {"values": ["tutorial","vlog","skit","edit","compilation","reaction","interview","documentary","performance","slideshow","other"], "status": "v1.0-proposal"},
    "affect":  {"values": ["funny","heartwarming","motivational","calming","exciting","sad","outrage","awe","cringe","neutral"], "status": "v1.0-proposal"},
    "creator_role": {"values": ["expert","enthusiast","brand","journalist","entertainer","educator","unknown"], "status": "v1.0-proposal"},
    "viewer_orientation": {"values": ["do","buy","go","watch","learn","feel","save_for_later"], "status": "v1.0-proposal"},
    "presentation": {"values": ["talking_head","voiceover","text_overlay","cinematic","tutorial_demo","skit","compilation","reaction","slideshow","before_after","pov","room_tour","outfit_showcase","edit","other"], "status": "ported"},
    "content_provenance": {"values": ["original","repost","clipped","ai_generated","ai_assisted","unknown"], "status": "v1.0-proposal"},
    "actionability": {"values": ["genuine_rec","informational","entertainment_only","promotional","ragebait_suspect"], "status": "v1.0-proposal"}
  }
}
```

**`schema/vocab/named-entity-anchors.json`** — the 9 types, each `{type, grounds_to, id_namespace, wikidata_anchor, notes}` copied from `evaluation-methodology.md` §2's table verbatim (e.g. `screen_work` → `{"grounds_to": "wikidata", "id_namespace": "QID", "wikidata_anchor": "P31: film/TV/series"}`).

**Gold record** (`gold.schema.json`) — one JSON object per item (JSONL):

```json
{
  "item_id": "7234567890123456789",
  "strata": {"has_vtt": true, "is_slideshow": false, "duration_tercile": 2},
  "mentions": [
    {"mention_id": "m1", "surface": "Kill Bill", "aliases": ["SZA — Kill Bill"],
     "type": "music_recording",
     "gold_id": {"authority": "musicbrainz", "id": "5a7c..."},
     "nil": null,
     "failed_queries": [],
     "kb_snapshot": {"authority": "musicbrainz", "retrieved": "2026-07-08"},
     "hard_case": false, "notes": ""}
  ],
  "concepts": [{"concept_id": "iptc:20000538", "authority": "iptc", "label": "fitness"}],
  "facets": {"topic": "fitness", "intent": "how_to"},
  "structured": [{"schemaOrgType": "ExercisePlan", "slots": [{"name": "exercise", "value": "cable lateral raise"}], "steps": [{"order": 1, "text": "set pulley at hip height"}]}],
  "claims": [{"claim_id": "c1", "statement": "cable lateral raises isolate the shoulder better than dumbbells"}]
}
```
Rules: `mentions[*]` — exactly one of `gold_id` (object) or `nil` (`"NIL_NO_ID"`/`"NON_ENTITY"`) is non-null (`oneOf`); `nil="NIL_NO_ID"` requires non-empty `failed_queries`. All layer blocks optional except `item_id`.

**Pred record** (`pred.schema.json`):

```json
{
  "item_id": "7234567890123456789",
  "mentions": [
    {"surface": "Kill Bill by SZA", "type": "music_recording",
     "grounding": {"authority": "musicbrainz", "externalId": "5a7c...", "nil": false, "grounding_confidence": 0.93}}
  ],
  "concepts": [{"concept_id": "iptc:20000538", "authority": "iptc", "score": 0.8}],
  "facets": {"topic": "fitness"},
  "structured": [ {"schemaOrgType": "ExercisePlan", "slots": [...], "steps": [...]} ],
  "claims": [{"statement": "..."}]
}
```

**Extractor-output schema** — the model-facing schema (Gemini `response_schema`-safe: no `$ref`, no `oneOf`/`allOf`, flat objects, enums as string enums, `propertyOrdering` optional): a single flat object `{ mentions: [{surface, type(9-enum), aliases[], evidence:[{channel(6-enum), source_role, quote, t_start?, t_end?, assertion_mode(4-enum), confidence}]}], concepts: [{surface, evidence:[...]}], facets: {affect?, topic?, genre?, intent?, creator_role?, viewer_orientation?, presentation?, content_provenance?, actionability?}, claims: [{statement, evidence:[...]}], structured: [{schemaOrgType, slots:[{name, value}], steps:[{order, text}], evidence:[...]}] }`. **No grounding fields** — grounding is the resolver's job downstream, never the extractor's. Every array-of-extraction element requires ≥1 evidence.

- [ ] **Step 1:** Write failing tests: extend `test_schema_fixtures.py`:

```python
def test_zero_evidence_extraction_rejected():
    item = json.loads((FIXTURES / "valid" / "extraction-grounded.json").read_text())
    item["extractions"][0]["evidence"] = []
    assert validate_item(item) != []

def test_grounding_nil_invariant():
    from commonplace_eval.schema_gate import validate_extraction
    g = {"kind": "named_entity", "surface": "Joe's Pizza", "type": "place",
         "evidence": [{"channel": "VISUAL_TEXT", "assertion_mode": "SHOWN", "confidence": 0.9}],
         "grounding": {"authority": "google_places", "externalId": None, "nil": False, "grounding_confidence": 0.5}}
    assert validate_extraction(g) != []  # nil=false requires an id
```
And `test_extractor_output_schema.py`:
```python
import json
from commonplace_eval.schema_gate import load_schema, validate_extractor_output

def _walk(node):
    yield node
    if isinstance(node, dict):
        for v in node.values(): yield from _walk(v)
    elif isinstance(node, list):
        for v in node: yield from _walk(v)

def test_no_refs_or_oneof():  # Gemini response_schema compatibility
    s = load_schema("extractor-output")
    for node in _walk(s):
        if isinstance(node, dict):
            assert "$ref" not in node and "oneOf" not in node and "allOf" not in node

def test_valid_output_passes():
    out = {"mentions": [{"surface": "SZA", "type": "person", "aliases": [],
            "evidence": [{"channel": "VERBAL_AUDIO", "source_role": "narration",
                          "quote": "", "assertion_mode": "STATED", "confidence": 0.9}]}],
           "concepts": [], "facets": {}, "claims": [], "structured": []}
    assert validate_extractor_output(out) == []
```
- [ ] **Step 2:** Run tests — expect FAIL.
- [ ] **Step 3:** Write the four schema files + two vocab files per the contracts above; extend `schema_gate.py` with the four validate functions (gold/pred validators also enforce the vocab-file facet values and the gold `oneOf` rule; `validate_gold_record` additionally checks `nil=="NIL_NO_ID" ⇒ failed_queries non-empty`).
- [ ] **Step 4:** Write `extraction-grounded.json` fixture (tiktok item + 2 extractions: one grounded music_recording w/ MBID + VERBAL_AUDIO evidence w/ `FragmentSelector {value: "t=12,19"}`; one facet assignment) and the 3 invalid fixtures.
- [ ] **Step 5:** Run `cd eval && uv run pytest -q` — expect PASS.
- [ ] **Step 6:** Update `schema/CHANGELOG.md`; commit: `feat(schema): extraction/extractor-output/gold/pred schemas + facet vocab v1.0`

### Task 3: JSON-LD context + SHACL base shape + TikTok profile

**Files:**
- Create: `schema/context/commonplace.context.jsonld`, `schema/shacl/base.shape.ttl`, `schema/shacl/profile-tiktok.shape.ttl`, `schema/profiles/tiktok.dctap.csv`
- Create: `eval/src/commonplace_eval/shacl_gate.py`
- Test: `eval/tests/test_shacl.py`

**Interfaces:**
- Consumes: fixtures from Tasks 1–2; field names from `item.schema.json`/`extraction.schema.json`.
- Produces: `shacl_gate.validate_shacl(item: dict, profile: str | None = None) -> tuple[bool, str]` (conforms, report-text). Internally: item JSON + `@context` → JSON-LD → rdflib graph → pyshacl against `base.shape.ttl` (+ profile shape when `profile` given).

Contract:
- Namespace: `cpl:` = `https://commonplace.app/ns#`. Context maps: `title` → `schema:name` (schema.org), `body` → `schema:text`, `identity.permalink` → `schema:url`, `creator` → `schema:creator`, `children` → `as:items` or `cpl:children` (pick `cpl:` when no clean standard term — do NOT force-fit; PROV: `wasDerivedFrom` → `prov:wasDerivedFrom`; evidence selector terms → `oa:` Web Annotation). Every JSON field used by the SHACL shapes MUST have a context mapping (unmapped fields are invisible to SHACL — the shape would pass vacuously).
- `base.shape.ttl` targets `cpl:Item` (context maps each item to `@type: cpl:Item`) and enforces, minimum: (1) exactly ≥1 identity handle (`sh:or` over permalink/canonicalId/contentHash paths); (2) ≥1 save with a date (`cpl:savedAt` path `sh:minCount 1`); (3) every `cpl:Extraction` node has `sh:minCount 1` on `cpl:evidence`; (4) `cpl:assertionMode` `sh:in` the 4 values; (5) `cpl:channel` `sh:in` the 6 values; (6) `mediaKind` `sh:in` the 7 values when present.
- **The cross-analyzability gate (KOE checklist): `base.shape.ttl` conforms on ALL `schema/fixtures/valid/*.json`.** That is the headline test.
- `profile-tiktok.shape.ttl` targets nodes with `cpl:platform "tiktok"` (sh:targetNode via sparqlTarget or a class `cpl:TikTokItem` assigned in context—simplest: `sh:targetSubjectsOf cpl:platformExtras` is wrong; use a SPARQL-based target on `cpl:platform = "tiktok"`), and requires: `canonicalId` present, `identity.status = platform_verified`, `mediaKind ∈ {video, photo}`. It MUST NOT constrain any base field beyond the base shape (zero-base-fields rule — adding requirements on profile-specific paths only is the allowed pattern; tightening cardinality of base optional fields for that platform is also allowed per DCTAP; document which stance each constraint takes in a comment).
- `tiktok.dctap.csv` header: `shapeID,propertyID,propertyLabel,mandatory,repeatable,valueDataType,valueConstraint,note` — one row per profile constraint, mirroring the TTL.

- [ ] **Step 1:** Write failing `eval/tests/test_shacl.py`:

```python
import json
from pathlib import Path
import pytest
from commonplace_eval.shacl_gate import validate_shacl

FIXTURES = Path(__file__).resolve().parents[2] / "schema" / "fixtures"

@pytest.mark.parametrize("p", sorted((FIXTURES / "valid").glob("*.json")), ids=lambda p: p.stem)
def test_base_shape_passes_on_all_valid_items(p):
    conforms, report = validate_shacl(json.loads(p.read_text()))
    assert conforms, report

def test_zero_evidence_fails_shacl():
    item = json.loads((FIXTURES / "invalid" / "zero-evidence-extraction.json").read_text())
    conforms, _ = validate_shacl(item)
    assert not conforms

def test_tiktok_profile():
    item = json.loads((FIXTURES / "valid" / "tiktok-video.json").read_text())
    conforms, report = validate_shacl(item, profile="tiktok")
    assert conforms, report
```
- [ ] **Step 2:** Run — expect FAIL (module missing).
- [ ] **Step 3:** Write context, shapes, dctap, `shacl_gate.py`. Note: `zero-evidence-extraction.json` has `evidence: []` which Task 2's JSON Schema already rejects; for SHACL the empty array simply produces no `cpl:evidence` triples → `sh:minCount 1` violation fires. If JSON-LD list-vs-set semantics bite, keep evidence as `@container: @set` in context.
- [ ] **Step 4:** Run `cd eval && uv run pytest -q tests/test_shacl.py` — expect PASS; run full suite.
- [ ] **Step 5:** Commit: `feat(schema): JSON-LD context + SHACL base shape (100% cross-platform gate) + TikTok profile`

### Task 4: `construct.md` + `guidelines.md` (the codebook)

**Files:**
- Create: `eval/construct.md`, `eval/guidelines.md`

**Interfaces:**
- Consumes: the 9-type enum + anchors (`schema/vocab/named-entity-anchors.json`), gold record format (`gold.schema.json`), NIL rules, facet vocab.
- Produces: the documents Phase 2 (pilot gold set) executes against. No code.

`construct.md` (≤1 page): defines "an entity worth grounding" — a mention referring to a **rigid individual** (specific, persistent, re-identifiable thing) that a user would plausibly want to retrieve/act on later, resolvable in principle to a durable external ID in the tier-1/2 authorities; excludes generic kinds (→ Concept), propositions (→ Claim), shaped content (→ StructuredContent). Includes 5 positive + 5 negative examples (e.g. "cable lateral raise" = NOT an entity → Concept/technique; "Joe's Pizza (Bleecker St)" = entity → place).

`guidelines.md` (the MATTER codebook, written BEFORE any label — target 6–12 pages). Required sections, in order:
1. **Unit + workflow** — gold unit = `(item_id, mention surface + aliases, type, external_ID or NIL-label)`; exhaustive per-video (label EVERY in-scope mention; never build gold from system output); the assisted flow (Claude pre-annotation as suggestions; verify/correct/add), the 15–20% blind-from-scratch control, the ≥2-weeks test-retest re-label of 10–15%.
2. **The decidable typing rule** (ontology §7) as a flowchart in prose + the named failure mode (over-typing generic services/skills into entities).
3. **Per-type decision rules** — one subsection per the 9 types: the Wikidata P31/P279 anchor, inclusion/exclusion rules, ≥3 worked examples each, boundary cases (restaurant→place subtype; cover song→recording vs work; app vs website; person = public figures/named creators only).
4. **NIL protocol** — `NIL_NO_ID` vs `NON_ENTITY` definitions + examples (TikTok original sound = NIL_NO_ID); MUST record failed search queries before assigning NIL.
5. **ID verification protocol** — every gold ID verified against the live authority at label time (open the MB/Wikidata/Places record; never accept by name similarity); store Places name+address+lat/lng; record KB snapshot dates per label.
6. **Evidence & selectors** — how to record where a mention was seen (channel, quote, timestamp fragment).
7. **Facets** — per-facet one-line definitions + the closed value lists (from `vocab/facets.json`).
8. **Concepts / Claims / StructuredContent** — brief per-layer rules (concept = kind with authority node; claim = proposition with evidence span, faithfulness-not-truth; structured = slot-filling with steps).
9. **Hard-case gallery** — the deliberately-seeded hard slice types: cover songs, chain restaurants, ambiguous film titles + rulings.
10. **IAA plan** — pairwise F1 for mentions, Krippendorff's α for type/NIL/ID (targets: α ≥ 0.8, floor 0.667); never raw % agreement.

- [ ] **Step 1:** Write both docs per the section contract.
- [ ] **Step 2:** Self-check: every enum value used in examples exists in the schemas/vocab; every section 1–10 present; construct fits one page.
- [ ] **Step 3:** Commit: `docs(eval): construct definition + annotation guidelines (MATTER codebook)`

### Task 5: Normalization + the matcher

**Files:**
- Create: `eval/src/commonplace_eval/normalize.py`, `eval/src/commonplace_eval/matcher.py`
- Test: `eval/tests/test_normalize.py`, `eval/tests/test_matcher.py`

**Interfaces:**
- Produces (`normalize.py`): `normalize_mention(s: str) -> str` — Unicode NFKC → casefold → strip leading articles (`the|a|an` + common non-English: `el|la|le|les|der|die|das`) → strip punctuation (keep intra-word apostrophes/hyphens? NO: map to space) → collapse whitespace.
- Produces (`matcher.py`):

```python
from dataclasses import dataclass
from enum import Enum

class MatchTier(str, Enum):
    EXACT = "exact"      # normalized equality vs gold surface OR any alias
    FUZZY = "fuzzy"      # rapidfuzz token_set_ratio >= threshold (default 90)
    NONE = "none"

class Category(str, Enum):  # MUC-5 / SemEval-2013 9.1
    COR = "COR"; INC = "INC"; PAR = "PAR"; MIS = "MIS"; SPU = "SPU"

Scheme = str  # "strict" | "exact" | "partial" | "type"

@dataclass(frozen=True)
class AlignedPair:
    gold_idx: int | None   # None => spurious pred
    pred_idx: int | None   # None => missed gold
    tier: MatchTier
    type_match: bool

@dataclass
class MatchResult:
    pairs: list[AlignedPair]
    def categorize(self, scheme: Scheme) -> list[tuple[AlignedPair, Category]]: ...

def align(gold: list[dict], pred: list[dict], fuzzy_threshold: int = 90) -> MatchResult: ...
```
- `align`: builds a similarity matrix (gold × pred): `1.0` if EXACT tier (normalized pred surface equals normalized gold surface or any normalized gold alias), else `token_set_ratio/100` if ≥ threshold, else `0`. Optimal 1:1 assignment via `scipy.optimize.linear_sum_assignment` (maximize). Pairs with similarity 0 are broken into MIS + SPU. Each gold pairs with ≤1 pred (Hungarian guarantees).
- `categorize(scheme)` per aligned pair:
  - `strict`: EXACT tier + type match → COR; EXACT tier + type mismatch → INC; FUZZY tier → PAR; unmatched gold → MIS; unmatched pred → SPU.
  - `exact`: EXACT tier → COR (type ignored); FUZZY → PAR; else MIS/SPU.
  - `partial`: EXACT or FUZZY tier → COR if EXACT else PAR (surface only).
  - `type`: (EXACT or FUZZY tier) + type match → COR; tier match + type mismatch → INC; else MIS/SPU.

- [ ] **Step 1:** Write failing tests. `test_normalize.py`:

```python
from commonplace_eval.normalize import normalize_mention as n

def test_case_and_articles(): assert n("The Bear") == n("bear")
def test_unicode_nfkc(): assert n("Ｊｏｅ's Pizza") == n("joe s pizza")
def test_punct(): assert n("SZA — Kill Bill") == n("sza kill bill")
```
`test_matcher.py` — MUST include the two named failure cases from the retracted spike:
```python
from commonplace_eval.matcher import align, Category

def _m(surface, type_, aliases=()): return {"surface": surface, "type": type_, "aliases": list(aliases)}

def test_kill_bill_alias_is_COR_strict():
    gold = [_m("Kill Bill", "music_recording", aliases=["Kill Bill by SZA", "SZA — Kill Bill"])]
    pred = [_m("kill bill by sza", "music_recording")]
    cats = [c for _, c in align(gold, pred).categorize("strict")]
    assert cats == [Category.COR]

def test_place_vs_restaurant_no_longer_possible():
    # 'restaurant' is not a type; a place typed as place matches strictly.
    gold = [_m("Joe's Pizza", "place")]
    pred = [_m("Joes Pizza", "place")]
    assert [c for _, c in align(gold, pred).categorize("strict")] == [Category.COR]

def test_fuzzy_is_PAR_strict():
    gold = [_m("Museum of Modern Art", "place")]
    pred = [_m("MoMA Museum of Modern Art NYC", "place")]
    (pair, cat), = align(gold, pred).categorize("strict")
    assert cat == Category.PAR

def test_type_mismatch_is_INC_strict():
    gold = [_m("Dune", "screen_work")]
    pred = [_m("Dune", "book")]
    assert [c for _, c in align(gold, pred).categorize("strict")] == [Category.INC]
    assert [c for _, c in align(gold, pred).categorize("exact")] == [Category.COR]

def test_miss_and_spurious():
    gold = [_m("Dune", "book"), _m("Berlin", "place")]
    pred = [_m("Dune", "book")]
    cats = sorted(c.value for _, c in align(gold, pred).categorize("strict"))
    assert cats == ["COR", "MIS"]

def test_hungarian_one_to_one():
    gold = [_m("Dune", "book")]
    pred = [_m("Dune", "book"), _m("Dune", "book")]
    cats = sorted(c.value for _, c in align(gold, pred).categorize("strict"))
    assert cats == ["COR", "SPU"]
```
- [ ] **Step 2:** Run — expect FAIL.
- [ ] **Step 3:** Implement `normalize.py` then `matcher.py` per the interface contract.
- [ ] **Step 4:** Run `cd eval && uv run pytest -q tests/test_normalize.py tests/test_matcher.py` — expect PASS. Run full suite.
- [ ] **Step 5:** Commit: `feat(eval): mention normalization + Hungarian-aligned MUC-5 matcher (exact-string banned)`

### Task 6: Extraction metrics + grounding metrics

**Files:**
- Create: `eval/src/commonplace_eval/extraction_metrics.py`, `eval/src/commonplace_eval/grounding_metrics.py`
- Test: `eval/tests/test_extraction_metrics.py`, `eval/tests/test_grounding_metrics.py`

**Interfaces:**
- Consumes: `matcher.align`, `MatchResult`, `Category`.
- Produces (`extraction_metrics.py`):

```python
def prf(counts: dict) -> dict:
    """counts: {COR, INC, PAR, MIS, SPU} ->
    {precision, recall, f1, actual, possible} with
    ACT=COR+INC+PAR+SPU, POS=COR+INC+PAR+MIS,
    P=(COR+0.5*PAR)/ACT, R=(COR+0.5*PAR)/POS (0 when denominator 0)."""

def score_extraction(gold_items: list[dict], pred_items: list[dict],
                     schemes: tuple = ("strict","exact","partial","type"),
                     fuzzy_threshold: int = 90) -> dict:
    """Joins gold/pred by item_id (missing pred item => all-MIS).
    Returns {scheme: {"micro": prf, "macro": {"f1": mean-of-per-type-f1, ...},
                      "per_type": {type: prf}, "counts": {...}}}.
    Per-type: gold-typed rows own COR/INC/PAR/MIS; SPU assigned by pred type."""
```
- Produces (`grounding_metrics.py`) — operates on the **strict-scheme alignment** of mentions with grounding info (gold `gold_id`/`nil`, pred `grounding`):

```python
def _id_eq(gold_id: dict, pred_g: dict) -> bool:
    """authority equality (casefold) AND id equality (str, stripped;
    wikidata ids uppercased Q…)."""

def disambiguation_accuracy(aligned) -> dict   # over aligned pairs where gold has gold_id AND pred grounded non-NIL? NO:
    # denominator = aligned pairs where gold has gold_id; correct = pred non-NIL and _id_eq. Report also per-authority.
def inkb_prf(gold_items, pred_items, alignment) -> dict
    # micro+macro: TP = aligned, gold InKB, pred non-NIL, id correct;
    # FP = pred non-NIL that is (wrong id | aligned to gold-NIL | spurious);
    # FN = gold InKB with no correct pred. Macro over the 9 types.
def nil_prf(alignment) -> dict
    # over aligned pairs: predicted-NIL vs gold NIL_NO_ID.
    # NIL-P = correct-NILs/predicted-NILs, NIL-R = correct-NILs/gold-NILs, NIL-F1.
def effective_reliability(gold_items, pred_items, alignment, c: float = 10.0) -> dict
    # Φ_c per evaluation-methodology.md §4: over ALL gold mentions:
    #   aligned pred with correct non-NIL id  -> +1
    #   aligned pred with wrong non-NIL id    -> -c   (includes gold-NIL cases)
    #   pred NIL/abstain or gold missed        -> 0
    # PLUS each spurious (unaligned) pred with a non-NIL id contributes -c to the sum.
    # Φ_c = sum / n_gold_mentions. Return {"phi": ..., "c": c, "n": ...,
    #   "components": {correct, wrong_id, abstain, missed, spurious_with_id}}.
def risk_coverage(gold_items, pred_items, alignment) -> dict
    # sweep confidence threshold over pred grounding_confidence (non-NIL preds):
    # coverage = answered/n_gold, risk = wrong/answered; returns curve points,
    # AURC (trapezoid over coverage), and coverage_at_risk(0.05).
```
Gold-mention universe for grounding = mentions with `nil != "NON_ENTITY"` (NON_ENTITY rows exist to score extraction SPU, not grounding).

- [ ] **Step 1:** Write failing tests with hand-computed micro-fixtures. Required cases: `test_prf_partial_credit` (COR=2, PAR=1, INC=1, MIS=1, SPU=1 → P=(2+0.5)/4=0.625? ACT=2+1+1+1=5 → P=0.5, POS=5 → R=0.5 — compute carefully in the test, by hand, and assert exact fractions); `test_phi_penalizes_wrong_id` (1 correct + 1 wrong at c=10 over 2 gold → Φ = (1−10)/2 = −4.5); `test_phi_abstain_zero` (1 correct + 1 NIL over 2 gold → 0.5); `test_phi_spurious_with_id` (1 correct over 1 gold + 1 spurious grounded pred → (1−10)/1 = −9); `test_nil_prf` (2 gold NIL_NO_ID, pred NILs 1 of them + NILs 1 InKB gold → NIL-P=0.5, NIL-R=0.5); `test_disambiguation_per_authority`; `test_inkb_fp_on_gold_nil`; `test_risk_coverage_monotone_data` (3 preds conf .9/.6/.3, correct/wrong/correct → check curve points + coverage_at_risk).
- [ ] **Step 2:** Run — FAIL.
- [ ] **Step 3:** Implement both modules.
- [ ] **Step 4:** Full suite green.
- [ ] **Step 5:** Commit: `feat(eval): extraction P/R/F1 (4 schemes) + decomposed grounding metrics (InKB, NIL, Φ_c, risk–coverage)`

### Task 7: Calibration + cluster bootstrap

**Files:**
- Create: `eval/src/commonplace_eval/calibration.py`, `eval/src/commonplace_eval/bootstrap.py`
- Test: `eval/tests/test_calibration.py`, `eval/tests/test_bootstrap.py`

**Interfaces:**
- Produces (`calibration.py`):

```python
def brier(confidences: list[float], correct: list[bool]) -> float
def smece(confidences, correct) -> float
    # via relplot.smECE if installed; else implement smoothed ECE:
    # kernel-smoothed calibration error (Błasiok & Nakkiran 2024):
    # bandwidth h = n^(-1/2) clipped to [0.01, 0.2]; reflected Gaussian kernel on [0,1];
    # smECE = ∫ |E[correct|conf=t] - t| dμ(t) approximated on a 512-point grid
    # weighted by the kernel-density of confidences.
def reliability_bins(confidences, correct, n_bins: int = 10) -> list[dict]
    # equal-width bins: [{lo, hi, n, mean_conf, frac_correct}] for the diagram.
```
- Produces (`bootstrap.py`):

```python
def cluster_bootstrap(item_ids: list[str], metric_fn, B: int = 10_000, seed: int = 0,
                      alpha: float = 0.05) -> dict
    # metric_fn(sampled_item_ids: list[str]) -> float. Resample unique item ids
    # with replacement (a resampled id contributes ALL its mentions each time drawn).
    # numpy Generator(seed). Returns {point, lo, hi, B, n_clusters}.
def paired_bootstrap(item_ids, metric_fn_a, metric_fn_b, B: int = 10_000, seed: int = 0) -> dict
    # same resample indices for both systems; delta = a - b per resample.
    # Returns {delta, lo, hi, p_value} — p = 2*min(frac(delta<=0), frac(delta>=0)).
```

- [ ] **Step 1:** Failing tests: `test_brier_perfect` (conf=1.0 correct → 0.0); `test_brier_hand` ([0.8 correct, 0.4 wrong] → ((0.8−1)²+(0.4−0)²)/2 = 0.1); `test_smece_well_calibrated_low` (synthetic: conf~U(0,1), correct=Bernoulli(conf), n=5000, seed fixed → smECE < 0.05); `test_smece_miscalibrated_high` (conf all 0.9, correct rate 0.5 → smECE > 0.3); `test_reliability_bins_sum` (bin ns sum to n); `test_cluster_bootstrap_recovers_mean` (100 clusters of known values → CI contains true mean, point ≈ mean); `test_cluster_bootstrap_deterministic_seed`; `test_paired_bootstrap_detects_difference` (system a = b + 0.1 shift on 50 clusters → lo > 0, p < 0.05).
- [ ] **Step 2:** Run — FAIL. **Step 3:** Implement. **Step 4:** Suite green.
- [ ] **Step 5:** Commit: `feat(eval): calibration (Brier, smECE, reliability bins) + per-video cluster & paired bootstrap`

### Task 8: Concept / Facet / StructuredContent metrics

**Files:**
- Create: `eval/src/commonplace_eval/concept_metrics.py`, `eval/src/commonplace_eval/facet_metrics.py`, `eval/src/commonplace_eval/structured_metrics.py`
- Test: `eval/tests/test_concept_metrics.py`, `eval/tests/test_facet_metrics.py`, `eval/tests/test_structured_metrics.py`
- Create: `eval/tests/fixtures/hierarchy_sample.json` (`{"edges": {"child_id": ["parent_id", ...]}}` — a 3-level sample tree)

**Interfaces:**
- Produces (`concept_metrics.py`):

```python
class Hierarchy:
    def __init__(self, edges: dict[str, list[str]]): ...
    @classmethod
    def from_file(cls, path) -> "Hierarchy": ...
    def ancestors(self, concept_id: str) -> set[str]  # transitive, excludes self; cycles -> ValueError at init
def hierarchical_prf_at_k(gold_items, pred_items, hierarchy, k: int = 5) -> dict
    # per item: pred = top-k by score; expand both sides with ancestor closure
    # (True-Path partial credit, Kiritchenko); set-based P/R/F1; micro (pool sets) + macro (mean per item).
def r_precision(gold_items, pred_items) -> dict
    # per item: precision at rank R=|gold concepts| (flat, no closure); mean over items.
```
- Produces (`facet_metrics.py`):

```python
def cohen_kappa(a: list[str], b: list[str]) -> float   # standard, with 1.0 when both constant & equal
def facet_scores(gold_items, pred_items, facet_vocab: dict) -> dict
    # per facet: macro-F1 over that facet's value set (one-vs-rest, mean of per-value F1
    # over values present in gold or pred), Cohen's κ, n (items where gold has the facet).
    # Items where pred omits a gold-present facet count as wrong (label "__missing__").
```
- Produces (`structured_metrics.py`):

```python
def field_accuracy(gold_doc: dict, pred_doc: dict) -> dict
    # slots matched by normalized name; value correct = normalize_mention equality
    # OR rapidfuzz token_set_ratio >= 90. Returns {correct, total, accuracy}.
def document_accuracy(gold_doc, pred_doc) -> bool     # all gold slots correct
def step_metrics(gold_steps: list[dict], pred_steps: list[dict]) -> dict
    # match steps by normalized text (fuzzy >= 90, Hungarian on similarity);
    # step_recall = matched/|gold|; order = normalized Kendall tau over matched
    # pairs' (gold order, pred order); tau=1.0 when <2 matched.
def structured_scores(gold_items, pred_items) -> dict
    # docs matched within item by schemaOrgType (first-match); returns
    # {field_accuracy, document_accuracy, step_recall, step_order, n_docs}.
```

- [ ] **Step 1:** Failing tests. Concept: `test_ancestor_closure_credit` (gold=child, pred=parent → hF1 > 0 but < 1; exact values hand-computed from the sample tree); `test_r_precision_hand`; `test_cycle_raises`. Facet: `test_kappa_perfect=1`, `test_kappa_chance≈0` (constructed marginals), `test_missing_facet_counts_wrong`. Structured: `test_field_accuracy_fuzzy` ("2 cups flour" vs "two cups flour" — decide: numeral-word normalization is NOT included; this pair scores wrong at 90 threshold; assert that, and add alias "2 cups flour"≈"2 cups of flour" scores correct); `test_step_order_kendall` (3 matched steps in order 1,3,2 → τ = 1/3); `test_document_accuracy`.
- [ ] **Step 2:** Run — FAIL. **Step 3:** Implement. **Step 4:** Suite green.
- [ ] **Step 5:** Commit: `feat(eval): concept hierarchical F1@k, facet macro-F1+κ, structured-content field/step metrics`

### Task 9: IO + scorecard matrix + CLI + matcher-validation + README + roadmap log

**Files:**
- Create: `eval/src/commonplace_eval/io.py`, `eval/src/commonplace_eval/scorecard.py`, `eval/src/commonplace_eval/cli.py`, `eval/src/commonplace_eval/matcher_validation.py`
- Create: `eval/tests/fixtures/gold_sample.jsonl` (4 items covering: grounded mentions, NIL_NO_ID, NON_ENTITY, concepts, facets, structured, ≥2 strata values), `eval/tests/fixtures/pred_sample.jsonl` (matching predictions with known hand-computed scores), `eval/tests/fixtures/matcher_pairs.jsonl` (12 human-judged pairs: 6 match/6 non-match, incl. "that pizza spot Joe's" vs "Joe's Pizza" marked match-but-hard)
- Create: `eval/README.md`
- Test: `eval/tests/test_io.py`, `eval/tests/test_scorecard.py`, `eval/tests/test_matcher_validation.py`
- Modify: `docs/strategy/roadmap.md` (status log line)

**Interfaces:**
- `io.py`: `load_gold(path) -> list[dict]`, `load_pred(path) -> list[dict]` — JSONL, each record validated via `schema_gate` (raise `ValueError` with line number + errors on first invalid record); `join_items(gold, pred) -> list[tuple[gold, pred|None]]` on `item_id`, warning-collecting for pred items with unknown ids.
- `scorecard.py`: `build_scorecard(gold, pred, *, c: float = 10.0, k: int = 5, B: int = 2000, seed: int = 0, hierarchy: Hierarchy | None, facet_vocab: dict) -> dict` returning:

```python
{"layers": {
   "named_entity": {"status": "scored", "flagship": True, "n_mentions": ..., "n_items": ...,
     "extraction": {scheme: {...}},          # headline: strict micro F1 + CI
     "grounding": {"disambiguation": ..., "inkb": ..., "nil": ..., "phi_c": ..., "risk_coverage": ...},
     "calibration": {"brier": ..., "smece": ..., "bins": [...]},
     "ci": {"strict_micro_f1": {point, lo, hi}, "phi_c": {point, lo, hi}}},   # cluster bootstrap
   "concept":  {"status": "scored"|"skipped_no_data", "hf1_at_k": ..., "r_precision": ..., "n_items": ...},
   "claim":    {"status": "in_calibration", "note": "faithfulness/coverage require validated judge (Phase 4)"},
   "structured": {"status": ..., ...}, "facets": {"status": ..., "per_facet": {...}}},
 "meta": {"schema_version", "eval_version", "seed", "B", "c", "k", "generated_by"}}
```
plus `render_markdown(scorecard) -> str` — one table row per layer (layer · status · headline metric · n · 95% CI · gate). **No cross-layer aggregate anywhere; add an explicit test asserting the words "overall" / "average score" never appear and no top-level scalar exists.**
- `matcher_validation.py`: `validate_matcher(pairs_path) -> dict` — pairs JSONL `{"a": {"surface":..., "aliases":[...]}, "b": {"surface":...}, "human_match": true}`; runs the matcher's tier logic on each pair (match = tier != NONE); returns matcher `{precision, recall, f1, n, confusion: {tp, fp, fn, tn}}` vs human judgment.
- `cli.py` (argparse, subcommands):
  - `commonplace-eval score --gold G.jsonl --pred P.jsonl [--out report.json] [--md report.md] [--hierarchy H.json] [--seed 0] [--bootstrap 2000] [--c 10] [--k 5]`
  - `commonplace-eval check-schemas` (validates all `schema/fixtures/`, prints matrix of pass/fail — exit 1 on any wrong outcome)
  - `commonplace-eval validate-matcher --pairs pairs.jsonl`
- `eval/README.md`: what this is (the open-source instrument behind the published accuracy page), the per-layer matrix philosophy (never one blended number), quickstart (`uv sync`, `uv run pytest`, `uv run commonplace-eval score …` on the test fixtures), formulae + citations table (nervaluate/MUC-5, GERBIL/ELEVANT, TAC-KBP NIL, Φ_c effective reliability, smECE, cluster bootstrap), the gold/pred formats.

- [ ] **Step 1:** Failing tests: `test_io_rejects_bad_gold` (record missing item_id → ValueError names line 1); `test_scorecard_end_to_end` (fixtures → assert hand-computed strict micro F1 and Φ_c values, both layers' statuses, claim layer = in_calibration); `test_scorecard_no_blended_number`; `test_cli_score_smoke` (run via `python -m commonplace_eval.cli` on fixtures with `--bootstrap 50`, assert exit 0 + report.json exists + markdown contains a `named_entity` row); `test_matcher_validation_counts` (hand-built pairs file → exact confusion counts).
- [ ] **Step 2:** Run — FAIL. **Step 3:** Implement all four modules + fixtures + README.
- [ ] **Step 4:** Full suite green: `cd eval && uv run pytest -q`. Also `npm run eval:test` from repo root.
- [ ] **Step 5:** Append to `docs/strategy/roadmap.md` status log: `- 2026-07-08 · Phase 1 COMPLETE — schema frozen (JSON Schema 1.0.0-rc.1 + SHACL + JSON-LD context + TikTok profile), eval harness green (matcher + per-layer matrix + Φ_c + bootstrap CIs + calibration), construct.md + guidelines.md written. Next: Phase 2 pilot prep + Phase 3 wiring.`
- [ ] **Step 6:** Commit: `feat(eval): scorecard matrix + CLI + matcher validation; Phase 1 complete`

---

## Self-review notes (run before execution)

- Spec coverage: roadmap Phase 1 names four deliverables — JSON Schema ✅ (T1–2), SHACL ✅ (T3), matcher + per-layer metric harness ✅ (T5–9), annotation guidelines ✅ (T4). Eval-method §1 phase-0 construct ✅ (T4).
- The Claim layer is deliberately NOT implemented beyond scorecard status (`in_calibration`) — faithfulness needs the validated LLM judge, which per `evaluation-methodology.md` §4 lands with prompt-iteration work (Phase 4), and publishing rules mark unpowered layers "in calibration". This is a scope decision, not a placeholder.
- IAA calculators (Krippendorff's α, pairwise-F1 agreement) intentionally deferred to Phase 2 (pilot) where the dual-label data exists; guidelines document the protocol now.
- Type consistency: gold/pred record shapes defined once in Task 2 and consumed verbatim by Tasks 6–9; matcher interface defined in Task 5 and consumed by 6 & 9.
