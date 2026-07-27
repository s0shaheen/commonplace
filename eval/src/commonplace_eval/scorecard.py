"""The per-layer scorecard — a MATRIX, never a scalar.

Governed by ``docs/specs/evaluation-methodology.md`` §4: "The scorecard is a per-layer
MATRIX, not a scalar ... each is scored by its own metric and **must not be
averaged into one number** (different denominators, chance baselines, meanings of
'correct' — a blended 'accuracy %' is statistically incoherent *and* dishonest).
One row per layer, each with metric + n + CI + publish-gate; NamedEntity-linking
is the named flagship, the rest 'in calibration' until powered."

``build_scorecard`` assembles that matrix by *consuming* the pure metric modules
(matcher / extraction / grounding / calibration / bootstrap / concept / facet /
structured) — it computes no new statistic itself. The calibration metrics need
the grounded-prediction (confidence, correct) set, which is the same set the
risk–coverage curve sweeps; that set is now published as
``grounding_metrics.answer_pairs`` and the **calibration adapter**
(``_calibration_pairs``) is a thin split of it into the two parallel lists
``brier`` / ``smece`` / ``reliability_bins`` expect. Single-sourcing that one
collection keeps calibration and risk–coverage from drifting on the id-correctness
rule, and there is **no cross-module private import** (only public surfaces).

**Cluster-bootstrap CIs.** The two published flagship headlines (strict micro F1,
Φ_c) get per-video clustered CIs (``bootstrap.cluster_bootstrap``). Because the
resampling unit is the *video* and a video may be drawn k times, the metric can't
be recomputed by re-running ``score_extraction`` on a duplicated item list (it
dedups by ``item_id``). Instead each item's **additive contribution** is
precomputed once — strict {COR,INC,PAR,MIS,SPU} counts, and the Φ_c
(numerator-parts, denominator) triple — and the per-resample metric just pools
those contributions over the sampled (multiset) ids. The point estimate the
bootstrap reports on the un-resampled ids therefore equals the global metric
exactly (verified in the tests: 8/11 and −5.6 on the fixtures).

Pure except that it accepts already-loaded records; all I/O lives in ``io.py``
and ``cli.py``.
"""

from __future__ import annotations

from commonplace_eval import __version__
from commonplace_eval.bootstrap import cluster_bootstrap
from commonplace_eval.calibration import brier, reliability_bins, smece
from commonplace_eval.concept_metrics import (
    Hierarchy,
    hierarchical_prf_at_k,
    r_precision,
)
from commonplace_eval.extraction_metrics import prf, score_extraction
from commonplace_eval.facet_metrics import facet_scores
from commonplace_eval.grounding_metrics import (
    align_grounding,
    answer_pairs,
    disambiguation_accuracy,
    effective_reliability,
    inkb_prf,
    nil_prf,
    risk_coverage,
)
from commonplace_eval.io import join_items
from commonplace_eval.structured_metrics import structured_scores

__all__ = ["build_scorecard", "render_markdown"]

# The current frozen measurement-contract semver (schema/CHANGELOG.md).
SCHEMA_VERSION = "1.0.0-rc.7"

_CLAIM_NOTE = "faithfulness/coverage require validated judge (Phase 4)"


# --- calibration adapter (single-source answered set) ------------------------
def _calibration_pairs(alignment) -> tuple[list[float], list[bool]]:
    """(grounding_confidence, correct) lists for the non-NIL grounded predictions.

    A thin adapter over ``grounding_metrics.answer_pairs`` — the single source for
    the answered set that the risk–coverage curve also consumes — split into the
    two parallel lists ``brier`` / ``smece`` / ``reliability_bins`` expect. Sharing
    ``answer_pairs`` (rather than reimplementing the correctness rule here) is what
    keeps calibration and the published risk–coverage curve from ever drifting.
    """
    pairs = answer_pairs(alignment)
    confs = [conf for conf, _ in pairs]
    correct = [ok for _, ok in pairs]
    return confs, correct


# --- per-item additive contributions (for the clustered bootstrap) -----------
def _per_item_strict_counts(gold: dict, pred: dict | None) -> dict:
    """Strict-scheme {COR,INC,PAR,MIS,SPU} counts for a single item.

    Reuses ``score_extraction`` on the 1-item slice, so the count semantics
    (NON_ENTITY recast, gold/pred type attribution) are identical to the global
    computation; summing these over items reproduces the pooled strict counts.
    """
    preds = [pred] if pred is not None else []
    return score_extraction([gold], preds, schemes=("strict",))["strict"]["counts"]


def _per_item_phi_parts(gold: dict, pred: dict | None, c: float) -> tuple[int, int, int]:
    """(correct, penalty, n) for a single item's Φ_c contribution.

    ``penalty`` = wrong_id + spurious_with_id + non_entity_with_id (each costs
    −c); ``n`` = in-universe gold count. Global Φ_c = (Σcorrect − c·Σpenalty)/Σn.
    """
    preds = [pred] if pred is not None else []
    alignment = align_grounding([gold], preds)
    er = effective_reliability([gold], preds, alignment, c=c)
    comp = er["components"]
    penalty = comp["wrong_id"] + comp["spurious_with_id"] + comp["non_entity_with_id"]
    return comp["correct"], penalty, er["n"]


def _ci(cb: dict) -> dict:
    """Project ``cluster_bootstrap``'s return onto the scorecard's {point,lo,hi}."""
    return {"point": cb["point"], "lo": cb["lo"], "hi": cb["hi"]}


# --- the named-entity (flagship) layer ---------------------------------------
def _named_entity_layer(gold, pred_matched, joined, item_ids, *, c, B, seed) -> dict:
    n_mentions = sum(len(g.get("mentions") or []) for g in gold)
    n_pred_mentions = sum(len(p.get("mentions") or []) for p in pred_matched)
    n_items = sum(1 for g in gold if g.get("mentions"))

    if n_mentions == 0 and n_pred_mentions == 0:
        return {"status": "skipped_no_data", "flagship": True, "n_mentions": 0, "n_items": 0}

    extraction = score_extraction(gold, pred_matched)

    alignment = align_grounding(gold, pred_matched)
    grounding = {
        "disambiguation": disambiguation_accuracy(alignment),
        "inkb": inkb_prf(gold, pred_matched, alignment),
        "nil": nil_prf(alignment),
        "phi_c": effective_reliability(gold, pred_matched, alignment, c=c),
        "risk_coverage": risk_coverage(gold, pred_matched, alignment),
    }

    confs, correct = _calibration_pairs(alignment)
    calibration = {
        "brier": brier(confs, correct),
        "smece": smece(confs, correct),
        "bins": reliability_bins(confs, correct),
    }

    # Per-item additive contributions, keyed by item_id, for the clustered CIs.
    strict_counts = {g["item_id"]: _per_item_strict_counts(g, p) for g, p in joined}
    phi_parts = {g["item_id"]: _per_item_phi_parts(g, p, c) for g, p in joined}

    def strict_micro_f1_fn(ids: list[str]) -> float:
        pooled = {k: 0 for k in ("COR", "INC", "PAR", "MIS", "SPU")}
        for i in ids:
            for k, v in strict_counts[i].items():
                pooled[k] += v
        return prf(pooled)["f1"]

    def phi_c_fn(ids: list[str]) -> float:
        num = 0.0
        den = 0
        for i in ids:
            corr, pen, n = phi_parts[i]
            num += corr - c * pen
            den += n
        return num / den if den else 0.0

    ci = {
        "strict_micro_f1": _ci(cluster_bootstrap(item_ids, strict_micro_f1_fn, B=B, seed=seed)),
        "phi_c": _ci(cluster_bootstrap(item_ids, phi_c_fn, B=B, seed=seed)),
    }

    return {
        "status": "scored",
        "flagship": True,
        "n_mentions": n_mentions,
        "n_items": n_items,
        "extraction": extraction,
        "grounding": grounding,
        "calibration": calibration,
        "ci": ci,
    }


def _concept_layer(gold, pred_matched, hierarchy, k) -> dict:
    n_items = sum(1 for g in gold if g.get("concepts"))
    if n_items == 0:
        return {"status": "skipped_no_data", "n_items": 0}
    # Absent a supplied hierarchy, an empty one degrades True-Path closure to
    # flat set-overlap (documented in concept_metrics.Hierarchy).
    hier = hierarchy if hierarchy is not None else Hierarchy({})
    return {
        "status": "scored",
        "n_items": n_items,
        "hf1_at_k": hierarchical_prf_at_k(gold, pred_matched, hier, k=k),
        "r_precision": r_precision(gold, pred_matched),
    }


def _structured_layer(gold, pred_matched) -> dict:
    n_docs = sum(len(g.get("structured") or []) for g in gold)
    if n_docs == 0:
        return {"status": "skipped_no_data", "n_docs": 0}
    scores = structured_scores(gold, pred_matched)
    return {"status": "scored", **scores}


def _facets_layer(gold, pred_matched, facet_vocab) -> dict:
    per_facet = facet_scores(gold, pred_matched, facet_vocab)
    scored = [name for name, v in per_facet.items() if v.get("status") == "scored"]
    status = "scored" if scored else "skipped_no_data"
    return {"status": status, "n_scored_axes": len(scored), "per_facet": per_facet}


def build_scorecard(
    gold: list[dict],
    pred: list[dict],
    *,
    c: float = 10.0,
    k: int = 5,
    B: int = 2000,
    seed: int = 0,
    hierarchy: Hierarchy | None = None,
    facet_vocab: dict,
) -> dict:
    """Assemble the per-layer scorecard matrix (see module docstring).

    Predictions are left-joined onto gold by ``item_id`` (``io.join_items``;
    unknown pred ids are warned and dropped), so every layer scores the same
    matched set and the clustered CIs resample the unique gold ids. Returns a
    ``{"layers": {...}, "meta": {...}}`` dict — **no top-level scalar, no
    cross-layer aggregate anywhere.**
    """
    joined = join_items(gold, pred)
    item_ids = [g["item_id"] for g in gold]
    pred_matched = [p for _g, p in joined if p is not None]

    layers = {
        "named_entity": _named_entity_layer(
            gold, pred_matched, joined, item_ids, c=c, B=B, seed=seed
        ),
        "concept": _concept_layer(gold, pred_matched, hierarchy, k),
        "claim": {"status": "in_calibration", "note": _CLAIM_NOTE},
        "structured": _structured_layer(gold, pred_matched),
        "facets": _facets_layer(gold, pred_matched, facet_vocab),
    }

    meta = {
        "schema_version": SCHEMA_VERSION,
        "eval_version": __version__,
        "seed": seed,
        "B": B,
        "c": c,
        "k": k,
        "generated_by": f"commonplace-eval {__version__}",
    }

    return {"layers": layers, "meta": meta}


# --- markdown rendering ------------------------------------------------------
def _fmt(x: float) -> str:
    return f"{x:.3f}"


def _ci_str(ci: dict | None) -> str:
    if not ci:
        return "—"
    return f"[{_fmt(ci['lo'])}, {_fmt(ci['hi'])}]"


def _named_entity_row(layer: dict) -> list[str]:
    if layer["status"] != "scored":
        return ["named_entity", layer["status"], "—", "0", "—", "flagship"]
    f1 = layer["extraction"]["strict"]["micro"]["f1"]
    ci = layer["ci"]["strict_micro_f1"]
    return [
        "named_entity",
        "scored",
        f"strict micro F1 = {_fmt(f1)}",
        str(layer["n_mentions"]),
        _ci_str(ci),
        "flagship",
    ]


def _concept_row(layer: dict, k: int) -> list[str]:
    if layer["status"] != "scored":
        return ["concept", layer["status"], "—", "0", "—", "in calibration"]
    hf1 = layer["hf1_at_k"]["macro"]["f1"]
    return [
        "concept",
        "scored",
        f"hierarchical F1@{k} = {_fmt(hf1)}",
        str(layer["n_items"]),
        "—",
        "in calibration",
    ]


def _structured_row(layer: dict) -> list[str]:
    if layer["status"] != "scored":
        return ["structured", layer["status"], "—", "0", "—", "in calibration"]
    return [
        "structured",
        "scored",
        f"field accuracy = {_fmt(layer['field_accuracy'])}",
        str(layer["n_docs"]),
        "—",
        "in calibration",
    ]


def _facets_row(layer: dict) -> list[str]:
    if layer["status"] != "scored":
        return ["facets", layer["status"], "—", "0", "—", "in calibration"]
    # Deliberately NO single blended number — one macro-F1 PER axis, reported
    # in the per_facet block; the row states how many axes were scored.
    return [
        "facets",
        "scored",
        f"{layer['n_scored_axes']} axes (per-facet macro-F1 + κ)",
        str(layer["n_scored_axes"]),
        "—",
        "in calibration",
    ]


def _claim_row(layer: dict) -> list[str]:
    return ["claim", layer["status"], "faithfulness + coverage", "—", "—", "in calibration"]


def render_markdown(scorecard: dict) -> str:
    """Render the scorecard as a one-row-per-layer markdown table.

    Columns: layer · status · headline metric · n · 95% CI · gate. There is
    deliberately **no total/blended row** — the layers do not share a scale.
    """
    layers = scorecard["layers"]
    meta = scorecard["meta"]
    k = meta["k"]

    header = ["Layer", "Status", "Headline metric", "n", "95% CI", "Gate"]
    rows = [
        _named_entity_row(layers["named_entity"]),
        _concept_row(layers["concept"], k),
        _claim_row(layers["claim"]),
        _structured_row(layers["structured"]),
        _facets_row(layers["facets"]),
    ]

    out: list[str] = []
    out.append("# Commonplace eval scorecard (per-layer matrix)")
    out.append("")
    out.append(
        "One row per layer — each with its own metric, denominator, and publish-gate. "
        "The layers are **never** blended into a single number (different denominators "
        "and meanings of \"correct\")."
    )
    out.append("")
    out.append("| " + " | ".join(header) + " |")
    out.append("| " + " | ".join("---" for _ in header) + " |")
    for row in rows:
        out.append("| " + " | ".join(row) + " |")
    out.append("")
    out.append(
        f"_schema {meta['schema_version']} · eval {meta['eval_version']} · "
        f"seed {meta['seed']} · B={meta['B']} · c={meta['c']} · k={meta['k']}_"
    )
    return "\n".join(out) + "\n"
