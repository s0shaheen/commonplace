"""Strata derivation for the gold-set sampler (evaluation-methodology.md §3).

The methodology names the stratification axes: VTT-present vs absent, slideshow
vs video, duration terciles, plus entity-type/content coverage. These tests pin
the derivation of those axes from a raw corpus item.
"""

from __future__ import annotations

import pytest

from gold import strata


# --- duration terciles -------------------------------------------------------
def test_terciles_split_known_durations_into_thirds():
    durations = [1, 2, 3, 4, 5, 6, 7, 8, 9]
    cuts = strata.duration_cuts(durations)
    assert cuts == (4, 7)


def test_terciles_ignore_missing_durations():
    # Slideshows carry no duration; they must not drag the cut points down.
    durations = [None, None, None, 10, 20, 30, 40, 50, 60]
    assert strata.duration_cuts(durations) == strata.duration_cuts([10, 20, 30, 40, 50, 60])


def test_tercile_of_assigns_1_2_3_by_cut_points():
    cuts = (15, 56)
    assert strata.duration_tercile(5, cuts) == 1
    assert strata.duration_tercile(15, cuts) == 2  # cut point is the lower edge of t2
    assert strata.duration_tercile(30, cuts) == 2
    assert strata.duration_tercile(56, cuts) == 3
    assert strata.duration_tercile(300, cuts) == 3


def test_missing_duration_falls_into_tercile_1_and_is_flagged():
    cuts = (15, 56)
    assert strata.duration_tercile(None, cuts) == 1
    assert strata.duration_tercile(0, cuts) == 1


# --- stratum key -------------------------------------------------------------
def test_stratum_of_reads_the_three_methodology_axes():
    item = {"id": "1", "hasSubtitles": True, "isSlideshow": False, "durationSec": 30}
    s = strata.stratum_of(item, cuts=(15, 56))
    assert s == {"has_vtt": True, "is_slideshow": False, "duration_tercile": 2}


def test_stratum_key_is_stable_and_readable():
    s = {"has_vtt": True, "is_slideshow": False, "duration_tercile": 2}
    assert strata.stratum_key(s) == "vtt=1|slide=0|dur=2"


# --- content buckets (coarse coverage heuristic, NOT a label) ----------------
def test_dark_matter_bucket_is_no_caption_and_no_hashtags():
    item = {"id": "1", "desc": "   ", "hashtags": []}
    assert strata.content_bucket(item) == "dark_matter"


def test_food_place_bucket_from_caption_keywords():
    item = {"id": "1", "desc": "best pizza in Brooklyn", "hashtags": ["foodtok"]}
    assert strata.content_bucket(item) == "food_place"


def test_music_bucket_from_hashtags():
    item = {"id": "1", "desc": "wow", "hashtags": ["music", "guitar"]}
    assert strata.content_bucket(item) == "music"


def test_unmatched_caption_falls_through_to_other():
    item = {"id": "1", "desc": "just some thoughts today", "hashtags": ["fyp"]}
    assert strata.content_bucket(item) == "other"


def test_every_bucket_name_is_declared():
    # The allocator iterates BUCKETS; a bucket the classifier can emit but the
    # allocator does not know about would silently never be covered.
    assert strata.content_bucket({"desc": "", "hashtags": []}) in strata.BUCKETS
    assert set(strata.BUCKETS) >= {
        "food_place",
        "tech_startup",
        "film_tv",
        "sports",
        "music",
        "dark_matter",
        "other",
    }


# --- hard-slice seeds --------------------------------------------------------
def test_cover_song_seed_from_music_name():
    item = {"id": "1", "music": {"name": "Kill Bill (sped up)", "author": "x"}}
    assert "cover_song" in strata.hard_case_seeds(item)


def test_original_sound_is_a_cover_song_seed():
    item = {"id": "1", "music": {"name": "original sound - user1234", "author": "u"}}
    assert "cover_song" in strata.hard_case_seeds(item)


def test_chain_restaurant_seed_from_caption():
    item = {"id": "1", "desc": "the Starbucks on 5th & Main", "hashtags": []}
    assert "chain_restaurant" in strata.hard_case_seeds(item)


def test_ambiguous_title_seed_requires_hashtag_or_multiword():
    hit_tag = {"id": "1", "desc": "", "hashtags": ["severance"]}
    hit_multi = {"id": "2", "desc": "rewatching the office again", "hashtags": []}
    miss = {"id": "3", "desc": "you should see this", "hashtags": ["fyp"]}
    assert "ambiguous_title" in strata.hard_case_seeds(hit_tag)
    assert "ambiguous_title" in strata.hard_case_seeds(hit_multi)
    assert "ambiguous_title" not in strata.hard_case_seeds(miss)


def test_non_english_text_seed_needs_a_real_run_not_hashtag_decoration():
    real = {"id": "1", "desc": "코킹에서 백스윙 그리고 피니시까", "hashtags": []}
    decoration = {"id": "2", "desc": "Youuu #fypシ゚viral", "hashtags": ["fypシ"]}
    assert "non_english_text" in strata.hard_case_seeds(real)
    assert "non_english_text" not in strata.hard_case_seeds(decoration)


def test_seeds_are_sorted_and_deduped():
    item = {
        "id": "1",
        "desc": "the Starbucks on 5th",
        "hashtags": ["severance"],
        "music": {"name": "original sound - x"},
    }
    seeds = strata.hard_case_seeds(item)
    assert seeds == tuple(sorted(set(seeds)))
    assert set(seeds) == {"ambiguous_title", "chain_restaurant", "cover_song"}


def test_seed_categories_constant_matches_what_the_classifier_emits():
    assert set(strata.HARD_CASE_CATEGORIES) == {
        "cover_song",
        "chain_restaurant",
        "ambiguous_title",
        "non_english_text",
    }


@pytest.mark.parametrize("missing", [{}, {"music": None}, {"desc": None, "hashtags": None}])
def test_classifiers_tolerate_missing_fields(missing):
    assert strata.hard_case_seeds(missing) == ()
    assert strata.content_bucket(missing) == "dark_matter"
