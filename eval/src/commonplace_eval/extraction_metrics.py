"""Extraction (mention-level) P/R/F1 — the MUC-5 / SemEval-2013 Task 9.1 stack.

Governed by ``docs/specs/evaluation-methodology.md`` §4 ("Extraction (mention-level),
exact-string BANNED"). Consumes the Task-5 matcher (``matcher.align`` +
``MatchResult.categorize``): the matcher decides *which* gold pairs with which
prediction and under which MUC category (COR/INC/PAR/MIS/SPU) per scheme; this
module only turns those categories into partial-credit P/R/F1.

Partial-credit definitions (SemEval-2013 9.1, via nervaluate), with PAR scored
at half credit::

    ACT = COR + INC + PAR + SPU        (predicted, "actual")
    POS = COR + INC + PAR + MIS        (gold, "possible")
    P   = (COR + 0.5*PAR) / ACT        (0.0 when ACT == 0)
    R   = (COR + 0.5*PAR) / POS        (0.0 when POS == 0)
    F1  = 2*P*R / (P + R)              (0.0 when P + R == 0)

Reported per scheme (strict / exact / partial / type) at three granularities:
**micro** (counts pooled across items), **macro** (unweighted mean of per-type
F1 over the *observed* types), and a **per-type** table. Strict is the
pre-designated headline (§4). Every returned value is a plain ``float``/``int``
(JSON-serializable); this module is pure — no I/O, no printing.

Attribution rule (per the brief): a gold-owning category (COR/INC/PAR/MIS) is
counted under the **gold** mention's type; a spurious prediction (SPU) is
counted under the **pred** mention's type. Join is by ``item_id`` — a gold item
with no matching pred item yields all-MIS; a pred item with no gold item yields
all-SPU (both fall out of ``matcher.align`` on an empty opposite side).

**NON_ENTITY traps are never creditable.** A gold mention with
``nil == "NON_ENTITY"`` is an adjudicated pre-annotation trap ("a good pizza
place" proposed then rejected), not a real entity. Alignment runs on the full
mention sets unchanged, but the result is recast: an *unmatched* NON_ENTITY gold
contributes **nothing** (correctly ignoring a trap is not a recall failure — no
MIS); a pred that aligned to one is **SPU** by its own pred type (the system
extracted something that was rejected), and the pair yields no COR/INC/PAR. This
keeps extraction honest without penalizing the annotator's trap rows on recall.

Macro averaging uses observed types (types present in the per-type table),
matching nervaluate; a type never seen contributes nothing (rather than a
0/0 F1 that would drag the mean toward zero). The grounding InKB metric, by
contrast, macro-averages over the fixed 9-type inventory — see
``grounding_metrics.inkb_prf`` — because there the type set is closed.
"""

from __future__ import annotations

from commonplace_eval.matcher import align

__all__ = ["prf", "score_extraction"]

# MUC-5 / SemEval-2013 9.1 category labels, string-keyed for JSON-serializable
# count dicts (the matcher's ``Category`` enum values are these same strings).
_CATS = ("COR", "INC", "PAR", "MIS", "SPU")
_DEFAULT_SCHEMES = ("strict", "exact", "partial", "type")


def prf(counts: dict) -> dict:
    """Partial-credit P/R/F1 from a ``{COR,INC,PAR,MIS,SPU}`` count dict.

    Returns ``{"precision", "recall", "f1", "actual", "possible"}`` where
    ``actual`` = ACT and ``possible`` = POS (see module docstring). Missing
    keys default to 0; PAR earns half credit. Any zero denominator yields 0.0
    for the affected quantity (P, R, or F1).
    """
    cor = counts.get("COR", 0)
    inc = counts.get("INC", 0)
    par = counts.get("PAR", 0)
    mis = counts.get("MIS", 0)
    spu = counts.get("SPU", 0)

    actual = cor + inc + par + spu
    possible = cor + inc + par + mis
    numer = cor + 0.5 * par

    precision = numer / actual if actual else 0.0
    recall = numer / possible if possible else 0.0
    f1 = 2 * precision * recall / (precision + recall) if (precision + recall) else 0.0

    return {
        "precision": precision,
        "recall": recall,
        "f1": f1,
        "actual": actual,
        "possible": possible,
    }


def _zero_counts() -> dict:
    return {c: 0 for c in _CATS}


def score_extraction(
    gold_items: list[dict],
    pred_items: list[dict],
    schemes: tuple = _DEFAULT_SCHEMES,
    fuzzy_threshold: int = 90,
) -> dict:
    """Score extraction across items and schemes.

    Joins ``gold_items``/``pred_items`` by ``item_id``; each side's ``mentions``
    list is aligned once via ``matcher.align`` (a gold item with no pred item ->
    all mentions MIS; a pred item with no gold item -> all mentions SPU). For
    every scheme the aligned pairs are categorized and tallied both pooled
    (micro) and per-type.

    Returns ``{scheme: {"micro": prf, "macro": {precision, recall, f1},
    "per_type": {type: prf}, "counts": {COR,INC,PAR,MIS,SPU}}}``. Macro is the
    unweighted mean of per-type precision/recall/F1 over observed types (0.0 for
    each when no type is observed). Duplicate ``item_id``s are last-wins.

    NON_ENTITY gold rows (``nil == "NON_ENTITY"``) are never creditable: an
    unmatched one is dropped (no MIS); a pred aligned to one is recast as SPU by
    its pred type. See the module docstring.
    """
    gold_by_id = {it["item_id"]: it for it in gold_items}
    pred_by_id = {it["item_id"]: it for it in pred_items}
    # Union of item ids, gold order first then pred-only ids (deterministic).
    item_ids = list(gold_by_id) + [k for k in pred_by_id if k not in gold_by_id]

    micro: dict[str, dict] = {s: _zero_counts() for s in schemes}
    per_type: dict[str, dict[str, dict]] = {s: {} for s in schemes}

    for item_id in item_ids:
        gold_mentions = gold_by_id.get(item_id, {}).get("mentions") or []
        pred_mentions = pred_by_id.get(item_id, {}).get("mentions") or []
        result = align(gold_mentions, pred_mentions, fuzzy_threshold)
        for scheme in schemes:
            for pair, cat in result.categorize(scheme):
                gold = gold_mentions[pair.gold_idx] if pair.gold_idx is not None else None
                if gold is not None and gold.get("nil") == "NON_ENTITY":
                    # Adjudicated trap: not creditable.
                    if pair.pred_idx is None:
                        continue  # unmatched trap correctly ignored -> no MIS
                    # A pred that grounded the trap is spurious, owned by pred type.
                    label = "SPU"
                    type_ = pred_mentions[pair.pred_idx].get("type")
                elif cat.value == "SPU":  # spurious pred owns its category by PRED type
                    label = "SPU"
                    type_ = pred_mentions[pair.pred_idx].get("type")
                else:  # COR/INC/PAR/MIS owned by GOLD type
                    label = cat.value
                    type_ = gold_mentions[pair.gold_idx].get("type")
                micro[scheme][label] += 1
                bucket = per_type[scheme].setdefault(type_, _zero_counts())
                bucket[label] += 1

    out: dict[str, dict] = {}
    for scheme in schemes:
        per_type_prf = {t: prf(c) for t, c in per_type[scheme].items()}
        out[scheme] = {
            "micro": prf(micro[scheme]),
            "macro": _macro(per_type_prf),
            "per_type": per_type_prf,
            "counts": micro[scheme],
        }
    return out


def _macro(per_type_prf: dict[str, dict]) -> dict:
    """Unweighted mean of per-type precision/recall/F1 over observed types."""
    if not per_type_prf:
        return {"precision": 0.0, "recall": 0.0, "f1": 0.0}
    n = len(per_type_prf)
    return {
        "precision": sum(d["precision"] for d in per_type_prf.values()) / n,
        "recall": sum(d["recall"] for d in per_type_prf.values()) / n,
        "f1": sum(d["f1"] for d in per_type_prf.values()) / n,
    }
