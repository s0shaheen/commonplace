"""The stratified sampler (evaluation-methodology.md §3, tasks 1.1-1.4).

Gold is sampled from the CORPUS, never pooled from system output — so these
tests exercise the sampler against a synthetic corpus only. The real corpus
(`attic-favorites.json`) is the founder's private data and is gitignored; no
fixture here contains real user content.
"""

from __future__ import annotations

import json
from collections import Counter

import pytest

from gold import sample, strata

SEED = 20260727


def _item(
    i: int,
    *,
    vtt: bool = False,
    slideshow: bool = False,
    duration: int | None = 30,
    desc: str = "a caption about coding and software",
    hashtags: tuple[str, ...] = ("tech",),
    music: str = "a normal studio track",
) -> dict:
    return {
        "id": f"syn{i:05d}",
        "desc": desc,
        "hashtags": list(hashtags),
        "author": f"user{i}",
        "authorName": f"User {i}",
        "durationSec": duration,
        "hasSubtitles": vtt,
        "isSlideshow": slideshow,
        "music": {"name": music, "author": "artist"},
        "url": f"https://example.invalid/{i}",
        "cover": f"https://example.invalid/{i}.jpg",
        "playUrl": "https://example.invalid/SECRET-SIGNED-URL",
    }


def _corpus(n: int = 600) -> list[dict]:
    """A synthetic corpus with every stratum, every bucket, and every hard seed."""
    buckets = [
        ("a pizza restaurant review", ("foodtok",)),
        ("a startup founder explains saas", ("tech",)),
        ("this film scene edit", ("movies",)),
        ("nba highlights tonight", ("sports",)),
        ("guitar solo performance", ("music",)),
        ("", ()),  # dark matter
        ("thoughts", ("fyp",)),  # other
    ]
    out: list[dict] = []
    for i in range(n):
        desc, tags = buckets[i % len(buckets)]
        vtt = i % 2 == 0
        slideshow = i % 7 == 0
        duration = None if slideshow else (5 + (i % 90))
        out.append(
            _item(i, vtt=vtt, slideshow=slideshow, duration=duration, desc=desc, hashtags=tags)
        )
    # Rare-but-real hard cases, one small cluster per category.
    out.append(_item(9001, desc="the Starbucks on 5th and Main", hashtags=()))
    out.append(_item(9002, desc="which Chipotle is this", hashtags=()))
    out.append(_item(9003, desc="", hashtags=("severance",)))
    out.append(_item(9004, desc="rewatching the office again", hashtags=()))
    out.append(_item(9005, music="original sound - creator123"))
    out.append(_item(9006, music="Kill Bill (sped up)"))
    out.append(_item(9007, desc="코킹에서 백스윙 그리고 피니시까", hashtags=()))
    out.append(_item(9008, desc="感覚人間 フィンガードラム", hashtags=()))
    return out


# --- shape -------------------------------------------------------------------
def test_draw_sample_returns_exactly_n_distinct_items():
    rows = sample.draw_sample(_corpus(), n=60, seed=SEED)
    assert len(rows) == 60
    assert len({r.item_id for r in rows}) == 60


def test_sample_is_capped_by_corpus_size():
    corpus = _corpus(10)
    rows = sample.draw_sample(corpus, n=60, seed=SEED)
    assert len(rows) == len(corpus) < 60


def test_row_carries_stratum_in_the_gold_schema_shape():
    rows = sample.draw_sample(_corpus(), n=60, seed=SEED)
    for r in rows:
        assert set(r.stratum) == {"has_vtt", "is_slideshow", "duration_tercile"}
        assert isinstance(r.stratum["has_vtt"], bool)
        assert r.stratum["duration_tercile"] in (1, 2, 3)
        assert r.stratum_key == strata.stratum_key(r.stratum)


def test_row_item_payload_drops_signed_media_urls():
    # sample.jsonl is derived from a gitignored PII corpus; carry only what the
    # review tool renders, never the expiring signed download/play URLs.
    rows = sample.draw_sample(_corpus(), n=20, seed=SEED)
    for r in rows:
        assert "playUrl" not in r.item
        assert "downloadUrl" not in r.item
    assert {"id", "desc", "hashtags", "url", "cover"} <= set(rows[0].item)


# --- determinism -------------------------------------------------------------
def test_same_seed_reproduces_the_same_sample_in_the_same_order():
    a = sample.draw_sample(_corpus(), n=60, seed=SEED)
    b = sample.draw_sample(_corpus(), n=60, seed=SEED)
    assert [r.item_id for r in a] == [r.item_id for r in b]
    assert [r.blind for r in a] == [r.blind for r in b]


def test_a_different_seed_draws_a_different_sample():
    a = sample.draw_sample(_corpus(), n=60, seed=SEED)
    b = sample.draw_sample(_corpus(), n=60, seed=SEED + 1)
    assert {r.item_id for r in a} != {r.item_id for r in b}


def test_corpus_order_does_not_change_the_sample():
    corpus = _corpus()
    a = sample.draw_sample(corpus, n=60, seed=SEED)
    b = sample.draw_sample(list(reversed(corpus)), n=60, seed=SEED)
    assert {r.item_id for r in a} == {r.item_id for r in b}


def test_rows_are_interleaved_not_grouped_by_stratum():
    # Annotating all of one stratum in a row invites order effects; the sample
    # is emitted in a seeded shuffle so difficulty is spread across the sitting.
    rows = sample.draw_sample(_corpus(), n=60, seed=SEED)
    keys = [r.stratum_key for r in rows]
    assert keys != sorted(keys)


# --- stratification ----------------------------------------------------------
def test_every_populated_stratum_is_represented():
    corpus = _corpus()
    cuts = strata.duration_cuts([i.get("durationSec") for i in corpus])
    populated = {strata.stratum_key(strata.stratum_of(i, cuts)) for i in corpus}
    rows = sample.draw_sample(corpus, n=60, seed=SEED)
    assert {r.stratum_key for r in rows} == populated


def test_rare_strata_are_oversampled_relative_to_their_corpus_share():
    # 594 plain videos + 6 slideshows: the slideshow stratum is 1% of the
    # corpus and must not be left to proportional allocation (0.6 of 60 items).
    corpus = [_item(i, duration=30) for i in range(594)]
    corpus += [_item(900 + i, slideshow=True, duration=None) for i in range(6)]
    rows = sample.draw_sample(corpus, n=60, seed=SEED, min_per_stratum=2)
    drawn = sum(1 for r in rows if r.stratum["is_slideshow"])
    assert drawn >= 2
    assert drawn / 60 > 6 / 600


def test_allocation_never_exceeds_a_stratum_population():
    corpus = [_item(i, duration=30) for i in range(50)]
    corpus += [_item(900, slideshow=True, duration=None)]
    rows = sample.draw_sample(corpus, n=40, seed=SEED, min_per_stratum=5)
    assert sum(1 for r in rows if r.stratum["is_slideshow"]) == 1


def test_large_strata_stay_roughly_proportional():
    # 540 vtt=True vs 60 vtt=False, floor 2: the majority stratum should still
    # take the clear majority of the sample.
    corpus = [_item(i, vtt=True, duration=30) for i in range(540)]
    corpus += [_item(900 + i, vtt=False, duration=30) for i in range(60)]
    rows = sample.draw_sample(corpus, n=60, seed=SEED)
    with_vtt = sum(1 for r in rows if r.stratum["has_vtt"])
    assert 45 <= with_vtt <= 58


# --- reweighting -------------------------------------------------------------
def test_design_weight_is_population_over_allocation():
    corpus = _corpus()
    rows = sample.draw_sample(corpus, n=60, seed=SEED)
    cuts = strata.duration_cuts([i.get("durationSec") for i in corpus])
    pop = Counter(strata.stratum_key(strata.stratum_of(i, cuts)) for i in corpus)
    drawn = Counter(r.stratum_key for r in rows)
    for r in rows:
        assert r.weight == pytest.approx(pop[r.stratum_key] / drawn[r.stratum_key])


def test_weights_sum_to_the_corpus_size():
    corpus = _corpus()
    rows = sample.draw_sample(corpus, n=60, seed=SEED)
    assert sum(r.weight for r in rows) == pytest.approx(len(corpus))


# --- hard slice --------------------------------------------------------------
def test_every_hard_case_category_with_candidates_is_seeded():
    rows = sample.draw_sample(_corpus(), n=60, seed=SEED)
    seeded = {cat for r in rows for cat in r.hard_case_seeds}
    assert set(strata.HARD_CASE_CATEGORIES) <= seeded


def test_hard_slice_is_seeded_across_several_seeds():
    for offset in range(5):
        rows = sample.draw_sample(_corpus(), n=60, seed=SEED + offset)
        seeded = {cat for r in rows for cat in r.hard_case_seeds}
        assert set(strata.HARD_CASE_CATEGORIES) <= seeded, f"seed offset {offset}"


def test_a_category_with_no_candidates_is_simply_absent():
    # No chains, no ambiguous titles, no non-Latin text, no cover sounds.
    corpus = [_item(i, desc="a quiet clip", hashtags=("fyp",)) for i in range(200)]
    rows = sample.draw_sample(corpus, n=30, seed=SEED)
    assert {cat for r in rows for cat in r.hard_case_seeds} == set()


# --- blind holdout -----------------------------------------------------------
def test_blind_holdout_is_15_to_20_percent_and_flagged():
    rows = sample.draw_sample(_corpus(), n=60, seed=SEED)
    blind = [r for r in rows if r.blind]
    assert 9 <= len(blind) <= 12  # 15-20% of 60
    assert all(isinstance(r.blind, bool) for r in rows)


def test_blind_and_assisted_sets_are_disjoint_and_exhaustive():
    rows = sample.draw_sample(_corpus(), n=60, seed=SEED)
    blind = {r.item_id for r in rows if r.blind}
    assisted = {r.item_id for r in rows if not r.blind}
    assert blind & assisted == set()
    assert blind | assisted == {r.item_id for r in rows}
    assert blind and assisted


# --- content-bucket coverage -------------------------------------------------
def test_sample_spreads_across_content_buckets():
    rows = sample.draw_sample(_corpus(), n=60, seed=SEED)
    covered = {r.content_bucket for r in rows}
    assert len(covered) >= 6
    assert "dark_matter" in covered


def test_no_single_bucket_monopolises_the_sample():
    rows = sample.draw_sample(_corpus(), n=60, seed=SEED)
    counts = Counter(r.content_bucket for r in rows)
    assert counts.most_common(1)[0][1] <= 20


# --- realized distribution report -------------------------------------------
def test_distribution_reports_realized_strata_buckets_seeds_and_blind():
    corpus = _corpus()
    rows = sample.draw_sample(corpus, n=60, seed=SEED)
    dist = sample.distribution(rows, corpus_size=len(corpus))
    assert dist["n"] == 60
    assert dist["corpus_size"] == len(corpus)
    assert sum(s["n"] for s in dist["strata"]) == 60
    assert sum(b["n"] for b in dist["content_buckets"]) == 60
    assert dist["blind"]["n"] == sum(1 for r in rows if r.blind)
    assert set(dist["hard_case_seeds"]) <= set(strata.HARD_CASE_CATEGORIES)
    for s in dist["strata"]:
        assert {"stratum_key", "n", "corpus_n", "weight"} <= set(s)


def test_render_distribution_is_a_readable_table():
    rows = sample.draw_sample(_corpus(), n=60, seed=SEED)
    text = sample.render_distribution(sample.distribution(rows, corpus_size=608))
    assert "stratum" in text
    assert "vtt=1|slide=0|dur=1" in text or "vtt=0|slide=0|dur=1" in text
    assert "blind" in text


# --- serialisation -----------------------------------------------------------
def test_rows_serialise_to_jsonl_and_round_trip():
    rows = sample.draw_sample(_corpus(), n=12, seed=SEED)
    lines = [json.dumps(sample.row_to_dict(r)) for r in rows]
    back = [json.loads(line) for line in lines]
    assert [b["item_id"] for b in back] == [r.item_id for r in rows]
    assert back[0]["stratum"] == rows[0].stratum
    assert set(back[0]) == {
        "item_id",
        "stratum",
        "stratum_key",
        "content_bucket",
        "weight",
        "blind",
        "hard_case_seeds",
        "duration_known",
        "item",
    }


def test_write_and_read_sample_round_trip(tmp_path):
    rows = sample.draw_sample(_corpus(), n=12, seed=SEED)
    path = tmp_path / "sample.jsonl"
    sample.write_sample(rows, path)
    back = sample.read_sample(path)
    assert [r.item_id for r in back] == [r.item_id for r in rows]
    assert [r.blind for r in back] == [r.blind for r in rows]
    assert back[0].weight == pytest.approx(rows[0].weight)


def test_manifest_records_the_seed_and_parameters(tmp_path):
    rows = sample.draw_sample(_corpus(), n=12, seed=SEED)
    path = tmp_path / "sample.jsonl"
    sample.write_sample(rows, path, seed=SEED, corpus_size=608)
    manifest = json.loads((tmp_path / "sample.manifest.json").read_text())
    assert manifest["seed"] == SEED
    assert manifest["n"] == 12
    assert manifest["corpus_size"] == 608
    assert "distribution" in manifest


# --- CLI ---------------------------------------------------------------------
def test_cli_writes_a_sample_and_prints_the_distribution(tmp_path, capsys):
    corpus_path = tmp_path / "corpus.json"
    corpus_path.write_text(json.dumps(_corpus()))
    out = tmp_path / "sample.jsonl"
    code = sample.main(
        ["--corpus", str(corpus_path), "--out", str(out), "--n", "30", "--seed", str(SEED)]
    )
    assert code == 0
    assert len(sample.read_sample(out)) == 30
    printed = capsys.readouterr().out
    assert "stratum" in printed
    assert "blind" in printed


def test_cli_refuses_a_missing_corpus(tmp_path, capsys):
    code = sample.main(
        ["--corpus", str(tmp_path / "nope.json"), "--out", str(tmp_path / "s.jsonl")]
    )
    assert code != 0
    assert "nope.json" in capsys.readouterr().err
