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
