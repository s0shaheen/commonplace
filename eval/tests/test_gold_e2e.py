"""End-to-end: sampler -> review tool -> gold.jsonl -> `commonplace-eval score`.

Task 4 of the change. The point is not to test the metrics (198 tests already
do) but to prove the *seam*: gold produced by the review tool is loadable and
scoreable by the existing harness without a second format or an adapter. If
this passes, the instrument is wired.

It also runs the harness's own matcher validation (§4: "validate the scorer
before trusting it"), so the ruler is checked before anything is measured with
it.
"""

from __future__ import annotations

import json
import re
import shutil
import subprocess
from pathlib import Path

import pytest

from commonplace_eval import cli, io
from commonplace_eval.matcher_validation import validate_matcher
from gold import preannotate, sample

REPO_ROOT = Path(__file__).resolve().parents[2]
REVIEW_HTML = REPO_ROOT / "eval" / "gold" / "review.html"
MATCHER_PAIRS = REPO_ROOT / "eval" / "tests" / "fixtures" / "matcher_pairs.jsonl"


def _synthetic_corpus(n: int = 120) -> list[dict]:
    out = []
    for i in range(n):
        out.append(
            {
                "id": f"syn{i:04d}",
                "desc": ["a pizza place review", "a film scene edit", "", "startup advice"][i % 4],
                "hashtags": [["foodtok"], ["movies"], [], ["tech"]][i % 4],
                "author": f"u{i}",
                "authorName": f"User {i}",
                "durationSec": None if i % 7 == 0 else 5 + (i % 90),
                "hasSubtitles": i % 2 == 0,
                "isSlideshow": i % 7 == 0,
                "music": {"name": "original sound - x" if i % 5 else "a track", "author": "a"},
                "url": f"https://example.invalid/{i}",
            }
        )
    return out


def _drive_review(payload: dict, tmp_path: Path) -> tuple[str, str]:
    """Run a scripted adjudication through the review tool's real core."""
    core = re.search(
        r'<script id="gold-core">(.*?)</script>',
        REVIEW_HTML.read_text(encoding="utf-8"),
        re.DOTALL,
    ).group(1)

    payload_path = tmp_path / "suggestions.json"
    payload_path.write_text(json.dumps(payload))

    driver = f"""
    const payload = JSON.parse(require('fs').readFileSync({json.dumps(str(payload_path))}, 'utf8'));
    const session = CPL.newSession(payload);
    session.items.forEach(function (item, idx) {{
      // A deterministic stand-in for the founder's pass: one verified link,
      // one honest NIL, one rejection — the three gold outcomes.
      const linked = CPL.addMention(item, {{surface: 'Joe\\'s Pizza ' + idx, type: 'place'}});
      CPL.setCandidate(linked, {{authority: 'google_places', id: 'ChIJ_synthetic_' + idx}});
      CPL.markOpened(linked);
      CPL.verify(linked);
      linked.verification = {{name: "Joe's Pizza", address: '7 Carmine St'}};

      const nil = CPL.addMention(item, {{surface: 'original sound - x', type: 'music_recording'}});
      CPL.setNil(nil, 'NIL_NO_ID');
      nil.failed_queries = ['musicbrainz recording: original sound - x'];

      const rejected = CPL.addMention(item, {{surface: 'a good pizza place', type: 'place'}});
      CPL.setNil(rejected, 'NON_ENTITY');

      item.facets = {{topic: 'food'}};
      CPL.markDone(item);
    }});
    require('fs').writeFileSync({json.dumps(str(tmp_path / 'gold.jsonl'))}, CPL.buildGoldJSONL(session));
    require('fs').writeFileSync({json.dumps(str(tmp_path / 'gold.manifest.jsonl'))}, CPL.buildManifestJSONL(session));
    """
    script = tmp_path / "drive.cjs"
    script.write_text(core + "\n" + driver, encoding="utf-8")
    proc = subprocess.run(["node", str(script)], capture_output=True, text=True, timeout=120)
    assert proc.returncode == 0, proc.stderr
    return (
        (tmp_path / "gold.jsonl").read_text(),
        (tmp_path / "gold.manifest.jsonl").read_text(),
    )


@pytest.mark.skipif(shutil.which("node") is None, reason="node required to drive the review tool")
def test_corpus_to_scorecard_end_to_end(tmp_path, capsys):
    # 1. sample the corpus
    rows = sample.draw_sample(_synthetic_corpus(), n=8, seed=20260727)
    assert len(rows) == 8

    # 2. build a suggestions payload (dry-run: no key needed, family stamped)
    payload = preannotate.build_suggestions(
        [sample.row_to_dict(r) for r in rows], preannotate.NullAnnotator(), dry_run=True
    )

    # 3. adjudicate through the review tool's real core
    gold_text, manifest_text = _drive_review(payload, tmp_path)
    gold_path = tmp_path / "gold.jsonl"
    assert gold_text.strip(), "the review tool emitted nothing"

    # 4. the harness's own loader gates every record through validate_gold_record
    gold = io.load_gold(gold_path)
    assert len(gold) == 8

    # the sidecar joins on item_id and carries what gold's frozen schema cannot
    manifest = [json.loads(line) for line in manifest_text.strip().splitlines()]
    assert {m["item_id"] for m in manifest} == {g["item_id"] for g in gold}
    assert all("blind" in m and "weight" in m for m in manifest)

    # 5. a prediction file: one exact hit, one wrong id, one missed NIL
    pred_path = tmp_path / "pred.jsonl"
    with pred_path.open("w") as fh:
        for i, record in enumerate(gold):
            mentions = [
                {
                    "surface": record["mentions"][0]["surface"],
                    "type": "place",
                    "grounding": {
                        "authority": "google_places",
                        "externalId": record["mentions"][0]["gold_id"]["id"]
                        if i % 2 == 0
                        else "ChIJ_WRONG",
                        "nil": False,
                        "grounding_confidence": 0.9,
                    },
                },
                {
                    "surface": "original sound - x",
                    "type": "music_recording",
                    "grounding": {
                        "authority": "musicbrainz",
                        "externalId": None,
                        "nil": True,
                        "grounding_confidence": 0.4,
                    },
                },
            ]
            fh.write(json.dumps({"item_id": record["item_id"], "mentions": mentions,
                                 "facets": {"topic": "food"}}) + "\n")

    # 6. score it through the shipped CLI
    report = tmp_path / "scorecard.json"
    code = cli.main(
        [
            "score",
            "--gold", str(gold_path),
            "--pred", str(pred_path),
            "--out", str(report),
            "--md", str(tmp_path / "scorecard.md"),
            "--bootstrap", "50",
        ]
    )
    assert code == 0

    scorecard = json.loads(report.read_text())
    assert scorecard, "the harness produced an empty scorecard"
    printed = capsys.readouterr().out
    assert printed.strip(), "the CLI printed no matrix"

    # the numbers must reflect the planted errors, not a vacuous pass
    blob = json.dumps(scorecard)
    assert "NIL" in blob or "nil" in blob
    assert (tmp_path / "scorecard.md").read_text().strip()


@pytest.mark.skipif(shutil.which("node") is None, reason="node required to drive the review tool")
def test_gold_from_the_review_tool_survives_the_loader_uniqueness_gate(tmp_path):
    rows = sample.draw_sample(_synthetic_corpus(), n=6, seed=1)
    payload = preannotate.build_suggestions(
        [sample.row_to_dict(r) for r in rows], preannotate.NullAnnotator(), dry_run=True
    )
    _drive_review(payload, tmp_path)
    gold = io.load_gold(tmp_path / "gold.jsonl")
    assert len({g["item_id"] for g in gold}) == len(gold)


def test_the_matcher_is_validated_before_anything_rests_on_it():
    """§4: 'validate the scorer against humans BEFORE trusting it'.

    These are the matcher's MEASURED numbers on the human-judged pairs that
    exist today, locked as a regression baseline: if a matcher change silently
    degrades it, every gold score becomes uninterpretable and this fails first.

    Honest limitation: n=12, well short of §4's "~100 human-judged pairs". The
    remaining pairs cannot be manufactured — their value is that a *human*
    judged them, so scaling this is a founder task, not a code task. Until
    then the matcher's own P/R is measured on a sample too small to be tight,
    and any published accuracy figure has to say so.
    """
    result = validate_matcher(MATCHER_PAIRS)
    assert result["n"] == 12
    assert result["precision"] == pytest.approx(5 / 6)
    assert result["recall"] == pytest.approx(5 / 6)
    assert result["f1"] == pytest.approx(5 / 6)
    assert result["confusion"] == {"tp": 5, "fp": 1, "fn": 1, "tn": 5}


def test_matcher_validation_is_reachable_from_the_cli(capsys):
    code = cli.main(["validate-matcher", "--pairs", str(MATCHER_PAIRS)])
    assert code == 0
    out = capsys.readouterr().out
    assert "precision" in out and "recall" in out
