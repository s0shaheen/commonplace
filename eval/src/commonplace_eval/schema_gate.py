"""Schema gate: JSON Schema (draft 2020-12) validation for Commonplace items.

`validate_item(obj)` returns a list of JSON-pointer-ish error strings (empty
== valid). `load_schema(name)` loads a schema from ``schema/json/`` by stem.
Alongside it, ``validate_extraction`` / ``validate_extractor_output`` /
``validate_gold_record`` / ``validate_pred_record`` gate the extraction-layer,
model-facing, and gold/pred record schemas respectively; the
extraction/extractor-output/gold/pred validators additionally enforce facet
values against ``schema/vocab/facets.json`` (kept out of the JSON Schema so the
vocabulary evolves without a schema bump).

The reference registry loads every ``schema/json/*.schema.json`` present on
disk and keys it by its ``$id``. Cross-schema ``$ref``s resolve strictly from
disk by filename; an unknown or typo'd ref raises ``NoSuchResource`` (fails
loudly) rather than silently resolving to a permissive stub.
"""

from __future__ import annotations

import functools
import json
from collections.abc import Mapping
from pathlib import Path

from jsonschema import Draft202012Validator
from referencing import Registry, Resource
from referencing.exceptions import NoSuchResource
from referencing.jsonschema import DRAFT202012


@functools.cache
def _repo_root() -> Path:
    """Walk up from this module until a directory containing ``schema/json`` is found."""
    here = Path(__file__).resolve()
    for parent in here.parents:
        if (parent / "schema" / "json").is_dir():
            return parent
    raise FileNotFoundError("could not locate repo root containing schema/json")


def _schema_dir() -> Path:
    return _repo_root() / "schema" / "json"


@functools.cache
def load_schema(name: str) -> dict:
    """Load a schema document from ``schema/json/<name>.schema.json`` by stem."""
    path = _schema_dir() / f"{name}.schema.json"
    return json.loads(path.read_text())


@functools.cache
def _registry() -> Registry:
    """Registry of all on-disk schemas, keyed by ``$id``.

    Refs that are not already preloaded are resolved strictly from disk by
    filename; anything else raises ``NoSuchResource`` so typo'd or missing
    ``$ref``s fail loudly instead of resolving to a permissive stub.
    """
    resources: list[tuple[str, Resource]] = []
    for path in sorted(_schema_dir().glob("*.schema.json")):
        contents = json.loads(path.read_text())
        resource = Resource.from_contents(contents, default_specification=DRAFT202012)
        resources.append((resource.id(), resource))

    def retrieve(uri: str) -> Resource:
        name = uri.rsplit("/", 1)[-1]
        path = _schema_dir() / name
        if name.endswith(".schema.json") and path.is_file():
            contents = json.loads(path.read_text())
            return Resource.from_contents(contents, default_specification=DRAFT202012)
        raise NoSuchResource(ref=uri)

    return Registry(retrieve=retrieve).with_resources(resources)


@functools.cache
def _validator(name: str) -> Draft202012Validator:
    return Draft202012Validator(load_schema(name), registry=_registry())


def _schema_errors(name: str, obj: object) -> list[str]:
    """Validate ``obj`` against ``<name>.schema.json``; return sorted error strings."""
    validator = _validator(name)
    errors = sorted(validator.iter_errors(obj), key=lambda e: (list(e.absolute_path), e.message))
    return [f"{e.json_path}: {e.message}" for e in errors]


@functools.cache
def _facet_vocab() -> dict[str, frozenset[str]]:
    """Load the frozen facet vocabulary as ``{facet_name: {allowed values}}``."""
    path = _repo_root() / "schema" / "vocab" / "facets.json"
    data = json.loads(path.read_text())
    return {name: frozenset(spec["values"]) for name, spec in data["facets"].items()}


def _facet_vocab_errors(facets: Mapping[str, object], prefix: str) -> list[str]:
    """Check a ``{facet_name: value}`` mapping against ``vocab/facets.json``."""
    vocab = _facet_vocab()
    errors: list[str] = []
    for name, value in facets.items():
        if name not in vocab:
            errors.append(f"{prefix}.{name}: unknown facet (not in vocab/facets.json)")
        elif value not in vocab[name]:
            errors.append(f"{prefix}.{name}: value {value!r} not in '{name}' facet vocabulary")
    return errors


def validate_item(obj: dict) -> list[str]:
    """Validate ``obj`` against ``item.schema.json``.

    Returns an empty list when valid; otherwise a list of ``<json-path>: <message>``
    strings, one per validation error, ordered by location in the document.
    """
    return _schema_errors("item", obj)


def validate_extraction(obj: dict) -> list[str]:
    """Validate a single extraction against ``extraction.schema.json``.

    In addition to JSON Schema validation, a ``facet``-kind extraction has its
    ``value`` checked against ``vocab/facets.json`` (the schema keeps it a bare
    string so the vocabulary can evolve without a schema bump).
    """
    errors = _schema_errors("extraction", obj)
    if isinstance(obj, Mapping) and obj.get("kind") == "facet":
        facet, value = obj.get("facet"), obj.get("value")
        if isinstance(facet, str) and isinstance(value, str):
            errors += _facet_vocab_errors({facet: value}, "$")
    return errors


def validate_extractor_output(obj: dict) -> list[str]:
    """Validate a model-facing extractor output against ``extractor-output.schema.json``.

    In addition to JSON Schema validation, each facet assignment in the ``facets``
    array has its ``value`` checked against ``vocab/facets.json`` for its ``facet``
    axis (the schema keeps values bare strings so the vocabulary can evolve without
    a schema bump), consistent with the gold/pred/extraction validators.
    """
    errors = _schema_errors("extractor-output", obj)
    if isinstance(obj, Mapping) and isinstance(obj.get("facets"), list):
        for i, assignment in enumerate(obj["facets"]):
            if isinstance(assignment, Mapping):
                facet, value = assignment.get("facet"), assignment.get("value")
                if isinstance(facet, str) and isinstance(value, str):
                    errors += _facet_vocab_errors({facet: value}, f"$.facets[{i}]")
    return errors


def validate_gold_record(obj: dict) -> list[str]:
    """Validate a gold record against ``gold.schema.json``.

    The schema enforces the mention ``gold_id`` XOR ``nil`` rule and the
    ``nil="NIL_NO_ID"`` ⇒ non-empty ``failed_queries`` rule; this validator
    additionally checks ``facets`` values against ``vocab/facets.json``.
    """
    errors = _schema_errors("gold", obj)
    if isinstance(obj, Mapping) and isinstance(obj.get("facets"), Mapping):
        errors += _facet_vocab_errors(obj["facets"], "$.facets")
    return errors


def validate_pred_record(obj: dict) -> list[str]:
    """Validate a prediction record against ``pred.schema.json``.

    Additionally checks ``facets`` values against ``vocab/facets.json``.
    """
    errors = _schema_errors("pred", obj)
    if isinstance(obj, Mapping) and isinstance(obj.get("facets"), Mapping):
        errors += _facet_vocab_errors(obj["facets"], "$.facets")
    return errors
