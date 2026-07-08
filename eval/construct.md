# The Construct — "an entity worth grounding"

> The single decision the whole benchmark rests on. Every mention an annotator
> sees is judged against this one definition before anything else. Governs
> `guidelines.md`; conforms to `docs/product/_EVAL-METHOD.md` §2 and
> `docs/product/_ONTOLOGY.md` §7. One page by design.

## Definition

A **NamedEntity worth grounding** is a mention that refers to a **rigid
individual** — one *specific, persistent, re-identifiable* thing, not a kind of
thing — that

1. a saver would plausibly want to **retrieve or act on later**, and
2. is resolvable **in principle** to a durable external ID in a tier-1/2
   authority: **MusicBrainz** (recordings), **Google Places** (places),
   **Wikidata** (people/screen works/products/orgs/apps/games/books), or
   **OpenLibrary** (books).

"In principle" is load-bearing. If the individual genuinely exists but the
authority happens not to list it, the correct gold answer is a **NIL label**
(`NIL_NO_ID`), *not* exclusion — a TikTok original sound is a real recording the
KB lacks. NIL is a legitimate gold answer, not a failure (guidelines §4).

## The three tests (all must hold)

- **Rigid individual.** It names *this* thing and stays the same thing across
  contexts. "Joe's Pizza on Bleecker St" (one shop) passes; "a good pizza place"
  (a category) fails.
- **Save-worthy.** A saver would return to *it* specifically — a song to replay,
  a restaurant to visit, a film to watch.
- **Groundable in principle.** An instance ID *could* exist for it in a tier-1/2
  authority. If only a *category* could ever be named, it is not an entity.

If any test fails, the mention is not a NamedEntity. It is still captured by the
schema — just routed to a different layer and scored separately, never folded
into the grounding headline:

| If the mention is… | It routes to |
|---|---|
| a generic **kind / technique / skill / service** | **Concept** |
| a **proposition / opinion / assertion** | **Claim** |
| **shaped step-content** (recipe, workout, itinerary) | **StructuredContent** |
| a **mood / topic / format / trend** | **Facet** (or Concept·CulturalReference) |

## The named failure mode

**Over-typing generic services, skills, and kinds into entities.** This is the
one error to guard against everywhere. When torn between entity and concept,
ask: *does this name one re-identifiable individual, or a category of things?*
Category → Concept. "Restaurant" is never a type — a specific restaurant is a
`place`; "a hair tool" is a kind but "Dyson Airwrap" is a `product`.

## Ten calibration examples

**Positive — entities worth grounding:**

1. "Kill Bill by SZA" (the track playing) → `music_recording` (MusicBrainz MBID).
2. "Joe's Pizza on Bleecker St" → `place` (Google Places ID).
3. "Dune: Part Two" → `screen_work` (Wikidata QID).
4. "Atomic Habits by James Clear" → `book` (OpenLibrary OLID / Wikidata QID).
5. "Zendaya" (named public figure) → `person` (Wikidata QID).

**Negative — NOT entities (route elsewhere):**

1. "cable lateral raise" → a technique, not a thing → **Concept**.
2. "a good pizza place near me" → a category, no individual → **not a mention**
   (or Concept "pizzeria").
3. "this 15-minute protein-shake recipe" → shaped steps → **StructuredContent**
   (Recipe).
4. "honestly it's worth the hype" → a proposition → **Claim** (faithfulness, not
   truth).
5. "that girl-dinner aesthetic" → a trend/mood → **Facet** (`affect`) /
   **Concept·CulturalReference**.
