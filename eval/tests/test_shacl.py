import json
from pathlib import Path

import pytest

from commonplace_eval.shacl_gate import validate_shacl

FIXTURES = Path(__file__).resolve().parents[2] / "schema" / "fixtures"


@pytest.mark.parametrize(
    "p", sorted((FIXTURES / "valid").glob("*.json")), ids=lambda p: p.stem
)
def test_base_shape_passes_on_all_valid_items(p):
    conforms, report = validate_shacl(json.loads(p.read_text()))
    assert conforms, report


def test_zero_evidence_fails_shacl():
    item = json.loads((FIXTURES / "invalid" / "zero-evidence-extraction.json").read_text())
    conforms, _ = validate_shacl(item)
    assert not conforms


def test_tiktok_profile():
    item = json.loads((FIXTURES / "valid" / "tiktok-video.json").read_text())
    conforms, report = validate_shacl(item, profile="tiktok")
    assert conforms, report
