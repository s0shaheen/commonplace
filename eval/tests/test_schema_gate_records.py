"""Gold/pred/extraction record validators + the tightened ref-resolution stub."""

import pytest
from jsonschema import Draft202012Validator

from commonplace_eval.schema_gate import (
    _registry,
    validate_extraction,
    validate_gold_record,
    validate_pred_record,
)


# --- gold record (the brief's canonical example) ----------------------------

GOLD = {
    "item_id": "7234567890123456789",
    "strata": {"has_vtt": True, "is_slideshow": False, "duration_tercile": 2},
    "mentions": [
        {"mention_id": "m1", "surface": "Kill Bill", "aliases": ["SZA — Kill Bill"],
         "type": "music_recording",
         "gold_id": {"authority": "musicbrainz", "id": "5a7c..."},
         "nil": None, "failed_queries": [],
         "kb_snapshot": {"authority": "musicbrainz", "retrieved": "2026-07-08"},
         "hard_case": False, "notes": ""},
    ],
    "concepts": [{"concept_id": "iptc:20000538", "authority": "iptc", "label": "fitness"}],
    "facets": {"topic": "fitness", "intent": "how_to"},
    "structured": [{"schemaOrgType": "ExercisePlan",
                    "slots": [{"name": "exercise", "value": "cable lateral raise"}],
                    "steps": [{"order": 1, "text": "set pulley at hip height"}]}],
    "claims": [{"claim_id": "c1", "statement": "cable lateral raises isolate the shoulder better than dumbbells"}],
}


def test_gold_example_valid():
    assert validate_gold_record(GOLD) == []


def test_gold_minimal_item_id_only():
    assert validate_gold_record({"item_id": "x"}) == []


def test_gold_gold_id_and_nil_both_nonnull_rejected():
    m = {"mention_id": "m1", "surface": "s", "type": "place",
         "gold_id": {"authority": "a", "id": "b"}, "nil": "NON_ENTITY"}
    assert validate_gold_record({"item_id": "x", "mentions": [m]}) != []


def test_gold_gold_id_and_nil_both_null_rejected():
    m = {"mention_id": "m1", "surface": "s", "type": "place", "gold_id": None, "nil": None}
    assert validate_gold_record({"item_id": "x", "mentions": [m]}) != []


def test_gold_nil_no_id_requires_failed_queries():
    m = {"mention_id": "m1", "surface": "s", "type": "place",
         "gold_id": None, "nil": "NIL_NO_ID", "failed_queries": []}
    assert validate_gold_record({"item_id": "x", "mentions": [m]}) != []
    m["failed_queries"] = ["joe pizza nyc"]
    assert validate_gold_record({"item_id": "x", "mentions": [m]}) == []


def test_gold_non_entity_needs_no_failed_queries():
    m = {"mention_id": "m1", "surface": "s", "type": "place",
         "gold_id": None, "nil": "NON_ENTITY", "failed_queries": []}
    assert validate_gold_record({"item_id": "x", "mentions": [m]}) == []


def test_gold_bad_facet_value_rejected():
    assert validate_gold_record({"item_id": "x", "facets": {"topic": "NOTATOPIC"}}) != []


def test_gold_unknown_facet_rejected():
    assert validate_gold_record({"item_id": "x", "facets": {"nonsense": "food"}}) != []


def test_gold_bad_entity_type_rejected():
    m = {"mention_id": "m1", "surface": "Joe's Pizza", "type": "restaurant", "nil": "NON_ENTITY"}
    assert validate_gold_record({"item_id": "x", "mentions": [m]}) != []


def test_gold_verification_object_valid():
    """A Place mention may carry the structured staleness-guard `verification` block."""
    m = {"mention_id": "m1", "surface": "Joe's Pizza", "type": "place",
         "gold_id": {"authority": "google_places", "id": "ChIJ...Bleecker"},
         "verification": {"name": "Joe's Pizza",
                          "address": "7 Carmine St, New York, NY 10014",
                          "lat": 40.7305, "lng": -74.0027,
                          "url": "https://maps.google.com/?cid=123"}}
    assert validate_gold_record({"item_id": "x", "mentions": [m]}) == []


def test_gold_verification_unknown_key_rejected():
    """`verification` is `additionalProperties: false` — an unknown key must fail."""
    m = {"mention_id": "m1", "surface": "Joe's Pizza", "type": "place",
         "gold_id": {"authority": "google_places", "id": "ChIJ...Bleecker"},
         "verification": {"name": "Joe's Pizza", "place_id": "ChIJ...Bleecker"}}
    assert validate_gold_record({"item_id": "x", "mentions": [m]}) != []


# --- pred record ------------------------------------------------------------

PRED = {
    "item_id": "7234567890123456789",
    "mentions": [{"surface": "Kill Bill by SZA", "type": "music_recording",
                  "grounding": {"authority": "musicbrainz", "externalId": "5a7c...",
                                "nil": False, "grounding_confidence": 0.93}}],
    "concepts": [{"concept_id": "iptc:20000538", "authority": "iptc", "score": 0.8}],
    "facets": {"topic": "fitness"},
    "structured": [{"schemaOrgType": "ExercisePlan", "slots": [], "steps": []}],
    "claims": [{"statement": "worth it"}],
}


def test_pred_example_valid():
    assert validate_pred_record(PRED) == []


def test_pred_grounding_nil_true_with_id_rejected():
    m = {"surface": "x", "type": "place",
         "grounding": {"authority": "a", "externalId": "id", "nil": True, "grounding_confidence": 0.1}}
    assert validate_pred_record({"item_id": "x", "mentions": [m]}) != []


def test_pred_grounding_nil_true_null_id_ok():
    m = {"surface": "x", "type": "place",
         "grounding": {"authority": "a", "externalId": None, "nil": True, "grounding_confidence": 0.1}}
    assert validate_pred_record({"item_id": "x", "mentions": [m]}) == []


def test_pred_bad_facet_value_rejected():
    assert validate_pred_record({"item_id": "x", "facets": {"topic": "NOTATOPIC"}}) != []


# --- extraction facet-vocab enforcement -------------------------------------

def _facet(value):
    return {"kind": "facet", "facet": "topic", "value": value,
            "evidence": [{"channel": "STRUCTURED_METADATA", "assertion_mode": "INFERRED", "confidence": 0.5}]}


def test_extraction_facet_value_in_vocab_ok():
    assert validate_extraction(_facet("food")) == []


def test_extraction_facet_value_off_vocab_rejected():
    assert validate_extraction(_facet("NOTATOPIC")) != []


# --- tightened ref resolution (Task 1 deferred item) ------------------------

def test_typoed_ref_fails_loudly():
    """A `$ref` to a schema file that does not exist must raise, not stub-pass."""
    schema = {"type": "array", "items": {"$ref": "does-not-exist.schema.json"}}
    validator = Draft202012Validator(schema, registry=_registry())
    with pytest.raises(Exception):
        list(validator.iter_errors([{"anything": 1}]))


def test_known_cross_file_ref_still_resolves():
    """A `$ref` to a real on-disk schema still resolves (no false failure)."""
    schema = {"type": "array", "items": {"$ref": "extraction.schema.json"}}
    validator = Draft202012Validator(schema, registry=_registry())
    good = {"kind": "facet", "facet": "topic", "value": "food",
            "evidence": [{"channel": "STRUCTURED_METADATA", "assertion_mode": "INFERRED", "confidence": 0.5}]}
    assert list(validator.iter_errors([good])) == []
