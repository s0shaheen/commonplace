"""Tests for io.py — JSONL loading, schema-gated, and the item_id join."""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from commonplace_eval.io import join_items, load_facet_vocab, load_gold, load_hierarchy, load_pred

FIXTURES = Path(__file__).resolve().parent / "fixtures"


def test_load_gold_pred_ok():
    gold = load_gold(FIXTURES / "gold_sample.jsonl")
    pred = load_pred(FIXTURES / "pred_sample.jsonl")
    assert [g["item_id"] for g in gold] == ["vid_001", "vid_002", "vid_003", "vid_004"]
    assert [p["item_id"] for p in pred] == ["vid_001", "vid_002", "vid_003", "vid_004"]


def test_io_rejects_bad_gold(tmp_path):
    """A gold record missing item_id -> ValueError naming the (1-based) line number."""
    bad = tmp_path / "bad_gold.jsonl"
    bad.write_text(
        json.dumps({"mentions": []}) + "\n"  # line 1: no item_id
        + json.dumps({"item_id": "ok"}) + "\n"
    )
    with pytest.raises(ValueError) as exc:
        load_gold(bad)
    msg = str(exc.value)
    assert "line 1" in msg
    assert "item_id" in msg  # the schema error is surfaced too


def test_io_rejects_bad_gold_names_correct_later_line(tmp_path):
    """The FIRST invalid record wins, and its own line number is named (not line 1)."""
    bad = tmp_path / "bad_gold.jsonl"
    bad.write_text(
        json.dumps({"item_id": "ok"}) + "\n"  # line 1 valid
        + json.dumps({"item_id": "x", "mentions": [{"mention_id": "m", "surface": "s"}]}) + "\n"  # line 2: mention missing type & id/nil
    )
    with pytest.raises(ValueError) as exc:
        load_gold(bad)
    assert "line 2" in str(exc.value)


def test_io_rejects_bad_pred(tmp_path):
    bad = tmp_path / "bad_pred.jsonl"
    bad.write_text(json.dumps({"mentions": []}) + "\n")  # no item_id
    with pytest.raises(ValueError) as exc:
        load_pred(bad)
    assert "line 1" in str(exc.value)


def test_io_rejects_non_json_line(tmp_path):
    bad = tmp_path / "bad.jsonl"
    bad.write_text(json.dumps({"item_id": "ok"}) + "\n" + "{not json}\n")
    with pytest.raises(ValueError) as exc:
        load_gold(bad)
    assert "line 2" in str(exc.value)


def test_join_items_missing_pred_is_none():
    gold = [{"item_id": "a"}, {"item_id": "b"}]
    pred = [{"item_id": "a"}]
    joined = join_items(gold, pred)
    assert [g["item_id"] for g, _ in joined] == ["a", "b"]
    assert joined[0][1] == {"item_id": "a"}
    assert joined[1][1] is None  # b has no prediction


def test_join_items_unknown_pred_id_warns():
    gold = [{"item_id": "a"}]
    pred = [{"item_id": "a"}, {"item_id": "z"}, {"item_id": "q"}]
    with pytest.warns(UserWarning, match="unknown"):
        joined = join_items(gold, pred)
    # The join is gold-driven: unknown pred ids never appear in the output.
    assert [g["item_id"] for g, _ in joined] == ["a"]


def test_join_items_no_warning_when_all_known():
    import warnings

    gold = [{"item_id": "a"}, {"item_id": "b"}]
    pred = [{"item_id": "a"}]
    with warnings.catch_warnings():
        warnings.simplefilter("error")  # any warning becomes an error
        join_items(gold, pred)  # must not warn


def test_load_facet_vocab_and_hierarchy():
    vocab = load_facet_vocab()
    assert "topic" in vocab["facets"]
    hierarchy = load_hierarchy(FIXTURES / "hierarchy_sample.json")
    assert hierarchy.ancestors("sourdough") == {"baking", "food"}
