"""SHACL gate: RDF/standards-conformance validation for Commonplace items.

`validate_shacl(item, profile=None)` lifts an item dict into RDF through the
JSON-LD context (``schema/context/commonplace.context.jsonld``) and validates the
resulting graph against the base SHACL shape (``schema/shacl/base.shape.ttl``),
plus a platform application-profile shape when ``profile`` is given
(``schema/shacl/profile-<profile>.shape.ttl``). It returns ``(conforms, report)``.

This is the machine-checkable form of the KOE-STANDARD conformance layer
(``docs/product/_KOE-STANDARD.md``): the base shape is the cross-platform
analyzability gate — it must conform on 100% of valid fixtures regardless of
platform — and each profile is an Application Profile that tightens the base for
one platform without touching base validation of any other.

Node typing (the SHACL target hook) is assigned in context-processing code here
rather than in the data or the ``@context``: the item root is stamped
``@type cpl:Item`` and every extraction node ``@type cpl:Extraction`` before the
JSON-LD is expanded. This is the simplest mechanism that pyshacl targets cleanly
(``sh:targetClass``); the TikTok profile instead targets by data (a SPARQL-based
target on ``origin.platform == "tiktok"``), which needs no injected type.

Mirrors ``schema_gate.py``'s cached-loader / walk-up-to-repo-root patterns.
"""

from __future__ import annotations

import copy
import functools
import json
from pathlib import Path

import pyshacl
from rdflib import Graph

CPL = "https://commonplace.app/ns#"


@functools.cache
def _repo_root() -> Path:
    """Walk up from this module until a directory containing ``schema/json`` is found."""
    here = Path(__file__).resolve()
    for parent in here.parents:
        if (parent / "schema" / "json").is_dir():
            return parent
    raise FileNotFoundError("could not locate repo root containing schema/json")


@functools.cache
def _context() -> dict:
    """The ``@context`` object that lifts item JSON into RDF."""
    path = _repo_root() / "schema" / "context" / "commonplace.context.jsonld"
    return json.loads(path.read_text())["@context"]


@functools.cache
def _shapes_graph(profile: str | None) -> Graph:
    """Parse the base shape (+ the profile shape when given) into one graph.

    The profile shape is loaded *alongside* the base shape, never instead of it:
    a profiled item must satisfy both.
    """
    shacl_dir = _repo_root() / "schema" / "shacl"
    graph = Graph()
    graph.parse(shacl_dir / "base.shape.ttl", format="turtle")
    if profile is not None:
        profile_path = shacl_dir / f"profile-{profile}.shape.ttl"
        if not profile_path.is_file():
            raise FileNotFoundError(f"unknown SHACL profile: {profile!r} ({profile_path})")
        graph.parse(profile_path, format="turtle")
    return graph


def _annotate_types(node: object, *, root: bool) -> None:
    """Stamp the SHACL target types onto a (deep-copied) item in place.

    The item root gets ``@type cpl:Item``; every extraction node (at the root and
    inside any nested child post) gets ``@type cpl:Extraction``. These rdf:type
    triples are what ``sh:targetClass`` keys off. Nothing else is retyped.
    """
    if not isinstance(node, dict):
        return
    if root:
        node["@type"] = "cpl:Item"
    extractions = node.get("extractions")
    if isinstance(extractions, list):
        for extraction in extractions:
            if isinstance(extraction, dict):
                extraction["@type"] = "cpl:Extraction"
    children = node.get("children")
    if isinstance(children, list):
        for child in children:
            if isinstance(child, dict):
                _annotate_types(child.get("post"), root=False)


def _to_graph(item: dict) -> Graph:
    """Lift an item dict into an rdflib graph via the JSON-LD context."""
    doc = copy.deepcopy(item)
    _annotate_types(doc, root=True)
    doc["@context"] = _context()
    graph = Graph()
    graph.parse(data=json.dumps(doc), format="json-ld")
    return graph


def validate_shacl(item: dict, profile: str | None = None) -> tuple[bool, str]:
    """Validate an item against the base SHACL shape (+ a profile when given).

    Returns ``(conforms, report)``: ``conforms`` is True iff the item's RDF graph
    satisfies every shape; ``report`` is pyshacl's human-readable validation
    report (useful as an assertion message on failure).
    """
    data_graph = _to_graph(item)
    conforms, _results_graph, report = pyshacl.validate(
        data_graph,
        shacl_graph=_shapes_graph(profile),
        advanced=True,  # required for the profile's SPARQL-based target
        inference="none",
        meta_shacl=False,
    )
    return conforms, report
