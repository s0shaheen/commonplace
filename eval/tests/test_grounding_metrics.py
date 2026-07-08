"""Tests for decomposed grounding metrics (Task 6).

Per ``docs/product/_EVAL-METHOD.md`` §4 ("Grounding (ID-level), decomposed
GERBIL/ELEVANT-style") — extraction noise and grounding noise are scored
separately. Covers: disambiguation accuracy, InKB micro/macro F1, NIL-F1, the
asymmetric Effective-Reliability headline Φ_c (default c=10), and the
risk–coverage / AURC curve. Every expected value is hand-computed in a comment.

Brief's required cases first, then the mandated additions: NON_ENTITY exclusion
from the grounding universe, wikidata case-normalization (q42≡Q42), empty inputs.
"""

import pytest

from commonplace_eval.grounding_metrics import (
    _id_eq,
    align_grounding,
    disambiguation_accuracy,
    effective_reliability,
    inkb_prf,
    nil_prf,
    risk_coverage,
)


# --- fixtures ----------------------------------------------------------------
def _gold_inkb(surface, authority, id_, type_="book"):
    return {
        "mention_id": surface,
        "surface": surface,
        "type": type_,
        "gold_id": {"authority": authority, "id": id_},
        "nil": None,
    }


def _gold_nil(surface, type_="book"):
    return {
        "mention_id": surface,
        "surface": surface,
        "type": type_,
        "gold_id": None,
        "nil": "NIL_NO_ID",
        "failed_queries": [surface],
    }


def _gold_nonentity(surface, type_="book"):
    return {
        "mention_id": surface,
        "surface": surface,
        "type": type_,
        "gold_id": None,
        "nil": "NON_ENTITY",
    }


def _pred_link(surface, authority, ext, conf=1.0, type_="book"):
    return {
        "surface": surface,
        "type": type_,
        "grounding": {
            "authority": authority,
            "externalId": ext,
            "nil": False,
            "grounding_confidence": conf,
        },
    }


def _pred_nil(surface, conf=1.0, type_="book", authority="wikidata"):
    return {
        "surface": surface,
        "type": type_,
        "grounding": {
            "authority": authority,
            "externalId": None,
            "nil": True,
            "grounding_confidence": conf,
        },
    }


def _item(item_id, mentions):
    return {"item_id": item_id, "mentions": mentions}


# --- _id_eq ------------------------------------------------------------------
def test_id_eq_basic_and_authority_casefold():
    assert _id_eq({"authority": "wikidata", "id": "Q1"},
                  {"authority": "Wikidata", "externalId": "Q1"})
    # Different id -> False.
    assert not _id_eq({"authority": "wikidata", "id": "Q1"},
                      {"authority": "wikidata", "externalId": "Q2"})
    # Different authority -> False.
    assert not _id_eq({"authority": "wikidata", "id": "Q1"},
                      {"authority": "musicbrainz", "externalId": "Q1"})


def test_id_eq_wikidata_case_normalization():
    # Mandated: wikidata ids uppercase-normalized so q42 == Q42 both directions.
    assert _id_eq({"authority": "wikidata", "id": "Q42"},
                  {"authority": "wikidata", "externalId": "q42"})
    assert _id_eq({"authority": "wikidata", "id": "q42"},
                  {"authority": "wikidata", "externalId": "Q42"})
    # Non-wikidata authorities are NOT case-folded on the id (MBIDs are exact).
    assert not _id_eq({"authority": "musicbrainz", "id": "ABC"},
                      {"authority": "musicbrainz", "externalId": "abc"})


def test_id_eq_strips_whitespace():
    assert _id_eq({"authority": "wikidata", "id": " Q1 "},
                  {"authority": "wikidata", "externalId": "Q1"})


# --- disambiguation accuracy (brief: overall + per-authority) ----------------
def test_disambiguation_per_authority():
    # 3 gold-with-id, all aligned: wikidata {correct, wrong}, musicbrainz {correct}.
    gold = [_item("v1", [
        _gold_inkb("Alpha", "wikidata", "Q1"),
        _gold_inkb("Beta", "wikidata", "Q2"),
        _gold_inkb("Gamma", "musicbrainz", "mbid-1", type_="music_recording"),
    ])]
    pred = [_item("v1", [
        _pred_link("Alpha", "wikidata", "Q1"),          # correct
        _pred_link("Beta", "wikidata", "Q3"),           # wrong
        _pred_link("Gamma", "musicbrainz", "mbid-1", type_="music_recording"),  # correct
    ])]
    al = align_grounding(gold, pred)
    out = disambiguation_accuracy(al)
    # Overall: denom=3 (all have gold_id), correct=2 -> 2/3.
    assert out["n"] == 3
    assert out["correct"] == 2
    assert abs(out["accuracy"] - 2 / 3) < 1e-12
    # wikidata: n=2, correct=1 -> 0.5. musicbrainz: n=1, correct=1 -> 1.0.
    assert out["per_authority"]["wikidata"]["accuracy"] == 0.5
    assert out["per_authority"]["wikidata"]["n"] == 2
    assert out["per_authority"]["musicbrainz"]["accuracy"] == 1.0


def test_disambiguation_abstain_counts_against():
    # A NIL prediction on a gold-with-id is in the denominator but not correct.
    gold = [_item("v1", [_gold_inkb("Alpha", "wikidata", "Q1")])]
    pred = [_item("v1", [_pred_nil("Alpha")])]
    out = disambiguation_accuracy(align_grounding(gold, pred))
    # denom=1, correct=0 -> 0.0.
    assert out["n"] == 1
    assert out["accuracy"] == 0.0


# --- InKB P/R/F1 -------------------------------------------------------------
def test_inkb_fp_on_gold_nil():
    # A: InKB, correctly linked -> TP. B: gold NIL, pred emits an id -> FP.
    gold = [_item("v1", [
        _gold_inkb("Alpha", "wikidata", "Q1"),
        _gold_nil("Beta"),
    ])]
    pred = [_item("v1", [
        _pred_link("Alpha", "wikidata", "Q1"),
        _pred_link("Beta", "wikidata", "Q5"),
    ])]
    micro = inkb_prf(gold, pred, align_grounding(gold, pred))["micro"]
    # TP=1 (Alpha), FP=1 (Beta: non-NIL id aligned to a gold-NIL), FN=0.
    assert micro["tp"] == 1
    assert micro["fp"] == 1
    assert micro["fn"] == 0
    # P = 1/(1+1) = 0.5, R = 1/(1+0) = 1.0, F1 = 2*0.5*1/1.5 = 0.6667.
    assert micro["precision"] == 0.5
    assert micro["recall"] == 1.0
    assert abs(micro["f1"] - (2 * 0.5 * 1.0) / 1.5) < 1e-12


def test_inkb_wrong_id_is_fp_and_fn():
    # Aligned InKB gold, pred gives a wrong id -> simultaneously FP and FN.
    gold = [_item("v1", [_gold_inkb("Alpha", "wikidata", "Q1")])]
    pred = [_item("v1", [_pred_link("Alpha", "wikidata", "Q9")])]
    micro = inkb_prf(gold, pred, align_grounding(gold, pred))["micro"]
    # TP=0, FP=1 (wrong id asserted), FN=1 (InKB gold not linked).
    assert micro["tp"] == 0
    assert micro["fp"] == 1
    assert micro["fn"] == 1
    assert micro["f1"] == 0.0


def test_inkb_spurious_pred_is_fp():
    # Spurious non-NIL pred (no gold) -> FP.
    gold = [_item("v1", [_gold_inkb("Alpha", "wikidata", "Q1")])]
    pred = [_item("v1", [
        _pred_link("Alpha", "wikidata", "Q1"),          # TP
        _pred_link("Zeta", "wikidata", "Q7"),           # spurious -> FP
    ])]
    micro = inkb_prf(gold, pred, align_grounding(gold, pred))["micro"]
    # TP=1, FP=1, FN=0. P=0.5, R=1.0.
    assert micro["tp"] == 1
    assert micro["fp"] == 1
    assert micro["fn"] == 0
    assert micro["precision"] == 0.5


def test_inkb_macro_over_nine_types():
    # Macro is the mean over the 9 canonical types (absent types contribute 0).
    gold = [_item("v1", [_gold_inkb("Alpha", "wikidata", "Q1", type_="book")])]
    pred = [_item("v1", [_pred_link("Alpha", "wikidata", "Q1", type_="book")])]
    out = inkb_prf(gold, pred, align_grounding(gold, pred))
    assert len(out["per_type"]) == 9
    # book F1 = 1.0, the other 8 types F1 = 0.0 -> macro F1 = 1/9.
    assert out["per_type"]["book"]["f1"] == 1.0
    assert abs(out["macro"]["f1"] - 1.0 / 9.0) < 1e-12
    # micro is only over what exists -> perfect.
    assert out["micro"]["f1"] == 1.0


# --- NIL P/R/F1 (brief's required case) --------------------------------------
def test_nil_prf():
    # 2 gold NIL_NO_ID + 1 InKB gold, all aligned.
    #   NIL#1  -> pred NIL         (correct NIL)
    #   NIL#2  -> pred non-NIL id  (missed NIL: gold-NIL not counted correct)
    #   InKB   -> pred NIL         (wrong NIL: predicted-NIL but gold has id)
    gold = [_item("v1", [
        _gold_nil("En1"),
        _gold_nil("En2"),
        _gold_inkb("Kay", "wikidata", "Q1"),
    ])]
    pred = [_item("v1", [
        _pred_nil("En1"),
        _pred_link("En2", "wikidata", "Q8"),
        _pred_nil("Kay"),
    ])]
    out = nil_prf(align_grounding(gold, pred))
    # predicted-NILs = {En1, Kay} = 2 ; gold-NILs = {En1, En2} = 2 ;
    # correct-NILs = {En1} = 1.
    assert out["predicted_nils"] == 2
    assert out["gold_nils"] == 2
    assert out["correct_nils"] == 1
    # NIL-P = 1/2 = 0.5 ; NIL-R = 1/2 = 0.5 ; NIL-F1 = 0.5.
    assert out["nil_precision"] == 0.5
    assert out["nil_recall"] == 0.5
    assert out["nil_f1"] == 0.5


# --- Effective Reliability Φ_c (brief's required cases) ----------------------
def test_phi_penalizes_wrong_id():
    # 1 correct + 1 wrong id, c=10, over 2 in-universe gold -> (1 - 10)/2 = -4.5.
    gold = [_item("v1", [
        _gold_inkb("Alpha", "wikidata", "Q1"),
        _gold_inkb("Beta", "wikidata", "Q2"),
    ])]
    pred = [_item("v1", [
        _pred_link("Alpha", "wikidata", "Q1"),
        _pred_link("Beta", "wikidata", "Q99"),
    ])]
    out = effective_reliability(gold, pred, align_grounding(gold, pred), c=10.0)
    assert out["n"] == 2
    assert out["components"]["correct"] == 1
    assert out["components"]["wrong_id"] == 1
    assert out["phi"] == -4.5


def test_phi_abstain_zero():
    # 1 correct + 1 NIL/abstain over 2 gold -> (1 + 0)/2 = 0.5.
    gold = [_item("v1", [
        _gold_inkb("Alpha", "wikidata", "Q1"),
        _gold_inkb("Beta", "wikidata", "Q2"),
    ])]
    pred = [_item("v1", [
        _pred_link("Alpha", "wikidata", "Q1"),
        _pred_nil("Beta"),
    ])]
    out = effective_reliability(gold, pred, align_grounding(gold, pred))
    assert out["components"]["abstain"] == 1
    assert out["phi"] == 0.5


def test_phi_spurious_with_id():
    # 1 correct over 1 gold + 1 spurious grounded pred -> (1 - 10)/1 = -9.
    gold = [_item("v1", [_gold_inkb("Alpha", "wikidata", "Q1")])]
    pred = [_item("v1", [
        _pred_link("Alpha", "wikidata", "Q1"),
        _pred_link("Zeta", "wikidata", "Q7"),   # spurious, non-NIL id
    ])]
    out = effective_reliability(gold, pred, align_grounding(gold, pred), c=10.0)
    # n counts only the 1 in-universe gold; the spurious pred adds -c to numerator.
    assert out["n"] == 1
    assert out["components"]["correct"] == 1
    assert out["components"]["spurious_with_id"] == 1
    assert out["phi"] == -9.0


def test_phi_missed_is_zero_not_penalized():
    # An InKB gold with no pred at all is a miss -> contributes 0, not -c.
    gold = [_item("v1", [_gold_inkb("Alpha", "wikidata", "Q1")])]
    pred = [_item("v1", [])]
    out = effective_reliability(gold, pred, align_grounding(gold, pred))
    assert out["components"]["missed"] == 1
    assert out["n"] == 1
    assert out["phi"] == 0.0


# --- risk–coverage / AURC (brief's required case) ----------------------------
def test_risk_coverage_monotone_data():
    # 3 preds conf .9/.6/.3 = correct/wrong/correct, 3 in-universe gold.
    gold = [_item("v1", [
        _gold_inkb("Alpha", "wikidata", "Q1"),
        _gold_inkb("Beta", "wikidata", "Q2"),
        _gold_inkb("Gamma", "wikidata", "Q3"),
    ])]
    pred = [_item("v1", [
        _pred_link("Alpha", "wikidata", "Q1", conf=0.9),   # correct
        _pred_link("Beta", "wikidata", "Q99", conf=0.6),   # wrong
        _pred_link("Gamma", "wikidata", "Q3", conf=0.3),   # correct
    ])]
    out = risk_coverage(gold, pred, align_grounding(gold, pred))
    assert out["n_gold"] == 3
    curve = out["curve"]
    # thresholds descending -> coverage ascending.
    # τ=.9: answered={.9}       -> cov 1/3, risk 0/1   = 0.0
    # τ=.6: answered={.9,.6}    -> cov 2/3, risk 1/2   = 0.5
    # τ=.3: answered={.9,.6,.3} -> cov 3/3, risk 1/3   ≈ 0.3333
    assert [pt["threshold"] for pt in curve] == [0.9, 0.6, 0.3]
    assert [pt["answered"] for pt in curve] == [1, 2, 3]
    assert [pt["wrong"] for pt in curve] == [0, 1, 1]
    assert abs(curve[0]["coverage"] - 1 / 3) < 1e-12 and curve[0]["risk"] == 0.0
    assert abs(curve[1]["coverage"] - 2 / 3) < 1e-12 and curve[1]["risk"] == 0.5
    assert curve[2]["coverage"] == 1.0 and abs(curve[2]["risk"] - 1 / 3) < 1e-12
    # AURC = trapezoid over coverage of the risk points:
    #   seg1: (2/3-1/3)*(0+0.5)/2   = (1/3)*(1/4)  = 1/12
    #   seg2: (1-2/3)*(0.5+1/3)/2   = (1/3)*(5/12) = 5/36
    #   AURC = 1/12 + 5/36 = 3/36 + 5/36 = 8/36 = 2/9
    assert abs(out["aurc"] - 2 / 9) < 1e-12
    # coverage_at_risk(0.05): only the τ=.9 point has risk ≤ 0.05 -> cov 1/3.
    assert abs(out["coverage_at_risk_5pct"] - 1 / 3) < 1e-12


def test_risk_coverage_no_point_under_risk_is_zero():
    # A single wrong answer: risk = 1.0 everywhere, so no point clears 5% -> 0.0.
    gold = [_item("v1", [_gold_inkb("Alpha", "wikidata", "Q1")])]
    pred = [_item("v1", [_pred_link("Alpha", "wikidata", "Q9", conf=0.5)])]
    out = risk_coverage(gold, pred, align_grounding(gold, pred))
    assert out["curve"][0]["risk"] == 1.0
    assert out["coverage_at_risk_5pct"] == 0.0


# --- NON_ENTITY: excluded from universe/denominator (mandated addition) ------
def test_non_entity_excluded_from_grounding_universe():
    # gold A = NON_ENTITY (adjudicated trap), B = InKB. The pred ABSTAINS on the
    # trap (NILs it) and correctly links B.
    gold = [_item("v1", [
        _gold_nonentity("Foo"),
        _gold_inkb("Bar", "wikidata", "Q1"),
    ])]
    pred = [_item("v1", [
        _pred_nil("Foo"),                        # aligned to NON_ENTITY, abstains
        _pred_link("Bar", "wikidata", "Q1"),     # correct
    ])]
    al = align_grounding(gold, pred)
    # Universe = only B (1 in-universe gold); Foo lands in non_entity, not pairs,
    # not spurious, not missed.
    assert len(al.pairs) == 1
    assert al.spurious == []
    assert al.missed == []
    assert len(al.non_entity) == 1
    # disambiguation: denom=1 (Bar), correct=1 -> 1.0.
    dis = disambiguation_accuracy(al)
    assert dis["n"] == 1 and dis["accuracy"] == 1.0
    # Φ_c: n=1, correct=1; the NON_ENTITY pred ABSTAINED so no penalty -> phi=1.0.
    phi = effective_reliability(gold, pred, al)
    assert phi["n"] == 1
    assert phi["components"]["spurious_with_id"] == 0
    assert phi["components"]["non_entity_with_id"] == 0
    assert phi["phi"] == 1.0


# --- NON_ENTITY: grounding a trap IS penalized (ratified semantics) -----------
def test_phi_non_entity_with_id():
    # 1 correct InKB gold + 1 NON_ENTITY gold that the pred GROUNDS with an id.
    # c=10; n=1 (only the InKB gold is in-universe). The NON_ENTITY grounding
    # adds -c to the numerator via non_entity_with_id but NOT to the denominator.
    #   numerator = correct - c*(wrong_id + spurious_with_id + non_entity_with_id)
    #             = 1 - 10*(0 + 0 + 1) = -9 ;  phi = -9 / 1 = -9.0
    gold = [_item("v1", [
        _gold_inkb("Alpha", "wikidata", "Q1"),
        _gold_nonentity("Foo"),
    ])]
    pred = [_item("v1", [
        _pred_link("Alpha", "wikidata", "Q1"),   # correct
        _pred_link("Foo", "wikidata", "Q99"),    # grounds the trap -> -c
    ])]
    al = align_grounding(gold, pred)
    out = effective_reliability(gold, pred, al, c=10.0)
    assert out["n"] == 1
    assert out["components"]["correct"] == 1
    assert out["components"]["non_entity_with_id"] == 1
    assert out["components"]["spurious_with_id"] == 0
    assert out["phi"] == -9.0


def test_inkb_fp_on_non_entity():
    # Same setup: Alpha correctly linked -> TP=1; the grounded NON_ENTITY trap is
    # an FP (bucketed by pred type 'book'), never TP-eligible, never FN.
    gold = [_item("v1", [
        _gold_inkb("Alpha", "wikidata", "Q1"),
        _gold_nonentity("Foo"),
    ])]
    pred = [_item("v1", [
        _pred_link("Alpha", "wikidata", "Q1"),
        _pred_link("Foo", "wikidata", "Q99"),
    ])]
    out = inkb_prf(gold, pred, align_grounding(gold, pred))
    micro = out["micro"]
    # TP=1 (Alpha), FP=1 (Foo trap grounding), FN=0.
    assert micro["tp"] == 1
    assert micro["fp"] == 1
    assert micro["fn"] == 0
    # P = 1/(1+1) = 0.5, R = 1/(1+0) = 1.0.
    assert micro["precision"] == 0.5
    assert micro["recall"] == 1.0
    # The FP is owned by the pred type 'book'.
    assert out["per_type"]["book"]["fp"] == 1


def test_nil_and_disambiguation_ignore_non_entity():
    # NON_ENTITY-aligned preds must NOT touch the resolver-isolation / NIL-class
    # views (both iterate alignment.pairs, which excludes NON_ENTITY).
    # gold: 1 gold-NIL (En1) + 1 InKB (Kay) + 1 NON_ENTITY (Foo) grounded by pred.
    gold = [_item("v1", [
        _gold_nil("En1"),
        _gold_inkb("Kay", "wikidata", "Q1"),
        _gold_nonentity("Foo"),
    ])]
    pred = [_item("v1", [
        _pred_nil("En1"),                        # correct NIL
        _pred_link("Kay", "wikidata", "Q1"),     # correct disambiguation
        _pred_link("Foo", "wikidata", "Q99"),    # grounds the trap -> ignored here
    ])]
    al = align_grounding(gold, pred)
    # disambiguation: only Kay has a gold_id among the in-universe pairs ->
    # denom=1, correct=1 -> 1.0. Foo never enters (it is in non_entity).
    dis = disambiguation_accuracy(al)
    assert dis["n"] == 1
    assert dis["accuracy"] == 1.0
    # nil_prf over in-universe pairs {En1, Kay}: predicted-NILs={En1}=1,
    # gold-NILs={En1}=1, correct-NILs={En1}=1 -> NIL-F1=1.0. Foo excluded.
    nil = nil_prf(al)
    assert nil["predicted_nils"] == 1
    assert nil["gold_nils"] == 1
    assert nil["correct_nils"] == 1
    assert nil["nil_f1"] == 1.0


# --- empty inputs (mandated addition) ----------------------------------------
def test_empty_inputs_grounding():
    al = align_grounding([], [])
    assert al.pairs == [] and al.missed == [] and al.spurious == []
    assert disambiguation_accuracy(al) == {
        "accuracy": 0.0, "n": 0, "correct": 0, "per_authority": {}}
    inkb = inkb_prf([], [], al)
    assert inkb["micro"]["f1"] == 0.0
    assert inkb["macro"]["f1"] == 0.0
    nil = nil_prf(al)
    assert nil["nil_f1"] == 0.0
    phi = effective_reliability([], [], al)
    assert phi["phi"] == 0.0 and phi["n"] == 0
    rc = risk_coverage([], [], al)
    assert rc["curve"] == []
    assert rc["aurc"] == 0.0
    assert rc["coverage_at_risk_5pct"] == 0.0


def test_no_pred_all_missed_grounding():
    gold = [_item("v1", [_gold_inkb("Alpha", "wikidata", "Q1")])]
    al = align_grounding(gold, [])
    assert len(al.missed) == 1 and al.pairs == []
    # disambiguation denom is over ALIGNED pairs only -> 0 aligned -> 0.0.
    assert disambiguation_accuracy(al)["n"] == 0
    # InKB: FN=1, TP=0, FP=0 -> R=0, P=0.
    inkb = inkb_prf(gold, [], al)["micro"]
    assert inkb["fn"] == 1 and inkb["tp"] == 0 and inkb["recall"] == 0.0


def test_no_gold_all_spurious_grounding():
    pred = [_item("v1", [_pred_link("Alpha", "wikidata", "Q1")])]
    al = align_grounding([], pred)
    assert len(al.spurious) == 1 and al.pairs == []
    inkb = inkb_prf([], pred, al)["micro"]
    # Spurious non-NIL pred -> FP=1, TP=0, FN=0. P=0/(0+1)=0.
    assert inkb["fp"] == 1 and inkb["precision"] == 0.0
    # Φ_c: n=0 (no gold) -> phi 0.0 even though a spurious penalty exists.
    phi = effective_reliability([], pred, al)
    assert phi["n"] == 0
    assert phi["components"]["spurious_with_id"] == 1
    assert phi["phi"] == 0.0


def test_ungrounded_pred_treated_as_abstain():
    # A pred mention with NO grounding block is an abstention (NIL), not a link.
    gold = [_item("v1", [_gold_inkb("Alpha", "wikidata", "Q1")])]
    pred = [_item("v1", [{"surface": "Alpha", "type": "book"}])]
    al = align_grounding(gold, pred)
    phi = effective_reliability(gold, pred, al)
    assert phi["components"]["abstain"] == 1
    assert phi["phi"] == 0.0
    # NIL side: it counts as a predicted-NIL (system declined to link).
    nil = nil_prf(al)
    assert nil["predicted_nils"] == 1
