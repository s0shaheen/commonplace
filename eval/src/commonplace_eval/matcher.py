"""Gold<->prediction mention matcher (Task 5).

Implements the MUC-5 / SemEval-2013 Task 9.1 extraction-matching family for the
span-free video setting, per ``docs/specs/evaluation-methodology.md`` §4 ("Extraction
(mention-level), exact-string BANNED"). Exact-string matching is BANNED as the
sole tier: the retracted pilot mechanically scored benign variation as total
error. The fix is two match tiers plus optimal 1:1 alignment:

* **EXACT** — normalized (see ``normalize.normalize_mention``) equality of the
  prediction surface against the gold surface OR any gold alias. Similarity 1.0.
* **FUZZY** — ``rapidfuzz.fuzz.token_set_ratio`` (of normalized strings) at or
  above ``fuzzy_threshold`` (default 90). Similarity = ``min(ratio / 100, 0.999)``
  — capped strictly below EXACT's 1.0 so a pure token subset/superset (ratio
  100) can never tie an exact match and steal its alignment by input order.
* otherwise similarity 0 (never aligned).

**Type-tie epsilon (assignment weight only).** The EXACT tier is 1.0 regardless
of type, so when a prediction is an exact surface match to *two* gold rows that
differ only in type (e.g. gold ``[Dune/book, Dune/screen_work]`` vs pred
``Dune/screen_work``), the solver would otherwise break the 1.0-vs-1.0 tie by
input order — flipping the pair between COR and INC. To make the alignment
deterministic and type-aware, the maximum-weight matching runs on a *bonused*
weight (``_assignment_weight``) that adds a tiny type-match epsilon
(``_TYPE_BONUS`` = 5e-4) which can never cross a tier boundary. The induced
ordering is::

    EXACT+type-match (1.0005) > EXACT+type-mismatch (1.0)
        > any FUZZY (<= 0.999) : FUZZY+type-match (ratio) > FUZZY+type-mismatch (ratio - 5e-4)

The bonus lives **only** inside the assignment weight. Tier attribution and the
FUZZY threshold check use the *unbonused* similarity from ``_score``, and the
forced-zero split below tests the *unbonused* ``sim``, so no bonus ever leaks
into a category or a threshold decision — it only settles equal-tier ties.

Alignment is a maximum-weight bipartite matching via
``scipy.optimize.linear_sum_assignment`` (maximize; weights may exceed 1.0
safely) so each gold pairs with at most one prediction. Zero-(unbonused-)similarity
assignments the solver is forced to return (it always returns
``min(n_gold, n_pred)`` pairs) are split back into a missed gold (MIS) + a
spurious prediction (SPU).

``MatchResult.categorize(scheme)`` maps each aligned pair to a MUC category
(COR/INC/PAR/MIS/SPU) under one of four schemes (strict/exact/partial/type).
Metrics (P/R/F1, partial credit) are Task 6's job; this module only aligns and
categorizes.

Mentions are ``dict``s: ``{"surface": str, "type": str, "aliases": [str, ...]}``
(``aliases`` optional). Aliases are one-directional by design — gold carries
them, predictions do not — so the EXACT tier compares the prediction surface
against gold surface + gold aliases only.
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import Enum

import numpy as np
from rapidfuzz import fuzz
from scipy.optimize import linear_sum_assignment

from commonplace_eval.normalize import normalize_mention

__all__ = [
    "MatchTier",
    "Category",
    "Scheme",
    "AlignedPair",
    "MatchResult",
    "align",
]


class MatchTier(str, Enum):
    EXACT = "exact"  # normalized equality vs gold surface OR any alias
    FUZZY = "fuzzy"  # rapidfuzz token_set_ratio >= threshold (default 90)
    NONE = "none"


class Category(str, Enum):  # MUC-5 / SemEval-2013 9.1
    COR = "COR"
    INC = "INC"
    PAR = "PAR"
    MIS = "MIS"
    SPU = "SPU"


Scheme = str  # "strict" | "exact" | "partial" | "type"

_SCHEMES = frozenset({"strict", "exact", "partial", "type"})


@dataclass(frozen=True)
class AlignedPair:
    gold_idx: int | None  # None => spurious pred
    pred_idx: int | None  # None => missed gold
    tier: MatchTier
    type_match: bool


@dataclass
class MatchResult:
    pairs: list[AlignedPair]

    def categorize(self, scheme: Scheme) -> list[tuple[AlignedPair, Category]]:
        if scheme not in _SCHEMES:
            raise ValueError(f"unknown scheme: {scheme!r}; expected one of {sorted(_SCHEMES)}")
        return [(p, _categorize_pair(p, scheme)) for p in self.pairs]


def _gold_forms(gold: dict) -> list[str]:
    """Normalized surface + aliases for a gold mention (dedup, drop empties)."""
    forms = [normalize_mention(gold.get("surface", ""))]
    for alias in gold.get("aliases") or []:
        forms.append(normalize_mention(alias))
    # Preserve order; drop empties and duplicates.
    seen: set[str] = set()
    out: list[str] = []
    for f in forms:
        if f and f not in seen:
            seen.add(f)
            out.append(f)
    return out


# Type-match tie-break epsilon added to the *assignment weight* (never to the
# unbonused similarity used for tier/threshold/forced-zero decisions). 5e-4 is
# safely below the 1e-3 gap between EXACT's floor (1.0) and FUZZY's ceiling
# (0.999), so it can never move a cell across a tier boundary — only settle a
# same-tier, equal-ratio tie toward the type-matching gold.
_TYPE_BONUS = 5e-4


def _score(gold_forms: list[str], pred_norm: str, threshold: int) -> tuple[float, MatchTier]:
    """Unbonused similarity and tier for one (gold, pred) cell.

    EXACT (1.0) if the normalized prediction surface equals any gold form;
    else FUZZY (``min(ratio/100, 0.999)``) if the best token_set_ratio over the
    gold forms is >= threshold; else no match (0.0, NONE). The FUZZY cap keeps a
    ratio-100 subset/superset strictly below EXACT so the assignment solver can
    never break a 1.0 vs 1.0 tie by input order (EXACT always outranks). This
    value is type-blind and is what all tier/threshold/forced-zero logic reads;
    the type-match epsilon is applied separately in ``_assignment_weight``.
    """
    if pred_norm and pred_norm in gold_forms:
        return 1.0, MatchTier.EXACT
    best = 0.0
    for form in gold_forms:
        best = max(best, fuzz.token_set_ratio(pred_norm, form))
    if best >= threshold:
        return min(best / 100.0, 0.999), MatchTier.FUZZY
    return 0.0, MatchTier.NONE


def _assignment_weight(similarity: float, tier: MatchTier, type_match: bool) -> float:
    """Bonused weight for the maximum-weight matching (never for categorization).

    Adds ``_TYPE_BONUS`` toward the type-matching gold without crossing a tier
    boundary, giving the strict ordering
    ``EXACT+type-match > EXACT+type-mismatch > FUZZY+type-match >= FUZZY+type-mismatch``:

    * EXACT: ``1.0 + _TYPE_BONUS`` if the types match, else ``1.0``.
    * FUZZY: ``similarity`` if the types match, else ``similarity - _TYPE_BONUS``.
    * NONE:  ``0.0`` (unchanged; never aligned).
    """
    if tier is MatchTier.EXACT:
        return 1.0 + (_TYPE_BONUS if type_match else 0.0)
    if tier is MatchTier.FUZZY:
        return similarity - (0.0 if type_match else _TYPE_BONUS)
    return 0.0


def align(gold: list[dict], pred: list[dict], fuzzy_threshold: int = 90) -> MatchResult:
    """Optimally align gold to predicted mentions (each gold <-> <=1 pred).

    Builds a gold x pred similarity matrix, runs maximum-weight bipartite
    matching, then splits any forced zero-similarity assignment into MIS + SPU.
    Unmatched gold -> MIS; unmatched pred -> SPU.
    """
    n_gold, n_pred = len(gold), len(pred)
    pairs: list[AlignedPair] = []

    if n_gold == 0 and n_pred == 0:
        return MatchResult(pairs=[])

    gold_forms = [_gold_forms(g) for g in gold]
    pred_norms = [normalize_mention(p.get("surface", "")) for p in pred]

    matched_gold: set[int] = set()
    matched_pred: set[int] = set()

    if n_gold and n_pred:
        # sim = unbonused similarity (drives tier/threshold/forced-zero logic);
        # weight = the bonused matrix the solver maximizes (type-tie epsilon).
        sim = np.zeros((n_gold, n_pred), dtype=float)
        weight = np.zeros((n_gold, n_pred), dtype=float)
        tiers: list[list[MatchTier]] = [[MatchTier.NONE] * n_pred for _ in range(n_gold)]
        for i in range(n_gold):
            for j in range(n_pred):
                s, t = _score(gold_forms[i], pred_norms[j], fuzzy_threshold)
                sim[i, j] = s
                tiers[i][j] = t
                type_match = gold[i].get("type") == pred[j].get("type")
                weight[i, j] = _assignment_weight(s, t, type_match)

        row_ind, col_ind = linear_sum_assignment(weight, maximize=True)
        for i, j in zip(row_ind, col_ind):
            i, j = int(i), int(j)
            if sim[i, j] > 0.0:  # unbonused: a real EXACT/FUZZY match, not a forced-zero pairing
                type_match = gold[i].get("type") == pred[j].get("type")
                pairs.append(
                    AlignedPair(gold_idx=i, pred_idx=j, tier=tiers[i][j], type_match=type_match)
                )
                matched_gold.add(i)
                matched_pred.add(j)

    for i in range(n_gold):
        if i not in matched_gold:
            pairs.append(AlignedPair(gold_idx=i, pred_idx=None, tier=MatchTier.NONE, type_match=False))
    for j in range(n_pred):
        if j not in matched_pred:
            pairs.append(AlignedPair(gold_idx=None, pred_idx=j, tier=MatchTier.NONE, type_match=False))

    return MatchResult(pairs=pairs)


def _categorize_pair(pair: AlignedPair, scheme: Scheme) -> Category:
    """MUC category for one aligned pair under ``scheme``.

    Unmatched pairs are scheme-invariant: a lone pred is SPU, a lone gold MIS.
    Matched pairs (tier EXACT or FUZZY) follow the brief's scheme table:
      strict:  EXACT+type -> COR; EXACT+!type -> INC; FUZZY -> PAR
      exact:   EXACT -> COR (type ignored); FUZZY -> PAR
      partial: EXACT -> COR; FUZZY -> PAR (surface only, type ignored)
      type:    (EXACT|FUZZY)+type -> COR; +!type -> INC
    """
    if pair.gold_idx is None:
        return Category.SPU
    if pair.pred_idx is None:
        return Category.MIS

    is_exact = pair.tier is MatchTier.EXACT

    if scheme == "strict":
        if is_exact:
            return Category.COR if pair.type_match else Category.INC
        return Category.PAR  # FUZZY
    if scheme in ("exact", "partial"):
        return Category.COR if is_exact else Category.PAR
    if scheme == "type":
        return Category.COR if pair.type_match else Category.INC
    raise ValueError(f"unknown scheme: {scheme!r}")  # pragma: no cover
