# `commonplace-eval` — the measurement instrument

This is the open-source evaluation harness behind Commonplace's **published
accuracy page**. Commonplace's moat is *measured, published grounding accuracy*,
so the instrument that produces those numbers is a first-class product asset, not
a QA afterthought — it is versioned, tested, and open. The governing design is
[`docs/specs/evaluation-methodology.md`](../docs/specs/evaluation-methodology.md); the data
contract it scores is [`schema/`](../schema/) (`knowledge-ontology.md` v3).

## The scorecard is a per-layer MATRIX — never one blended number

The engine emits several distinct **referent kinds** (named entities, concepts,
claims, structured content) plus facets. Each grounds to a different authority
under a different regime, so **each is scored by its own metric with its own
denominator, chance baseline, and meaning of "correct."** Averaging them into a
single "accuracy %" is statistically incoherent *and* dishonest — a place link
(closed-world, exact-ID) and a subject tag (open, hierarchical, partial-credit)
do not share a scale.

So the scorecard is a table: **one row per layer**, each with `metric · n · 95%
CI · publish-gate`. **NamedEntity-linking is the named flagship**; every other
layer is marked **"in calibration"** until it is powered by a sealed, sized test
set. There is deliberately **no total row, no top-level scalar, and the words
"overall"/"average score" never appear** — a committed test
(`test_scorecard_no_blended_number`) enforces this.

```
| Layer        | Status         | Headline metric                 | n | 95% CI          | Gate           |
| named_entity | scored         | strict micro F1 = 0.727         | 6 | [0.000, 0.923]  | flagship       |
| concept      | scored         | hierarchical F1@5 = 0.933       | 3 | —               | in calibration |
| claim        | in_calibration | faithfulness + coverage         | — | —               | in calibration |
| structured   | scored         | field accuracy = 1.000          | 1 | —               | in calibration |
| facets       | scored         | 2 axes (per-facet macro-F1 + κ) | 2 | —               | in calibration |
```

The **claim** layer is always `in_calibration`: faithfulness/coverage require a
*validated* LLM judge (Cohen's κ ≥ 0.6 vs human on a dual-labelled set), which
lands with prompt-iteration in Phase 4.

## Quickstart

```bash
cd eval
uv sync                      # install into a local venv
uv run pytest -q             # the whole instrument, green

# Score the bundled fixtures (4 gold items, hand-verified expectations):
uv run commonplace-eval score \
  --gold tests/fixtures/gold_sample.jsonl \
  --pred tests/fixtures/pred_sample.jsonl \
  --hierarchy tests/fixtures/hierarchy_sample.json \
  --bootstrap 2000 --seed 0 \
  --out report.json --md report.md

# Regression-gate the schema fixtures (valid must pass, invalid must fail):
uv run commonplace-eval check-schemas

# Score the matcher itself against human-judged pairs:
uv run commonplace-eval validate-matcher --pairs tests/fixtures/matcher_pairs.jsonl
```

`score` flags: `--gold`, `--pred` (required); `--out` (JSON report), `--md`
(markdown matrix), `--hierarchy` (concept edges), `--seed` (default 0),
`--bootstrap` (B, default 2000), `--c` (Φ_c penalty, default 10), `--k` (concept
top-k, default 5).

## Formulae & citations

Every metric traces to named prior art; the harness reuses reference
implementations (`rapidfuzz`, `scipy`, `relplot`) rather than reinventing them.

| Layer / quantity | Formula (summary) | Prior art |
|---|---|---|
| **Extraction** P/R/F1 (COR/INC/PAR/MIS/SPU; schemes strict·exact·partial·type; PAR = ½ credit: `P=(COR+0.5·PAR)/ACT`) | `extraction_metrics.prf` / `score_extraction`; **strict micro F1** is the pre-designated headline | MUC-5; SemEval-2013 Task 9.1; nervaluate |
| Mention alignment (span-free) | normalized surface+alias EXACT tier + rapidfuzz `token_set_ratio ≥ 90` FUZZY tier, **Hungarian** max-weight 1:1 matching; exact-string-only BANNED | MUC-5 matching; `scipy.optimize.linear_sum_assignment` |
| **Grounding** decomposition | disambiguation-given-gold · InKB micro/macro F1 · NIL-as-class · Φ_c · risk–coverage — extraction vs grounding noise never confounded | GERBIL / ELEVANT decomposition |
| NIL as its own class | NIL-P = correct-NILs / predicted-NILs; NIL-R = correct-NILs / gold-NILs; NIL-F1 | TAC-KBP (penalizes never-say-NIL) |
| **Effective Reliability Φ_c** (flagship) | per in-universe gold: **+1** correct id, **0** NIL/abstain, **−c** wrong id (default c=10); spurious/NON_ENTITY grounded ids also cost −c outside the denominator; `Φ_c = (Σcorrect − c·Σwrong) / n` | asymmetric "honesty over fluency" utility; risk–coverage / AURC (selective prediction) |
| **Calibration** | Brier (proper score) + **smECE** (bin-free, gaming-resistant) + reliability bins; over the non-NIL grounded predictions' (confidence, correct) pairs | Brier 1950; smECE — Błasiok & Nakkiran, ICLR 2024 (`relplot`) |
| **Concept** | hierarchical (True-Path) F1@k, micro+macro, ancestor-closure partial credit; R-precision@k | Kiritchenko et al. 2005 (True-Path Rule); Manning IR (R-precision) |
| **Facets** | per-facet one-vs-rest macro-F1 + Cohen's κ (closed vocab); **never blended across axes** | Cohen 1960; Hripcsak & Rothschild 2005 (κ for bounded categories only) |
| **StructuredContent** | Field Accuracy + Document Accuracy + step recall / Kendall-τ order | slot-filling eval; Kendall τ (`scipy.stats.kendalltau`) |
| **Confidence intervals** | **per-video cluster bootstrap** (mentions cluster within videos; resample the video, not the mention) | Miller, "Adding Error Bars to Evals," arXiv:2411.00640 |
| System-vs-system Δ | paired cluster bootstrap + two-sided **add-one** p-value (floored at `2/(B+1)`) | North, Curtis & Sham 2002; Davison & Hinkley 1997 §4.2 |
| **Matcher validation** | the matcher is scored like any classifier: P/R/F1 + confusion vs human match/non-match judgments | Husain's rule (raw agreement misleads under class imbalance) |

## Gold / pred record formats

Both are **JSONL, one record per item**, validated at load time
(`io.load_gold` / `io.load_pred`) against
[`schema/json/gold.schema.json`](../schema/json/gold.schema.json) and
[`pred.schema.json`](../schema/json/pred.schema.json); a bad line raises a
`ValueError` naming the 1-based line number. Every layer block is optional except
`item_id`.

**Gold** (`gold.schema.json`) — the human-verified ground truth. A `mentions[*]`
carries exactly one of `gold_id` (a `{authority, id}` object) **or** `nil`
(`"NIL_NO_ID"` / `"NON_ENTITY"`); `nil="NIL_NO_ID"` requires a non-empty
`failed_queries` (the Learn-to-Not-Link signal), and `nil="NON_ENTITY"` marks an
adjudicated extraction trap (a phrase proposed then rejected — never creditable).
Optional `concepts`, `facets`, `structured`, `claims`, and `strata` (for CI
stratification) blocks. Facet values are checked against
[`schema/vocab/facets.json`](../schema/vocab/facets.json) at load.

```json
{"item_id": "vid_001",
 "strata": {"has_vtt": true, "duration_tercile": 1},
 "mentions": [
   {"mention_id": "m1", "surface": "Kill Bill", "type": "music_recording",
    "gold_id": {"authority": "musicbrainz", "id": "…"}},
   {"mention_id": "m4", "surface": "obscure local band", "type": "music_recording",
    "nil": "NIL_NO_ID", "failed_queries": ["obscure local band musicbrainz"]}],
 "concepts": [{"concept_id": "baking", "authority": "cpl", "label": "Baking"}],
 "facets": {"topic": "food"},
 "structured": [{"schemaOrgType": "Recipe", "slots": [{"name": "prepTime", "value": "10 min"}],
                 "steps": [{"order": 1, "text": "Mix the flour and water"}]}]}
```

**Pred** (`pred.schema.json`) — the system's grounding-resolved output. A
`mentions[*]` carries an optional `grounding` block `{authority, externalId, nil,
grounding_confidence}` with the invariant **`nil=false ⇒ externalId` is a
non-null string; `nil=true ⇒ externalId` is null** (an absent `grounding` block
*is* an abstention). Concepts carry a `score` used for top-k ranking.

```json
{"item_id": "vid_001",
 "mentions": [
   {"surface": "Kill Bill", "type": "music_recording",
    "grounding": {"authority": "musicbrainz", "externalId": "…", "nil": false, "grounding_confidence": 0.95}},
   {"surface": "obscure local band", "type": "music_recording",
    "grounding": {"authority": "musicbrainz", "externalId": null, "nil": true, "grounding_confidence": 0.2}}],
 "concepts": [{"concept_id": "baking", "authority": "cpl", "score": 0.9}]}
```

The **matcher-pairs** file (`validate-matcher`) is JSONL of
`{"a": {"surface", "aliases"?}, "b": {"surface"}, "human_match": bool}` — `a` is
the gold side (aliases allowed), `b` the prediction side; a "match" is a 1×1
alignment at tier ≠ NONE.

## Module map

| Module | Role |
|---|---|
| `schema_gate` · `shacl_gate` | JSON-Schema and SHACL validation of the data contract |
| `normalize` · `matcher` | span-free mention normalization + Hungarian MUC-5 alignment |
| `extraction_metrics` · `grounding_metrics` | mention P/R/F1; InKB / NIL / Φ_c / risk–coverage |
| `calibration` · `bootstrap` | Brier / smECE / bins; cluster & paired bootstrap CIs |
| `concept_metrics` · `facet_metrics` · `structured_metrics` | the non-flagship layers |
| `io` | JSONL loaders (schema-gated) + the gold↔pred join |
| `scorecard` | assembles the per-layer matrix; `render_markdown` |
| `matcher_validation` | scores the matcher against human judgment |
| `cli` | `commonplace-eval {score,check-schemas,validate-matcher}` |

All metric modules are **pure** (no I/O); only `io` and `cli` touch the
filesystem. `scorecard` consumes the metric modules and adds no new statistic —
its one cross-module private reuse (three `grounding_metrics` correctness
predicates, for the calibration adapter) is flagged in its docstring.
