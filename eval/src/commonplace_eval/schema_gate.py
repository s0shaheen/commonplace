"""Schema gate: JSON Schema (draft 2020-12) validation for Commonplace items.

`validate_item(obj)` returns a list of JSON-pointer-ish error strings (empty
== valid). `load_schema(name)` loads a schema from ``schema/json/`` by stem.

The reference registry loads every ``schema/json/*.schema.json`` present on
disk and keys it by its ``$id``. Cross-schema ``$ref``s to files that do not
yet exist (e.g. ``extraction.schema.json`` until Task 2 lands) resolve to a
permissive ``{"type": "object"}`` stub via the registry's ``retrieve`` hook,
so the base container validates today and gets stricter for free later.
"""

from __future__ import annotations

import functools
import json
from pathlib import Path

from jsonschema import Draft202012Validator
from referencing import Registry, Resource
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
    """Registry of all on-disk schemas, keyed by ``$id``; missing refs get a stub."""
    resources: list[tuple[str, Resource]] = []
    for path in sorted(_schema_dir().glob("*.schema.json")):
        contents = json.loads(path.read_text())
        resource = Resource.from_contents(contents, default_specification=DRAFT202012)
        resources.append((resource.id(), resource))

    def retrieve(uri: str) -> Resource:
        # Permissive stub for any schema referenced but not yet on disk
        # (e.g. extraction.schema.json until Task 2 replaces it).
        return Resource.from_contents({"type": "object"}, default_specification=DRAFT202012)

    return Registry(retrieve=retrieve).with_resources(resources)


@functools.cache
def _validator(name: str) -> Draft202012Validator:
    return Draft202012Validator(load_schema(name), registry=_registry())


def validate_item(obj: dict) -> list[str]:
    """Validate ``obj`` against ``item.schema.json``.

    Returns an empty list when valid; otherwise a list of ``<json-path>: <message>``
    strings, one per validation error, ordered by location in the document.
    """
    validator = _validator("item")
    errors = sorted(validator.iter_errors(obj), key=lambda e: (list(e.absolute_path), e.message))
    return [f"{e.json_path}: {e.message}" for e in errors]
