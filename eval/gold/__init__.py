"""Gold-set apparatus — the tooling that PRODUCES gold, beside the harness that CONSUMES it.

``commonplace_eval`` is the scoring library: it reads a gold JSONL and a
prediction JSONL and emits the per-layer scorecard. This package is the other
half — the operator tooling that produces that gold file in the first place,
per ``docs/specs/evaluation-methodology.md`` §3 (the gold set) and §5 (the
solo-annotator protocol):

* :mod:`gold.strata`      — the stratification axes + coarse coverage buckets
* :mod:`gold.sample`      — the deterministic stratified sampler over the corpus
* :mod:`gold.preannotate` — pluggable pre-annotation (Claude, a *different*
  model family than the Gemini pipeline under evaluation — §5.1)
* ``review.html``         — the local, keyboard-first adjudication tool

It is deliberately NOT part of the installed ``commonplace_eval`` package: the
scoring library must stay dependency-light and importable by anyone reproducing
the published numbers, while this side talks to APIs and the filesystem.
"""

__all__ = ["strata", "sample", "preannotate"]
