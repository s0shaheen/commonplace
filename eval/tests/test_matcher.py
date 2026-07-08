"""Tests for the gold<->pred matcher (Task 5).

The retracted pilot scored benign variation ("Kill Bill by SZA" vs
"SZA — Kill Bill", `place` vs `restaurant`) as total error because it used
exact-string + exact-type matching. This suite pins the fix: normalized +
fuzzy tiers, Hungarian 1:1 alignment, MUC-5/SemEval categories across schemes.

Brief's verbatim tests first, then the mandated edge cases.
"""

from commonplace_eval.matcher import AlignedPair, Category, MatchTier, align


def _m(surface, type_, aliases=()):
    return {"surface": surface, "type": type_, "aliases": list(aliases)}


# --- brief's verbatim tests --------------------------------------------------
def test_kill_bill_alias_is_COR_strict():
    gold = [_m("Kill Bill", "music_recording", aliases=["Kill Bill by SZA", "SZA — Kill Bill"])]
    pred = [_m("kill bill by sza", "music_recording")]
    cats = [c for _, c in align(gold, pred).categorize("strict")]
    assert cats == [Category.COR]


def test_place_vs_restaurant_no_longer_possible():
    # 'restaurant' is not a type; a place typed as place matches strictly.
    gold = [_m("Joe's Pizza", "place")]
    pred = [_m("Joes Pizza", "place")]
    assert [c for _, c in align(gold, pred).categorize("strict")] == [Category.COR]


def test_fuzzy_is_PAR_strict():
    gold = [_m("Museum of Modern Art", "place")]
    pred = [_m("MoMA Museum of Modern Art NYC", "place")]
    (pair, cat), = align(gold, pred).categorize("strict")
    assert cat == Category.PAR


def test_type_mismatch_is_INC_strict():
    gold = [_m("Dune", "screen_work")]
    pred = [_m("Dune", "book")]
    assert [c for _, c in align(gold, pred).categorize("strict")] == [Category.INC]
    assert [c for _, c in align(gold, pred).categorize("exact")] == [Category.COR]


def test_miss_and_spurious():
    gold = [_m("Dune", "book"), _m("Berlin", "place")]
    pred = [_m("Dune", "book")]
    cats = sorted(c.value for _, c in align(gold, pred).categorize("strict"))
    assert cats == ["COR", "MIS"]


def test_hungarian_one_to_one():
    gold = [_m("Dune", "book")]
    pred = [_m("Dune", "book"), _m("Dune", "book")]
    cats = sorted(c.value for _, c in align(gold, pred).categorize("strict"))
    assert cats == ["COR", "SPU"]


# --- mandated edge cases -----------------------------------------------------
def test_empty_gold_all_spurious():
    pred = [_m("Dune", "book"), _m("Berlin", "place")]
    cats = sorted(c.value for _, c in align([], pred).categorize("strict"))
    assert cats == ["SPU", "SPU"]


def test_empty_pred_all_missed():
    gold = [_m("Dune", "book"), _m("Berlin", "place")]
    cats = sorted(c.value for _, c in align(gold, []).categorize("strict"))
    assert cats == ["MIS", "MIS"]


def test_both_empty_no_pairs():
    result = align([], [])
    assert result.pairs == []
    assert result.categorize("strict") == []


def test_duplicate_surfaces_both_sides():
    gold = [_m("Dune", "book"), _m("Dune", "book")]
    pred = [_m("Dune", "book"), _m("Dune", "book")]
    cats = sorted(c.value for _, c in align(gold, pred).categorize("strict"))
    assert cats == ["COR", "COR"]


def test_alias_only_match_is_exact_tier():
    # Aliases live on gold; preds carry none. A pred matching ONLY via a gold
    # alias (not the gold surface) must still be EXACT tier, not FUZZY.
    gold = [_m("Kill Bill", "music_recording", aliases=["SZA — Kill Bill"])]
    pred = [_m("sza kill bill", "music_recording")]
    result = align(gold, pred)
    matched = [p for p in result.pairs if p.gold_idx is not None and p.pred_idx is not None]
    assert len(matched) == 1
    assert matched[0].tier == MatchTier.EXACT


def test_below_threshold_stays_unmatched():
    # token_set_ratio well below threshold: even as the only candidate, the
    # pair must NOT align — it breaks into MIS + SPU.
    gold = [_m("Berlin", "place")]
    pred = [_m("Tokyo Metropolitan Area", "place")]
    result = align(gold, pred)
    matched = [p for p in result.pairs if p.gold_idx is not None and p.pred_idx is not None]
    assert matched == []
    cats = sorted(c.value for _, c in result.categorize("strict"))
    assert cats == ["MIS", "SPU"]


def test_zero_similarity_pair_not_forced():
    # 1 gold, 1 pred, disjoint surfaces -> Hungarian would otherwise force the
    # only pairing; the zero-similarity guard must split them.
    gold = [_m("Dune", "book")]
    pred = [_m("Neuromancer", "book")]
    cats = sorted(c.value for _, c in align(gold, pred).categorize("strict"))
    assert cats == ["MIS", "SPU"]


# --- scheme table coverage ---------------------------------------------------
def test_exact_scheme_ignores_type():
    gold = [_m("Dune", "screen_work")]
    pred = [_m("Dune", "book")]
    assert [c for _, c in align(gold, pred).categorize("exact")] == [Category.COR]


def test_partial_scheme_exact_is_COR_fuzzy_is_PAR():
    gold = [_m("Dune", "book"), _m("Museum of Modern Art", "place")]
    pred = [_m("Dune", "book"), _m("MoMA Museum of Modern Art NYC", "place")]
    cats = sorted(c.value for _, c in align(gold, pred).categorize("partial"))
    assert cats == ["COR", "PAR"]


def test_type_scheme_fuzzy_type_match_is_COR():
    gold = [_m("Museum of Modern Art", "place")]
    pred = [_m("MoMA Museum of Modern Art NYC", "place")]
    assert [c for _, c in align(gold, pred).categorize("type")] == [Category.COR]


def test_type_scheme_fuzzy_type_mismatch_is_INC():
    gold = [_m("Museum of Modern Art", "place")]
    pred = [_m("MoMA Museum of Modern Art NYC", "book")]
    assert [c for _, c in align(gold, pred).categorize("type")] == [Category.INC]


def test_type_scheme_exact_type_match_is_COR():
    # EXACT tier + matching type -> COR under the "type" scheme.
    gold = [_m("Dune", "book")]
    pred = [_m("Dune", "book")]
    (pair, cat), = align(gold, pred).categorize("type")
    assert pair.tier == MatchTier.EXACT
    assert cat == Category.COR


def test_type_scheme_exact_type_mismatch_is_INC():
    # EXACT tier + mismatched type -> INC under the "type" scheme.
    gold = [_m("Dune", "screen_work")]
    pred = [_m("Dune", "book")]
    (pair, cat), = align(gold, pred).categorize("type")
    assert pair.tier == MatchTier.EXACT
    assert cat == Category.INC


# --- deterministic EXACT>FUZZY tie-break -------------------------------------
def test_exact_beats_fuzzy_tie_regardless_of_order():
    # A pure token superset ("Museum of Modern Art NYC") scores token_set_ratio
    # 100 -> FUZZY sim would tie EXACT's 1.0, letting the assignment solver pick
    # the alignment by input ORDER. The FUZZY cap (0.999 < 1.0) must make the
    # exact-surface pred win in BOTH orderings: {COR, SPU} with the COR pair
    # aligned to the exact pred (asserted via pred_idx + EXACT tier).
    gold = [_m("Museum of Modern Art", "place")]
    exact = _m("Museum of Modern Art", "place")
    superset = _m("Museum of Modern Art NYC", "place")
    for pred in ([exact, superset], [superset, exact]):
        result = align(gold, pred)
        cats = sorted(c.value for _, c in result.categorize("strict"))
        assert cats == ["COR", "SPU"], f"order {[p['surface'] for p in pred]}"
        matched = [
            p for p in result.pairs if p.gold_idx is not None and p.pred_idx is not None
        ]
        assert len(matched) == 1
        assert matched[0].tier == MatchTier.EXACT
        assert pred[matched[0].pred_idx]["surface"] == "Museum of Modern Art"


def test_aligned_pair_indices_and_flags():
    gold = [_m("Dune", "book")]
    pred = [_m("Dune", "book")]
    (pair,) = align(gold, pred).pairs
    assert isinstance(pair, AlignedPair)
    assert pair.gold_idx == 0
    assert pair.pred_idx == 0
    assert pair.tier == MatchTier.EXACT
    assert pair.type_match is True
