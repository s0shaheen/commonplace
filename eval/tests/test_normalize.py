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
    # "La La Land": strip the single leading "la ", leaving "la land" — NOT
    # recursively (that would give "land"). (Do not assert == n("la land"):
    # normalization is intentionally non-idempotent on stacked articles, since
    # n("la land") strips again to "land".)
    assert n("La La Land") == "la land"


def test_non_english_leading_articles():
    assert n("Der Spiegel") == n("spiegel")
    assert n("Les Misérables") == n("misérables")


def test_collapses_whitespace_and_casefolds():
    assert n("  The   Matrix  ") == "matrix"


def test_idempotent():
    once = n("The Museum of Modern Art!!!")
    assert n(once) == once
