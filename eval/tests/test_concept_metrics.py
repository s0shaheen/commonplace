"""Tests for Concept-layer metrics (Task 8): hierarchical F1@k + R-precision.

Per ``docs/product/_EVAL-METHOD.md`` §4 Concept row ("open multi-label subject
indexing → hierarchical F1@k (micro+macro), True-Path partial credit,
R-precision@k — **not** 1:1 linking"). Every expected value below is
hand-computed in a comment from ``fixtures/hierarchy_sample.json``:

    food   travel                 (L1 roots, two branches)
    ├ baking   ├ hiking           (L2)
    ├ cooking
    │ ├ sourdough (baking)        (L3)
    │ ├ pastry    (baking,cooking)  <- multi-parent node
    └ trail       (hiking)

Closure ("self + ancestors", True-Path / Kiritchenko):
    sourdough -> {sourdough, baking, food}
    pastry    -> {pastry, baking, cooking, food}
    baking    -> {baking, food}
    food      -> {food}
"""

from pathlib import Path

import pytest

from commonplace_eval.concept_metrics import (
    Hierarchy,
    hierarchical_prf_at_k,
    r_precision,
)

FIXTURE = Path(__file__).parent / "fixtures" / "hierarchy_sample.json"


def _h() -> Hierarchy:
    return Hierarchy.from_file(FIXTURE)


def _gold(item_id, ids):
    return {"item_id": item_id, "concepts": [{"concept_id": i, "authority": "x", "label": i} for i in ids]}


def _pred(item_id, scored):
    # scored: list of (concept_id, score)
    return {"item_id": item_id, "concepts": [{"concept_id": i, "authority": "x", "score": s} for i, s in scored]}


# --- Hierarchy structure ------------------------------------------------------
def test_ancestors_transitive_and_multiparent():
    h = _h()
    assert h.ancestors("sourdough") == {"baking", "food"}
    # multi-parent node: union of both parents' closures.
    assert h.ancestors("pastry") == {"baking", "cooking", "food"}
    assert h.ancestors("baking") == {"food"}
    assert h.ancestors("food") == set()  # a root excludes self


def test_unknown_concept_self_closure():
    h = _h()
    # An id absent from the hierarchy has no ancestors (closes over self only).
    assert h.ancestors("does_not_exist") == set()
    # unknown-gold vs SAME-unknown-pred: both close to {self} -> exact -> F1=1.0
    out_same = hierarchical_prf_at_k([_gold("v1", ["unknownX"])], [_pred("v1", [("unknownX", 0.9)])], h)
    assert out_same["micro"]["f1"] == pytest.approx(1.0)
    # known-gold vs unknown-pred: disjoint closures -> F1=0.0
    out_diff = hierarchical_prf_at_k([_gold("v1", ["sourdough"])], [_pred("v1", [("unknownZ", 0.9)])], h)
    assert out_diff["micro"]["f1"] == 0.0


def test_cycle_raises():
    with pytest.raises(ValueError):
        Hierarchy({"a": ["b"], "b": ["a"]})  # 2-cycle
    with pytest.raises(ValueError):
        Hierarchy({"a": ["a"]})  # self-loop


# --- hierarchical F1@k --------------------------------------------------------
def test_ancestor_closure_credit():
    # gold = child (sourdough), pred = its parent (baking). Ancestor closure
    # gives PARTIAL credit (0 < F1 < 1): the two share {baking, food}.
    #   gold closure {sourdough,baking,food} (3); pred closure {baking,food} (2)
    #   inter = {baking,food} = 2 -> P = 2/2 = 1.0, R = 2/3, F1 = 0.8
    h = _h()
    out = hierarchical_prf_at_k([_gold("v1", ["sourdough"])], [_pred("v1", [("baking", 0.9)])], h, k=5)
    assert 0.0 < out["micro"]["f1"] < 1.0
    assert out["micro"]["precision"] == pytest.approx(1.0)
    assert out["micro"]["recall"] == pytest.approx(2 / 3)
    assert out["micro"]["f1"] == pytest.approx(0.8)
    assert out["macro"]["f1"] == pytest.approx(0.8)  # single item -> macro == micro F1


def test_multi_parent_closure_credit():
    # gold = pastry (closure size 4), pred = food (closure {food}).
    #   inter = {food} = 1 -> P = 1/1 = 1.0, R = 1/4 = 0.25, F1 = 0.4
    h = _h()
    out = hierarchical_prf_at_k([_gold("v1", ["pastry"])], [_pred("v1", [("food", 0.5)])], h)
    assert out["micro"]["precision"] == pytest.approx(1.0)
    assert out["micro"]["recall"] == pytest.approx(0.25)
    assert out["micro"]["f1"] == pytest.approx(0.4)


def test_top_k_truncation():
    # gold = sourdough; 3 preds. k=2 drops the lowest-score pred (trail:0.1).
    #   k=2 pred ids [baking,cooking] -> closure {baking,cooking,food} (3)
    #        gold closure {sourdough,baking,food}; inter {baking,food}=2
    #        P=2/3, R=2/3, F1=2/3
    #   k=3 also pulls trail's branch {trail,hiking,travel}; pred closure size 6
    #        inter still 2 -> P=2/6=1/3 (precision drops)
    h = _h()
    g = [_gold("v1", ["sourdough"])]
    p = [_pred("v1", [("baking", 0.9), ("cooking", 0.8), ("trail", 0.1)])]
    out2 = hierarchical_prf_at_k(g, p, h, k=2)
    out3 = hierarchical_prf_at_k(g, p, h, k=3)
    assert out2["micro"]["precision"] == pytest.approx(2 / 3)
    assert out2["micro"]["f1"] == pytest.approx(2 / 3)
    assert out3["micro"]["precision"] == pytest.approx(1 / 3)
    assert out2["micro"]["f1"] > out3["micro"]["f1"]


def test_items_without_gold_excluded():
    # Chosen convention: items with NO gold concepts are excluded ENTIRELY
    # (not counted in micro or macro). v2 contributes nothing.
    h = _h()
    g = [_gold("v1", ["sourdough"]), {"item_id": "v2", "concepts": []}]
    p = [_pred("v1", [("baking", 0.9)]), _pred("v2", [("trail", 0.9)])]
    out = hierarchical_prf_at_k(g, p, h)
    assert out["n_items"] == 1
    assert out["micro"]["f1"] == pytest.approx(0.8)


# --- R-precision --------------------------------------------------------------
def test_r_precision_hand():
    # gold {a,b,c} -> R=3 (flat ids, no closure). Preds by score desc:
    #   a:0.9, x:0.8, b:0.7, c:0.6 -> top-R=[a,x,b]; hits {a,b}=2 -> 2/3
    g = [_gold("v1", ["a", "b", "c"])]
    p = [_pred("v1", [("a", 0.9), ("x", 0.8), ("b", 0.7), ("c", 0.6)])]
    out = r_precision(g, p)
    assert out["r_precision"] == pytest.approx(2 / 3)
    assert out["n_items"] == 1


def test_r_precision_skips_no_gold():
    # Item with no gold concepts is not in the mean's denominator.
    g = [_gold("v1", ["a", "b"]), {"item_id": "v2", "concepts": []}]
    p = [_pred("v1", [("a", 0.9), ("b", 0.8)]), _pred("v2", [("z", 0.9)])]
    out = r_precision(g, p)
    assert out["r_precision"] == pytest.approx(1.0)  # v1: top-2 [a,b] both hit
    assert out["n_items"] == 1
