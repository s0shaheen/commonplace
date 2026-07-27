"""Stratification axes, coverage buckets, and hard-slice seeds — pure functions.

``evaluation-methodology.md`` §3 names the axes the gold set must be stratified
on: "VTT-present (53%) vs absent, slideshow (17%) vs video, duration terciles,
and entity-type coverage", plus "Seed a hard slice deliberately (cover songs,
chain restaurants, ambiguous film titles) — ambiguous-name seeding."

Three separate things live here, and they are NOT equally load-bearing:

1. **Strata** (``stratum_of``) — the real design variables. Every sampled row
   carries its stratum and the sampler reweights by it, so these must be exact.
   They read three fields the platform itself reports, so they are facts, not
   guesses.

2. **Content buckets** (``content_bucket``) — a COARSE KEYWORD HEURISTIC used
   ONLY to spread the sample across subject matter so one topic cannot
   monopolise 60 items. It is emphatically **not a label**: it never enters a
   gold record, is never scored, and no accuracy claim rests on it. A bucket
   being wrong costs a little coverage diversity and nothing else. (The real
   entity-type coverage figure comes out of adjudication, where the annotator
   assigns types per `guidelines.md` §3 — you cannot derive it from a caption.)

3. **Hard-case seeds** (``hard_case_seeds``) — a RECALL-ORIENTED FILTER whose
   job is to *find real candidates in the corpus* for the four ambiguity classes
   in `guidelines.md` §9. A seed is a "look here" flag for the annotator, not a
   claim that the item is hard; the annotator sets the scored ``hard_case`` flag
   on the mention itself during adjudication. Precision therefore matters less
   than not fabricating — every seeded row is a real corpus row.
"""

from __future__ import annotations

import re
import unicodedata
from collections.abc import Iterable, Mapping

__all__ = [
    "BUCKETS",
    "HARD_CASE_CATEGORIES",
    "duration_cuts",
    "duration_tercile",
    "stratum_of",
    "stratum_key",
    "content_bucket",
    "hard_case_seeds",
]


# --- duration terciles -------------------------------------------------------
def duration_cuts(durations: Iterable[int | None]) -> tuple[int, int]:
    """Return the (lower, upper) tercile cut points over the KNOWN durations.

    Items with no duration are excluded from the quantile computation — in the
    real corpus every slideshow has ``durationSec`` null (806 of 807 nulls), so
    including them as 0 would drag both cut points toward zero and mis-bin every
    real video. Returns ``(0, 0)`` when nothing is known.
    """
    known = sorted(d for d in durations if d)
    if not known:
        return (0, 0)
    n = len(known)
    return (known[n // 3], known[2 * n // 3])


def duration_tercile(seconds: int | None, cuts: tuple[int, int]) -> int:
    """Bin a duration into 1/2/3 given the corpus cut points.

    A missing or zero duration bins to tercile 1: the gold schema's
    ``strata.duration_tercile`` is a required 1-3 integer with no "unknown"
    member, and a null-duration item is a slideshow (shortest-form content), so
    tercile 1 is the honest floor. The sample row separately carries
    ``duration_known`` so the distinction survives for analysis.
    """
    if not seconds:
        return 1
    lower, upper = cuts
    if seconds < lower:
        return 1
    if seconds < upper:
        return 2
    return 3


# --- strata ------------------------------------------------------------------
def stratum_of(item: Mapping, cuts: tuple[int, int]) -> dict:
    """The three methodology axes for one corpus item.

    Shape matches ``gold.schema.json``'s ``strata`` object exactly, so the
    review tool can copy it onto the emitted gold record unchanged.
    """
    return {
        "has_vtt": bool(item.get("hasSubtitles")),
        "is_slideshow": bool(item.get("isSlideshow")),
        "duration_tercile": duration_tercile(item.get("durationSec"), cuts),
    }


def stratum_key(stratum: Mapping) -> str:
    """A stable, readable key for a stratum — the allocator's dict key."""
    return (
        f"vtt={int(bool(stratum['has_vtt']))}"
        f"|slide={int(bool(stratum['is_slideshow']))}"
        f"|dur={int(stratum['duration_tercile'])}"
    )


# --- content buckets (coarse coverage heuristic — see module docstring) ------
BUCKETS: tuple[str, ...] = (
    "food_place",
    "tech_startup",
    "film_tv",
    "sports",
    "music",
    "dark_matter",
    "other",
)

# Checked in this order; first match wins. Ordering is the tie-break policy, not
# a taxonomy — "a cooking video about a startup" lands in food_place, which is
# fine for a coverage knob.
_BUCKET_PATTERNS: tuple[tuple[str, re.Pattern[str]], ...] = (
    (
        "food_place",
        re.compile(
            r"\b(food|foodie|foodtok|recipe|recipes|cook|cooking|baking|bake|eat|eats|eating"
            r"|restaurant|cafe|coffee|pizza|burger|ramen|sushi|taco|brunch|dinner|lunch"
            r"|breakfast|dessert|chef|menu|kitchen|bar|cocktail|bakery|deli|diner"
            r"|nyc|london|travel|hotel|airbnb|itinerary)\b",
            re.I,
        ),
    ),
    (
        "tech_startup",
        re.compile(
            r"\b(tech|startup|startups|founder|founders|saas|vc|venture|ai|llm|coding|code"
            r"|developer|dev|software|engineer|engineering|python|javascript|react|api"
            r"|product|design|figma|iphone|android|app|apps|gadget|laptop|setup)\b",
            re.I,
        ),
    ),
    (
        "film_tv",
        re.compile(
            r"\b(movie|movies|film|films|cinema|tv|series|show|shows|netflix|hbo|hulu|disney"
            r"|anime|kdrama|drama|episode|season|trailer|actor|actress|director|oscars"
            r"|edit|edits|scene|cinematography)\b",
            re.I,
        ),
    ),
    (
        "sports",
        re.compile(
            r"\b(sport|sports|nba|nfl|mlb|nhl|soccer|football|basketball|baseball|tennis"
            r"|golf|boxing|ufc|mma|f1|formula1|running|marathon|gym|workout|lifting"
            r"|fitness|training|athlete|coach|team|match|game)\b",
            re.I,
        ),
    ),
    (
        "music",
        re.compile(
            r"\b(music|song|songs|album|artist|band|rap|rapper|hiphop|hip-hop|rnb|jazz|rock"
            r"|pop|edm|dj|concert|tour|guitar|piano|drums|producer|beat|beats|lyrics"
            r"|singer|singing|vocals|spotify)\b",
            re.I,
        ),
    ),
)


def _text_of(item: Mapping) -> str:
    desc = item.get("desc") or ""
    tags = item.get("hashtags") or []
    return f"{desc} {' '.join(str(t) for t in tags)}"


def content_bucket(item: Mapping) -> str:
    """Assign a coarse content bucket for SAMPLE COVERAGE ONLY (not a label).

    ``dark_matter`` (no caption and no hashtags) is checked first because it is
    a structural fact rather than a keyword guess, and it is the bucket the
    corpus backtest called out as the hardest and most under-served.
    """
    desc = (item.get("desc") or "").strip()
    tags = item.get("hashtags") or []
    if not desc and not tags:
        return "dark_matter"

    text = _text_of(item)
    for name, pattern in _BUCKET_PATTERNS:
        if pattern.search(text):
            return name
    return "other"


# --- hard-slice seeds --------------------------------------------------------
HARD_CASE_CATEGORIES: tuple[str, ...] = (
    "cover_song",
    "chain_restaurant",
    "ambiguous_title",
    "non_english_text",
)

# guidelines.md §9.1 + §9.4: an attached sound that is a cover / sped-up / remix
# take, or a platform "original sound", is where a confidently-wrong MBID is
# most likely (the famous *work* does not license the original's MBID).
_COVER_SOUND = re.compile(
    r"(original sound|cover|sped\s*up|speed\s*up|slowed|remix|mashup|nightcore"
    r"|instrumental|live version|acoustic)",
    re.I,
)

# guidelines.md §9.2: the place-vs-brand_org fork. Chains present in the real
# corpus were confirmed before this list was written (49 items match).
_CHAINS: tuple[str, ...] = (
    "starbucks", "mcdonald", "chipotle", "shake shack", "five guys", "subway",
    "dunkin", "popeyes", "chick-fil-a", "chickfila", "taco bell", "kfc",
    "wendy", "burger king", "domino", "papa john", "pret", "nando",
    "wingstop", "raising cane", "in-n-out", "halal guys", "joe's pizza",
    "panda express", "sweetgreen", "cava", "jollibee", "tim hortons",
    "costa coffee", "pizza hut", "olive garden", "cheesecake factory",
    "ihop", "denny", "waffle house",
)

# guidelines.md §9.3: surfaces shared across works (US/UK, remake vs original,
# same title different year). Single-word entries are matched ONLY as an exact
# hashtag — matching "you" or "up" in free text hits ~500 items and is noise,
# not signal. Multi-word entries are additionally matched in the caption.
_AMBIGUOUS_TITLES: tuple[str, ...] = (
    "the office", "dune", "the batman", "joker", "it ends with us", "the crown",
    "shogun", "ghost", "the wire", "severance", "fallout", "the bear",
    "wednesday", "arcane", "squid game", "you", "friends", "suits",
    "breaking bad", "oppenheimer", "barbie", "interstellar", "inception",
    "superman", "spiderman", "spider-man", "batman", "the last of us",
    "euphoria", "narcos", "dark", "parasite", "her", "up", "coco", "soul",
    "luca", "turning red", "gladiator", "anora", "challengers", "saltburn",
    "poor things", "sinners", "nosferatu", "twisters", "wicked", "matrix",
    "the matrix", "avatar", "titanic", "casino", "heat", "drive", "warfare",
    "conclave",
)

# Hashtag decorations that are katakana/other non-Latin but carry no language
# signal — "#fypシ" is an English-language post. Stripped before the run check.
_DECORATIONS = str.maketrans("", "", "シ゚ツ")

_NON_LATIN = re.compile(
    r"[Ѐ-ӿ֐-׿؀-ۿऀ-ॿ"
    r"฀-๿぀-ヿ一-鿿가-힯]"
)
_MIN_NON_LATIN_CHARS = 3


def _has_ambiguous_title(desc: str, tags: Iterable[str]) -> bool:
    lowered = desc.lower()
    tagset = {str(t).lower().replace(" ", "").replace("-", "") for t in tags}
    for title in _AMBIGUOUS_TITLES:
        key = title.replace(" ", "").replace("-", "")
        if key in tagset:
            return True
        if " " in title and re.search(
            r"(?<![a-z0-9])" + re.escape(title) + r"(?![a-z0-9])", lowered
        ):
            return True
    return False


def hard_case_seeds(item: Mapping) -> tuple[str, ...]:
    """Which hard-slice categories this real corpus item is a candidate for.

    Returns a sorted, deduped tuple drawn from :data:`HARD_CASE_CATEGORIES`.
    Empty when the item shows none of the four ambiguity signals.
    """
    seeds: set[str] = set()

    music = item.get("music") or {}
    music_name = str(music.get("name") or "") if isinstance(music, Mapping) else ""
    if _COVER_SOUND.search(music_name):
        seeds.add("cover_song")

    desc = str(item.get("desc") or "")
    tags = item.get("hashtags") or []
    text = _text_of(item).lower()

    if any(chain in text for chain in _CHAINS):
        seeds.add("chain_restaurant")

    if _has_ambiguous_title(desc, tags):
        seeds.add("ambiguous_title")

    stripped = unicodedata.normalize("NFC", _text_of(item)).translate(_DECORATIONS)
    if len(_NON_LATIN.findall(stripped)) >= _MIN_NON_LATIN_CHARS:
        seeds.add("non_english_text")

    return tuple(sorted(seeds))
