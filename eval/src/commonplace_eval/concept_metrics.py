"""Concept-layer metrics (Task 8): hierarchical F1@k + R-precision.

Governed by ``docs/product/_EVAL-METHOD.md`` §4 Concept row: *open multi-label
subject indexing* is scored by **hierarchical F1@k (micro+macro)** with
**True-Path partial credit** and **R-precision@k** — explicitly **not** 1:1
linking (a video's subject tags form a hierarchy; predicting a parent of the
gold concept deserves partial, not zero, credit).

**Hierarchical F1 (Kiritchenko et al. 2005 "True-Path Rule").** Each concept is
expanded to its *ancestor closure* (self + all transitive ancestors); precision,
recall and F1 are set-overlap over the expanded sets. Predicting ``baking`` when
gold is ``sourdough`` (a child of ``baking``) still shares ``{baking, food}``,
so it scores partial credit instead of a flat miss.

Conventions (each flagged in the Task-8 report, several left to us by dispatch):

* **Top-k selection** — per item the predictions are ranked by ``score`` (desc;
  ties broken by input order) and truncated to the top ``k`` *before* closure
  expansion.
* **Ancestor closure** — ``closure(c) = {c} ∪ ancestors(c)``. An id absent from
  the hierarchy has no ancestors, so it closes over *itself only* (documented).
* **micro** pools the expanded sets across items: ``P = Σ|inter| / Σ|pred_exp|``,
  ``R = Σ|inter| / Σ|gold_exp|``. **macro** is the unweighted mean of each item's
  P/R/F1; ``macro["f1"]`` (mean per-item hierarchical F1) is the headline.
* **Items with no gold concepts are excluded ENTIRELY** — they contribute to
  neither micro nor macro. The dispatch floated (and rejected) crediting their
  predictions in the micro precision denominator; excluding them outright is the
  simplest self-consistent rule and is the one implemented.

**R-precision** (Manning/IR): per item ``R = |gold concepts|`` over *flat* ids
(no closure); precision among the top-``R`` predictions; mean over items with at
least one gold concept.

Pure and JSON-serializable; no I/O beyond ``Hierarchy.from_file``.
"""

from __future__ import annotations

import json
from pathlib import Path

__all__ = ["Hierarchy", "hierarchical_prf_at_k", "r_precision"]


class Hierarchy:
    """A concept DAG stored as child -> list-of-parents edges.

    Multi-parent nodes are allowed (a concept may sit under several broader
    subjects). Cycles are rejected at construction with ``ValueError`` — an
    ancestor relation must be a partial order. ``ancestors`` returns the
    transitive parent closure *excluding* the node itself.
    """

    def __init__(self, edges: dict[str, list[str]]):
        # Defensive copy; drop self as its own parent would be a trivial cycle
        # (caught below, but copy so callers can't mutate our state).
        self._edges: dict[str, list[str]] = {c: list(parents) for c, parents in edges.items()}
        self._check_acyclic()
        self._cache: dict[str, frozenset[str]] = {}

    @classmethod
    def from_file(cls, path) -> "Hierarchy":
        data = json.loads(Path(path).read_text(encoding="utf-8"))
        return cls(data["edges"])

    def _check_acyclic(self) -> None:
        """DFS over the parent graph; a back-edge to a node on the current
        recursion stack is a cycle (self-loops included)."""
        WHITE, GRAY, BLACK = 0, 1, 2
        color: dict[str, int] = {}

        def visit(node: str, stack: tuple[str, ...]) -> None:
            color[node] = GRAY
            for parent in self._edges.get(node, ()):
                if color.get(parent) == GRAY:
                    cycle = " -> ".join(stack + (node, parent))
                    raise ValueError(f"cycle in concept hierarchy: {cycle}")
                if color.get(parent, WHITE) == WHITE:
                    visit(parent, stack + (node,))
            color[node] = BLACK

        for node in self._edges:
            if color.get(node, WHITE) == WHITE:
                visit(node, ())

    def ancestors(self, concept_id: str) -> set[str]:
        """Transitive ancestors of ``concept_id`` (excludes self).

        An id with no outgoing parent edges — including one absent from the
        hierarchy entirely — returns the empty set.
        """
        return set(self._ancestors(concept_id))

    def _ancestors(self, concept_id: str) -> frozenset[str]:
        cached = self._cache.get(concept_id)
        if cached is not None:
            return cached
        acc: set[str] = set()
        for parent in self._edges.get(concept_id, ()):
            acc.add(parent)
            acc |= self._ancestors(parent)
        result = frozenset(acc)
        self._cache[concept_id] = result
        return result

    def closure(self, concept_id: str) -> set[str]:
        """``{concept_id} ∪ ancestors(concept_id)`` — the True-Path expansion."""
        return {concept_id} | self._ancestors(concept_id)


def _f1(precision: float, recall: float) -> float:
    denom = precision + recall
    return 2 * precision * recall / denom if denom else 0.0


def _join_by_item_id(gold_items: list[dict], pred_items: list[dict]) -> list[tuple[dict, dict]]:
    """Pair gold/pred records by ``item_id`` (gold order first, then pred-only
    ids), last-wins on duplicates — the same join ``extraction_metrics`` uses."""
    gold_by_id = {it["item_id"]: it for it in gold_items}
    pred_by_id = {it["item_id"]: it for it in pred_items}
    item_ids = list(gold_by_id) + [k for k in pred_by_id if k not in gold_by_id]
    return [(gold_by_id.get(i, {}), pred_by_id.get(i, {})) for i in item_ids]


def _gold_ids(record: dict) -> list[str]:
    return [c["concept_id"] for c in record.get("concepts") or []]


def _pred_ids_by_score(record: dict) -> list[str]:
    """Predicted concept ids sorted by score desc, ties by input order."""
    concepts = list(record.get("concepts") or [])
    order = sorted(
        range(len(concepts)),
        key=lambda i: (-(concepts[i].get("score") or 0.0), i),
    )
    return [concepts[i]["concept_id"] for i in order]


def hierarchical_prf_at_k(
    gold_items: list[dict],
    pred_items: list[dict],
    hierarchy: Hierarchy,
    k: int = 5,
) -> dict:
    """Hierarchical (True-Path) precision/recall/F1@k over concept items.

    Per item: take the top-``k`` predictions by score, expand both gold and
    predicted ids to their ancestor closures, and score set overlap. Returns
    ``{"micro": {precision, recall, f1}, "macro": {precision, recall, f1},
    "k": k, "n_items": n}``. Items with no gold concepts are excluded entirely.
    """
    sum_inter = sum_gold = sum_pred = 0
    per_item: list[tuple[float, float, float]] = []

    for gold, pred in _join_by_item_id(gold_items, pred_items):
        gold_ids = _gold_ids(gold)
        if not gold_ids:  # no gold concepts -> excluded entirely
            continue
        pred_ids = _pred_ids_by_score(pred)[:k]

        gold_exp: set[str] = set()
        for cid in gold_ids:
            gold_exp |= hierarchy.closure(cid)
        pred_exp: set[str] = set()
        for cid in pred_ids:
            pred_exp |= hierarchy.closure(cid)

        inter = len(gold_exp & pred_exp)
        sum_inter += inter
        sum_gold += len(gold_exp)
        sum_pred += len(pred_exp)

        p = inter / len(pred_exp) if pred_exp else 0.0
        r = inter / len(gold_exp) if gold_exp else 0.0
        per_item.append((p, r, _f1(p, r)))

    micro_p = sum_inter / sum_pred if sum_pred else 0.0
    micro_r = sum_inter / sum_gold if sum_gold else 0.0
    micro = {"precision": micro_p, "recall": micro_r, "f1": _f1(micro_p, micro_r)}

    n = len(per_item)
    if n:
        macro = {
            "precision": sum(p for p, _, _ in per_item) / n,
            "recall": sum(r for _, r, _ in per_item) / n,
            "f1": sum(f for _, _, f in per_item) / n,
        }
    else:
        macro = {"precision": 0.0, "recall": 0.0, "f1": 0.0}

    return {"micro": micro, "macro": macro, "k": k, "n_items": n}


def r_precision(gold_items: list[dict], pred_items: list[dict]) -> dict:
    """R-precision over concept items (flat ids, no closure).

    Per item with >=1 gold concept: ``R = |distinct gold ids|``; precision =
    (hits among the top-``R`` predictions) / ``R``. Returns ``{"r_precision":
    mean, "n_items": scored-item-count}``.
    """
    scores: list[float] = []
    for gold, pred in _join_by_item_id(gold_items, pred_items):
        gold_set = set(_gold_ids(gold))
        r = len(gold_set)
        if r == 0:  # no gold concepts -> not in the mean
            continue
        top_r = _pred_ids_by_score(pred)[:r]
        hits = sum(1 for cid in top_r if cid in gold_set)
        scores.append(hits / r)

    n = len(scores)
    return {"r_precision": sum(scores) / n if n else 0.0, "n_items": n}
