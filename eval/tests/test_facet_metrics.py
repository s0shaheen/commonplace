"""Tests for Facet-layer metrics (Task 8): per-facet macro-F1 + Cohen's κ.

Per ``docs/product/_EVAL-METHOD.md`` §4 Facets row ("classification → per-facet
macro-F1 + Cohen's κ"). Each κ below is hand-computed from the confusion of the
paired label sequences; div-by-zero and degenerate-marginal conventions are
asserted explicitly.
"""

import pytest

from commonplace_eval.facet_metrics import cohen_kappa, facet_scores

# The 9 facet axes (names only; values are data-derived, so empty value-lists
# are fine here — facet_scores enumerates axes from the vocab keys).
_AXES = [
    "topic",
    "intent",
    "genre",
    "affect",
    "creator_role",
    "viewer_orientation",
    "presentation",
    "content_provenance",
    "actionability",
]
VOCAB = {"facets": {name: {"values": []} for name in _AXES}}


def _rec(item_id, facets):
    return {"item_id": item_id, "facets": facets}


# --- Cohen's kappa conventions -----------------------------------------------
def test_kappa_perfect():
    # po=1; pe = (2/4)^2+(1/4)^2+(1/4)^2 = .375; kappa=(1-.375)/(1-.375)=1.0
    assert cohen_kappa(["x", "y", "x", "z"], ["x", "y", "x", "z"]) == pytest.approx(1.0)


def test_kappa_both_constant_equal():
    # Degenerate: both raters constant & equal -> pe==1, po==1 -> convention 1.0
    assert cohen_kappa(["a", "a", "a"], ["a", "a", "a"]) == pytest.approx(1.0)


def test_kappa_chance():
    # A=[a,a,b,b], B=[a,b,a,b]: agreements items 0,3 -> po=0.5;
    # marginals all 0.5 -> pe=0.5*0.5+0.5*0.5=0.5; kappa=(.5-.5)/(1-.5)=0.0
    assert cohen_kappa(["a", "a", "b", "b"], ["a", "b", "a", "b"]) == pytest.approx(0.0, abs=1e-9)


def test_kappa_empty():
    assert cohen_kappa([], []) == 0.0


def test_kappa_length_mismatch_raises():
    with pytest.raises(ValueError):
        cohen_kappa(["a"], ["a", "b"])


# --- facet_scores -------------------------------------------------------------
def test_missing_facet_counts_wrong():
    # 4 gold items all topic=food. Pred omits topic on v2 -> label "__missing__".
    gold = [_rec(f"v{i}", {"topic": "food"}) for i in range(1, 5)]
    pred = [
        _rec("v1", {"topic": "food"}),
        _rec("v2", {}),  # omits the gold-present facet -> "__missing__"
        _rec("v3", {"topic": "food"}),
        _rec("v4", {"topic": "food"}),
    ]
    out = facet_scores(gold, pred, VOCAB)
    t = out["topic"]
    assert t["n"] == 4
    assert t["status"] == "scored"
    # value_set = {food} ("__missing__" excluded as a class). For 'food':
    #   TP=3 (v1,v3,v4), FP=0, FN=1 (v2 missing) -> P=1, R=3/4, F1=2*1*.75/1.75
    assert t["macro_f1"] == pytest.approx(2 * 1 * 0.75 / 1.75)
    assert t["macro_f1"] < 1.0  # the missing facet strictly damages recall

    # Control: every pred present & correct -> macro_f1 == 1.0
    pred_ok = [_rec(f"v{i}", {"topic": "food"}) for i in range(1, 5)]
    assert facet_scores(gold, pred_ok, VOCAB)["topic"]["macro_f1"] == pytest.approx(1.0)


def test_facet_skip_empty():
    gold = [_rec("v1", {"topic": "food"})]
    pred = [_rec("v1", {"topic": "food"})]
    out = facet_scores(gold, pred, VOCAB)
    assert out["topic"]["status"] == "scored"
    # No gold item carries 'genre' -> empty eval set -> skipped, status noted.
    assert out["genre"]["status"] == "empty"
    assert out["genre"]["n"] == 0
    assert "macro_f1" not in out["genre"]


def test_facet_multi_value_macro():
    # Two topic values; one item each wrong-way -> per-value F1 averaged.
    gold = [_rec("v1", {"topic": "food"}), _rec("v2", {"topic": "tech"})]
    pred = [_rec("v1", {"topic": "food"}), _rec("v2", {"topic": "food"})]
    out = facet_scores(gold, pred, VOCAB)["topic"]
    # value_set={food,tech}. food: TP=1(v1),FP=1(v2),FN=0 -> P=.5,R=1,F1=2/3
    #                        tech: TP=0,FP=0,FN=1(v2)     -> F1=0
    # macro = (2/3 + 0)/2 = 1/3
    assert out["macro_f1"] == pytest.approx(1 / 3)
    assert out["n"] == 2
