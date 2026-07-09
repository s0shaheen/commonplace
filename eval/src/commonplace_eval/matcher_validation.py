"""Validate the matcher itself against human judgment.

Governed by ``docs/specs/evaluation-methodology.md`` §4: "Validate the matcher itself:
run it on ~100 human-judged match/non-match pairs and report *its* precision and
recall (Hamel Husain's rule — raw agreement misleads under class imbalance). The
matcher is part of the instrument." The matcher is a component of the measurement
apparatus, so it gets measured like any other classifier.

Each pairs-file line is ``{"a": {"surface", "aliases"?}, "b": {"surface"},
"human_match": bool}`` — ``a`` is the gold side (it may carry aliases, which the
matcher's EXACT tier compares against), ``b`` the prediction side. The matcher
"predicts match" iff a 1×1 ``matcher.align([a], [b])`` yields an aligned pair with
tier ≠ NONE. That prediction is scored against ``human_match``:

    TP: human match & matcher match     FP: human non-match & matcher match
    FN: human match & matcher miss      TN: human non-match & matcher miss

and reported as precision/recall/F1 + the raw confusion. Pure except for reading
the JSONL file.
"""

from __future__ import annotations

import json
from pathlib import Path

from commonplace_eval.matcher import MatchTier, align

__all__ = ["validate_matcher"]


def _matcher_matches(a: dict, b: dict) -> bool:
    """True iff the matcher aligns ``b`` to ``a`` at a tier other than NONE."""
    gold = {"surface": a.get("surface", ""), "type": "x", "aliases": a.get("aliases") or []}
    pred = {"surface": b.get("surface", ""), "type": "x"}
    result = align([gold], [pred])
    for pair in result.pairs:
        if pair.gold_idx is not None and pair.pred_idx is not None and pair.tier is not MatchTier.NONE:
            return True
    return False


def validate_matcher(pairs_path) -> dict:
    """Score the matcher on human-judged match/non-match pairs.

    Returns ``{precision, recall, f1, n, confusion: {tp, fp, fn, tn}}`` — the
    matcher's precision/recall against ``human_match`` over every pair in the
    JSONL file. Any zero denominator yields ``0.0`` for the affected quantity.
    """
    tp = fp = fn = tn = 0

    with Path(pairs_path).open(encoding="utf-8") as fh:
        for lineno, raw in enumerate(fh, start=1):
            raw = raw.strip()
            if not raw:
                continue
            try:
                row = json.loads(raw)
            except json.JSONDecodeError as exc:
                raise ValueError(f"matcher pairs {pairs_path}: line {lineno} is not valid JSON: {exc}") from exc
            human = bool(row["human_match"])
            predicted = _matcher_matches(row["a"], row["b"])
            if human and predicted:
                tp += 1
            elif not human and predicted:
                fp += 1
            elif human and not predicted:
                fn += 1
            else:
                tn += 1

    precision = tp / (tp + fp) if (tp + fp) else 0.0
    recall = tp / (tp + fn) if (tp + fn) else 0.0
    f1 = 2 * precision * recall / (precision + recall) if (precision + recall) else 0.0

    return {
        "precision": precision,
        "recall": recall,
        "f1": f1,
        "n": tp + fp + fn + tn,
        "confusion": {"tp": tp, "fp": fp, "fn": fn, "tn": tn},
    }
