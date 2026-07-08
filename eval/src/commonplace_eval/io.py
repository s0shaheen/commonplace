"""JSONL loaders + the gold<->pred join — the only I/O in the metric stack.

Every record read here is gated through ``schema_gate`` (``validate_gold_record`` /
``validate_pred_record``) at load time, so no invalid record ever reaches a
metric: ``load_gold``/``load_pred`` raise ``ValueError`` naming the **1-based
line number** and the schema errors on the *first* offending line (fail fast at
the boundary rather than midway through scoring). ``join_items`` pairs gold with
its prediction by ``item_id`` — a gold-driven left join: a gold item with no
prediction gets ``None`` (all-missed), and any prediction whose ``item_id`` is
not in the gold set is dropped with a collected ``UserWarning`` (a stray pred id
is an operator error worth surfacing, never a silent scoring input).

The two small loaders ``load_facet_vocab`` / ``load_hierarchy`` exist so the CLI
and tests get the facet vocabulary and concept hierarchy without re-implementing
path discovery. This module is the boundary; everything downstream is pure.
"""

from __future__ import annotations

import json
import warnings
from collections.abc import Callable
from functools import cache
from pathlib import Path

from commonplace_eval.concept_metrics import Hierarchy
from commonplace_eval.schema_gate import validate_gold_record, validate_pred_record

__all__ = [
    "load_gold",
    "load_pred",
    "join_items",
    "load_facet_vocab",
    "load_hierarchy",
]


@cache
def _repo_root() -> Path:
    """Walk up until a directory containing ``schema/vocab`` is found."""
    here = Path(__file__).resolve()
    for parent in here.parents:
        if (parent / "schema" / "vocab").is_dir():
            return parent
    raise FileNotFoundError("could not locate repo root containing schema/vocab")


def _load_jsonl(path, validator: Callable[[dict], list[str]], kind: str) -> list[dict]:
    """Read a JSONL file, validating each record; raise on the first bad line."""
    records: list[dict] = []
    with Path(path).open(encoding="utf-8") as fh:
        for lineno, raw in enumerate(fh, start=1):
            raw = raw.strip()
            if not raw:
                continue  # tolerate blank lines
            try:
                obj = json.loads(raw)
            except json.JSONDecodeError as exc:
                raise ValueError(f"{kind} {path}: line {lineno} is not valid JSON: {exc}") from exc
            errors = validator(obj)
            if errors:
                raise ValueError(
                    f"{kind} {path}: line {lineno} failed schema validation: {errors}"
                )
            records.append(obj)
    return records


def load_gold(path) -> list[dict]:
    """Load gold records from JSONL; each validated via ``validate_gold_record``.

    Raises ``ValueError`` naming the 1-based line number (and the schema errors)
    on the first invalid or non-JSON line.
    """
    return _load_jsonl(path, validate_gold_record, "gold")


def load_pred(path) -> list[dict]:
    """Load prediction records from JSONL; each validated via ``validate_pred_record``.

    Raises ``ValueError`` naming the 1-based line number on the first bad line.
    """
    return _load_jsonl(path, validate_pred_record, "pred")


def join_items(gold: list[dict], pred: list[dict]) -> list[tuple[dict, dict | None]]:
    """Left-join predictions onto gold by ``item_id`` (gold order preserved).

    Returns one ``(gold_record, pred_record | None)`` per gold item. Predictions
    whose ``item_id`` is absent from the gold set are unusable (nothing to score
    them against) and are dropped with a single collected ``UserWarning`` listing
    them — a stray pred id is surfaced, never silently consumed. Duplicate pred
    ids are last-wins (matching the metric modules' join convention).
    """
    pred_by_id = {p["item_id"]: p for p in pred}
    gold_ids = {g["item_id"] for g in gold}

    unknown = sorted(pid for pid in pred_by_id if pid not in gold_ids)
    if unknown:
        warnings.warn(
            f"join_items: {len(unknown)} prediction(s) have unknown item_ids "
            f"(no matching gold): {unknown}",
            UserWarning,
            stacklevel=2,
        )

    return [(g, pred_by_id.get(g["item_id"])) for g in gold]


@cache
def load_facet_vocab(path=None) -> dict:
    """Load the frozen facet vocabulary (``schema/vocab/facets.json`` by default).

    Returns the raw parsed dict (top-level ``facets`` key); ``facet_metrics`` and
    ``schema_gate`` both accept this shape directly.
    """
    p = Path(path) if path is not None else _repo_root() / "schema" / "vocab" / "facets.json"
    return json.loads(p.read_text(encoding="utf-8"))


def load_hierarchy(path) -> Hierarchy:
    """Load a concept :class:`Hierarchy` from a ``{"edges": {...}}`` JSON file."""
    return Hierarchy.from_file(path)
