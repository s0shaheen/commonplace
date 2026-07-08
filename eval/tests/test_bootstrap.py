"""Tests for cluster & paired bootstrap CIs (Task 7).

Per ``docs/product/_EVAL-METHOD.md`` §3 (per-video cluster bootstrap, Miller
"Adding Error Bars to Evals", arXiv:2411.00640) and §6 (paired bootstrap for
ablation ΔF1, B=10,000/95% CI/p<0.05). Bootstrap B is kept small (500–2000)
for test speed; production defaults to 10_000.
"""

import pytest

from commonplace_eval.bootstrap import cluster_bootstrap, paired_bootstrap


@pytest.fixture
def clusters_100():
    # 100 clusters with known values 0..99; metric = mean over sampled ids.
    ids = [f"c{i}" for i in range(100)]
    values = {f"c{i}": float(i) for i in range(100)}

    def metric(sampled):
        return sum(values[s] for s in sampled) / len(sampled)

    true_mean = sum(values.values()) / len(values)  # 49.5
    return ids, metric, true_mean


def test_cluster_bootstrap_recovers_mean(clusters_100):
    ids, metric, true_mean = clusters_100
    out = cluster_bootstrap(ids, metric, B=1000, seed=0)
    assert out["n_clusters"] == 100
    assert out["B"] == 1000
    assert out["point"] == pytest.approx(true_mean)  # point on original ids
    assert out["lo"] < true_mean < out["hi"]  # CI contains the truth
    assert out["hi"] - out["lo"] > 0  # sane, positive width


def test_cluster_bootstrap_deterministic_seed(clusters_100):
    ids, metric, _ = clusters_100
    a = cluster_bootstrap(ids, metric, B=500, seed=7)
    b = cluster_bootstrap(ids, metric, B=500, seed=7)
    assert a == b  # same seed → byte-identical dict
    c = cluster_bootstrap(ids, metric, B=500, seed=99)
    assert (a["lo"], a["hi"]) != (c["lo"], c["hi"])  # different seed → different CI


def test_paired_bootstrap_detects_difference():
    # system a = b + 0.1 on every one of 50 clusters (deterministic values):
    # the +0.1 shift survives every resample, so the whole CI sits above 0.
    ids = [f"c{i}" for i in range(50)]
    b_val = {f"c{i}": float(i) / 50.0 for i in range(50)}
    a_val = {k: v + 0.1 for k, v in b_val.items()}

    def metric_a(s):
        return sum(a_val[x] for x in s) / len(s)

    def metric_b(s):
        return sum(b_val[x] for x in s) / len(s)

    out = paired_bootstrap(ids, metric_a, metric_b, B=1000, seed=0)
    assert out["delta"] == pytest.approx(0.1)
    assert out["lo"] > 0
    assert out["p_value"] < 0.05


def test_paired_bootstrap_null():
    # a == b: every resample delta is exactly 0 → degenerate two-sided p = 1.0.
    ids = [f"c{i}" for i in range(30)]
    val = {f"c{i}": float(i) for i in range(30)}

    def metric(s):
        return sum(val[x] for x in s) / len(s)

    out = paired_bootstrap(ids, metric, metric, B=500, seed=0)
    assert out["delta"] == 0.0
    assert out["p_value"] == 1.0
    assert out["lo"] == 0.0 and out["hi"] == 0.0
