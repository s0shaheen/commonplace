"""Mention normalization for the span-free matcher (Task 5).

``normalize_mention(s)`` is the deterministic canonicalizer the matcher's EXACT
tier compares on. Exact-string matching is BANNED as the sole tier (see
``docs/specs/evaluation-methodology.md`` §4 "Extraction (mention-level), exact-string
BANNED") precisely because it scores benign variation ("SZA — Kill Bill" vs
"Kill Bill by SZA") as total error; this normalizer absorbs case, Unicode
form, leading articles, and punctuation so those variants collapse.

Pipeline, in order:
1. Unicode NFKC (fold fullwidth/compatibility forms, e.g. "Ｊｏｅ" -> "Joe").
2. casefold (aggressive, Unicode-aware lowercasing).
3. remove INTRA-WORD apostrophes so "Joe's" -> "joes" (and "O'Brien" ->
   "obrien"); every other punctuation/symbol char (incl. hyphens, dashes,
   colons, surrounding quotes) maps to a space.
4. collapse runs of whitespace and strip the ends.
5. strip a single LEADING article followed by whitespace (``the|a|an`` ONLY).
   Punctuation is handled BEFORE this step, so a quoted title
   (``"The Matrix"``) has its quotes stripped first and the leading article
   then strips just like the bare title. The pattern is anchored at the start,
   so mid-string article substrings ("Isla") and non-leading articles ("Bear
   The") are untouched, and only a SINGLE article strips ("The The Band" ->
   "the band", not "band").
6. final whitespace collapse / trim.

Articles are English-only by deliberate choice. Foreign leading articles
(``el|la|le|les|der|die|das``) are NOT stripped: they false-strip English
titles ("Die Hard" -> "hard", "La La Land" -> degraded). Foreign-article
variants belong in gold aliases, not the normalizer.

**Deviation from the Task-5 brief, flagged deliberately.** The brief's
normalize spec says map intra-word apostrophes/hyphens *to space* ("Joe's" ->
"joe s"), and its ``test_unicode_nfkc`` encodes that. But the brief's own
required matcher test ``test_place_vs_restaurant`` requires "Joe's Pizza" to be
an EXACT (COR) match for "Joes Pizza" — which is impossible under
apostrophe->space (yields "joe s pizza" != "joes pizza"). The two brief tests
are formally unsatisfiable together. ``evaluation-methodology.md`` §4 governs on conflict
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

# English-only articles. Foreign leading articles are deliberately excluded
# (see module docstring): they false-strip English titles ("Die Hard").
_ARTICLES = ("the", "an", "a")
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
    # Punctuation BEFORE article-stripping so quoted titles ('"The Matrix"')
    # lose their quotes first and then strip the leading article as normal.
    s = _INTRAWORD_APOSTROPHE.sub("", s)
    s = _PUNCT.sub(" ", s)
    s = _WHITESPACE.sub(" ", s).strip()
    # Single leading-article strip (count=1, not a loop).
    s = _LEADING_ARTICLE.sub("", s, count=1)
    return _WHITESPACE.sub(" ", s).strip()
