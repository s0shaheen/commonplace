import json
from commonplace_eval.schema_gate import load_schema, validate_extractor_output


def _walk(node):
    yield node
    if isinstance(node, dict):
        for v in node.values(): yield from _walk(v)
    elif isinstance(node, list):
        for v in node: yield from _walk(v)


def test_no_refs_or_oneof():  # Gemini response_schema compatibility
    s = load_schema("extractor-output")
    for node in _walk(s):
        if isinstance(node, dict):
            assert "$ref" not in node and "oneOf" not in node and "allOf" not in node


def test_valid_output_passes():
    out = {"mentions": [{"surface": "SZA", "type": "person", "aliases": [],
            "evidence": [{"channel": "VERBAL_AUDIO", "source_role": "narration",
                          "quote": "", "assertion_mode": "STATED", "confidence": 0.9}]}],
           "concepts": [], "facets": [], "claims": [], "structured": []}
    assert validate_extractor_output(out) == []


def _one_mention(mention):
    return {"mentions": [mention], "concepts": [], "facets": [], "claims": [], "structured": []}


def _one_facet(assignment):
    return {"mentions": [], "concepts": [], "facets": [assignment], "claims": [], "structured": []}


def test_grounding_field_rejected():
    """The model never emits grounding — it's the downstream resolver's job.
    `additionalProperties: false` on the mention object must reject a `grounding`."""
    mention = {"surface": "SZA", "type": "person",
               "evidence": [{"channel": "VERBAL_AUDIO", "assertion_mode": "STATED", "confidence": 0.9}],
               "grounding": {"authority": "musicbrainz", "externalId": "5a7c...",
                             "nil": False, "grounding_confidence": 0.93}}
    assert validate_extractor_output(_one_mention(mention)) != []


def test_zero_evidence_rejected():
    """Every extraction element requires >=1 evidence (minItems 1)."""
    mention = {"surface": "SZA", "type": "person", "evidence": []}
    assert validate_extractor_output(_one_mention(mention)) != []


# --- facet assignments carry model-emitted evidence (rc.6) -------------------
def test_facet_assignment_with_evidence_passes():
    """A facet assignment with a valid axis, an in-vocab value, and >=1 evidence
    span validates — the model emits facet provenance itself (no synthetic stamp)."""
    assignment = {"facet": "topic", "value": "food",
                  "evidence": [{"channel": "VERBAL_AUDIO", "assertion_mode": "STATED",
                                "confidence": 0.9}]}
    assert validate_extractor_output(_one_facet(assignment)) == []


def test_facet_zero_evidence_rejected():
    """A facet assignment with an empty evidence array is rejected (minItems 1) —
    the whole point of the rc.6 shape is that facets carry real provenance."""
    assignment = {"facet": "topic", "value": "food", "evidence": []}
    assert validate_extractor_output(_one_facet(assignment)) != []


def test_facet_off_vocab_value_rejected():
    """An off-vocab facet value passes JSON Schema (value is a bare string) but is
    rejected by the runtime vocab check in validate_extractor_output."""
    assignment = {"facet": "topic", "value": "NOTATOPIC",
                  "evidence": [{"channel": "VERBAL_AUDIO", "assertion_mode": "STATED",
                                "confidence": 0.9}]}
    assert validate_extractor_output(_one_facet(assignment)) != []


def test_facet_unknown_axis_rejected():
    """An unknown facet axis name is rejected by the schema enum (not a vocab check)."""
    assignment = {"facet": "not_a_facet", "value": "food",
                  "evidence": [{"channel": "VERBAL_AUDIO", "assertion_mode": "STATED",
                                "confidence": 0.9}]}
    assert validate_extractor_output(_one_facet(assignment)) != []
