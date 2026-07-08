"""Tests for scorecard.py + cli.py.

Hand-computed expectations for the fixtures (full derivation below). The gold set
has 6 mentions across 4 items; one is a NON_ENTITY trap (out of the grounding
universe), one is a NIL_NO_ID, the rest are InKB (musicbrainz / google_places /
wikidata x2). The prediction set is engineered to exercise every category.

STRICT EXTRACTION (MUC-5 strict scheme, per item, then pooled):
  vid_001: [Kill Bill, Joe's Pizza] vs [Kill Bill, Joe's Pizza]
           -> 2x EXACT + type-match           => COR, COR
  vid_002: [The Matrix, obscure band] vs [The Matrix, obscure band, Fake Brand]
           -> 2x EXACT + type-match => COR, COR;  Fake Brand no gold => SPU
  vid_003: [a good pizza place (NON_ENTITY)] vs [a good pizza place]
           -> pred aligned to a NON_ENTITY trap => recast SPU (never creditable)
  vid_004: [Taylor Swift] vs []                => MIS
  pooled counts: COR=4, INC=0, PAR=0, MIS=1, SPU=2
    ACT = COR+INC+PAR+SPU = 6 ; POS = COR+INC+PAR+MIS = 5 ; numer = COR+0.5*PAR = 4
    P = 4/6 = 2/3 ; R = 4/5 ; F1 = 2*(2/3)*(4/5)/((2/3)+(4/5)) = 16/22 = 8/11
  => strict micro F1 = 8/11 = 0.72727...

EFFECTIVE RELIABILITY Phi_c (c=10), over the 5 in-universe gold (NON_ENTITY excluded):
  Kill Bill : pred non-NIL, id correct          => correct   (+1)
  Joe's Pizza: pred non-NIL, id WRONG           => wrong_id  (-c)
  The Matrix : pred non-NIL, id correct         => correct   (+1)
  obscure band: pred NIL/abstain (gold NIL)     => abstain   ( 0)
  Taylor Swift: missed (no pred)                => missed    ( 0)
  plus Fake Brand spurious non-NIL id           => spurious_with_id   (-c, out of denom)
  plus pred grounding the NON_ENTITY trap       => non_entity_with_id (-c, out of denom)
  numerator = correct - c*(wrong_id + spurious_with_id + non_entity_with_id)
            = 2 - 10*(1 + 1 + 1) = 2 - 30 = -28 ;  n = 5
  => Phi_c = -28/5 = -5.6
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from commonplace_eval import cli, scorecard
from commonplace_eval.concept_metrics import Hierarchy
from commonplace_eval.io import load_facet_vocab, load_gold, load_pred

FIXTURES = Path(__file__).resolve().parent / "fixtures"

EXPECTED_STRICT_MICRO_F1 = 8.0 / 11.0
EXPECTED_PHI_C = -5.6


def _build(**overrides):
    gold = load_gold(FIXTURES / "gold_sample.jsonl")
    pred = load_pred(FIXTURES / "pred_sample.jsonl")
    kwargs = dict(
        c=10.0,
        k=5,
        B=50,
        seed=0,
        hierarchy=Hierarchy.from_file(FIXTURES / "hierarchy_sample.json"),
        facet_vocab=load_facet_vocab(),
    )
    kwargs.update(overrides)
    return scorecard.build_scorecard(gold, pred, **kwargs)


def test_scorecard_end_to_end():
    sc = _build()
    ne = sc["layers"]["named_entity"]

    assert ne["status"] == "scored"
    assert ne["flagship"] is True
    assert ne["n_mentions"] == 6  # 6 gold mentions across the 4 items

    # Extraction headline: strict micro F1 = 8/11.
    assert ne["extraction"]["strict"]["micro"]["f1"] == pytest.approx(EXPECTED_STRICT_MICRO_F1)

    # Grounding headline: Phi_c = -5.6, and the components match the derivation.
    phi = ne["grounding"]["phi_c"]
    assert phi["phi"] == pytest.approx(EXPECTED_PHI_C)
    assert phi["components"] == {
        "correct": 2,
        "wrong_id": 1,
        "abstain": 1,
        "missed": 1,
        "spurious_with_id": 1,
        "non_entity_with_id": 1,
    }

    # Grounding decomposition is present.
    for key in ("disambiguation", "inkb", "nil", "phi_c", "risk_coverage"):
        assert key in ne["grounding"]

    # Calibration is computed over the non-NIL grounded predictions (5 of them).
    cal = ne["calibration"]
    assert set(cal.keys()) == {"brier", "smece", "bins"}
    assert 0.0 <= cal["brier"] <= 1.0

    # Cluster-bootstrap CIs: point == the exact hand-computed value; the CI brackets it.
    ci_f1 = ne["ci"]["strict_micro_f1"]
    assert ci_f1["point"] == pytest.approx(EXPECTED_STRICT_MICRO_F1)
    assert ci_f1["lo"] <= ci_f1["point"] <= ci_f1["hi"]

    ci_phi = ne["ci"]["phi_c"]
    assert ci_phi["point"] == pytest.approx(EXPECTED_PHI_C)
    assert ci_phi["lo"] <= ci_phi["point"] <= ci_phi["hi"]

    # Other layers.
    assert sc["layers"]["concept"]["status"] == "scored"
    assert sc["layers"]["concept"]["n_items"] == 3
    assert sc["layers"]["structured"]["status"] == "scored"
    assert sc["layers"]["facets"]["status"] == "scored"

    # Claim layer is ALWAYS in_calibration (no validated judge until Phase 4).
    claim = sc["layers"]["claim"]
    assert claim["status"] == "in_calibration"
    assert "Phase 4" in claim["note"]

    # Meta block.
    meta = sc["meta"]
    assert meta["seed"] == 0
    assert meta["B"] == 50
    assert meta["c"] == 10.0
    assert meta["k"] == 5
    assert "schema_version" in meta
    assert "eval_version" in meta
    assert "generated_by" in meta


def test_calibration_pairs_and_brier_from_fixtures():
    """Pin the single-source answered set and the hand-derived Brier on the fixtures.

    Grounded (non-NIL) predictions, in ``answer_pairs`` order (in-universe aligned,
    then spurious, then NON_ENTITY-trap):
      Kill Bill  conf 0.95 -> correct  (musicbrainz id matches)
      Joe's Pizza conf 0.80 -> wrong   (ChIJ_WRONG id)
      The Matrix conf 0.90 -> correct  (Q83495 matches)
      Fake Brand conf 0.60 -> wrong    (spurious, no gold)
      pizza trap conf 0.70 -> wrong    (NON_ENTITY-aligned)
    (obscure band is pred-NIL -> not answered.)

    Brier = mean_i (conf_i - correct_i)^2, correct cast 1/0:
      (0.95-1)^2 + (0.80-0)^2 + (0.90-1)^2 + (0.60-0)^2 + (0.70-0)^2
      = 0.0025 + 0.64 + 0.01 + 0.36 + 0.49 = 1.5025 ;  1.5025 / 5 = 0.3005
    """
    from commonplace_eval.calibration import brier
    from commonplace_eval.grounding_metrics import align_grounding, answer_pairs

    gold = load_gold(FIXTURES / "gold_sample.jsonl")
    pred = load_pred(FIXTURES / "pred_sample.jsonl")
    alignment = align_grounding(gold, pred)

    pairs = answer_pairs(alignment)
    assert [ok for _, ok in pairs] == [True, False, True, False, False]
    assert [conf for conf, _ in pairs] == pytest.approx([0.95, 0.80, 0.90, 0.60, 0.70])

    confs = [conf for conf, _ in pairs]
    correct = [ok for _, ok in pairs]
    assert brier(confs, correct) == pytest.approx(0.3005)

    # The scorecard's calibration adapter must report the same Brier end-to-end.
    sc = _build()
    assert sc["layers"]["named_entity"]["calibration"]["brier"] == pytest.approx(0.3005)


def test_scorecard_determinism():
    """Same seed/B => identical CIs (seeded bootstrap)."""
    a = _build()
    b = _build()
    assert a["layers"]["named_entity"]["ci"] == b["layers"]["named_entity"]["ci"]


def test_scorecard_no_blended_number():
    """HARD RULE: never a cross-layer aggregate.

    (1) No top-level scalar: the scorecard has exactly {layers, meta}, both dicts.
    (2) The rendered markdown contains neither 'overall' nor 'average score'.
    """
    sc = _build()
    assert set(sc.keys()) == {"layers", "meta"}
    assert all(isinstance(v, dict) for v in sc.values())

    md = scorecard.render_markdown(sc)
    low = md.lower()
    assert "overall" not in low
    assert "average score" not in low
    # And a per-layer matrix really is rendered: one row per layer.
    for layer in ("named_entity", "concept", "claim", "structured", "facets"):
        assert layer in md


def test_render_markdown_has_named_entity_row_with_ci():
    sc = _build()
    md = scorecard.render_markdown(sc)
    # The flagship row shows its headline strict-micro-F1 and a CI.
    ne_line = next(line for line in md.splitlines() if "named_entity" in line)
    assert "0.727" in ne_line  # strict micro F1
    assert "flagship" in ne_line  # the publish-gate column


def test_scorecard_skips_layers_with_no_data():
    """Concept/structured/facets report skipped_no_data when the gold has none."""
    gold = [{"item_id": "x", "mentions": [{"mention_id": "g", "surface": "Nike", "type": "brand_org", "nil": "NIL_NO_ID", "failed_queries": ["nike"]}]}]
    pred = [{"item_id": "x", "mentions": []}]
    sc = scorecard.build_scorecard(gold, pred, facet_vocab=load_facet_vocab(), B=10, seed=0)
    assert sc["layers"]["concept"]["status"] == "skipped_no_data"
    assert sc["layers"]["structured"]["status"] == "skipped_no_data"
    assert sc["layers"]["facets"]["status"] == "skipped_no_data"
    # Named-entity still scores (it is the flagship and has mention data).
    assert sc["layers"]["named_entity"]["status"] == "scored"


# --- CLI -------------------------------------------------------------------
def test_cli_score_smoke(tmp_path):
    out = tmp_path / "report.json"
    md = tmp_path / "report.md"
    rc = cli.main(
        [
            "score",
            "--gold", str(FIXTURES / "gold_sample.jsonl"),
            "--pred", str(FIXTURES / "pred_sample.jsonl"),
            "--hierarchy", str(FIXTURES / "hierarchy_sample.json"),
            "--out", str(out),
            "--md", str(md),
            "--bootstrap", "50",
            "--seed", "0",
        ]
    )
    assert rc == 0
    assert out.exists()
    report = json.loads(out.read_text())
    assert report["layers"]["named_entity"]["extraction"]["strict"]["micro"]["f1"] == pytest.approx(
        EXPECTED_STRICT_MICRO_F1
    )
    assert "named_entity" in md.read_text()


def test_cli_check_schemas_against_real_fixtures():
    """check-schemas must return 0 on the real schema/fixtures/{valid,invalid}."""
    rc = cli.main(["check-schemas"])
    assert rc == 0


def test_cli_validate_matcher(capsys):
    rc = cli.main(["validate-matcher", "--pairs", str(FIXTURES / "matcher_pairs.jsonl")])
    assert rc == 0
    printed = capsys.readouterr().out
    assert "precision" in printed.lower()
