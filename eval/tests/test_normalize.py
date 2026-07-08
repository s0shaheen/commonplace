"""Tests for mention normalization (Task 5).

Brief's verbatim cases first, then the edge cases mandated by the task:
leading-article stripping must fire only at the string start (never
mid-string), and casefold/NFKC/punct must collapse benign variation.
"""

from commonplace_eval.normalize import normalize_mention as n


# --- brief's verbatim tests --------------------------------------------------
def test_case_and_articles():
    assert n("The Bear") == n("bear")


def test_unicode_nfkc():
    # NFKC folds fullwidth "Ｊｏｅ" -> "Joe", so the fullwidth and ASCII forms
    # must normalize identically. (Asserted against the ASCII form rather than
    # a literal "joe s pizza": intra-word apostrophes are REMOVED, not spaced —
    # see normalize.py's flagged deviation. This still verifies NFKC folding.)
    assert n("Ｊｏｅ's Pizza") == n("Joe's Pizza")
    assert n("Ｊｏｅ's Pizza") == "joes pizza"


def test_punct():
    assert n("SZA — Kill Bill") == n("sza kill bill")


# --- mandated edge cases -----------------------------------------------------
def test_leading_article_only_fires_at_start():
    # "The Bear" strips the leading article; "Bear The" must NOT — the trailing
    # "the" is not leading, so the two must not collapse to the same string.
    assert n("The Bear") != n("Bear The")


def test_article_substring_is_not_stripped():
    # "la" appears inside "Isla" — must not be stripped (only whole leading
    # article tokens followed by whitespace strip).
    assert n("Isla Nublar") == "isla nublar"


def test_only_one_leading_article_stripped():
    # "The The Band": strip the single leading "the ", leaving "the band" — NOT
    # recursively (that would give "band"). One strip pass, not a loop. (Do not
    # assert == n("the band"): normalization is intentionally non-idempotent on
    # stacked articles, since n("the band") strips again to "band".)
    assert n("The The Band") == "the band"


def test_foreign_articles_not_stripped():
    # English-only articles: foreign leading articles are NOT stripped (they
    # false-strip English titles). Foreign-article variants are gold-alias
    # territory, not normalizer territory.
    assert n("Der Spiegel") == "der spiegel"
    assert n("Les Misérables") == "les misérables"


def test_die_hard_not_stripped():
    # "Die"/"La" are not English articles: the titles survive intact.
    assert n("Die Hard") == "die hard"
    assert n("La La Land") == "la la land"


def test_quoted_title_article_strips():
    # Punctuation is handled before article-stripping, so a quoted title loses
    # its quotes first and then strips the leading article exactly like the bare
    # title. All three collapse to "matrix".
    assert n('"The Matrix"') == n("The Matrix") == "matrix"


def test_collapses_whitespace_and_casefolds():
    assert n("  The   Matrix  ") == "matrix"


def test_idempotent():
    once = n("The Museum of Modern Art!!!")
    assert n(once) == once
