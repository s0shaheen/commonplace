"""Pre-annotation with a different model family (methodology §5.1, tasks 2.2-2.3).

The pipeline under evaluation is Gemini, so the pre-annotator must be Claude —
not a preference but the anti-correlated-error requirement: a Gemini
pre-annotator grading a Gemini pipeline inflates agreement through shared
blind spots and self-preference.

**No test here reaches the network.** The Anthropic client is injected, so
these exercise the request this code builds, the parsing of a recorded
response, and the guard rails — not the API. `ANTHROPIC_API_KEY` is not
present in this repo, so the real path is built and gated, never run.
"""

from __future__ import annotations

import json
from types import SimpleNamespace

import pytest

from gold import preannotate


# --- fakes -------------------------------------------------------------------
class _FakeMessages:
    def __init__(self, response, recorder):
        self._response = response
        self._recorder = recorder

    def create(self, **kwargs):
        self._recorder.append(kwargs)
        if callable(self._response):
            return self._response(**kwargs)
        return self._response


class _FakeClient:
    """Stands in for `anthropic.Anthropic()` — the injected seam."""

    def __init__(self, response):
        self.calls: list[dict] = []
        self.messages = _FakeMessages(response, self.calls)


def _response(payload: dict, stop_reason: str = "end_turn") -> SimpleNamespace:
    return SimpleNamespace(
        stop_reason=stop_reason,
        stop_details=None,
        model="claude-opus-5",
        content=[SimpleNamespace(type="text", text=json.dumps(payload))],
    )


RECORDED = {
    "mentions": [
        {
            "surface": "Joe's Pizza",
            "type": "place",
            "aliases": ["Joes Pizza"],
            "candidates": [
                {"authority": "google_places", "id": "ChIJrw7QBK9YwokRVs3v7O8oULU", "label": "Joe's Pizza"}
            ],
            "confidence": 0.8,
            "evidence": 'channel=VERBAL_AUDIO; quote="best slice is Joe\'s"',
        },
        {
            "surface": "original sound - creator123",
            "type": "music_recording",
            "aliases": [],
            "candidates": [],
            "confidence": 0.3,
            "evidence": "channel=STRUCTURED_METADATA",
        },
    ],
    "concepts": [{"concept_id": "Q177", "authority": "wikidata", "label": "pizza"}],
    "facets": [{"facet": "topic", "value": "food"}, {"facet": "intent", "value": "recommendation"}],
    "claims": [{"statement": "it is worth the queue"}],
}


def _row(item_id: str = "syn_0001", blind: bool = False) -> dict:
    return {
        "item_id": item_id,
        "blind": blind,
        "stratum": {"has_vtt": True, "is_slideshow": False, "duration_tercile": 2},
        "stratum_key": "vtt=1|slide=0|dur=2",
        "content_bucket": "food_place",
        "weight": 77.6,
        "hard_case_seeds": [],
        "item": {
            "id": item_id,
            "desc": "best slice in town",
            "hashtags": ["foodtok"],
            "durationSec": 30,
            "music": {"name": "a track", "author": "artist"},
            "url": "https://example.invalid/1",
        },
    }


# --- the key gate ------------------------------------------------------------
def test_api_key_is_absent_from_this_repo_so_the_claude_path_stays_gated(monkeypatch, tmp_path):
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    assert preannotate.load_api_key(env_path=tmp_path / "nope.env") is None


def test_missing_key_raises_an_actionable_error(monkeypatch, tmp_path):
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    with pytest.raises(preannotate.MissingApiKey) as exc:
        preannotate.AnthropicAnnotator(env_path=tmp_path / "nope.env")
    message = str(exc.value)
    assert "ANTHROPIC_API_KEY" in message
    assert ".env.local" in message
    assert "different model family" in message.lower()


def test_key_is_read_from_env_local(monkeypatch, tmp_path):
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    env = tmp_path / ".env.local"
    env.write_text("# a comment\nGEMINI_API_KEY=other\nANTHROPIC_API_KEY=sk-ant-fromfile\n")
    assert preannotate.load_api_key(env_path=env) == "sk-ant-fromfile"


def test_process_environment_wins_over_the_file(monkeypatch, tmp_path):
    env = tmp_path / ".env.local"
    env.write_text("ANTHROPIC_API_KEY=sk-ant-fromfile\n")
    monkeypatch.setenv("ANTHROPIC_API_KEY", "sk-ant-fromenv")
    assert preannotate.load_api_key(env_path=env) == "sk-ant-fromenv"


@pytest.mark.parametrize(
    "line,expected",
    [
        ('ANTHROPIC_API_KEY="sk-quoted"', "sk-quoted"),
        ("ANTHROPIC_API_KEY='sk-single'", "sk-single"),
        ("export ANTHROPIC_API_KEY=sk-exported", "sk-exported"),
        ("ANTHROPIC_API_KEY = sk-spaced ", "sk-spaced"),
        ("ANTHROPIC_API_KEY=", None),
    ],
)
def test_env_file_parsing_handles_real_world_shapes(monkeypatch, tmp_path, line, expected):
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    env = tmp_path / ".env.local"
    env.write_text(line + "\n")
    assert preannotate.load_api_key(env_path=env) == expected


# --- the request this code builds -------------------------------------------
def test_annotate_requests_claude_with_a_constrained_json_schema():
    client = _FakeClient(_response(RECORDED))
    ann = preannotate.AnthropicAnnotator(api_key="sk-test", client=client)
    ann.annotate(_row())

    call = client.calls[0]
    assert call["model"] == preannotate.DEFAULT_MODEL == "claude-opus-5"
    assert call["max_tokens"] >= 4000
    fmt = call["output_config"]["format"]
    assert fmt["type"] == "json_schema"
    assert fmt["schema"]["additionalProperties"] is False
    assert set(fmt["schema"]["properties"]) == {"mentions", "concepts", "facets", "claims"}
    assert call["messages"][0]["role"] == "user"


def test_the_prompt_carries_the_item_the_annotator_must_read():
    client = _FakeClient(_response(RECORDED))
    ann = preannotate.AnthropicAnnotator(api_key="sk-test", client=client)
    ann.annotate(_row())
    prompt = client.calls[0]["messages"][0]["content"]
    assert "best slice in town" in prompt
    assert "foodtok" in prompt
    assert "a track" in prompt


def test_the_system_prompt_is_built_from_the_frozen_vocabularies():
    client = _FakeClient(_response(RECORDED))
    ann = preannotate.AnthropicAnnotator(api_key="sk-test", client=client)
    ann.annotate(_row())
    system = client.calls[0]["system"]
    for entity_type in preannotate.TYPES:
        assert entity_type in system
    assert "save_for_later" in system  # a viewer_orientation facet value
    assert "NIL" in system
    assert "suggestion" in system.lower()


def test_suggestions_are_never_presented_as_answers():
    # The guard against a suggestion becoming gold on its own is a hard one:
    # nothing in the emitted payload may claim a decision was made.
    client = _FakeClient(_response(RECORDED))
    ann = preannotate.AnthropicAnnotator(api_key="sk-test", client=client)
    out = ann.annotate(_row())
    for mention in out["mentions"]:
        assert "gold_id" not in mention
        assert "verified" not in mention
        assert "nil" not in mention


# --- parsing a recorded response --------------------------------------------
def test_a_recorded_response_parses_into_review_tool_suggestions():
    client = _FakeClient(_response(RECORDED))
    ann = preannotate.AnthropicAnnotator(api_key="sk-test", client=client)
    out = ann.annotate(_row())

    assert [m["surface"] for m in out["mentions"]] == [
        "Joe's Pizza",
        "original sound - creator123",
    ]
    assert out["mentions"][0]["candidates"][0]["authority"] == "google_places"
    assert out["mentions"][0]["aliases"] == ["Joes Pizza"]
    assert out["concepts"] == [{"concept_id": "Q177", "authority": "wikidata", "label": "pizza"}]
    assert out["facets"] == {"topic": "food", "intent": "recommendation"}
    assert out["claims"] == [{"statement": "it is worth the queue"}]


def test_facet_values_outside_the_frozen_vocabulary_are_dropped():
    payload = dict(RECORDED, facets=[
        {"facet": "topic", "value": "food"},
        {"facet": "topic_invented", "value": "x"},
        {"facet": "intent", "value": "not_a_value"},
    ])
    client = _FakeClient(_response(payload))
    ann = preannotate.AnthropicAnnotator(api_key="sk-test", client=client)
    assert ann.annotate(_row())["facets"] == {"topic": "food"}


def test_types_outside_the_nine_groundable_types_are_dropped():
    payload = dict(RECORDED, mentions=[
        {"surface": "Joe's Pizza", "type": "place", "candidates": []},
        {"surface": "a vibe", "type": "restaurant", "candidates": []},
    ])
    client = _FakeClient(_response(payload))
    ann = preannotate.AnthropicAnnotator(api_key="sk-test", client=client)
    out = ann.annotate(_row())
    assert [m["surface"] for m in out["mentions"]] == ["Joe's Pizza"]


def test_unknown_candidate_authorities_are_dropped_but_the_mention_survives():
    payload = dict(RECORDED, mentions=[
        {
            "surface": "Dune",
            "type": "screen_work",
            "candidates": [
                {"authority": "imdb", "id": "tt1160419"},
                {"authority": "wikidata", "id": "Q60705"},
            ],
        }
    ])
    client = _FakeClient(_response(payload))
    ann = preannotate.AnthropicAnnotator(api_key="sk-test", client=client)
    out = ann.annotate(_row())
    assert len(out["mentions"]) == 1
    assert [c["authority"] for c in out["mentions"][0]["candidates"]] == ["wikidata"]


def test_a_refusal_is_recorded_rather_than_crashing_the_run():
    client = _FakeClient(_response(RECORDED, stop_reason="refusal"))
    ann = preannotate.AnthropicAnnotator(api_key="sk-test", client=client)
    out = ann.annotate(_row())
    assert out["error"].startswith("refusal")
    assert out["mentions"] == []


def test_unparseable_output_is_recorded_rather_than_crashing_the_run():
    bad = SimpleNamespace(
        stop_reason="end_turn", stop_details=None, model="claude-opus-5",
        content=[SimpleNamespace(type="text", text="I could not do that.")],
    )
    client = _FakeClient(bad)
    ann = preannotate.AnthropicAnnotator(api_key="sk-test", client=client)
    out = ann.annotate(_row())
    assert "error" in out
    assert out["mentions"] == []


# --- blind rows --------------------------------------------------------------
def test_blind_rows_get_no_suggestions_and_are_never_sent_to_the_model():
    client = _FakeClient(_response(RECORDED))
    ann = preannotate.AnthropicAnnotator(api_key="sk-test", client=client)

    blind = _row("b", blind=True)
    blind["item"]["desc"] = "SENTINEL-BLIND-CAPTION"
    payload = preannotate.build_suggestions([_row("a"), blind], ann)

    assert payload["items"][0]["suggestions"] is not None
    assert payload["items"][1]["suggestions"] is None
    # One call, and nothing from the blind row's content is in it — a leaked
    # suggestion would destroy the anchoring-bias measurement it exists for.
    assert len(client.calls) == 1
    assert "SENTINEL-BLIND-CAPTION" not in json.dumps(client.calls)


def test_blind_share_is_reported_so_the_bias_control_is_visible():
    client = _FakeClient(_response(RECORDED))
    ann = preannotate.AnthropicAnnotator(api_key="sk-test", client=client)
    payload = preannotate.build_suggestions([_row("a"), _row("b", blind=True)], ann)
    assert payload["blind_n"] == 1
    assert payload["n"] == 2


# --- family stamping (the independence claim) --------------------------------
def test_the_model_family_is_stamped_on_the_payload_and_every_item():
    client = _FakeClient(_response(RECORDED))
    ann = preannotate.AnthropicAnnotator(api_key="sk-test", client=client)
    payload = preannotate.build_suggestions([_row("a"), _row("b", blind=True)], ann)

    assert payload["preannotator_family"] == "anthropic"
    assert payload["preannotator_model"] == "claude-opus-5"
    for item in payload["items"]:
        assert item["preannotator_family"] == "anthropic"


def test_a_substituted_family_is_stamped_on_every_affected_record():
    # A non-Claude pre-annotator weakens the anti-correlated-error claim, so it
    # can never be silent: the substitution rides on the artifact itself.
    class _Gemini:
        family = "google"
        model = "gemini-3.6-flash"

        def annotate(self, row):
            return {"mentions": [], "concepts": [], "facets": {}, "claims": []}

    payload = preannotate.build_suggestions([_row("a")], _Gemini())
    assert payload["preannotator_family"] == "google"
    assert payload["items"][0]["preannotator_family"] == "google"
    assert payload["family_substituted"] is True
    assert "correlated" in payload["substitution_warning"].lower()


def test_the_claude_family_is_not_flagged_as_a_substitution():
    client = _FakeClient(_response(RECORDED))
    ann = preannotate.AnthropicAnnotator(api_key="sk-test", client=client)
    payload = preannotate.build_suggestions([_row("a")], ann)
    assert payload["family_substituted"] is False
    assert "substitution_warning" not in payload


# --- the sample row passes through untouched --------------------------------
def test_sample_metadata_rides_through_to_the_review_tool():
    client = _FakeClient(_response(RECORDED))
    ann = preannotate.AnthropicAnnotator(api_key="sk-test", client=client)
    row = _row("a")
    row["hard_case_seeds"] = ["chain_restaurant"]
    item = preannotate.build_suggestions([row], ann)["items"][0]
    assert item["stratum"] == row["stratum"]
    assert item["weight"] == 77.6
    assert item["content_bucket"] == "food_place"
    assert item["hard_case_seeds"] == ["chain_restaurant"]
    assert item["item"]["desc"] == "best slice in town"


# --- CLI ---------------------------------------------------------------------
def test_cli_fails_with_an_actionable_message_when_the_key_is_missing(
    monkeypatch, tmp_path, capsys
):
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    sample_path = tmp_path / "sample.jsonl"
    sample_path.write_text(json.dumps(_row()) + "\n")
    code = preannotate.main(
        [
            "--sample", str(sample_path),
            "--out", str(tmp_path / "s.json"),
            "--env", str(tmp_path / "absent.env"),
        ]
    )
    assert code != 0
    err = capsys.readouterr().err
    assert "ANTHROPIC_API_KEY" in err
    assert ".env.local" in err
    assert not (tmp_path / "s.json").exists()


def test_cli_refuses_a_different_family_without_the_explicit_flag(monkeypatch, tmp_path, capsys):
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    sample_path = tmp_path / "sample.jsonl"
    sample_path.write_text(json.dumps(_row()) + "\n")
    code = preannotate.main(
        [
            "--sample", str(sample_path),
            "--out", str(tmp_path / "s.json"),
            "--family", "google",
            "--env", str(tmp_path / "absent.env"),
        ]
    )
    assert code != 0
    err = capsys.readouterr().err
    assert "--i-accept-a-weaker-independence-claim" in err
    assert "5.1" in err


def test_cli_dry_run_builds_the_payload_shape_without_a_key(monkeypatch, tmp_path, capsys):
    # Lets the review tool be exercised end-to-end before the key exists.
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    sample_path = tmp_path / "sample.jsonl"
    sample_path.write_text(json.dumps(_row("a")) + "\n" + json.dumps(_row("b", blind=True)) + "\n")
    out = tmp_path / "s.json"
    code = preannotate.main(
        ["--sample", str(sample_path), "--out", str(out), "--dry-run", "--env", str(tmp_path / "x")]
    )
    assert code == 0
    payload = json.loads(out.read_text())
    assert payload["preannotator_family"] == "none"
    assert payload["dry_run"] is True
    assert payload["items"][0]["suggestions"] == {
        "mentions": [], "concepts": [], "facets": {}, "claims": []
    }
    assert payload["items"][1]["suggestions"] is None


def test_dry_run_output_is_loadable_by_the_review_tool(tmp_path):
    # The contract between the two halves, asserted rather than assumed.
    import shutil
    import subprocess

    if shutil.which("node") is None:
        pytest.skip("node required")

    payload = preannotate.build_suggestions(
        [_row("a"), _row("b", blind=True)], preannotate.NullAnnotator()
    )
    (tmp_path / "s.json").write_text(json.dumps(payload))

    html = (
        preannotate.__file__.replace("preannotate.py", "review.html")
    )
    import re

    core = re.search(
        r'<script id="gold-core">(.*?)</script>',
        open(html, encoding="utf-8").read(),
        re.DOTALL,
    ).group(1)

    driver = f"""
    const payload = JSON.parse(require('fs').readFileSync({json.dumps(str(tmp_path / 's.json'))}, 'utf8'));
    const s = CPL.newSession(payload);
    console.log(JSON.stringify({{
      items: s.items.length,
      blind: s.items.map(i => i.blind),
      ids: s.items.map(i => i.item_id),
      strata: s.items.map(i => i.stratum_key),
    }}));
    """
    script = tmp_path / "d.cjs"
    script.write_text(core + "\n" + driver)
    proc = subprocess.run(["node", str(script)], capture_output=True, text=True, timeout=60)
    assert proc.returncode == 0, proc.stderr
    result = json.loads(proc.stdout)
    assert result["items"] == 2
    assert result["blind"] == [False, True]
    assert result["ids"] == ["a", "b"]
    assert result["strata"] == ["vtt=1|slide=0|dur=2", "vtt=1|slide=0|dur=2"]
