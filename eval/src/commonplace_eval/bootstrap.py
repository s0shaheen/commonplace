"""Cluster & paired bootstrap confidence intervals.

Governed by ``docs/product/_EVAL-METHOD.md`` §3 — mentions cluster within
videos, so CIs are computed with a **per-video cluster bootstrap** (Miller,
"Adding Error Bars to Evals", arXiv:2411.00640) — and §6, where ablations use
a **paired bootstrap** (B=10,000, 95% CI on ΔF1, p<0.05; Berg-Kirkpatrick 2012,
Dror et al. 2018).

Every published point estimate carries a clustered CI; every system-vs-system
delta carries a paired CI + two-sided p-value. The resampling unit is the
*cluster* (video), never the mention: mentions within a video are correlated,
so resampling mentions would understate the interval. ``metric_fn`` receives a
list of cluster ids — a **multiset**: a cluster drawn k times appears k times —
and is responsible for expanding each id to all of its mentions.

Pure module: no I/O; deterministic given ``seed`` (numpy PCG64).
"""

from __future__ import annotations

from collections.abc import Callable, Sequence

import numpy as np

# metric_fn(sampled_cluster_ids) -> scalar metric on that (multiset) sample.
MetricFn = Callable[[list[str]], float]

# Paired-bootstrap CI level is fixed at 95% per _EVAL-METHOD.md §6.
_PAIRED_ALPHA = 0.05


def _unique_ordered(item_ids: Sequence[str]) -> list[str]:
    """Unique cluster ids in first-appearance order (deterministic set)."""
    return list(dict.fromkeys(item_ids))


def _resample(
    clusters: np.ndarray, rng: np.random.Generator
) -> list[str]:
    """One with-replacement draw of ``len(clusters)`` cluster ids."""
    draw = rng.integers(0, clusters.shape[0], size=clusters.shape[0])
    return clusters[draw].tolist()


def cluster_bootstrap(
    item_ids: Sequence[str],
    metric_fn: MetricFn,
    B: int = 10_000,
    seed: int = 0,
    alpha: float = 0.05,
) -> dict:
    """Per-cluster bootstrap CI for a single system's metric.

    Resamples the **unique** cluster ids with replacement (size = n_clusters);
    a cluster drawn k times appears k times in the list handed to ``metric_fn``,
    which contributes all of that cluster's mentions each time. ``point`` is
    ``metric_fn`` on the original ids (no resampling); ``lo``/``hi`` are the
    ``alpha/2`` and ``1 - alpha/2`` percentiles of the ``B`` resample
    statistics. Returns ``{point, lo, hi, B, n_clusters}``.
    """
    clusters = _unique_ordered(item_ids)
    n_clusters = len(clusters)
    point = float(metric_fn(list(item_ids)))

    if n_clusters == 0 or B <= 0:
        return {"point": point, "lo": point, "hi": point, "B": int(B), "n_clusters": n_clusters}

    rng = np.random.Generator(np.random.PCG64(seed))
    clusters_arr = np.asarray(clusters, dtype=object)
    stats = np.empty(B, dtype=float)
    for b in range(B):
        stats[b] = metric_fn(_resample(clusters_arr, rng))

    lo = float(np.percentile(stats, 100.0 * (alpha / 2.0)))
    hi = float(np.percentile(stats, 100.0 * (1.0 - alpha / 2.0)))
    return {"point": point, "lo": lo, "hi": hi, "B": int(B), "n_clusters": n_clusters}


def paired_bootstrap(
    item_ids: Sequence[str],
    metric_fn_a: MetricFn,
    metric_fn_b: MetricFn,
    B: int = 10_000,
    seed: int = 0,
) -> dict:
    """Paired cluster bootstrap for a system A − B delta.

    Both systems are scored on the **same** resample each iteration (paired), so
    shared-cluster variance cancels — the ablation convention of §6. ``delta`` is
    ``metric_fn_a − metric_fn_b`` on the original ids (no resampling);
    ``lo``/``hi`` are the 2.5 / 97.5 percentiles (fixed 95% CI) of the
    per-resample deltas.

    ``p_value`` is the two-sided sign-flip bootstrap p-value —
    ``2 * min(frac(delta_b <= 0), frac(delta_b >= 0))``, clamped to ``1.0``.
    When the delta distribution is degenerately all-zero (A == B), both fractions
    are 1.0 so the raw value is 2.0 and clamps to ``1.0`` — the documented
    convention that "no observed difference" reports the largest possible
    (non-significant) p. Returns ``{delta, lo, hi, p_value}``.
    """
    clusters = _unique_ordered(item_ids)
    n_clusters = len(clusters)
    orig = list(item_ids)
    delta = float(metric_fn_a(orig) - metric_fn_b(orig))

    if n_clusters == 0 or B <= 0:
        return {"delta": delta, "lo": delta, "hi": delta, "p_value": 1.0}

    rng = np.random.Generator(np.random.PCG64(seed))
    clusters_arr = np.asarray(clusters, dtype=object)
    deltas = np.empty(B, dtype=float)
    for b in range(B):
        sampled = _resample(clusters_arr, rng)
        deltas[b] = metric_fn_a(sampled) - metric_fn_b(sampled)

    lo = float(np.percentile(deltas, 100.0 * (_PAIRED_ALPHA / 2.0)))
    hi = float(np.percentile(deltas, 100.0 * (1.0 - _PAIRED_ALPHA / 2.0)))
    frac_le = float(np.mean(deltas <= 0.0))
    frac_ge = float(np.mean(deltas >= 0.0))
    p_value = min(1.0, 2.0 * min(frac_le, frac_ge))
    return {"delta": delta, "lo": lo, "hi": hi, "p_value": p_value}
