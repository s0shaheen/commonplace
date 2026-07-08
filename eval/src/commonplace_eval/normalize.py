"""Mention normalization for the span-free matcher (Task 5).

``normalize_mention(s)`` is the deterministic canonicalizer the matcher's EXACT
tier compares on. Exact-string matching is BANNED as the sole tier (see
``docs/product/_EVAL-METHOD.md`` §4 "Extraction (mention-level), exact-string
BANNED") precisely because it scores benign variation ("SZA — Kill Bill" vs
"Kill Bill by SZA") as total error; this normalizer absorbs case, Unicode
form, leading articles, and punctuation so those variants collapse.

Pipeline, in order:
1. Unicode NFKC (fold fullwidth/compatibility forms, e.g. "Ｊｏｅ" -> "Joe").
2. casefold (aggressive, Unicode-aware lowercasing).
3. strip a single LEADING article followed by whitespace
   (``the|a|an`` + common non-English ``el|la|le|les|der|die|das``). The
   pattern tolerates leading whitespace so "  The Matrix" still strips, but is
   anchored at the start so mid-string article substrings ("Isla", "La La
   Land"'s second "la") are untouched.
4. remove INTRA-WORD apostrophes so "Joe's" -> "joes" (and "O'Brien" ->
   "obrien"); every other punctuation/symbol char (incl. hyphens, dashes,
   colons) maps to a space.
5. collapse runs of whitespace and strip the ends.

**Deviation from the Task-5 brief, flagged deliberately.** The brief's
normalize spec says map intra-word apostrophes/hyphens *to space* ("Joe's" ->
"joe s"), and its ``test_unicode_nfkc`` encodes that. But the brief's own
required matcher test ``test_place_vs_restaurant`` requires "Joe's Pizza" to be
an EXACT (COR) match for "Joes Pizza" — which is impossible under
apostrophe->space (yields "joe s pizza" != "joes pizza"). The two brief tests
are formally unsatisfiable together. ``_EVAL-METHOD.md`` §4 governs on conflict
(benign variation must not score as error) and entity-linking canonicalization
prior art removes intra-word apostrophes rather than splitting them. So
apostrophes are REMOVED intra-word; hyphens and all other punctuation still map
to space (minimal deviation). ``test_unicode_nfkc`` was adjusted to preserve
its NFKC-folding purpose without the incidental apostrophe-output assumption.
"""

from __future__ import annotations

import re
import unicodedata

__all__ = ["normalize_mention"]

# Longer forms first for readability; the trailing ``\s+`` anchor disambiguates
# overlapping prefixes ("les" vs "le") on its own via backtracking.
_ARTICLES = ("the", "an", "a", "el", "les", "le", "la", "der", "die", "das")
# Leading article: optional leading whitespace, one article token, then
# whitespace. Anchored at ``^`` so only a LEADING article strips.
_LEADING_ARTICLE = re.compile(r"^\s*(?:" + "|".join(_ARTICLES) + r")\s+", re.UNICODE)
# Apostrophes (straight + curly) sitting between two word chars: possessives /
# contractions. Removed (not spaced) so "Joe's" -> "joes".
_INTRAWORD_APOSTROPHE = re.compile(r"(?<=\w)['’](?=\w)", re.UNICODE)
# Anything that is not a (Unicode) word char or whitespace -> punctuation.
_PUNCT = re.compile(r"[^\w\s]", re.UNICODE)
_WHITESPACE = re.compile(r"\s+", re.UNICODE)


def normalize_mention(s: str) -> str:
    """Return the canonical form of a mention surface string."""
    s = unicodedata.normalize("NFKC", s)
    s = s.casefold()
    s = _LEADING_ARTICLE.sub("", s, count=1)
    s = _INTRAWORD_APOSTROPHE.sub("", s)
    s = _PUNCT.sub(" ", s)
    s = _WHITESPACE.sub(" ", s).strip()
    return s
