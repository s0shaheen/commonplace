"""StructuredContent-layer metrics (Task 8): slot-filling + step recall/order.

Governed by ``docs/specs/evaluation-methodology.md`` §4 StructuredContent row:
*slot-filling* is scored by **Field Accuracy + Document Accuracy + step
recall/order**. StructuredContent is the schema.org-typed structured payload of
a video (a ``Recipe`` with ingredient slots and ordered steps, a ``HowTo``,
etc.); we score how many slots are filled correctly, whether the whole document
is exactly right, and how faithfully the ordered steps are recovered.

Value-correctness reuses the Task-5 matcher's convention verbatim: normalize
both sides (``normalize.normalize_mention``) then accept on **normalized equality
OR rapidfuzz ``token_set_ratio`` >= 90**. Step matching reuses the same fuzzy
tier under a Hungarian (``scipy.optimize.linear_sum_assignment``) alignment.

Conventions (flagged in the Task-8 report — several left to us by dispatch):

* **field_accuracy** — gold slots matched to pred slots by *normalized name*
  equality; ``total = |gold slots|``; a gold slot with no correctly-valued
  same-named pred slot is wrong. ``total == 0`` → ``accuracy = 0.0``.
* **document_accuracy** — ``True`` iff every gold slot is correct. **Empty gold
  slots → vacuously True** (``all([]) == True``): a document with nothing to fill
  is trivially filled. (The dispatch waffled here; this is the coherent choice
  and is flagged. In ``structured_scores`` an *unmatched* gold doc is scored
  ``False`` directly, so vacuous-True never inflates the aggregate.)
* **step_metrics** — steps matched by normalized text (exact → 1.0, fuzzy >= 90 →
  ``ratio/100`` capped at 0.999) under Hungarian assignment. ``step_recall =
  matched / |gold steps|``; ``step_order`` = raw Kendall τ over the matched
  pairs' ``(gold order, pred order)``, **defined 1.0 when < 2 matched pairs** (τ
  undefined). **Empty gold steps → recall 1.0, order 1.0** (nothing to recall);
  ``n_gold_steps`` is reported so consumers see the degenerate case.
* **structured_scores** — gold docs matched to pred docs within an item by exact
  ``schemaOrgType`` (first unmatched pred of that type; leftovers unmatched).
  ``field_accuracy`` is **pooled** (Σcorrect/Σtotal over all gold docs, an
  unmatched gold doc contributing its slots as all-wrong); ``document_accuracy``
  is the fraction of gold docs exactly right (unmatched → False); step
  recall/order are **means over matched docs that have steps**; ``n_docs`` =
  gold doc count.

Pure and JSON-serializable.
"""

from __future__ import annotations

import numpy as np
from rapidfuzz import fuzz
from scipy.optimize import linear_sum_assignment
from scipy.stats import kendalltau

from commonplace_eval.normalize import normalize_mention

__all__ = ["field_accuracy", "document_accuracy", "step_metrics", "structured_scores"]

_FUZZY_THRESHOLD = 90  # same tier the matcher uses


def _as_text(value: object) -> str:
    return value if isinstance(value, str) else str(value)


def _norm(value: object) -> str:
    return normalize_mention(_as_text(value))


def _value_correct(gold_value: object, pred_value: object) -> bool:
    """Normalized equality OR ``token_set_ratio`` >= 90 (matcher convention)."""
    g = _norm(gold_value)
    p = _norm(pred_value)
    if g == p:
        return True
    return fuzz.token_set_ratio(g, p) >= _FUZZY_THRESHOLD


def field_accuracy(gold_doc: dict, pred_doc: dict) -> dict:
    """Slot-fill accuracy for one document. ``{correct, total, accuracy}``."""
    gold_slots = gold_doc.get("slots") or []
    pred_slots = pred_doc.get("slots") or []

    # Predicted values indexed by normalized slot name (a name may repeat).
    pred_by_name: dict[str, list[object]] = {}
    for s in pred_slots:
        pred_by_name.setdefault(_norm(s.get("name", "")), []).append(s.get("value"))

    correct = 0
    for s in gold_slots:
        candidates = pred_by_name.get(_norm(s.get("name", "")), [])
        if any(_value_correct(s.get("value"), pv) for pv in candidates):
            correct += 1

    total = len(gold_slots)
    return {"correct": correct, "total": total, "accuracy": correct / total if total else 0.0}


def document_accuracy(gold_doc: dict, pred_doc: dict) -> bool:
    """``True`` iff every gold slot is correct (empty gold slots → vacuously True)."""
    fa = field_accuracy(gold_doc, pred_doc)
    return fa["correct"] == fa["total"]


def step_metrics(gold_steps: list[dict], pred_steps: list[dict]) -> dict:
    """Step recall + order for one document's ordered steps.

    Returns ``{step_recall, step_order, n_gold_steps, n_matched}``.
    """
    n_gold = len(gold_steps)
    if n_gold == 0:
        # Nothing to recall; order trivially satisfied (documented convention).
        return {"step_recall": 1.0, "step_order": 1.0, "n_gold_steps": 0, "n_matched": 0}

    gnorm = [_norm(s.get("text", "")) for s in gold_steps]
    pnorm = [_norm(s.get("text", "")) for s in pred_steps]
    n_pred = len(pred_steps)

    matched_pairs: list[tuple[int, int]] = []  # (gold order, pred order)
    if n_pred:
        sim = np.zeros((n_gold, n_pred), dtype=float)
        for i in range(n_gold):
            for j in range(n_pred):
                if gnorm[i] == pnorm[j]:
                    sim[i, j] = 1.0
                else:
                    ratio = fuzz.token_set_ratio(gnorm[i], pnorm[j])
                    if ratio >= _FUZZY_THRESHOLD:
                        sim[i, j] = min(ratio / 100.0, 0.999)
        row_ind, col_ind = linear_sum_assignment(sim, maximize=True)
        for i, j in zip(row_ind, col_ind):
            i, j = int(i), int(j)
            if sim[i, j] > 0.0:
                matched_pairs.append((gold_steps[i]["order"], pred_steps[j]["order"]))

    n_matched = len(matched_pairs)
    step_recall = n_matched / n_gold

    if n_matched < 2:
        step_order = 1.0  # τ undefined for < 2 pairs (documented convention)
    else:
        tau = kendalltau([g for g, _ in matched_pairs], [p for _, p in matched_pairs]).statistic
        step_order = float(tau) if tau == tau else 1.0  # NaN (all-ties) → 1.0

    return {
        "step_recall": step_recall,
        "step_order": step_order,
        "n_gold_steps": n_gold,
        "n_matched": n_matched,
    }


def _join_by_item_id(gold_items: list[dict], pred_items: list[dict]) -> list[tuple[dict, dict]]:
    gold_by_id = {it["item_id"]: it for it in gold_items}
    pred_by_id = {it["item_id"]: it for it in pred_items}
    item_ids = list(gold_by_id) + [k for k in pred_by_id if k not in gold_by_id]
    return [(gold_by_id.get(i, {}), pred_by_id.get(i, {})) for i in item_ids]


def structured_scores(gold_items: list[dict], pred_items: list[dict]) -> dict:
    """Aggregate StructuredContent scores across items.

    Returns ``{field_accuracy, document_accuracy, step_recall, step_order,
    n_docs, n_step_docs}`` (``n_step_docs`` = matched docs with steps, the step
    means' denominator).
    """
    pooled_correct = pooled_total = 0
    n_docs = 0
    doc_true = 0
    step_recalls: list[float] = []
    step_orders: list[float] = []

    for gold, pred in _join_by_item_id(gold_items, pred_items):
        gold_docs = gold.get("structured") or []
        pred_docs = list(pred.get("structured") or [])
        used = [False] * len(pred_docs)

        for gdoc in gold_docs:
            n_docs += 1
            gtype = gdoc.get("schemaOrgType")
            match_idx = next(
                (j for j, pdoc in enumerate(pred_docs) if not used[j] and pdoc.get("schemaOrgType") == gtype),
                None,
            )

            if match_idx is None:  # unmatched gold doc: all slots wrong, doc False
                pooled_total += len(gdoc.get("slots") or [])
                continue

            used[match_idx] = True
            pdoc = pred_docs[match_idx]
            fa = field_accuracy(gdoc, pdoc)
            pooled_correct += fa["correct"]
            pooled_total += fa["total"]
            if document_accuracy(gdoc, pdoc):
                doc_true += 1
            if gdoc.get("steps"):  # step means only over matched docs WITH steps
                sm = step_metrics(gdoc.get("steps") or [], pdoc.get("steps") or [])
                step_recalls.append(sm["step_recall"])
                step_orders.append(sm["step_order"])

    return {
        "field_accuracy": pooled_correct / pooled_total if pooled_total else 0.0,
        "document_accuracy": doc_true / n_docs if n_docs else 0.0,
        "step_recall": sum(step_recalls) / len(step_recalls) if step_recalls else 0.0,
        "step_order": sum(step_orders) / len(step_orders) if step_orders else 0.0,
        "n_docs": n_docs,
        "n_step_docs": len(step_recalls),
    }
