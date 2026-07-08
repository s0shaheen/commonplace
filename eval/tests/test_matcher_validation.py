"""Tests for matcher_validation.py — the matcher scored against human judgment.

The 12-pair fixture (matcher_pairs.jsonl) is 6 human-match / 6 human-non-match.
The matcher's ACTUAL behavior on each pair (verified against the Task-5 matcher)
gives this confusion:

  TP=5  human match  & matcher matches (Joes Pizza, "that pizza spot Joe's" [FUZZY],
        The Matrix/Matrix, SZA via alias, Taylor Swift via alias)
  FN=1  human match  & matcher misses  (NYC vs "the Big Apple" — nickname coreference)
  FP=1  human non    & matcher matches  (Dune vs Dune Part Two — token_set_ratio=100)
  TN=5  human non    & matcher misses  (Radiohead/Coldplay, Nike/Adidas,
        iPhone/Samsung, Inception/Dark Knight, Central Park/Hyde Park)

  precision = 5/6 ; recall = 5/6 ; f1 = 5/6
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from commonplace_eval.matcher_validation import validate_matcher

FIXTURES = Path(__file__).resolve().parent / "fixtures"


def test_matcher_validation_counts():
    result = validate_matcher(FIXTURES / "matcher_pairs.jsonl")
    assert result["n"] == 12
    assert result["confusion"] == {"tp": 5, "fp": 1, "fn": 1, "tn": 5}
    assert result["precision"] == pytest.approx(5 / 6)
    assert result["recall"] == pytest.approx(5 / 6)
    assert result["f1"] == pytest.approx(5 / 6)


def test_matcher_validation_hard_pair_is_a_true_positive():
    """The required 'that pizza spot Joe's' pair: human match, and the matcher
    ACTUALLY matches it (FUZZY, token_set_ratio=100), so it must count as a TP —
    the confusion above already bakes this in; this pins the behavior."""
    result = validate_matcher(FIXTURES / "matcher_pairs.jsonl")
    # If the hard pair had been an FN instead, recall would be 4/6, not 5/6.
    assert result["recall"] == pytest.approx(5 / 6)


def test_matcher_validation_confusion_sums_to_n(tmp_path):
    pairs = [
        {"a": {"surface": "Nike", "aliases": []}, "b": {"surface": "Nike"}, "human_match": True},
        {"a": {"surface": "Nike", "aliases": []}, "b": {"surface": "Adidas"}, "human_match": False},
    ]
    p = tmp_path / "p.jsonl"
    p.write_text("\n".join(json.dumps(x) for x in pairs) + "\n")
    result = validate_matcher(p)
    c = result["confusion"]
    assert c["tp"] + c["fp"] + c["fn"] + c["tn"] == result["n"] == 2
    assert c == {"tp": 1, "fp": 0, "fn": 0, "tn": 1}
