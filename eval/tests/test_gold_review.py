"""The local review tool (`eval/gold/review.html`) — tasks 3.1-3.4 + 4.1.

The tool is one self-contained HTML file with no server and no build step, so
its logic is tested the way it actually runs: the pure `gold-core` script block
is extracted, executed in node, driven through a simulated adjudication
session, and the gold JSONL it emits is validated with the harness's own
`schema_gate.validate_gold_record`. That closes the loop the design cares
about — "the emitted records validate against the gate the harness already
uses" — rather than asserting on a hand-written fixture that could drift.
"""

from __future__ import annotations

import json
import re
import shutil
import subprocess
import textwrap
from pathlib import Path

import pytest

from commonplace_eval.schema_gate import validate_gold_record

REPO_ROOT = Path(__file__).resolve().parents[2]
REVIEW_HTML = REPO_ROOT / "eval" / "gold" / "review.html"
FACET_VOCAB = REPO_ROOT / "schema" / "vocab" / "facets.json"
GOLD_SCHEMA = REPO_ROOT / "schema" / "json" / "gold.schema.json"

pytestmark = pytest.mark.skipif(
    shutil.which("node") is None, reason="node is required to drive the review tool's core"
)


# --- harness -----------------------------------------------------------------
def _core_source() -> str:
    """Extract the pure-logic `gold-core` script block from the HTML file."""
    html = REVIEW_HTML.read_text(encoding="utf-8")
    match = re.search(
        r'<script id="gold-core">(.*?)</script>', html, re.DOTALL
    )
    assert match, "review.html must expose its pure logic in <script id=\"gold-core\">"
    return match.group(1)


def _run_core(driver: str, tmp_path: Path) -> str:
    """Run `driver` (JS) with the review tool's core in scope; return stdout."""
    script = tmp_path / "drive.cjs"
    script.write_text(_core_source() + "\n" + textwrap.dedent(driver), encoding="utf-8")
    proc = subprocess.run(
        ["node", str(script)], capture_output=True, text=True, timeout=60
    )
    assert proc.returncode == 0, f"node failed:\n{proc.stderr}"
    return proc.stdout


def _suggestions_fixture() -> dict:
    """A synthetic suggestions payload. No real user content — the corpus is PII."""
    return {
        "version": "1.0",
        "preannotator_family": "anthropic",
        "preannotator_model": "claude-opus-5",
        "items": [
            {
                "item_id": "syn_0001",
                "blind": False,
                "stratum": {"has_vtt": True, "is_slideshow": False, "duration_tercile": 2},
                "stratum_key": "vtt=1|slide=0|dur=2",
                "content_bucket": "food_place",
                "weight": 77.6,
                "hard_case_seeds": ["chain_restaurant"],
                "item": {
                    "id": "syn_0001",
                    "desc": "the best slice in town",
                    "hashtags": ["foodtok"],
                    "url": "https://example.invalid/1",
                    "cover": "https://example.invalid/1.jpg",
                    "music": {"name": "a studio track", "author": "artist"},
                    "durationSec": 30,
                },
                "content": {"transcript": "best slice is Joe's on Bleecker"},
                "suggestions": {
                    "mentions": [
                        {
                            "surface": "Joe's Pizza",
                            "type": "place",
                            "aliases": ["Joes Pizza"],
                            "candidates": [
                                {
                                    "authority": "google_places",
                                    "id": "ChIJrw7QBK9YwokRVs3v7O8oULU",
                                    "label": "Joe's Pizza, Carmine St",
                                }
                            ],
                        },
                        {
                            "surface": "a good pizza place",
                            "type": "place",
                            "candidates": [],
                        },
                        {
                            "surface": "original sound - creator123",
                            "type": "music_recording",
                            "candidates": [],
                        },
                    ],
                    "concepts": [{"concept_id": "Q177", "authority": "wikidata", "label": "pizza"}],
                    "facets": {"topic": "food", "intent": "recommendation"},
                    "claims": [{"statement": "it is worth the queue"}],
                },
            },
            {
                "item_id": "syn_0002",
                "blind": True,
                "stratum": {"has_vtt": False, "is_slideshow": True, "duration_tercile": 1},
                "stratum_key": "vtt=0|slide=1|dur=1",
                "content_bucket": "dark_matter",
                "weight": 80.6,
                "hard_case_seeds": [],
                "item": {"id": "syn_0002", "desc": "", "hashtags": [], "url": "https://example.invalid/2"},
                "suggestions": None,
            },
        ],
    }


# --- self-containment --------------------------------------------------------
def test_review_html_exists_and_is_a_single_file():
    assert REVIEW_HTML.is_file()


def test_review_html_loads_no_external_assets():
    html = REVIEW_HTML.read_text(encoding="utf-8")
    assert not re.search(r"<script[^>]*\ssrc=", html), "no external scripts"
    assert not re.search(r"<link[^>]*rel=[\"']?stylesheet", html), "no external stylesheets"
    assert not re.search(r"<img[^>]*\ssrc=[\"']https?://(?!\{)", html), "no hardcoded remote images"
    assert "@import" not in html


def test_review_html_needs_no_build_step():
    html = REVIEW_HTML.read_text(encoding="utf-8")
    assert html.lstrip().lower().startswith("<!doctype html")
    assert 'type="module"' not in html  # file:// modules are blocked by CORS


# --- inlined vocabularies must not drift ------------------------------------
def test_inlined_facet_vocab_matches_the_frozen_vocab():
    core = _core_source()
    match = re.search(r"const FACET_VOCAB = (\{.*?\});", core, re.DOTALL)
    assert match, "review.html must inline the facet vocabulary"
    inlined = json.loads(match.group(1))
    frozen = {
        name: spec["values"]
        for name, spec in json.loads(FACET_VOCAB.read_text())["facets"].items()
    }
    assert inlined == frozen


def test_inlined_entity_types_match_the_gold_schema():
    core = _core_source()
    match = re.search(r"const TYPES = (\[.*?\]);", core, re.DOTALL)
    assert match, "review.html must inline the entity type enum"
    inlined = json.loads(match.group(1))
    schema = json.loads(GOLD_SCHEMA.read_text())
    frozen = schema["$defs"]["GoldMention"]["properties"]["type"]["enum"]
    assert inlined == frozen


# --- authority links (the verification gate's target) ------------------------
def test_authority_urls_point_at_the_real_records(tmp_path):
    out = _run_core(
        """
        const cases = [
          ['musicbrainz', 'a1b2c3d4-0000-0000-0000-000000000001'],
          ['wikidata', 'Q42'],
          ['google_places', 'ChIJrw7QBK9YwokRVs3v7O8oULU'],
          ['openlibrary', 'OL45804W'],
        ];
        console.log(JSON.stringify(cases.map(([a, id]) => CPL.authorityUrl(a, id))));
        """,
        tmp_path,
    )
    urls = json.loads(out)
    assert "musicbrainz.org/recording/a1b2c3d4-0000-0000-0000-000000000001" in urls[0]
    assert "wikidata.org/wiki/Q42" in urls[1]
    assert "place_id:ChIJrw7QBK9YwokRVs3v7O8oULU" in urls[2]
    assert "openlibrary.org" in urls[3]


def test_search_urls_exist_for_finding_a_candidate_by_hand(tmp_path):
    out = _run_core(
        """
        console.log(JSON.stringify({
          mb: CPL.searchUrl('musicbrainz', "Kill Bill"),
          wd: CPL.searchUrl('wikidata', "Dune Part Two"),
          gp: CPL.searchUrl('google_places', "Joe's Pizza Bleecker"),
        }));
        """,
        tmp_path,
    )
    urls = json.loads(out)
    assert "musicbrainz.org" in urls["mb"] and "Kill%20Bill" in urls["mb"].replace("+", "%20")
    assert "wikidata.org" in urls["wd"]
    assert "google.com/maps" in urls["gp"]


# --- the ID-verification gate (methodology §5.2, spec scenario) --------------
def test_an_id_cannot_be_verified_until_its_record_has_been_opened(tmp_path):
    out = _run_core(
        """
        const m = CPL.newMention({surface: 'Joe\\'s Pizza', type: 'place',
          candidates: [{authority: 'google_places', id: 'ChIJ_test'}]});
        const before = CPL.verify(m);
        const beforeVerified = m.verified === true;   // captured BEFORE the retry
        CPL.markOpened(m);
        const after = CPL.verify(m);
        console.log(JSON.stringify({before: before, beforeVerified: beforeVerified}));
        console.log(JSON.stringify({after: after, afterVerified: m.verified === true}));
        """,
        tmp_path,
    )
    before, after = [json.loads(line) for line in out.strip().splitlines()]
    assert before["before"]["ok"] is False
    assert "open" in before["before"]["error"].lower()
    assert before["beforeVerified"] is False
    assert after["after"]["ok"] is True
    assert after["afterVerified"] is True


def test_changing_the_candidate_id_revokes_verification(tmp_path):
    # Verifying record A then pasting id B must not inherit A's verification.
    out = _run_core(
        """
        const m = CPL.newMention({surface: 'X', type: 'place',
          candidates: [{authority: 'google_places', id: 'ChIJ_A'}]});
        CPL.markOpened(m); CPL.verify(m);
        const wasVerified = m.verified === true;
        CPL.setCandidate(m, {authority: 'google_places', id: 'ChIJ_B'});
        console.log(JSON.stringify({wasVerified, nowVerified: m.verified === true,
                                    nowOpened: m.opened === true}));
        """,
        tmp_path,
    )
    r = json.loads(out)
    assert r["wasVerified"] is True
    assert r["nowVerified"] is False
    assert r["nowOpened"] is False


def test_an_unverified_mention_blocks_the_item_from_being_emitted(tmp_path):
    out = _run_core(
        """
        const m = CPL.newMention({surface: 'X', type: 'place',
          candidates: [{authority: 'google_places', id: 'ChIJ_A'}]});
        m.decision = 'linked';
        const item = CPL.newItem({item_id: 'i1', suggestions: {mentions: []}});
        item.mentions = [m];
        console.log(JSON.stringify(CPL.itemIssues(item)));
        """,
        tmp_path,
    )
    issues = json.loads(out)
    assert any("verif" in i.lower() or "open" in i.lower() for i in issues)


# --- NIL is first-class ------------------------------------------------------
def test_nil_no_id_requires_failed_queries(tmp_path):
    out = _run_core(
        """
        const item = CPL.newItem({item_id: 'i1', suggestions: {mentions: []}});
        const m = CPL.newMention({surface: 'original sound - x', type: 'music_recording'});
        item.mentions = [m];
        CPL.setNil(m, 'NIL_NO_ID');
        const without = CPL.itemIssues(item);
        m.failed_queries = ['musicbrainz recording: original sound - x'];
        const with_ = CPL.itemIssues(item);
        console.log(JSON.stringify({without, with_}));
        """,
        tmp_path,
    )
    r = json.loads(out)
    assert any("failed" in i.lower() for i in r["without"])
    assert r["with_"] == []


def test_non_entity_is_recorded_not_deleted(tmp_path):
    out = _run_core(
        """
        const item = CPL.newItem({item_id: 'i1', suggestions: {mentions: []}});
        const m = CPL.newMention({surface: 'a good pizza place', type: 'place'});
        item.mentions = [m];
        CPL.setNil(m, 'NON_ENTITY');
        console.log(JSON.stringify(CPL.buildGoldRecord(item)));
        """,
        tmp_path,
    )
    record = json.loads(out)
    assert record["mentions"][0]["nil"] == "NON_ENTITY"
    assert "gold_id" not in record["mentions"][0]
    assert validate_gold_record(record) == []


# --- the round trip: suggestions -> simulated session -> valid gold ---------
def test_round_trip_emits_gold_that_passes_the_harness_gate(tmp_path):
    (tmp_path / "suggestions.json").write_text(json.dumps(_suggestions_fixture()))
    out = _run_core(
        f"""
        const fs = require('fs');
        const payload = JSON.parse(fs.readFileSync({json.dumps(str(tmp_path / 'suggestions.json'))}, 'utf8'));
        const session = CPL.newSession(payload);

        // item 1: assisted. Accept the place, verify its id, NIL the sound,
        // reject the category surface, and add a mention the model missed.
        const a = session.items[0];
        CPL.acceptAll(a);

        const place = a.mentions[0];
        CPL.markOpened(place);
        CPL.verify(place);
        place.verification = {{name: "Joe's Pizza", address: '7 Carmine St', lat: 40.7305, lng: -74.0027}};
        place.hard_case = true;
        place.notes = 'channel=VERBAL_AUDIO; quote="best slice is Joe\\'s on Bleecker"; t=8,13';

        CPL.setNil(a.mentions[1], 'NON_ENTITY');
        CPL.setNil(a.mentions[2], 'NIL_NO_ID');
        a.mentions[2].failed_queries = ['musicbrainz recording: creator123 original sound'];

        const added = CPL.addMention(a, {{surface: 'SZA', type: 'person'}});
        CPL.setCandidate(added, {{authority: 'wikidata', id: 'Q21621853'}});
        CPL.markOpened(added);
        CPL.verify(added);

        // item 2: blind. Nothing suggested; annotate from scratch.
        const b = session.items[1];
        const fresh = CPL.addMention(b, {{surface: 'Dune: Part Two', type: 'screen_work'}});
        CPL.setCandidate(fresh, {{authority: 'wikidata', id: 'Q60705'}});
        CPL.markOpened(fresh);
        CPL.verify(fresh);

        CPL.markDone(a); CPL.markDone(b);
        process.stdout.write(CPL.buildGoldJSONL(session));
        """,
        tmp_path,
    )

    records = [json.loads(line) for line in out.strip().splitlines()]
    assert len(records) == 2

    for record in records:
        assert validate_gold_record(record) == [], record

    first = records[0]
    assert first["item_id"] == "syn_0001"
    assert first["strata"] == {"has_vtt": True, "is_slideshow": False, "duration_tercile": 2}
    assert first["facets"] == {"topic": "food", "intent": "recommendation"}

    by_surface = {m["surface"]: m for m in first["mentions"]}
    assert by_surface["Joe's Pizza"]["gold_id"] == {
        "authority": "google_places",
        "id": "ChIJrw7QBK9YwokRVs3v7O8oULU",
    }
    assert by_surface["Joe's Pizza"]["verification"]["address"] == "7 Carmine St"
    assert by_surface["Joe's Pizza"]["kb_snapshot"]["authority"] == "google_places"
    assert by_surface["Joe's Pizza"]["hard_case"] is True
    assert by_surface["a good pizza place"]["nil"] == "NON_ENTITY"
    assert by_surface["original sound - creator123"]["nil"] == "NIL_NO_ID"
    assert by_surface["original sound - creator123"]["failed_queries"]
    assert by_surface["SZA"]["gold_id"]["id"] == "Q21621853"

    assert [m["mention_id"] for m in first["mentions"]] == ["m1", "m2", "m3", "m4"]

    second = records[1]
    assert second["item_id"] == "syn_0002"
    assert second["mentions"][0]["gold_id"] == {"authority": "wikidata", "id": "Q60705"}
    assert "facets" not in second


def test_blind_rows_carry_no_suggestions_into_the_session(tmp_path):
    (tmp_path / "s.json").write_text(json.dumps(_suggestions_fixture()))
    out = _run_core(
        f"""
        const fs = require('fs');
        const session = CPL.newSession(JSON.parse(fs.readFileSync({json.dumps(str(tmp_path / 's.json'))}, 'utf8')));
        console.log(JSON.stringify({{
          blind: session.items.map(i => i.blind),
          mentionCounts: session.items.map(i => i.mentions.length),
          facets: session.items.map(i => Object.keys(i.facets).length),
        }}));
        """,
        tmp_path,
    )
    r = json.loads(out)
    assert r["blind"] == [False, True]
    assert r["mentionCounts"] == [3, 0]
    assert r["facets"] == [2, 0]


def test_incomplete_items_are_skipped_not_half_emitted(tmp_path):
    (tmp_path / "s.json").write_text(json.dumps(_suggestions_fixture()))
    out = _run_core(
        f"""
        const fs = require('fs');
        const session = CPL.newSession(JSON.parse(fs.readFileSync({json.dumps(str(tmp_path / 's.json'))}, 'utf8')));
        const b = session.items[1];
        CPL.markDone(b);
        const jsonl = CPL.buildGoldJSONL(session);
        console.log(JSON.stringify({{
          lines: jsonl.trim() ? jsonl.trim().split('\\n').length : 0,
          progress: CPL.progress(session),
        }}));
        """,
        tmp_path,
    )
    r = json.loads(out)
    assert r["lines"] == 1
    assert r["progress"]["done"] == 1
    assert r["progress"]["total"] == 2


def test_facet_values_are_constrained_to_the_frozen_vocabulary(tmp_path):
    out = _run_core(
        """
        const item = CPL.newItem({item_id: 'i1', suggestions: {mentions: []}});
        item.facets = {topic: 'not_a_real_value'};
        const bad = CPL.itemIssues(item);
        item.facets = {topic: 'food'};
        const good = CPL.itemIssues(item);
        console.log(JSON.stringify({bad, good}));
        """,
        tmp_path,
    )
    r = json.loads(out)
    assert any("facet" in i.lower() for i in r["bad"])
    assert r["good"] == []


def test_empty_layers_are_omitted_rather_than_emitted_empty(tmp_path):
    # gold.schema.json is `additionalProperties: false`; empty arrays are legal
    # but noisy, and an empty `facets` would be indistinguishable from "the
    # annotator judged there to be none".
    out = _run_core(
        """
        const item = CPL.newItem({item_id: 'i1', suggestions: {mentions: []}});
        console.log(JSON.stringify(CPL.buildGoldRecord(item)));
        """,
        tmp_path,
    )
    record = json.loads(out)
    assert set(record) == {"item_id"}
    assert validate_gold_record(record) == []


def test_session_state_serialises_for_localstorage_resume(tmp_path):
    (tmp_path / "s.json").write_text(json.dumps(_suggestions_fixture()))
    out = _run_core(
        f"""
        const fs = require('fs');
        const payload = JSON.parse(fs.readFileSync({json.dumps(str(tmp_path / 's.json'))}, 'utf8'));
        const session = CPL.newSession(payload);
        CPL.setNil(session.items[0].mentions[0], 'NON_ENTITY');
        CPL.markDone(session.items[0]);
        const saved = CPL.serialize(session);
        const restored = CPL.deserialize(JSON.parse(JSON.stringify(saved)));
        console.log(JSON.stringify({{
          id: session.id === restored.id,
          done: CPL.progress(restored).done,
          nil: restored.items[0].mentions[0].nil,
          sameJsonl: CPL.buildGoldJSONL(session) === CPL.buildGoldJSONL(restored),
        }}));
        """,
        tmp_path,
    )
    r = json.loads(out)
    assert r["id"] is True
    assert r["done"] == 1
    assert r["nil"] == "NON_ENTITY"
    assert r["sameJsonl"] is True


def test_session_id_is_derived_from_the_payload_so_resume_matches_the_file(tmp_path):
    (tmp_path / "s.json").write_text(json.dumps(_suggestions_fixture()))
    out = _run_core(
        f"""
        const fs = require('fs');
        const payload = JSON.parse(fs.readFileSync({json.dumps(str(tmp_path / 's.json'))}, 'utf8'));
        const a = CPL.newSession(payload).id;
        const b = CPL.newSession(JSON.parse(JSON.stringify(payload))).id;
        const other = JSON.parse(JSON.stringify(payload));
        other.items[0].item_id = 'different';
        const c = CPL.newSession(other).id;
        console.log(JSON.stringify({{same: a === b, different: a !== c, nonEmpty: a.length > 0}}));
        """,
        tmp_path,
    )
    r = json.loads(out)
    assert r["same"] is True
    assert r["different"] is True
    assert r["nonEmpty"] is True


def test_manifest_carries_blind_stratum_and_weight_beside_gold(tmp_path):
    # `gold.schema.json` is frozen and closed, so the blind flag / design weight
    # / stratum cannot ride on the gold record. They ship in a sidecar joined on
    # item_id — that pairing is what the assisted-vs-blind recall gap needs.
    (tmp_path / "s.json").write_text(json.dumps(_suggestions_fixture()))
    out = _run_core(
        f"""
        const fs = require('fs');
        const session = CPL.newSession(JSON.parse(fs.readFileSync({json.dumps(str(tmp_path / 's.json'))}, 'utf8')));
        session.items.forEach(i => {{ i.mentions.forEach(m => CPL.setNil(m, 'NON_ENTITY')); CPL.markDone(i); }});
        process.stdout.write(CPL.buildManifestJSONL(session));
        """,
        tmp_path,
    )
    rows = [json.loads(line) for line in out.strip().splitlines()]
    assert [r["item_id"] for r in rows] == ["syn_0001", "syn_0002"]
    assert rows[0]["blind"] is False and rows[1]["blind"] is True
    assert rows[0]["weight"] == 77.6
    assert rows[0]["stratum"]["duration_tercile"] == 2
    assert rows[0]["hard_case_seeds"] == ["chain_restaurant"]
    assert rows[0]["preannotator_family"] == "anthropic"
    assert "ms_spent" in rows[0]


def test_manifest_and_gold_line_up_one_to_one(tmp_path):
    (tmp_path / "s.json").write_text(json.dumps(_suggestions_fixture()))
    out = _run_core(
        f"""
        const fs = require('fs');
        const session = CPL.newSession(JSON.parse(fs.readFileSync({json.dumps(str(tmp_path / 's.json'))}, 'utf8')));
        CPL.markDone(session.items[1]);
        console.log(JSON.stringify({{
          gold: CPL.buildGoldJSONL(session).trim().split('\\n').filter(Boolean).length,
          manifest: CPL.buildManifestJSONL(session).trim().split('\\n').filter(Boolean).length,
        }}));
        """,
        tmp_path,
    )
    r = json.loads(out)
    assert r["gold"] == r["manifest"] == 1


def test_every_script_block_in_the_page_parses(tmp_path):
    # The UI layer touches the DOM so it cannot be executed headlessly, but a
    # syntax error there ships a blank page with no test catching it. `node
    # --check` parses without executing, which is exactly the guard needed.
    html = REVIEW_HTML.read_text(encoding="utf-8")
    blocks = re.findall(r"<script(?![^>]*\ssrc=)[^>]*>(.*?)</script>", html, re.DOTALL)
    assert len(blocks) >= 2, "expected the core block and the UI block"
    for i, block in enumerate(blocks):
        path = tmp_path / f"block{i}.js"
        path.write_text(block, encoding="utf-8")
        proc = subprocess.run(
            ["node", "--check", str(path)], capture_output=True, text=True, timeout=60
        )
        assert proc.returncode == 0, f"script block {i} does not parse:\n{proc.stderr}"


# --- keyboard-first affordances are actually documented in the page ---------
def test_the_shortcut_legend_is_rendered_in_the_page():
    html = REVIEW_HTML.read_text(encoding="utf-8")
    for token in ["accept all", "next", "verify", "NIL", "download"]:
        assert token.lower() in html.lower(), f"missing shortcut legend entry: {token}"
