"""Grounding (ID-level) metrics, decomposed GERBIL/ELEVANT-style.

Governed by ``docs/product/_EVAL-METHOD.md`` §4 ("Grounding (ID-level),
decomposed ..."). Extraction noise and grounding noise must never be
confounded, so this module scores the *resolver* on top of the Task-5 matcher's
**strict-scheme alignment**, decomposed into five views:

* ``disambiguation_accuracy`` — resolver accuracy *given* a gold mention with an
  id (isolates linking from extraction).
* ``inkb_prf`` — end-to-end InKB micro/macro F1 (gold has an id).
* ``nil_prf`` — NIL treated as its own class (TAC-KBP penalizes never-say-NIL):
  NIL-precision = correct-NILs / predicted-NILs, NIL-recall = correct-NILs /
  gold-NILs.
* ``effective_reliability`` — the asymmetric headline Φ_c: +1 correct id, 0
  NIL/abstain, −c a wrong id (default c=10). "Honesty over fluency" as a number
  — a confidently-wrong durable id is far worse than an honest NIL.
* ``risk_coverage`` — risk–coverage curve + AURC + coverage-at-≤5%-risk (the
  product-facing "coverage at the shipped confidence threshold").

**Grounding universe.** Gold mentions with ``nil == "NON_ENTITY"`` are excluded
from the universe/denominator: those rows are adjudicated extraction traps, not
grounding targets. The universe is every gold mention with ``nil != "NON_ENTITY"``:
InKB (has ``gold_id``) or ``nil == "NIL_NO_ID"``. A NON_ENTITY gold with no
aligned pred contributes nothing anywhere (extraction owns the SPU).

**Grounding a trap is penalized ("honesty over fluency", §4).** A pred the
matcher aligned to a NON_ENTITY gold that nonetheless asserts a non-NIL id is a
confidently-wrong durable assertion and is penalized *without* entering the
denominator: it costs **−c** in Φ_c (component ``non_entity_with_id``, exactly
like ``spurious_with_id``), counts as an **FP** in ``inkb_prf`` (bucketed by
pred type; never TP-eligible, never FN), and counts as an **answered+wrong**
point in ``risk_coverage``. A pred aligned to a NON_ENTITY that abstains/NILs
contributes nothing. These NON_ENTITY-aligned pairs live in ``GAlignment.non_entity``
so ``disambiguation_accuracy`` and ``nil_prf`` (resolver-isolation / NIL-class
views over ``pairs`` only) never see them and stay NON_ENTITY-excluded.

**Alignment object.** ``align_grounding(gold_items, pred_items)`` runs the
matcher per ``item_id`` and returns a :class:`GAlignment` carrying: ``pairs``
(aligned in-universe gold + its pred), ``missed`` (in-universe gold with no
pred), ``spurious`` (pred aligned to no gold), and ``non_entity`` (a NON_ENTITY
gold with an aligned pred — excluded from the universe/denominator but its pred
penalized when grounded). Every metric consumes this object. Functions whose brief signature also takes ``gold_items``/``pred_items``
keep them for harness-contract symmetry; the alignment already encodes the
universe, missed, and spurious sets, so those params are not re-read (avoiding
any risk of a second, divergent universe count).

Prediction grounding states (a pred mention's ``grounding`` block, optional per
``pred.schema.json``): **non-NIL** (``grounding.nil == false`` with a non-null
``externalId``) vs **NIL/abstain** (``grounding.nil == true`` OR no grounding
block at all — declining to link *is* an abstention). All returns are plain
dicts of ``float``/``int`` (JSON-serializable); the module is pure.
"""

from __future__ import annotations

from typing import NamedTuple

from commonplace_eval.matcher import align

__all__ = [
    "GPair",
    "GAlignment",
    "align_grounding",
    "answer_pairs",
    "disambiguation_accuracy",
    "inkb_prf",
    "nil_prf",
    "effective_reliability",
    "risk_coverage",
]

# Closed 9-type inventory (gold/pred schema enum). InKB macro averages over all
# nine — a type absent from a given run contributes an honest 0, because the
# type set is fixed, unlike extraction's open observed-type macro.
CANONICAL_TYPES = (
    "music_recording",
    "place",
    "screen_work",
    "book",
    "person",
    "product",
    "brand_org",
    "software_app",
    "game",
)


class GPair(NamedTuple):
    """One grounding record: ``gold``/``pred`` mention dicts (either may be None).

    both set -> aligned pair; gold only -> missed gold; pred only -> spurious.
    """

    gold: dict | None
    pred: dict | None


class GAlignment(NamedTuple):
    """Strict-scheme alignment restricted to the grounding universe."""

    pairs: list  # aligned: in-universe gold + matched pred
    missed: list  # in-universe gold with no matched pred
    spurious: list  # pred matched to no gold
    non_entity: list  # NON_ENTITY gold + its matched pred (out of universe/denom)


# --- small predicates over mention dicts -------------------------------------
def _in_universe(gold: dict) -> bool:
    """A gold mention is in the grounding universe iff it is not a NON_ENTITY."""
    return gold.get("nil") != "NON_ENTITY"


def _is_inkb(gold: dict) -> bool:
    """Gold has a durable external id (InKB), as opposed to a NIL label."""
    return gold.get("gold_id") is not None


def _gold_is_nil_no_id(gold: dict) -> bool:
    return gold.get("nil") == "NIL_NO_ID"


def _pred_nonnil(pred: dict) -> bool:
    """Prediction asserted a durable id (grounding present, not NIL, id non-null)."""
    grounding = pred.get("grounding")
    if not grounding:
        return False
    if grounding.get("nil") is True:
        return False
    return grounding.get("externalId") is not None


def _id_eq(gold_id: dict, pred_g: dict) -> bool:
    """True iff a gold id and a pred grounding denote the same referent.

    Authority equality is casefolded; id equality is on the stripped string.
    Wikidata ids are case-insensitive on the Q-number (``q42 == Q42``); every
    other authority (e.g. MusicBrainz MBIDs) is compared exactly. ``gold_id``
    uses key ``id``; the pred grounding uses ``externalId``.
    """
    if not gold_id or not pred_g:
        return False
    g_auth = str(gold_id.get("authority", "")).strip().casefold()
    p_auth = str(pred_g.get("authority", "")).strip().casefold()
    if g_auth != p_auth:
        return False
    g_id = str(gold_id.get("id", "")).strip()
    p_id = str(pred_g.get("externalId") or "").strip()
    if g_auth == "wikidata":
        g_id = g_id.upper()
        p_id = p_id.upper()
    return g_id == p_id


# --- alignment builder -------------------------------------------------------
def align_grounding(
    gold_items: list[dict],
    pred_items: list[dict],
    fuzzy_threshold: int = 90,
) -> GAlignment:
    """Build the in-universe grounding alignment across items.

    Joins by ``item_id`` and runs ``matcher.align`` per item. NON_ENTITY gold are
    kept out of the universe: one with an aligned pred goes to ``non_entity`` (so
    grounding a trap can be penalized without inflating the denominator); one with
    no aligned pred is dropped (extraction owns its SPU).
    """
    gold_by_id = {it["item_id"]: it for it in gold_items}
    pred_by_id = {it["item_id"]: it for it in pred_items}
    item_ids = list(gold_by_id) + [k for k in pred_by_id if k not in gold_by_id]

    pairs: list = []
    missed: list = []
    spurious: list = []
    non_entity: list = []

    for item_id in item_ids:
        gold_mentions = gold_by_id.get(item_id, {}).get("mentions") or []
        pred_mentions = pred_by_id.get(item_id, {}).get("mentions") or []
        result = align(gold_mentions, pred_mentions, fuzzy_threshold)
        for pair in result.pairs:
            if pair.gold_idx is not None and pair.pred_idx is not None:
                gold = gold_mentions[pair.gold_idx]
                pred = pred_mentions[pair.pred_idx]
                if _in_universe(gold):
                    pairs.append(GPair(gold, pred))
                else:  # NON_ENTITY gold with an aligned pred -> penalize if grounded.
                    non_entity.append(GPair(gold, pred))
            elif pair.gold_idx is not None:
                gold = gold_mentions[pair.gold_idx]
                if _in_universe(gold):
                    missed.append(GPair(gold, None))
                # else: NON_ENTITY gold, no pred -> contributes nothing anywhere.
            else:  # pred with no gold -> spurious
                spurious.append(GPair(None, pred_mentions[pair.pred_idx]))

    return GAlignment(pairs=pairs, missed=missed, spurious=spurious, non_entity=non_entity)


# --- disambiguation accuracy -------------------------------------------------
def disambiguation_accuracy(alignment: GAlignment) -> dict:
    """Resolver accuracy over aligned pairs whose gold has an id.

    Denominator = aligned pairs where gold has ``gold_id``; a pair is correct
    iff the pred is non-NIL and its id equals the gold id. Reports overall plus
    a per-authority breakdown, keyed by the gold id's authority stripped+casefolded
    (so ``"Wikidata"`` and ``"wikidata"`` share one bucket, matching ``_id_eq``).
    Zero denominator -> 0.0.
    """
    total = 0
    correct = 0
    per_auth: dict[str, dict] = {}

    for gold, pred in alignment.pairs:
        gold_id = gold.get("gold_id")
        if gold_id is None:
            continue
        authority = str(gold_id.get("authority", "")).strip().casefold()
        bucket = per_auth.setdefault(authority, {"n": 0, "correct": 0})
        total += 1
        bucket["n"] += 1
        if _pred_nonnil(pred) and _id_eq(gold_id, pred.get("grounding")):
            correct += 1
            bucket["correct"] += 1

    per_authority = {
        auth: {
            "accuracy": b["correct"] / b["n"] if b["n"] else 0.0,
            "n": b["n"],
            "correct": b["correct"],
        }
        for auth, b in per_auth.items()
    }
    return {
        "accuracy": correct / total if total else 0.0,
        "n": total,
        "correct": correct,
        "per_authority": per_authority,
    }


# --- InKB P/R/F1 -------------------------------------------------------------
def _prf_tfpn(tp: int, fp: int, fn: int) -> dict:
    precision = tp / (tp + fp) if (tp + fp) else 0.0
    recall = tp / (tp + fn) if (tp + fn) else 0.0
    f1 = 2 * precision * recall / (precision + recall) if (precision + recall) else 0.0
    return {"precision": precision, "recall": recall, "f1": f1, "tp": tp, "fp": fp, "fn": fn}


def inkb_prf(gold_items: list[dict], pred_items: list[dict], alignment: GAlignment) -> dict:
    """End-to-end InKB linking P/R/F1 (micro + macro over the 9 types).

    * **TP** — aligned, gold InKB, pred non-NIL, id correct (owned by gold type).
    * **FP** — every non-NIL pred that is not a TP: a wrong id, a link on a
      gold-NIL, a spurious pred, or a link on a NON_ENTITY trap (owned by pred
      type). A NON_ENTITY-aligned pred is never TP-eligible and never an FN.
    * **FN** — every InKB gold without a correct pred: aligned-but-wrong/NIL, or
      missed (owned by gold type).

    An aligned InKB gold given a *wrong* id is simultaneously an FP (a bad id was
    asserted) and an FN (the gold went unlinked). Macro averages per-type F1
    over the fixed 9-type inventory. ``gold_items``/``pred_items`` are accepted
    for signature symmetry; the alignment already carries missed/spurious.
    """
    tp: dict[str, int] = {}
    fp: dict[str, int] = {}
    fn: dict[str, int] = {}

    for gold, pred in alignment.pairs:
        gold_type = gold.get("type")
        inkb = _is_inkb(gold)
        nonnil = _pred_nonnil(pred)
        correct = inkb and nonnil and _id_eq(gold.get("gold_id"), pred.get("grounding"))
        if correct:
            tp[gold_type] = tp.get(gold_type, 0) + 1
        else:
            if inkb:  # InKB gold not correctly linked -> false negative
                fn[gold_type] = fn.get(gold_type, 0) + 1
            if nonnil:  # a non-NIL id that isn't a TP -> false positive
                pt = pred.get("type")
                fp[pt] = fp.get(pt, 0) + 1

    for gold, _pred in alignment.missed:
        if _is_inkb(gold):
            fn[gold.get("type")] = fn.get(gold.get("type"), 0) + 1

    for _gold, pred in alignment.spurious:
        if _pred_nonnil(pred):
            pt = pred.get("type")
            fp[pt] = fp.get(pt, 0) + 1

    for _gold, pred in alignment.non_entity:
        if _pred_nonnil(pred):  # grounding a NON_ENTITY trap -> FP (never TP/FN)
            pt = pred.get("type")
            fp[pt] = fp.get(pt, 0) + 1

    micro = _prf_tfpn(sum(tp.values()), sum(fp.values()), sum(fn.values()))

    per_type: dict[str, dict] = {}
    for t in CANONICAL_TYPES:
        per_type[t] = _prf_tfpn(tp.get(t, 0), fp.get(t, 0), fn.get(t, 0))
    n = len(CANONICAL_TYPES)
    macro = {
        "precision": sum(d["precision"] for d in per_type.values()) / n,
        "recall": sum(d["recall"] for d in per_type.values()) / n,
        "f1": sum(d["f1"] for d in per_type.values()) / n,
    }
    return {"micro": micro, "macro": macro, "per_type": per_type}


# --- NIL P/R/F1 --------------------------------------------------------------
def nil_prf(alignment: GAlignment) -> dict:
    """NIL as its own class, over aligned pairs.

    predicted-NIL = aligned pred that is NIL/abstain; gold-NIL = aligned gold
    with ``nil == "NIL_NO_ID"``; a pair is a correct-NIL when both hold.
    NIL-P = correct/predicted, NIL-R = correct/gold-NILs, NIL-F1 the harmonic
    mean (0.0 on any zero denominator).
    """
    predicted_nils = 0
    gold_nils = 0
    correct_nils = 0

    for gold, pred in alignment.pairs:
        pred_is_nil = not _pred_nonnil(pred)
        gold_is_nil = _gold_is_nil_no_id(gold)
        if pred_is_nil:
            predicted_nils += 1
        if gold_is_nil:
            gold_nils += 1
        if pred_is_nil and gold_is_nil:
            correct_nils += 1

    nil_p = correct_nils / predicted_nils if predicted_nils else 0.0
    nil_r = correct_nils / gold_nils if gold_nils else 0.0
    nil_f1 = 2 * nil_p * nil_r / (nil_p + nil_r) if (nil_p + nil_r) else 0.0
    return {
        "nil_precision": nil_p,
        "nil_recall": nil_r,
        "nil_f1": nil_f1,
        "predicted_nils": predicted_nils,
        "gold_nils": gold_nils,
        "correct_nils": correct_nils,
    }


# --- Effective Reliability Φ_c ----------------------------------------------
def effective_reliability(
    gold_items: list[dict],
    pred_items: list[dict],
    alignment: GAlignment,
    c: float = 10.0,
) -> dict:
    """Asymmetric headline Φ_c over all in-universe gold mentions.

    Per in-universe gold: a correct non-NIL id scores **+1**; a wrong non-NIL id
    (including asserting an id where gold is NIL) scores **−c**; a NIL/abstain or
    a missed gold scores **0**. Additionally, each **spurious** pred that asserts
    a non-NIL id contributes **−c** (a fabricated durable id is a grounding harm
    even with no gold to align to), and each pred aligned to a **NON_ENTITY** gold
    that asserts a non-NIL id contributes **−c** via ``non_entity_with_id``
    (grounding an adjudicated trap is the same confident-wrong harm). Neither
    enters the denominator. ``Φ_c = numerator / n`` where n = count of in-universe
    gold mentions (0.0 when n == 0, even if spurious/NON_ENTITY penalties exist).
    Returns ``{"phi", "c", "n", "components"}`` with components
    ``{correct, wrong_id, abstain, missed, spurious_with_id, non_entity_with_id}``.
    ``gold_items``/``pred_items`` are accepted for signature symmetry; n and the
    components are derived from the alignment so they cannot diverge.
    """
    correct = 0
    wrong_id = 0
    abstain = 0

    for gold, pred in alignment.pairs:
        if _pred_nonnil(pred):
            if _is_inkb(gold) and _id_eq(gold.get("gold_id"), pred.get("grounding")):
                correct += 1
            else:  # wrong id, or an id asserted on a gold-NIL
                wrong_id += 1
        else:
            abstain += 1

    missed = len(alignment.missed)
    spurious_with_id = sum(1 for _gold, pred in alignment.spurious if _pred_nonnil(pred))
    non_entity_with_id = sum(1 for _gold, pred in alignment.non_entity if _pred_nonnil(pred))

    n = correct + wrong_id + abstain + missed  # in-universe gold mentions
    numerator = correct - c * (wrong_id + spurious_with_id + non_entity_with_id)
    phi = numerator / n if n else 0.0

    return {
        "phi": phi,
        "c": c,
        "n": n,
        "components": {
            "correct": correct,
            "wrong_id": wrong_id,
            "abstain": abstain,
            "missed": missed,
            "spurious_with_id": spurious_with_id,
            "non_entity_with_id": non_entity_with_id,
        },
    }


# --- answered (confidence, correct) set --------------------------------------
def answer_pairs(alignment: GAlignment) -> list[tuple[float, bool]]:
    """(grounding_confidence, correct) for every non-NIL grounded prediction.

    The single source for the "answered" set shared by ``risk_coverage`` (the
    risk–coverage curve) and the scorecard's calibration metrics (Brier / smECE /
    reliability bins), so the two can never drift on which predictions count or on
    the correctness rule. Collected in the order they enter the grounding
    universe: aligned in-universe pairs whose pred is non-NIL (correct iff gold is
    InKB and the id matches ``_id_eq``), then every non-NIL **spurious** pred, then
    every non-NIL pred aligned to a **NON_ENTITY** trap. The last two are always
    ``False`` — a fabricated or trap-grounded durable id is a confident-wrong
    assertion (consistent with Φ_c).
    """
    pairs: list[tuple[float, bool]] = []
    for gold, pred in alignment.pairs:
        if _pred_nonnil(pred):
            conf = pred["grounding"].get("grounding_confidence", 0.0)
            is_correct = _is_inkb(gold) and _id_eq(gold.get("gold_id"), pred.get("grounding"))
            pairs.append((conf, bool(is_correct)))
    for _gold, pred in alignment.spurious:
        if _pred_nonnil(pred):
            conf = pred["grounding"].get("grounding_confidence", 0.0)
            pairs.append((conf, False))  # spurious link is always wrong
    for _gold, pred in alignment.non_entity:
        if _pred_nonnil(pred):
            conf = pred["grounding"].get("grounding_confidence", 0.0)
            pairs.append((conf, False))  # grounding a NON_ENTITY trap is always wrong
    return pairs


# --- risk–coverage / AURC ----------------------------------------------------
def _trapezoid(ys: list[float], xs: list[float]) -> float:
    """Trapezoidal integral of ``ys`` over ``xs`` (assumes xs ascending)."""
    area = 0.0
    for i in range(1, len(xs)):
        area += (xs[i] - xs[i - 1]) * (ys[i] + ys[i - 1]) / 2.0
    return area


def _coverage_at_risk(curve: list[dict], target: float) -> float:
    """Max coverage among curve points whose risk is <= ``target`` (0.0 if none)."""
    eligible = [pt["coverage"] for pt in curve if pt["risk"] <= target]
    return max(eligible) if eligible else 0.0


def risk_coverage(
    gold_items: list[dict],
    pred_items: list[dict],
    alignment: GAlignment,
) -> dict:
    """Risk–coverage curve, AURC, and coverage at ≤5% risk.

    Sweeps the confidence threshold over the distinct ``grounding_confidence``
    values of the non-NIL predictions (aligned in-universe, spurious, or aligned
    to a NON_ENTITY trap), descending. At each threshold τ: answered = non-NIL
    preds with confidence >= τ; wrong = answered that are not a correct link (a
    spurious or NON_ENTITY-aligned grounding is always wrong, consistent with
    Φ_c); ``coverage = answered / n_gold`` (in-universe gold count),
    ``risk = wrong / answered``. Points are ordered by ascending coverage. AURC =
    trapezoidal area of risk over coverage across those points (no synthetic
    anchor; the curve *is* the swept thresholds).
    ``coverage_at_risk_5pct`` = max coverage of any point with risk <= 0.05, or
    0.0 if none qualifies. ``gold_items``/``pred_items`` accepted for signature
    symmetry; all quantities derive from the alignment.

    **Coverage can exceed 1.0.** The numerator (answered = non-NIL preds) includes
    spurious and NON_ENTITY-trap groundings, which are *not* in-universe gold, but
    the denominator ``n_gold`` is the in-universe gold count — so a run that
    fabricates more durable ids than there are real targets reports coverage > 1.0
    (a deliberate over-answering signal, not a bug).
    """
    n_gold = len(alignment.pairs) + len(alignment.missed)  # in-universe gold

    answers = answer_pairs(alignment)

    thresholds = sorted({conf for conf, _ in answers}, reverse=True)
    curve: list[dict] = []
    for tau in thresholds:
        answered = [a for a in answers if a[0] >= tau]
        n_answered = len(answered)
        n_wrong = sum(1 for _conf, ok in answered if not ok)
        curve.append(
            {
                "threshold": tau,
                "coverage": n_answered / n_gold if n_gold else 0.0,
                "risk": n_wrong / n_answered if n_answered else 0.0,
                "answered": n_answered,
                "wrong": n_wrong,
            }
        )

    aurc = _trapezoid([pt["risk"] for pt in curve], [pt["coverage"] for pt in curve])
    return {
        "curve": curve,
        "aurc": aurc,
        "coverage_at_risk_5pct": _coverage_at_risk(curve, 0.05),
        "n_gold": n_gold,
    }
