"""Tests for extraction P/R/F1 (Task 6), the MUC-5 / SemEval-2013 9.1 stack.

Per ``docs/product/_EVAL-METHOD.md`` §4 ("Extraction (mention-level),
exact-string BANNED"): partial credit ``P=(COR+0.5·PAR)/ACT``, four schemes,
micro AND macro AND per-type. Every expected value below is hand-computed in a
comment beside the assertion; no value is imported from the implementation.

Brief's required cases first (``test_prf_partial_credit``), then the mandated
additions: per-type SPU attribution, micro-vs-macro divergence, empty inputs.
"""

from commonplace_eval.extraction_metrics import prf, score_extraction


def _m(surface, type_, aliases=()):
    return {"surface": surface, "type": type_, "aliases": list(aliases)}


def _ne(surface, type_, aliases=()):
    # An adjudicated NON_ENTITY trap: a proposed mention the annotator rejected.
    return {"surface": surface, "type": type_, "aliases": list(aliases), "nil": "NON_ENTITY"}


def _item(item_id, mentions):
    return {"item_id": item_id, "mentions": mentions}


# --- prf partial-credit arithmetic (brief's required case) -------------------
def test_prf_partial_credit():
    # COR=2, INC=1, PAR=1, MIS=1, SPU=1.
    # ACT = COR+INC+PAR+SPU = 2+1+1+1 = 5
    # POS = COR+INC+PAR+MIS = 2+1+1+1 = 5
    # P = (COR + 0.5*PAR)/ACT = (2 + 0.5)/5 = 2.5/5 = 0.5
    # R = (COR + 0.5*PAR)/POS = 2.5/5 = 0.5
    # F1 = 2PR/(P+R) = 2*0.25/1.0 = 0.5
    out = prf({"COR": 2, "INC": 1, "PAR": 1, "MIS": 1, "SPU": 1})
    assert out["actual"] == 5
    assert out["possible"] == 5
    assert out["precision"] == 0.5
    assert out["recall"] == 0.5
    assert out["f1"] == 0.5


def test_prf_all_correct_is_one():
    # COR=3 only. ACT=POS=3. P=R=3/3=1.0, F1=1.0.
    out = prf({"COR": 3})
    assert out["precision"] == 1.0
    assert out["recall"] == 1.0
    assert out["f1"] == 1.0


def test_prf_zero_denominators_are_zero():
    # No counts at all: ACT=POS=0 -> P=R=F1=0.0 (division-by-zero convention).
    out = prf({})
    assert out == {"precision": 0.0, "recall": 0.0, "f1": 0.0, "actual": 0, "possible": 0}
    # Only a spurious pred: ACT=1, POS=0 -> P=0/1=0, R=0 (POS 0), F1=0.
    out = prf({"SPU": 1})
    assert out["actual"] == 1 and out["possible"] == 0
    assert out["precision"] == 0.0 and out["recall"] == 0.0 and out["f1"] == 0.0


def test_prf_partial_only_half_credit():
    # PAR=2 only. ACT=POS=2. P=(0+0.5*2)/2 = 1/2 = 0.5. R=0.5. F1=0.5.
    out = prf({"PAR": 2})
    assert out["precision"] == 0.5
    assert out["recall"] == 0.5
    assert out["f1"] == 0.5


# --- score_extraction: shape + the four schemes ------------------------------
def test_score_extraction_returns_all_schemes():
    gold = [_item("v1", [_m("Dune", "book")])]
    pred = [_item("v1", [_m("Dune", "book")])]
    out = score_extraction(gold, pred)
    assert set(out) == {"strict", "exact", "partial", "type"}
    for scheme in out.values():
        assert set(scheme) == {"micro", "macro", "per_type", "counts"}


def test_score_extraction_perfect_match_micro_one():
    # One exact same-type match -> COR=1 under strict. P=R=F1=1.0.
    gold = [_item("v1", [_m("Dune", "book")])]
    pred = [_item("v1", [_m("Dune", "book")])]
    micro = score_extraction(gold, pred)["strict"]["micro"]
    assert micro["precision"] == 1.0
    assert micro["recall"] == 1.0
    assert micro["f1"] == 1.0
    assert micro["actual"] == 1
    assert micro["possible"] == 1


def test_score_extraction_type_mismatch_strict_vs_exact():
    # Same surface, different type: strict -> INC (COR=0), exact -> COR.
    gold = [_item("v1", [_m("Dune", "screen_work")])]
    pred = [_item("v1", [_m("Dune", "book")])]
    out = score_extraction(gold, pred)
    # strict: INC=1 -> ACT=POS=1, P=(0+0)/1=0, R=0, F1=0.
    assert out["strict"]["counts"] == {"COR": 0, "INC": 1, "PAR": 0, "MIS": 0, "SPU": 0}
    assert out["strict"]["micro"]["f1"] == 0.0
    # exact: COR=1 -> P=R=F1=1.0.
    assert out["exact"]["counts"]["COR"] == 1
    assert out["exact"]["micro"]["f1"] == 1.0


# --- join semantics: missing pred item => all MIS; missing gold => all SPU ---
def test_missing_pred_item_all_mis():
    # gold item 'v2' has no pred item -> its mention is MIS.
    gold = [_item("v1", [_m("Dune", "book")]), _item("v2", [_m("Berlin", "place")])]
    pred = [_item("v1", [_m("Dune", "book")])]
    out = score_extraction(gold, pred)["strict"]
    # Pooled: v1 COR=1, v2 MIS=1. COR=1, MIS=1.
    assert out["counts"] == {"COR": 1, "INC": 0, "PAR": 0, "MIS": 1, "SPU": 0}
    # ACT = 1 (COR), POS = 2 (COR+MIS). P=1/1=1.0, R=1/2=0.5, F1=2*1*0.5/1.5=0.6667.
    assert out["micro"]["precision"] == 1.0
    assert out["micro"]["recall"] == 0.5
    assert abs(out["micro"]["f1"] - (2 * 1.0 * 0.5) / 1.5) < 1e-12


def test_missing_gold_item_all_spu():
    # pred item 'v2' has no gold item -> its mention is SPU (attributed to pred type).
    gold = [_item("v1", [_m("Dune", "book")])]
    pred = [_item("v1", [_m("Dune", "book")]), _item("v2", [_m("Berlin", "place")])]
    out = score_extraction(gold, pred)["strict"]
    # COR=1 (v1), SPU=1 (v2 place). ACT = COR+SPU = 2, POS = COR = 1.
    assert out["counts"] == {"COR": 1, "INC": 0, "PAR": 0, "MIS": 0, "SPU": 1}
    # P=1/2=0.5, R=1/1=1.0, F1=0.6667.
    assert out["micro"]["precision"] == 0.5
    assert out["micro"]["recall"] == 1.0
    # SPU is attributed to the pred type 'place'.
    assert out["per_type"]["place"]["actual"] == 1
    assert out["per_type"]["place"]["possible"] == 0


# --- per-type SPU attribution (mandated addition) ----------------------------
def test_per_type_spu_attributed_to_pred_type():
    # gold: one book (COR). pred: same book + a spurious place.
    gold = [_item("v1", [_m("Dune", "book")])]
    pred = [_item("v1", [_m("Dune", "book"), _m("Berlin", "place")])]
    per_type = score_extraction(gold, pred)["strict"]["per_type"]
    # book: COR=1 -> ACT=POS=1, P=R=F1=1.0.
    assert per_type["book"]["f1"] == 1.0
    # place: SPU=1 owned by PRED type 'place' -> ACT=1, POS=0, P=0, R=0.
    assert per_type["place"]["actual"] == 1
    assert per_type["place"]["possible"] == 0
    assert per_type["place"]["precision"] == 0.0
    assert per_type["place"]["recall"] == 0.0


def test_per_type_mis_attributed_to_gold_type():
    # gold has a place it misses; SPU book from a different pred surface.
    gold = [_item("v1", [_m("Dune", "book"), _m("Berlin", "place")])]
    pred = [_item("v1", [_m("Dune", "book")])]
    per_type = score_extraction(gold, pred)["strict"]["per_type"]
    # place: MIS=1 owned by GOLD type -> ACT=0, POS=1.
    assert per_type["place"]["actual"] == 0
    assert per_type["place"]["possible"] == 1
    assert per_type["place"]["recall"] == 0.0


# --- NON_ENTITY traps are never creditable (ratified semantics) --------------
def test_non_entity_gold_not_missed():
    # gold: 1 real (Dune/book) + 1 NON_ENTITY trap (Pizza Place/place).
    # pred: only the real one. The unmatched trap must NOT count as MIS.
    gold = [_item("v1", [_m("Dune", "book"), _ne("Pizza Place", "place")])]
    pred = [_item("v1", [_m("Dune", "book")])]
    out = score_extraction(gold, pred)["strict"]
    # Only Dune scores: COR=1, no MIS from the trap.
    # ACT = COR = 1, POS = COR = 1 -> strict micro P=1.0, R=1.0, F1=1.0.
    assert out["counts"] == {"COR": 1, "INC": 0, "PAR": 0, "MIS": 0, "SPU": 0}
    assert out["micro"]["precision"] == 1.0
    assert out["micro"]["recall"] == 1.0
    assert out["micro"]["f1"] == 1.0
    # The trap's 'place' type never enters the per-type table (nothing counted).
    assert "place" not in out["per_type"]


def test_pred_matching_non_entity_is_spurious():
    # gold: 1 real (Dune/book) + 1 NON_ENTITY trap (Pizza Place/place).
    # pred: the real one + a pred that HITS the trap surface -> that pred is SPU.
    gold = [_item("v1", [_m("Dune", "book"), _ne("Pizza Place", "place")])]
    pred = [_item("v1", [_m("Dune", "book"), _m("Pizza Place", "place")])]
    out = score_extraction(gold, pred)["strict"]
    # Dune -> COR; the trap-aligned pred is recast COR->SPU (owned by pred type).
    # counts: COR=1, SPU=1. ACT = COR+SPU = 2, POS = COR = 1 (no MIS from trap).
    # P = (1 + 0.5*0)/ACT = 1/2 = 0.5 ; R = 1/POS = 1/1 = 1.0 ; F1 = 2*0.5*1/1.5.
    assert out["counts"] == {"COR": 1, "INC": 0, "PAR": 0, "MIS": 0, "SPU": 1}
    assert out["micro"]["precision"] == 0.5
    assert out["micro"]["recall"] == 1.0
    assert abs(out["micro"]["f1"] - (2 * 0.5 * 1.0) / 1.5) < 1e-12
    # Attribution: book COR (gold type), place SPU (pred type).
    assert out["per_type"]["book"]["f1"] == 1.0
    assert out["per_type"]["place"]["actual"] == 1
    assert out["per_type"]["place"]["possible"] == 0


# --- micro vs macro divergence on skewed types (mandated addition) -----------
def test_micro_vs_macro_divergence_skewed_types():
    # book stratum (3 mentions, perfect) dominates micro; place stratum
    # (1 gold missed + 1 spurious) is a total miss. Macro weights the two
    # types equally, so it diverges from micro.
    gold = [
        _item(
            "v1",
            [
                _m("Dune", "book"),
                _m("Neuromancer", "book"),
                _m("Foundation", "book"),
                _m("Berlin", "place"),
            ],
        )
    ]
    pred = [
        _item(
            "v1",
            [
                _m("Dune", "book"),
                _m("Neuromancer", "book"),
                _m("Foundation", "book"),
                _m("Tokyo Tower", "place"),
            ],
        )
    ]
    out = score_extraction(gold, pred)["strict"]
    # Pooled: book COR=3; place MIS=1 (Berlin), SPU=1 (Tokyo Tower).
    # ACT = COR+SPU = 3+1 = 4; POS = COR+MIS = 3+1 = 4.
    # micro P = 3/4 = 0.75, micro R = 3/4 = 0.75, micro F1 = 0.75.
    assert out["micro"]["f1"] == 0.75
    # Per-type F1: book=1.0 (3 COR), place=0.0 (0 COR, MIS+SPU).
    assert out["per_type"]["book"]["f1"] == 1.0
    assert out["per_type"]["place"]["f1"] == 0.0
    # Macro F1 = mean(1.0, 0.0) = 0.5  != micro 0.75.
    assert out["macro"]["f1"] == 0.5


# --- empty inputs (mandated addition) ----------------------------------------
def test_empty_both_all_zero():
    out = score_extraction([], [])
    for scheme in out.values():
        assert scheme["counts"] == {"COR": 0, "INC": 0, "PAR": 0, "MIS": 0, "SPU": 0}
        assert scheme["micro"]["f1"] == 0.0
        assert scheme["macro"]["f1"] == 0.0
        assert scheme["per_type"] == {}


def test_empty_pred_all_missed():
    gold = [_item("v1", [_m("Dune", "book"), _m("Berlin", "place")])]
    out = score_extraction(gold, [])["strict"]
    # Both gold mentions MIS. ACT=0, POS=2. P=0, R=0, F1=0.
    assert out["counts"] == {"COR": 0, "INC": 0, "PAR": 0, "MIS": 2, "SPU": 0}
    assert out["micro"]["possible"] == 2
    assert out["micro"]["recall"] == 0.0


def test_empty_gold_all_spurious():
    pred = [_item("v1", [_m("Dune", "book"), _m("Berlin", "place")])]
    out = score_extraction([], pred)["strict"]
    # Both pred mentions SPU. ACT=2, POS=0. P=0, R=0.
    assert out["counts"] == {"COR": 0, "INC": 0, "PAR": 0, "MIS": 0, "SPU": 2}
    assert out["micro"]["actual"] == 2
    assert out["micro"]["precision"] == 0.0
    # SPU split across the two pred types.
    assert out["per_type"]["book"]["actual"] == 1
    assert out["per_type"]["place"]["actual"] == 1


def test_partial_scheme_fuzzy_is_half_credit():
    # A fuzzy (token-superset) match is PAR under the partial scheme.
    gold = [_item("v1", [_m("Museum of Modern Art", "place")])]
    pred = [_item("v1", [_m("MoMA Museum of Modern Art NYC", "place")])]
    out = score_extraction(gold, pred)["partial"]
    # PAR=1 -> ACT=POS=1. P=(0+0.5)/1=0.5, R=0.5, F1=0.5.
    assert out["counts"]["PAR"] == 1
    assert out["micro"]["precision"] == 0.5
    assert out["micro"]["f1"] == 0.5
