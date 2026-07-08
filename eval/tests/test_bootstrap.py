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

    B = 1000
    out = paired_bootstrap(ids, metric_a, metric_b, B=B, seed=0)
    assert out["delta"] == pytest.approx(0.1)
    assert out["lo"] > 0
    assert out["p_value"] < 0.05
    # add-one convention never publishes a literal 0.0, and floors at 2/(B+1);
    # with test-sized B the floor still clears the 0.05 significance bar above.
    assert out["p_value"] > 0.0
    assert out["p_value"] >= 2 / (B + 1)


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


def test_paired_p_never_zero():
    # Strongly separated systems: a beats b by a fixed +1.0 on every cluster,
    # so every one of B resamples favors a (count(delta<=0) == 0). The naive
    # 2·min(frac) p-value would be exactly 0.0 (a published overclaim); the
    # add-one convention floors it at 2/(B+1) instead.
    ids = [f"c{i}" for i in range(40)]
    b_val = {f"c{i}": float(i) for i in range(40)}
    a_val = {k: v + 1.0 for k, v in b_val.items()}

    def metric_a(s):
        return sum(a_val[x] for x in s) / len(s)

    def metric_b(s):
        return sum(b_val[x] for x in s) / len(s)

    B = 1000
    out = paired_bootstrap(ids, metric_a, metric_b, B=B, seed=0)
    assert out["p_value"] == pytest.approx(2 / (B + 1))


def test_cluster_bootstrap_rejects_duplicate_ids():
    ids = ["c0", "c1", "c1", "c2"]  # c1 duplicated

    def metric(s):
        return float(len(s))

    with pytest.raises(ValueError, match="unique cluster ids"):
        cluster_bootstrap(ids, metric, B=100, seed=0)


def test_paired_bootstrap_rejects_duplicate_ids():
    ids = ["c0", "c1", "c1", "c2"]  # c1 duplicated

    def metric(s):
        return float(len(s))

    with pytest.raises(ValueError, match="unique cluster ids"):
        paired_bootstrap(ids, metric, metric, B=100, seed=0)
