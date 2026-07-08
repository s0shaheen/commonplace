"""Tests for calibration metrics (Task 7).

Per ``docs/product/_EVAL-METHOD.md`` §4 ("Calibration (we publish confidence):
smECE + reliability diagram (relplot; Błasiok & Nakkiran ICLR 2024) + Brier
score."). smECE is delegated to ``relplot.smECE``; the two smECE tests use
fixed seeds / deterministic inputs so their thresholds are stable. Every
expected value is hand-computed in a comment.
"""

import numpy as np
import pytest

from commonplace_eval.calibration import brier, reliability_bins, smece


# --- Brier -------------------------------------------------------------------
def test_brier_perfect():
    # conf 1.0 on all-correct → each term (1-1)^2 = 0; mean 0.
    assert brier([1.0, 1.0], [True, True]) == 0.0
    # conf 0.0 on a wrong answer → (0-0)^2 = 0.
    assert brier([0.0], [False]) == 0.0


def test_brier_hand():
    # ((0.8-1)^2 + (0.4-0)^2) / 2 = (0.04 + 0.16) / 2 = 0.1
    assert brier([0.8, 0.4], [True, False]) == pytest.approx(0.1)


def test_brier_empty():
    assert brier([], []) == 0.0


def test_brier_length_mismatch():
    with pytest.raises(ValueError):
        brier([0.5, 0.5], [True])


# --- smECE (relplot reference implementation) --------------------------------
def test_smece_well_calibrated_low():
    # conf ~ U(0,1), correct ~ Bernoulli(conf): calibrated in expectation, so a
    # bin-free smoothed ECE should be small. n=5000, fixed seed → deterministic.
    rng = np.random.default_rng(42)
    conf = rng.uniform(0.0, 1.0, 5000)
    correct = rng.uniform(0.0, 1.0, 5000) < conf
    assert smece(conf.tolist(), correct.tolist()) < 0.05


def test_smece_miscalibrated_high():
    # all confidences 0.9 but the true accuracy is exactly 0.5 (deterministic
    # alternating) → a ~0.4 calibration gap the smoother cannot wash out.
    conf = [0.9] * 200
    correct = [True, False] * 100
    assert smece(conf, correct) > 0.3


def test_smece_empty():
    assert smece([], []) == 0.0


# --- reliability bins --------------------------------------------------------
def test_reliability_bins_sum():
    conf = [0.05, 0.15, 0.95, 1.0, 0.42, 0.42]
    correct = [False, True, True, True, False, True]
    bins = reliability_bins(conf, correct, n_bins=10)
    assert len(bins) == 10
    assert sum(b["n"] for b in bins) == len(conf)


def test_reliability_bins_last_bin_inclusive():
    # conf exactly 1.0 must land in the last bin [0.9, 1.0], never overflow.
    bins = reliability_bins([1.0], [True], n_bins=10)
    assert bins[-1]["n"] == 1
    assert bins[-1]["lo"] == pytest.approx(0.9)
    assert bins[-1]["hi"] == pytest.approx(1.0)
    assert sum(b["n"] for b in bins) == 1


def test_reliability_bins_hand():
    # 0.05→bin0, 0.15→bin1, 0.95 & 1.0→bin9 (last bin, right-edge inclusive).
    conf = [0.05, 0.15, 0.95, 1.0]
    correct = [False, True, True, True]
    bins = reliability_bins(conf, correct, n_bins=10)
    assert bins[0]["n"] == 1
    assert bins[0]["mean_conf"] == pytest.approx(0.05)
    assert bins[0]["frac_correct"] == pytest.approx(0.0)
    assert bins[1]["n"] == 1
    assert bins[1]["frac_correct"] == pytest.approx(1.0)
    assert bins[9]["n"] == 2
    assert bins[9]["mean_conf"] == pytest.approx(0.975)  # (0.95 + 1.0) / 2
    assert bins[9]["frac_correct"] == pytest.approx(1.0)


def test_reliability_bins_empty_bin_zeroed():
    bins = reliability_bins([0.05], [True], n_bins=10)
    # bin 5 ([0.5, 0.6)) is empty → n=0, mean_conf/frac_correct default to 0.0.
    assert bins[5]["n"] == 0
    assert bins[5]["mean_conf"] == 0.0
    assert bins[5]["frac_correct"] == 0.0
