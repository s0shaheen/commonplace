import json
from pathlib import Path
import pytest
from commonplace_eval.schema_gate import validate_item

FIXTURES = Path(__file__).resolve().parents[2] / "schema" / "fixtures"


@pytest.mark.parametrize("p", sorted((FIXTURES / "valid").glob("*.json")), ids=lambda p: p.stem)
def test_valid_fixtures_pass(p):
    errors = validate_item(json.loads(p.read_text()))
    assert errors == [], f"{p.name} should validate: {errors}"


@pytest.mark.parametrize("p", sorted((FIXTURES / "invalid").glob("*.json")), ids=lambda p: p.stem)
def test_invalid_fixtures_fail(p):
    assert validate_item(json.loads(p.read_text())) != []


def test_minimal_admission_rule():
    item = {"identity": {"status": "inferred", "contentHash": "ni:///sha-256;abc"},
            "saves": [{"sources": [{"kind": "manual", "at": "2026-07-08T00:00:00Z"}]}]}
    assert validate_item(item) == []


def test_root_gates_and_repeatable_capturedat():
    """Ontology §2.5/§2.6: root `gates`, `captureStatus`, and repeatable `capturedAt`."""
    item = {
        "identity": {"status": "inferred", "contentHash": "ni:///sha-256;abc"},
        "saves": [{"sources": [{"kind": "manual", "at": "2026-07-08T00:00:00Z"}]}],
        "gates": {"replyControls": "everyone", "quoteControls": "followers"},
        "captureStatus": "recaptured",
        "capturedAt": [
            {"value": "2026-07-08T00:00:00Z", "source": "inferred", "confidence": 0.9},
            {"value": "2026-07-09T09:15:00Z", "source": "user", "confidence": 1},
        ],
    }
    assert validate_item(item) == []


def test_zero_evidence_extraction_rejected():
    item = json.loads((FIXTURES / "valid" / "extraction-grounded.json").read_text())
    item["extractions"][0]["evidence"] = []
    assert validate_item(item) != []


def test_grounding_nil_invariant():
    from commonplace_eval.schema_gate import validate_extraction
    g = {"kind": "named_entity", "surface": "Joe's Pizza", "type": "place",
         "evidence": [{"channel": "VISUAL_TEXT", "assertion_mode": "SHOWN", "confidence": 0.9}],
         "grounding": {"authority": "google_places", "externalId": None, "nil": False, "grounding_confidence": 0.5}}
    assert validate_extraction(g) != []  # nil=false requires an id
