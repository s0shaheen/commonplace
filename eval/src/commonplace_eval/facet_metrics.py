"""Facet-layer metrics (Task 8): per-facet macro-F1 + Cohen's κ.

Governed by ``docs/specs/evaluation-methodology.md`` §4 Facets row: the facets are a
fixed set of *classification* axes, so each is scored on its own — **per-facet
macro-F1 + Cohen's κ** — and never blended into one number (each axis has its
own value set, chance baseline, and denominator).

Note the §5/§6 caveat: Cohen's κ is the right chance-corrected agreement
statistic **for the closed-vocabulary facet axes** (bounded categories per axis).
It is deliberately NOT used for span/set tasks (mentions) where negatives are
unbounded — that is why the extraction layer reports pairwise F1 instead.

Conventions (flagged in the Task-8 report):

* **cohen_kappa** — standard ``(po − pe)/(1 − pe)`` over paired labels, with:
  empty input → ``0.0``; ``pe == 1`` (a rater is constant) → ``1.0`` iff
  ``po == 1`` else ``0.0`` (the ``0/0`` guard: perfect-and-degenerate agreement
  is credited, degenerate-with-disagreement is not); length mismatch →
  ``ValueError`` (labels must be paired).
* **facet_scores** — for each axis named in the vocab, the eval set is the items
  whose *gold* record carries that facet. A pred that omits a gold-present facet
  is labelled ``"__missing__"``. Per-facet macro-F1 is the mean one-vs-rest F1
  over the values present in gold or pred (``"__missing__"`` is **excluded as a
  class** but still damages the true value's recall — a gold value the system
  failed to emit is a false negative). κ is computed over the same pairs (with
  ``"__missing__"`` as an ordinary category). ``n`` = eval-set size. Axes with an
  empty eval set are skipped, ``status="empty"``.
"""

from __future__ import annotations

from collections import Counter

__all__ = ["cohen_kappa", "facet_scores"]

_MISSING = "__missing__"


def cohen_kappa(a: list[str], b: list[str]) -> float:
    """Cohen's κ for two paired label sequences.

    See the module docstring for the empty / degenerate-marginal conventions.
    """
    if len(a) != len(b):
        raise ValueError(f"cohen_kappa: paired sequences differ in length ({len(a)} != {len(b)})")
    n = len(a)
    if n == 0:
        return 0.0

    po = sum(1 for x, y in zip(a, b) if x == y) / n
    count_a = Counter(a)
    count_b = Counter(b)
    pe = sum((count_a[c] / n) * (count_b.get(c, 0) / n) for c in count_a)

    if pe >= 1.0:  # a rater is constant -> (po - pe)/(1 - pe) is 0/0
        return 1.0 if po >= 1.0 else 0.0
    return (po - pe) / (1.0 - pe)


def _per_value_f1(gold: list[str], pred: list[str]) -> dict[str, float]:
    """One-vs-rest F1 for each real value present in gold or pred.

    ``_MISSING`` is never a positive value (it earns no TP/FP) but naturally
    contributes an FN whenever it stands in for a true gold value.
    """
    values = (set(gold) | set(pred)) - {_MISSING}
    out: dict[str, float] = {}
    for v in sorted(values):
        tp = sum(1 for g, p in zip(gold, pred) if g == v and p == v)
        fp = sum(1 for g, p in zip(gold, pred) if g != v and p == v)
        fn = sum(1 for g, p in zip(gold, pred) if g == v and p != v)
        prec = tp / (tp + fp) if (tp + fp) else 0.0
        rec = tp / (tp + fn) if (tp + fn) else 0.0
        out[v] = 2 * prec * rec / (prec + rec) if (prec + rec) else 0.0
    return out


def _axes(facet_vocab: dict) -> list[str]:
    """Axis names from the vocab. Accepts the raw ``facets.json`` dict (top-level
    ``facets`` key) or a bare ``{name: ...}`` mapping."""
    axes = facet_vocab.get("facets", facet_vocab)
    return list(axes.keys())


def _join_by_item_id(gold_items: list[dict], pred_items: list[dict]) -> list[tuple[dict, dict]]:
    gold_by_id = {it["item_id"]: it for it in gold_items}
    pred_by_id = {it["item_id"]: it for it in pred_items}
    item_ids = list(gold_by_id) + [k for k in pred_by_id if k not in gold_by_id]
    return [(gold_by_id.get(i, {}), pred_by_id.get(i, {})) for i in item_ids]


def facet_scores(gold_items: list[dict], pred_items: list[dict], facet_vocab: dict) -> dict:
    """Per-facet macro-F1 + Cohen's κ over every axis in ``facet_vocab``.

    Returns ``{facet_name: {...}}`` where a scored axis has ``{"macro_f1",
    "kappa", "n", "per_value_f1", "status": "scored"}`` and an axis with an empty
    eval set has ``{"n": 0, "status": "empty"}``.
    """
    pairs = _join_by_item_id(gold_items, pred_items)
    out: dict[str, dict] = {}

    for facet in _axes(facet_vocab):
        gold_labels: list[str] = []
        pred_labels: list[str] = []
        for gold, pred in pairs:
            gold_facets = gold.get("facets") or {}
            if facet not in gold_facets:
                continue  # eval set = items whose GOLD carries this facet
            pred_facets = pred.get("facets") or {}
            gold_labels.append(gold_facets[facet])
            pred_labels.append(pred_facets.get(facet, _MISSING))

        n = len(gold_labels)
        if n == 0:
            out[facet] = {"n": 0, "status": "empty"}
            continue

        per_value = _per_value_f1(gold_labels, pred_labels)
        macro_f1 = sum(per_value.values()) / len(per_value) if per_value else 0.0
        out[facet] = {
            "macro_f1": macro_f1,
            "kappa": cohen_kappa(gold_labels, pred_labels),
            "n": n,
            "per_value_f1": per_value,
            "status": "scored",
        }

    return out
