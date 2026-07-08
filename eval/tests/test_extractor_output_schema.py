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
           "concepts": [], "facets": {}, "claims": [], "structured": []}
    assert validate_extractor_output(out) == []


def _one_mention(mention):
    return {"mentions": [mention], "concepts": [], "facets": {}, "claims": [], "structured": []}


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
