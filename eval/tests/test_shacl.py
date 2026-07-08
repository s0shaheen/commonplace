import copy
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


# Each invalid fixture must trip exactly the base guard it was built to violate —
# without these, the guard could silently regress into vacuous passing (a shape
# that targets nothing still "conforms"). Value = (constraint component, path/target)
# substrings that MUST appear in the report so we know the RIGHT guard fired, not
# just that *something* failed. bad-entity-type.json is intentionally excluded:
# the base shape does not constrain entity types.
BASE_NEGATIVES = {
    # (1) identity sh:or: no permalink/canonicalId/contentHash handle present.
    "no-identity": ("OrConstraintComponent", "cpl:identity"),
    # (2) savedAt minCount: saves[] carries no source date.
    "no-save": ("MinCountConstraintComponent", "cpl:savedAt"),
    # (4) assertion_mode sh:in: evidence.assertion_mode = "ASSUMED" (off-vocab).
    "bad-assertion-mode": ("InConstraintComponent", "cpl:assertionMode"),
}


@pytest.mark.parametrize("stem", sorted(BASE_NEGATIVES), ids=lambda s: s)
def test_base_guard_negatives(stem):
    component, path = BASE_NEGATIVES[stem]
    item = json.loads((FIXTURES / "invalid" / f"{stem}.json").read_text())
    conforms, report = validate_shacl(item)
    assert not conforms, f"{stem} should violate the base shape but conformed"
    assert component in report, f"{stem}: expected {component} in report:\n{report}"
    assert path in report, f"{stem}: expected {path} in report:\n{report}"


def test_tiktok_profile():
    item = json.loads((FIXTURES / "valid" / "tiktok-video.json").read_text())
    conforms, report = validate_shacl(item, profile="tiktok")
    assert conforms, report


def test_tiktok_profile_negatives():
    """The three TikTok tightens must actually reject, and the SPARQL target must
    not bind to non-TikTok items (guarding against a vacuously-passing profile)."""
    base = json.loads((FIXTURES / "valid" / "tiktok-video.json").read_text())

    # (a) status tighten (sh:hasValue platform_verified): "inferred" is rejected.
    inferred = copy.deepcopy(base)
    inferred["identity"]["status"] = "inferred"
    conforms, report = validate_shacl(inferred, profile="tiktok")
    assert not conforms, f"identity.status=inferred should fail the profile:\n{report}"

    # (b) canonicalId tighten (sh:minCount 1): dropping it is rejected even though
    #     permalink still satisfies the base identity sh:or.
    no_canonical = copy.deepcopy(base)
    del no_canonical["identity"]["canonicalId"]
    conforms, report = validate_shacl(no_canonical, profile="tiktok")
    assert not conforms, f"deleting identity.canonicalId should fail the profile:\n{report}"

    # (c) vacuous-targeting guard: a copy that breaks ALL three TikTok rules but is
    #     origin.platform="reddit" must PASS the profile — the SPARQL target selects
    #     only tiktok items, so the tightens never bind. (mediaKind=audio stays in
    #     the base 7 so the base shape still conforms.)
    reddit = copy.deepcopy(base)
    reddit["origin"]["platform"] = "reddit"
    reddit["identity"]["status"] = "inferred"
    del reddit["identity"]["canonicalId"]
    reddit["mediaKind"] = "audio"
    conforms, report = validate_shacl(reddit, profile="tiktok")
    assert conforms, f"non-tiktok item must not be bound by the TikTok target:\n{report}"
