"""Calibration metrics — Brier, smECE, reliability bins.

Governed by ``docs/specs/evaluation-methodology.md`` §4: "Calibration (we publish
confidence): smECE + reliability diagram (``relplot``; Błasiok & Nakkiran ICLR
2024 — plain binned ECE is bin-sensitive and gameable) + Brier score." Because
the product ships a confidence number, calibration is itself a *published*
number, so it gets the same rigor as the accuracy headline:

- **smECE** (headline) — bin-free, gaming-resistant smoothed calibration error.
  Delegated to ``relplot.smECE`` (Apple ml-calibration, the reference
  implementation of Błasiok–Nakkiran SmoothECE with automatic kernel
  bandwidth). We wrap it rather than reimplement, per the task brief.
- **reliability_bins** — the equal-width binned view behind the reliability
  diagram (visual only; smECE, not binned ECE, is the reported scalar).
- **brier** — the proper-scoring-rule summary (Brier 1950).

Pure module: no I/O, deterministic given inputs.
"""

from __future__ import annotations

from collections.abc import Sequence

import numpy as np
import relplot


def brier(confidences: Sequence[float], correct: Sequence[bool]) -> float:
    """Brier score: mean squared error of confidence vs. binary outcome.

    ``mean_i (conf_i - correct_i)**2`` (correct cast 1.0/0.0). Empty input →
    ``0.0``. Lower is better; a perfectly confident-and-right (or
    unconfident-and-wrong) predictor scores 0.0.
    """
    if len(confidences) != len(correct):
        raise ValueError("confidences and correct must be the same length")
    if len(confidences) == 0:
        return 0.0
    conf = np.asarray(confidences, dtype=float)
    corr = np.asarray(correct, dtype=float)
    return float(np.mean((conf - corr) ** 2))


def smece(confidences: Sequence[float], correct: Sequence[bool]) -> float:
    """Smoothed ECE (Błasiok–Nakkiran 2024) via ``relplot.smECE``.

    Bin-free, gaming-resistant calibration error with automatically chosen
    kernel bandwidth — the published calibration headline. Empty input →
    ``0.0``. ``relplot.smECE`` requires numpy arrays (it does elementwise
    arithmetic on its inputs), so lists are converted here.
    """
    if len(confidences) != len(correct):
        raise ValueError("confidences and correct must be the same length")
    if len(confidences) == 0:
        return 0.0
    conf = np.asarray(confidences, dtype=float)
    corr = np.asarray(correct, dtype=float)
    return float(relplot.smECE(conf, corr))


def reliability_bins(
    confidences: Sequence[float],
    correct: Sequence[bool],
    n_bins: int = 10,
) -> list[dict]:
    """Equal-width reliability bins over [0, 1] for the reliability diagram.

    ``n_bins`` bins of width ``1/n_bins``. The last bin is **right-edge
    inclusive** so ``conf == 1.0`` lands in it (and any out-of-[0,1] confidence
    is clamped into the nearest edge bin). Each bin dict is
    ``{lo, hi, n, mean_conf, frac_correct}``; an empty bin has ``n == 0`` and
    ``mean_conf == frac_correct == 0.0``. The bin ``n``s sum to
    ``len(confidences)``.
    """
    if len(confidences) != len(correct):
        raise ValueError("confidences and correct must be the same length")
    if n_bins < 1:
        raise ValueError("n_bins must be >= 1")

    conf = np.asarray(confidences, dtype=float)
    corr = np.asarray(correct, dtype=float)

    # Bin index = floor(conf * n_bins), clamped to [0, n_bins-1]. The clamp is
    # what makes the last bin right-edge inclusive (conf == 1.0 → n_bins-1
    # rather than an overflow index n_bins) and is defensive against confidences
    # marginally outside [0, 1].
    if conf.size:
        idx = np.clip(np.floor(conf * n_bins).astype(int), 0, n_bins - 1)
    else:
        idx = np.empty(0, dtype=int)

    bins: list[dict] = []
    for b in range(n_bins):
        mask = idx == b
        n = int(mask.sum())
        if n:
            mean_conf = float(conf[mask].mean())
            frac_correct = float(corr[mask].mean())
        else:
            mean_conf = 0.0
            frac_correct = 0.0
        bins.append(
            {
                "lo": b / n_bins,
                "hi": (b + 1) / n_bins,
                "n": n,
                "mean_conf": mean_conf,
                "frac_correct": frac_correct,
            }
        )
    return bins
