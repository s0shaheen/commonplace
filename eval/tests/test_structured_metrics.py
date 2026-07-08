"""Tests for StructuredContent-layer metrics (Task 8).

Per ``docs/product/_EVAL-METHOD.md`` §4 StructuredContent row ("slot-filling ->
Field Accuracy + Document Accuracy + step recall/order"). Value-correctness uses
the SAME normalize + fuzzy>=90 convention as the Task-5 matcher.

KEY FLAG (test_field_accuracy_fuzzy): the dispatch/brief PREDICTED "2 cups
flour" vs "two cups flour" scores WRONG at the 90 threshold. rapidfuzz's actual
token_set_ratio of the normalized strings is 90.9 >= 90 => it scores CORRECT.
The dispatch also says "assert actual behavior", so we assert CORRECT and flag
the brief's prediction as factually wrong. A genuine numeral-word miss ("1 egg"
vs "one egg", ratio 75) demonstrates the intended point (no numeral
normalization) without contradicting reality.
"""

import pytest

from commonplace_eval.structured_metrics import (
    document_accuracy,
    field_accuracy,
    step_metrics,
    structured_scores,
)


def _slot(name, value):
    return {"name": name, "value": value}


def _step(order, text):
    return {"order": order, "text": text}


def _doc(type_, slots=None, steps=None):
    d = {"schemaOrgType": type_}
    if slots is not None:
        d["slots"] = slots
    if steps is not None:
        d["steps"] = steps
    return d


def _item(item_id, docs):
    return {"item_id": item_id, "structured": docs}


# --- field accuracy -----------------------------------------------------------
def test_field_accuracy_fuzzy():
    g = _doc("Recipe", [_slot("qty", "2 cups flour")])
    # ACTUAL: token_set_ratio("2 cups flour","two cups flour")=90.9 >= 90 -> CORRECT.
    # (Brief predicted WRONG; asserting actual behavior per dispatch. Flagged.)
    p_word = _doc("Recipe", [_slot("qty", "two cups flour")])
    assert field_accuracy(g, p_word) == {"correct": 1, "total": 1, "accuracy": 1.0}

    # token subset ("2 cups flour" ⊂ "2 cups of flour") -> ratio 100 -> CORRECT
    p_of = _doc("Recipe", [_slot("qty", "2 cups of flour")])
    assert field_accuracy(g, p_of)["accuracy"] == 1.0

    # Numeral-word normalization is NOT applied: "1 egg" vs "one egg" ratio 75
    # < 90 -> WRONG. (This is the point the brief meant to make.)
    g1 = _doc("Recipe", [_slot("qty", "1 egg")])
    p1 = _doc("Recipe", [_slot("qty", "one egg")])
    assert field_accuracy(g1, p1)["accuracy"] == 0.0


def test_field_accuracy_name_match_and_empty():
    # Slots matched by NORMALIZED name; a missing/renamed pred slot -> wrong.
    g = _doc("Recipe", [_slot("Serves", "4"), _slot("Time", "30 min")])
    p = _doc("Recipe", [_slot("serves", "4")])  # 'Time' slot absent -> wrong
    assert field_accuracy(g, p) == {"correct": 1, "total": 2, "accuracy": 0.5}
    # empty gold slots -> total 0 -> accuracy 0.0 (div-by-zero convention)
    assert field_accuracy(_doc("Recipe", []), _doc("Recipe", []))["accuracy"] == 0.0


# --- document accuracy --------------------------------------------------------
def test_document_accuracy():
    g = _doc("Recipe", [_slot("a", "x"), _slot("b", "y")])
    assert document_accuracy(g, _doc("Recipe", [_slot("a", "x"), _slot("b", "y")])) is True
    assert document_accuracy(g, _doc("Recipe", [_slot("a", "x"), _slot("b", "WRONG")])) is False
    # Chosen convention (flagged): empty gold slots -> vacuously True (all([])).
    assert document_accuracy(_doc("Recipe", []), _doc("Recipe", [])) is True


# --- step metrics -------------------------------------------------------------
def test_step_order_kendall():
    # 3 gold steps (orders 1,2,3). Preds carry the matching texts but the step
    # that matches gold#2 sits at pred order 3 and gold#3 at pred order 2, so the
    # matched (gold_order, pred_order) pairs are (1,1),(2,3),(3,2).
    # Kendall tau = (2 concordant - 1 discordant)/3 = 1/3.
    gold = [_step(1, "step one"), _step(2, "step two"), _step(3, "step three")]
    pred = [_step(1, "step one"), _step(3, "step two"), _step(2, "step three")]
    out = step_metrics(gold, pred)
    assert out["step_recall"] == pytest.approx(1.0)
    assert out["n_matched"] == 3
    assert out["step_order"] == pytest.approx(1 / 3)


def test_step_recall_partial():
    gold = [_step(1, "chop onions"), _step(2, "boil water"), _step(3, "add salt")]
    pred = [_step(1, "chop onions"), _step(2, "boil water")]
    out = step_metrics(gold, pred)
    assert out["step_recall"] == pytest.approx(2 / 3)
    # 2 matched pairs in order -> tau=1.0
    assert out["step_order"] == pytest.approx(1.0)


def test_step_order_single_match_defined():
    # <2 matched pairs -> order defined as 1.0 (tau undefined for n<2).
    out = step_metrics([_step(1, "only step")], [_step(1, "only step")])
    assert out["n_matched"] == 1
    assert out["step_order"] == 1.0


def test_step_empty_gold():
    # Chosen convention (flagged): gold empty -> recall 1.0, order 1.0.
    out = step_metrics([], [])
    assert out["step_recall"] == 1.0
    assert out["step_order"] == 1.0
    assert out["n_gold_steps"] == 0


# --- structured_scores (aggregate) -------------------------------------------
def test_structured_scores_matched():
    doc = _doc(
        "Recipe",
        [_slot("a", "x"), _slot("b", "y")],
        steps=[_step(1, "s1"), _step(2, "s2")],
    )
    out = structured_scores([_item("v1", [doc])], [_item("v1", [dict(doc)])])
    assert out["field_accuracy"] == pytest.approx(1.0)
    assert out["document_accuracy"] == pytest.approx(1.0)
    assert out["step_recall"] == pytest.approx(1.0)
    assert out["step_order"] == pytest.approx(1.0)
    assert out["n_docs"] == 1


def test_structured_unmatched_gold_doc_false():
    # gold Recipe, pred only HowTo (different schemaOrgType) -> gold doc unmatched.
    g = [_item("v1", [_doc("Recipe", [_slot("a", "x")])])]
    p = [_item("v1", [_doc("HowTo", [_slot("a", "x")])])]
    out = structured_scores(g, p)
    assert out["document_accuracy"] == 0.0  # unmatched gold doc -> False
    assert out["field_accuracy"] == 0.0  # its slot counts as wrong (no matched pred)
    assert out["n_docs"] == 1


def test_structured_first_match_duplicate_types():
    # Two gold Recipe docs, one pred Recipe -> first gold matches, second unmatched.
    g = [_item("v1", [_doc("Recipe", [_slot("a", "x")]), _doc("Recipe", [_slot("a", "y")])])]
    p = [_item("v1", [_doc("Recipe", [_slot("a", "x")])])]
    out = structured_scores(g, p)
    # field pool: correct=1 (doc1), total=2 -> 0.5
    assert out["field_accuracy"] == pytest.approx(0.5)
    # doc acc: doc1 True, doc2 False -> 1/2
    assert out["document_accuracy"] == pytest.approx(0.5)
    assert out["n_docs"] == 2
