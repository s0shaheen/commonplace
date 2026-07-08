# Annotation Guidelines — the Commonplace grounding codebook

> **The instrument that makes the measurement valid.** Commonplace's moat is a
> *published, measured grounding-accuracy page*; these guidelines are what let a
> stranger reproduce our gold labels and therefore trust that page. They
> operationalize `docs/product/_EVAL-METHOD.md` (§2 the 9 types + NIL, §3 the
> gold-set rules, §5 the solo-annotator protocol) and `docs/product/_ONTOLOGY.md`
> v3 (§3 the four Referent kinds, §4 evidence/channels/selectors, §7 the
> decidable typing rule). Labels are captured in the format frozen by
> `schema/json/gold.schema.json`; the type enum is
> `schema/vocab/named-entity-anchors.json`; facet value lists are
> `schema/vocab/facets.json`.
>
> **Acceptance bar for this document: a stranger with this doc and a browser
> reaches the same label we would.** Every rule below is written to be
> *decidable* — "if X then Y" plus worked examples — not a matter of taste. Read
> the one-page `construct.md` first; it defines the single question every rule
> serves.

---

## 1. The unit and the workflow

### 1.1 The gold unit

The atomic gold unit is:

```
(item_id, mention surface + aliases, type, external_ID  or  NIL-label)
```

captured per `schema/json/gold.schema.json`. One JSONL record per item; the
required field is `item_id`; each in-scope entity is one object in `mentions[]`:

| Concept | Field in `gold.schema.json` |
|---|---|
| which saved item | `item_id` |
| a stable id for this mention within the item | `mention_id` |
| the phrase as it appeared | `surface` |
| other forms of the same phrase | `aliases[]` |
| which of the 9 types | `type` |
| the grounded id | `gold_id { authority, id }` |
| **xor** the honest-no-id label | `nil` ∈ `NIL_NO_ID` \| `NON_ENTITY` |
| searches you ran before NIL | `failed_queries[]` |
| when you looked it up | `kb_snapshot { authority, retrieved }` |
| is this a seeded hard case | `hard_case` (boolean) |
| free-text: evidence note, Places address, disambiguation | `notes` |

**Invariant (schema-enforced):** exactly one of `gold_id` or `nil` is non-null
per mention (`oneOf`). If `nil = "NIL_NO_ID"`, `failed_queries` must be
non-empty. Facet/Concept/Claim/StructuredContent layers have their own blocks
(`facets`, `concepts`, `claims`, `structured`) — §7 and §8.

### 1.2 Exhaustive, per-item — never from system output

Label **every** in-scope mention in each item, top to bottom, in every channel
(spoken audio, on-screen text, caption, the song on the track). **Never build
gold from the union of engine outputs** — pooling from system predictions
inflates recall because you only ever confirm what the system already found and
never add what it missed (`_EVAL-METHOD.md` §3). The gold set is the independent
truth the system is measured *against*; it cannot be derived from the thing
being measured.

### 1.3 The assisted flow (pre-annotation as suggestions)

1. **Pre-annotate with Claude** — deliberately a *different model family* than
   the extraction pipeline (Gemini/Qwen), to avoid correlated errors and
   self-preference (`_EVAL-METHOD.md` §5.1). Import the pre-labels as
   **suggestions** into the annotation tool (**Argilla** primary, or **Label
   Studio** for its native video player).
2. **Human pass:** for every suggestion — *verify* it, *correct* the type or
   surface if wrong, *delete* it if it is a NON_ENTITY, and **add** every
   in-scope mention the pre-annotation missed. Confirm every id by opening the
   actual record (§5). The suggestions are a labor aid, never the answer.

### 1.4 Two bias controls, built into the schedule

- **Blind-from-scratch control — 15–20% of items.** Annotate these with **no
  pre-labels shown**. The recall gap between the assisted pass and the blind
  pass *is* your measured pre-annotation bias (pre-annotation mainly suppresses
  recall — you stop looking once the suggestions look complete). Draw the 15–20%
  at random and record which items are blind.
- **Test–retest — 10–15% of items, ≥2 weeks later.** Re-label with your prior
  labels hidden. Agreement between the two passes is your **intra-annotator
  Krippendorff's α** (§10). This is what lets a *solo* annotator report a
  reliability number honestly.

For a *publishable inter-annotator* number, have **1–2 other people
double-annotate 50–100 items** from this same document (§10).

---

## 2. The decidable typing rule (ontology §7)

Run this for **each mention**, in order. It is a decision procedure, not a vibe.

```
For the mention, ask in order:

Q1. Does it name a RIGID INDIVIDUAL?
    (one specific, persistent, re-identifiable thing — not a kind of thing)
        YES → it is a NamedEntity.
              → assign exactly one of the 9 types (§3),
              → then ground to an instance ID, or an honest NIL (§4).
        NO  → go to Q2.

Q2. Is it a KIND / IDEA with an authority node above threshold?
    (a category, technique, skill, subject, meme/trend)
        YES → it is a Concept (§8). Not a grounding entity.
        NO  → it is a free tag / Facet value (§7).

Orthogonally, regardless of Q1–Q2:
    • Is the mention a PROPOSITION (a claim, opinion, verdict)? → Claim (§8).
    • Is it SHAPED STEP-CONTENT (recipe, workout, itinerary)?   → StructuredContent (§8).
    • Is it a MOOD / TOPIC / FORMAT / INTENT?                    → Facet (§7).
```

**Role, not string, decides.** The same words can be different kinds depending on
what they *refer to* in context:

- "I edit everything in **CapCut**" → the app → `software_app` (entity).
- "the **sourdough** discourse" → a subject/kind → Concept, *not* a place or
  product.
- "**Starbucks** raised prices" (the company) → `brand_org`; "met her at **the
  Starbucks on 5th**" (one store) → `place`. Same string, different referent
  (hard case, §9).

### The named failure mode — guard against it on every mention

**Over-typing generic services, skills, and kinds into entities.** This is the
error that quietly destroys grounding precision. Litmus test: *one
re-identifiable individual, or a category of things?* Category → Concept.

- "cable lateral raise" → a **technique** → Concept. **NOT** an entity.
- "a good pizza place" → a **category** → not a mention (or Concept). **NOT** a
  place entity.
- "a solid retinol serum" → a **kind** → Concept. **NOT** a product.
- "a nutritionist said…" → a **role** → Concept/nothing. **NOT** a person.

Only when the mention pins down *the* individual — "Joe's Pizza on Bleecker",
"Dyson Airwrap", "Andrew Huberman" — does it become an entity.

---

## 3. Per-type decision rules (the 9 types)

The nine groundable types and their anchors are frozen in
`schema/vocab/named-entity-anchors.json`. For each type below: its **KB anchor**
(where it grounds + id namespace + any Wikidata P31 anchor), **include/exclude**
rules, **≥3 worked examples** (realistic TikTok-save content, each with a ruling
and a one-line reason), and at least one **boundary case**.

Where the frozen anchor file gives no explicit Wikidata P31 (`wikidata_anchor:
null`), a **verification check** is given as an annotation heuristic — you
confirm it by opening the record (§5), not by trusting the surface string.

`gold_id.authority` uses the normalized authority tokens from the anchors file:
`musicbrainz`, `google_places`, `wikidata`, `openlibrary`.

---

### 3.1 `music_recording`

- **Anchor:** grounds to **MusicBrainz**, id namespace **MBID (recording)**.
  `wikidata_anchor: null`. *Notes (from the anchor file): use AcoustID/Chromaprint
  audio fingerprint when the song is the audio — never gold-label from a title
  string alone.*
- **Verification check:** the MBID must resolve to a **Recording** entity on
  musicbrainz.org — a *recording* (a specific performance/master), not a
  *release* or *work*. Confirm the artist and title on the page match what plays.
- **Include:** a specific track that is heard or named.
- **Exclude:** a genre ("lofi", "phonk") → Concept; an artist with no track named
  → `person`; a playlist → Concept/StructuredContent.
- **Boundary — recording vs. work:** the **work** is the composition; the
  **recording** is *this* performance of it. Gold labels the **recording that
  actually plays**. Covers, live versions, and sped-up edits are usually
  *distinct recordings* — often ones MusicBrainz lacks (→ `NIL_NO_ID`).

| # | Content | Ruling | Reason |
|---|---|---|---|
| 1 | SZA's "Kill Bill" studio track plays under the clip | `music_recording` → MBID of that recording | the audio *is* the recording |
| 2 | A "sped-up / nightcore" edit of "Kill Bill" | ground to the sped-up recording **if MB has it**, else `NIL_NO_ID` | a speed edit is a distinct recording; don't attach the studio MBID to it |
| 3 | "original sound — user1234" (creator's own audio, unreleased) | `NIL_NO_ID` (record failed MB queries) | a real recording the KB genuinely lacks; joins on the platform soundId inside the library |
| 4 (boundary) | A creator sings Adele's "Someone Like You" live to camera | the *work* is Adele's; the *recording* is this amateur performance → `NIL_NO_ID` | recording ≠ work; MB won't have this take |

---

### 3.2 `place`

- **Anchor:** grounds to **Google Places**, id namespace **Place ID**.
  `wikidata_anchor: null`. *`restaurant` is **not** a type — it is absorbed into
  `place`; the place/restaurant split is exactly what broke the retracted
  matcher.*
- **Verification check:** the Place ID resolves in Google Places to a specific
  establishment/landmark. **Store the resolved `name`, formatted `address`, and
  `lat/lng` in `notes`** — Place IDs go stale, so the human-readable anchor is
  what keeps the label reproducible (`_EVAL-METHOD.md` §3).
- **Include:** a specific, physically locatable establishment or landmark
  (restaurant, café, gym, shop, park, monument).
- **Exclude:** a category ("a good taco spot"), a generic ("the gym", "home"), a
  whole city as a topic ("Tokyo travel guide") when no specific site is meant →
  Concept/Facet.
- **Boundary — chain brand vs. one outlet:** the chain *as a brand* →
  `brand_org`; a *specific visited location* → `place` (§9).

| # | Content | Ruling | Reason |
|---|---|---|---|
| 1 | "Best slice in NYC — Joe's Pizza on Bleecker St" | `place` → Place ID; `notes`: name + address + lat/lng | named, locatable individual |
| 2 | "this hidden gym in Bali" — no name shown or spoken | not a place entity → **NON_ENTITY** | no re-identifiable individual; only a category is named |
| 3 | "the Eiffel Tower at night" | `place` → Place ID | named locatable landmark |
| 4 (boundary) | "grabbed a coffee at Starbucks" (no specific store) | `brand_org` (the chain), **not** `place` | the referent is the brand, not one outlet — see §9 |

---

### 3.3 `screen_work`

- **Anchor:** grounds to **Wikidata**, id namespace **QID**, **P31: film / TV /
  series**. *Carries TMDB/IMDb/Letterboxd as link-outs (no TMDB API).*
- **Verification check:** the QID's `P31 (instance of)` is a film / television
  series / television film / anime / miniseries (etc.) on wikidata.org.
- **Include:** a specific film, series, or episode.
- **Exclude:** a **franchise** ("Marvel", "the MCU") → `brand_org`/Concept; a
  **genre** ("A24 horror") → Concept; an actor → `person`.
- **Boundary — series vs. episode; ambiguous titles:** ground to the specific
  episode QID if the episode *is* the referent and it has one, else the series
  QID (note the fallback). Shared titles ("The Office" US vs UK) are hard cases
  (§9).

| # | Content | Ruling | Reason |
|---|---|---|---|
| 1 | A film-edit captioned "Dune: Part Two" | `screen_work` → QID of the 2024 film | named film individual |
| 2 | "the new Marvel movie era" | `brand_org` (Marvel) / Concept, **not** `screen_work` | a franchise/category, not one specific work |
| 3 | A recap of a specific "Severance" episode | episode QID if it exists, else the series QID (note the fallback) | prefer the episode individual; degrade to series honestly |
| 4 (boundary) | A clip captioned only "The Office" | disambiguate by on-screen cast/context → the specific QID; if unresolvable, dominant-evidence + note; `hard_case: true` | two individuals share the surface (§9) |

---

### 3.4 `book`

- **Anchor:** grounds to **Wikidata / OpenLibrary**, id namespace **QID / ISBN**.
  Use `authority: openlibrary` with an **OLID**, or `authority: wikidata` with a
  QID; an ISBN identifies a specific *edition*.
- **Verification check:** the record on openlibrary.org / wikidata.org is a
  written work whose title + author match.
- **Include:** a specific published book or written work.
- **Exclude:** a genre/shelf ("booktok fantasy", "dark romance") → Concept/Facet;
  the author alone → `person`; the film adaptation → `screen_work`.
- **Boundary — work vs. edition vs. adaptation:** ground to the **work** level
  unless a specific edition/translation is the referent; a book and its film are
  *different* entities of *different* types.

| # | Content | Ruling | Reason |
|---|---|---|---|
| 1 | "the book that changed my year — Atomic Habits by James Clear" | `book` → OLID / QID | named published work |
| 2 | "James Clear's whole vibe" (no book named) | `person`, **not** `book` | the referent is the author individual |
| 3 | "everyone on booktok reading dark romance" | Concept/Facet, **not** `book` | a genre/category, no individual work |
| 4 (boundary) | "the Dune book vs the movie" | two entities: `book` (QID/OLID) *and* `screen_work` (QID) | same franchise, distinct individuals & types |

---

### 3.5 `person`

- **Anchor:** grounds to **Wikidata**, id namespace **QID**. *`wikidata_anchor:
  null`; **public figures / named creators only**.*
- **Verification check:** the QID's `P31` is **human (Q5)** on wikidata.org.
- **Include:** a **named public figure** or a **named creator** (someone with a
  public identity / notability).
- **Exclude — critical:** an anonymous person on screen, a private individual
  ("my sister", "my nutritionist Dr. Sarah"), or a generic role ("a
  dermatologist"). A named *private* person is **out of type scope** → it is a
  NON_ENTITY when extracted as a person, **not** a NIL.

| # | Content | Ruling | Reason |
|---|---|---|---|
| 1 | "Zendaya's press-tour looks" | `person` → QID (P31 = Q5) | named public figure |
| 2 | "@hubermanlab explains sleep" | `person` → Andrew Huberman QID | named creator / public figure |
| 3 | "this random guy at the gym" | **NON_ENTITY** | not named, not public — an over-extraction, not a NIL |
| 4 (boundary) | "my nutritionist Dr. Sarah recommends…" | **NON_ENTITY** (as a person entity) | named but private → outside "public figures / named creators only" |

---

### 3.6 `product`

- **Anchor:** grounds to **Wikidata**, id namespace **QID**. *Notable products
  only; **high legitimate-NIL rate — that's fine, NIL is a valid gold answer.***
- **Verification check:** the QID is a specific product/product model on
  wikidata.org (P31 = product, consumer electronics, etc.).
- **Include:** a specific, notable, **named** product model.
- **Exclude:** a product *kind* ("a retinol serum", "a hair tool") → Concept; the
  brand alone → `brand_org`.
- **Boundary:** most specific SKUs lack a QID → `NIL_NO_ID` after an honest
  search is the *expected, correct* answer here — do not force a name-similar QID.

| # | Content | Ruling | Reason |
|---|---|---|---|
| 1 | "the Dyson Airwrap is worth it" | `product` → QID | named, notable product model |
| 2 | "this CeraVe moisturizing cream" | `product` → QID if it has one, else `NIL_NO_ID` (+ `brand_org` CeraVe) | brand is notable; the specific SKU often isn't in the KB |
| 3 | "a good drugstore retinol" | Concept, **not** `product` | a category, no individual |
| 4 (boundary) | "the pink one from my haul" (unnamed) | **NON_ENTITY** unless a specific named product is identifiable | no individuated product |

---

### 3.7 `brand_org`

- **Anchor:** grounds to **Wikidata**, id namespace **QID**.
- **Verification check:** the QID is a company / brand / organization on
  wikidata.org.
- **Include:** a specific company, brand, or organization.
- **Exclude:** a category of orgs ("small businesses", "fast-fashion brands") →
  Concept; a specific store location → `place` (§9).

| # | Content | Ruling | Reason |
|---|---|---|---|
| 1 | "Nike's new campaign" | `brand_org` → QID | named organization |
| 2 | "support small businesses" | Concept, **not** `brand_org` | a category, no specific org |
| 3 (boundary) | "Starbucks" as the company vs "the Starbucks on 5th" | `brand_org` (company) vs `place` (one outlet) | role decides — the referent, not the string (§9) |

---

### 3.8 `software_app`

- **Anchor:** grounds to **Wikidata**, id namespace **QID**. *`else NIL`.*
- **Verification check:** the QID is a software application / mobile app /
  website-as-product on wikidata.org.
- **Include:** a specific, named application or platform with a KB identity.
- **Exclude:** a generic capability ("a habit tracker") → Concept.
- **Boundary — app vs. website; app vs. company:** a **named notable app or
  platform** → `software_app` (Notion, CapCut, Pinterest). A generic personal
  website with no product identity → `NIL_NO_ID`/Concept. When the *company* and
  the *app* are both named, ground the **app** to `software_app` and, if
  separately mentioned, the company to `brand_org`.

| # | Content | Ruling | Reason |
|---|---|---|---|
| 1 | "I plan my week in Notion" | `software_app` → QID | named notable app |
| 2 | "edited in CapCut" | `software_app` → QID | named editing app |
| 3 (boundary, app vs website) | "found it on Pinterest" vs "my little Wordpress blog" | Pinterest → `software_app`; a personal blog → `NIL_NO_ID`/Concept | notability + KB presence separates a platform from a one-off site |
| 4 (boundary, app vs company) | "Adobe" (company) vs "Photoshop" (the app) | `brand_org` vs `software_app` | different referents, different types |

---

### 3.9 `game`

- **Anchor:** grounds to **Wikidata**, id namespace **QID**.
- **Verification check:** the QID's `P31` is a video game on wikidata.org.
- **Include:** a specific video game (or a specific titled edition/DLC).
- **Exclude:** a genre ("cozy games", "roguelikes") → Concept; a character
  ("Mario") → Concept/CulturalReference, not `game`; a platform ("Nintendo
  Switch") → `product`/`brand_org`.

| # | Content | Ruling | Reason |
|---|---|---|---|
| 1 | "100 hours in Elden Ring" | `game` → QID | named video game |
| 2 | "Baldur's Gate 3 romance scenes" | `game` → QID | named video game |
| 3 | "obsessed with cozy games" | Concept, **not** `game` | a genre/category |
| 4 (boundary) | "Mario is iconic" | Concept/CulturalReference, **not** `game`; but "Super Mario Bros." → `game` | a character ≠ the game |

---

## 4. NIL protocol — `NIL_NO_ID` vs `NON_ENTITY`

Every mention that is not linked to an id carries exactly one NIL label. They are
**two different meanings** and the distinction is scored (`_EVAL-METHOD.md` §2,
"Learn to Not Link"):

- **`NIL_NO_ID`** — a **real, in-scope rigid individual that the KB genuinely
  lacks.** A *legitimate gold answer*, not an error. Examples: a TikTok
  "original sound", an indie product with no Wikidata item, a small local café
  not yet in Places, an amateur cover recording.
- **`NON_ENTITY`** — an **extraction error**: the mention is *not* a rigid
  in-scope individual at all — a generic kind, a proposition, a private unnamed
  person, or a mis-parse. It should not have been extracted as an entity.

**Decision:**

```
Is the mention a rigid, in-scope individual (passes the three construct tests)?
    YES, but no id after an honest search → NIL_NO_ID   (record failed_queries)
    NO  (kind / proposition / private / mis-parse)      → NON_ENTITY
```

**You MUST record `failed_queries` before assigning `NIL_NO_ID`.** List the
actual searches you ran against the authority (the schema *requires*
`failed_queries` to be non-empty when `nil = "NIL_NO_ID"`). This is what makes a
NIL auditable — a reviewer can re-run your searches. Example:

```json
{
  "mention_id": "m3", "surface": "original sound - user1234",
  "type": "music_recording",
  "nil": "NIL_NO_ID",
  "failed_queries": [
    "musicbrainz recording: user1234 original sound",
    "musicbrainz: <hummed hook> — no release match",
    "AcoustID fingerprint lookup — no result"
  ],
  "notes": "creator-original audio; joins on platform:tiktok soundId in-library"
}
```

`NON_ENTITY` needs no `failed_queries` (there was nothing to search for). Reserve
it for genuine over-extractions:

```json
{ "mention_id": "m7", "surface": "a good pizza place", "type": "place",
  "nil": "NON_ENTITY", "notes": "generic kind — not a rigid individual" }
```

Remember the schema invariant: `gold_id` **xor** `nil`. A mention never has both.

---

## 5. ID-verification protocol

**Every gold ID is verified against the live authority at label time by opening
the actual record. Never accept an id by name similarity** — a name-matched
wrong id is the worst outcome the metric punishes (`_EVAL-METHOD.md` §4, the
Φ_c penalty). The steps:

1. **Open the record in a browser** and confirm the entity *is* the referent:
   - `musicbrainz` → the **Recording** page; artist + title + version match.
   - `google_places` → Google Places / Maps; the establishment matches, and you
     **copy its name, formatted address, and lat/lng into `notes`** (Place IDs
     go stale — the readable anchor is what survives).
   - `wikidata` → the entity page; **check `P31`** matches the type
     (`person` = human/Q5; `screen_work` = film/series; `game` = video game;
     `product`/`brand_org`/`software_app` = the corresponding class).
   - `openlibrary` → the work/edition page; title + author match (ISBN =
     edition).
2. **Record the id** in `gold_id { authority, id }` using the normalized
   authority tokens (`musicbrainz`, `google_places`, `wikidata`, `openlibrary`).
3. **Record the snapshot** in `kb_snapshot { authority, retrieved }` —
   `retrieved` is the date (YYYY-MM-DD) you looked it up, so the benchmark stays
   reproducible against a moving KB (Wikidata edits, MB additions, Places
   churn). One snapshot per mention (a mention grounds to one authority).

```json
{
  "mention_id": "m1", "surface": "Joe's Pizza", "aliases": ["Joe's Pizza Bleecker"],
  "type": "place",
  "gold_id": { "authority": "google_places", "id": "ChIJ...Bleecker" },
  "kb_snapshot": { "authority": "google_places", "retrieved": "2026-07-08" },
  "notes": "Joe's Pizza, 7 Carmine St, New York, NY 10014 — 40.7305,-74.0027"
}
```

> **Schema note / reconciliation:** `gold.schema.json`'s `GoldMention` has **no
> dedicated fields** for a Place's name/address/lat/lng — they live in `notes`
> by the convention above (the frozen schema keeps mentions lean). Flagged in the
> task report.

---

## 6. Evidence and selectors — recording *where* a mention was seen

For each mention, record *where* in the item you saw it, using the **same closed
vocabulary the engine emits** (`schema/json/extraction.schema.json` §4 / ontology
§4) so gold and predictions describe provenance identically. Three things:

- **Channel** — the closed 6-value enum (never invent one):
  `VERBAL_AUDIO` (spoken), `VERBAL_TEXT` (caption / description),
  `VISUAL_SCENE` (something shown), `VISUAL_TEXT` (on-screen text / OCR),
  `NONVERBAL_AUDIO` (music / sound), `STRUCTURED_METADATA` (title, tags,
  attached sound name).
- **Quote** — the exact spoken or on-screen text where the mention appears (a
  denormalized snapshot; verbatim, so a reviewer can find it).
- **Timestamp / region fragment** — a Media-Fragments `t=` for video/audio (e.g.
  `t=12,19` = 0:12–0:19) or `xywh=` for a slide region; for a specific carousel
  slide, name the slide.

**Where to store it.** `gold.schema.json`'s `GoldMention` has no evidence block
(the full `Evidence` object — with `selector`, `channel`, `assertion_mode` — is
carried on the *engine's* `extraction.schema.json` records, not on gold). In the
gold record, capture the provenance compactly in **`notes`** using this
convention:

```
notes: "channel=VERBAL_AUDIO; quote=\"best slice is Joe's on Bleecker\"; t=8,13"
```

> **Reconciliation flagged in the report:** the brief asks for an evidence
> section, but the frozen gold schema stores no evidence fields — hence the
> `notes` convention above. The channel/selector *vocabulary* is authoritative
> (it is the engine's), the *storage location* on gold is `notes`.

**Why bother:** the quote + channel disambiguate the surface and drive the
`surface`/`aliases` decision (a song named in `STRUCTURED_METADATA` vs *heard* in
`VERBAL_AUDIO` are different evidence for the same recording), and they let the
final scorecard break accuracy out per channel / assertion mode
(`_ONTOLOGY.md` §8 — STATED should beat INFERRED).

---

## 7. Facets

Facets are the orthogonal, closed-vocabulary descriptors of the *item as a whole*
(not entities). In the gold record they live in the `facets` object as
`{ facet_name: value }` string pairs; **each value must be a member of the frozen
list** in `schema/vocab/facets.json` (enforced at runtime by
`schema_gate.validate_gold_record`). Assign a facet only when the item clearly
warrants it; leave it out when unclear. The nine facets and their **verbatim**
value lists:

| Facet | One-line definition | Closed values (from `vocab/facets.json`) |
|---|---|---|
| `topic` | the subject domain | `food` · `travel` · `fitness` · `fashion` · `tech` · `finance` · `home` · `entertainment` · `education` · `other` |
| `intent` | why the creator made it | `how_to` · `review` · `recommendation` · `haul` · `demo` · `meme` · `explainer` · `storytime` · `news` · `inspiration` · `other` |
| `genre` | the content form/genre | `tutorial` · `vlog` · `skit` · `edit` · `compilation` · `reaction` · `interview` · `documentary` · `performance` · `slideshow` · `other` |
| `affect` | the dominant emotional register | `funny` · `heartwarming` · `motivational` · `calming` · `exciting` · `sad` · `outrage` · `awe` · `cringe` · `neutral` |
| `creator_role` | the creator's stance | `expert` · `enthusiast` · `brand` · `journalist` · `entertainer` · `educator` · `unknown` |
| `viewer_orientation` | what the save is *for* | `do` · `buy` · `go` · `watch` · `learn` · `feel` · `save_for_later` |
| `presentation` | the shooting/format style | `talking_head` · `voiceover` · `text_overlay` · `cinematic` · `tutorial_demo` · `skit` · `compilation` · `reaction` · `slideshow` · `before_after` · `pov` · `room_tour` · `outfit_showcase` · `edit` · `other` |
| `content_provenance` | inferred origin of the footage | `original` · `repost` · `clipped` · `ai_generated` · `ai_assisted` · `unknown` |
| `actionability` | how load-bearing the recommendation is | `genuine_rec` · `informational` · `entertainment_only` · `promotional` · `ragebait_suspect` |

**Worked example.** A creator demonstrates a dumbbell routine to camera with a
motivational voiceover:
`{ "topic": "fitness", "intent": "how_to", "genre": "tutorial",
"affect": "motivational", "creator_role": "expert",
"viewer_orientation": "do", "presentation": "tutorial_demo",
"content_provenance": "original", "actionability": "genuine_rec" }` — every value
is drawn verbatim from the lists above.

> Values are **additive-only** in the vocab; if you truly need a value that isn't
> listed, use `other`/`unknown` for now and log it — never coin a new string
> (it will fail validation).

---

## 8. Concepts, Claims, StructuredContent (the non-entity layers)

These are captured (each is a separate gold block) and scored by their own
metrics, but are **not** part of the grounding headline. Brief rules:

### 8.1 Concepts — `concepts[]`

A **kind / idea / subject** with an authority node above threshold — including
**CulturalReference** (memes, trends, aesthetics). Open **multi-label subject
indexing**, *not* 1:1 linking: an item carries as many concepts as it is about.
Gold block `GoldConcept`: `{ concept_id, authority, label }`.

- Include: "flow state", "sourdough hydration", "ADHD", "progressive overload",
  "girl dinner" (CulturalReference).
- This is the **home of the over-typing failure mode**: a technique
  ("cable lateral raise"), a skill, a service, a genre — all Concepts, never
  entities.

### 8.2 Claims — `claims[]`

A **proposition** the item asserts. **Faithfulness, not truth** — record what the
video *says*, never whether it is objectively correct (`_EVAL-METHOD.md` §4).
Anchor it to its **evidence span** (the quote/timestamp, §6). Gold block
`GoldClaim`: `{ claim_id, statement }`. v1 captures the **one primary Takeaway
claim** per item.

- "This restaurant is worth the hype." / "Creatine is safe for women." → record
  the statement as claimed; do not adjudicate its truth.

### 8.3 StructuredContent — `structured[]`

**Shaped, slot-fillable content** with steps. Gold block `GoldStructured`:
`{ schemaOrgType, slots[{name, value}], steps[{order, text}] }`. Use a schema.org
shell: `Recipe`, `HowTo`, `ItemList`, `ExercisePlan` (Product, Event,
LocalBusiness, NewsArticle, Menu, SoftwareSourceCode, Trip also seeded).

- A protein-shake video → `schemaOrgType: "Recipe"`, ingredient `slots`, ordered
  `steps`.
- A dumbbell routine → `schemaOrgType: "ExercisePlan"`, `steps` in order.

---

## 9. Hard-case gallery (the seeded hard slice)

Per `_EVAL-METHOD.md` §3, the gold set **deliberately over-samples** ambiguous
cases so the benchmark is stress-tested, not flattered. Mark each with
`hard_case: true`. The seeded categories and their rulings:

### 9.1 Cover songs (`music_recording`)

- Ground to the **recording that plays**, never the composition (work).
- Studio original playing → the studio MBID.
- **Amateur / live cover** → almost always `NIL_NO_ID` (MB lacks the take); the
  work being famous does **not** license attaching the original's MBID.
- **Sped-up / remix / mashup** → a *distinct recording*; ground to that specific
  MBID if it exists, else `NIL_NO_ID`.

### 9.2 Chain restaurants (`place` vs `brand_org`)

- The chain named **as a brand** ("Starbucks raised prices") → `brand_org` (QID).
- A **specific visited outlet** ("the Starbucks on 5th & Main", or a shown
  storefront you can locate) → `place` (Place ID; name+address+lat/lng in
  `notes`).
- Named chain, no specific outlet identifiable → `brand_org`. Decide by
  **referent role**, and note the reasoning.

### 9.3 Ambiguous film / TV titles (`screen_work`)

- Shared surfaces ("The Office" US/UK, a remake vs original, same-title films
  across years) → disambiguate by **on-screen evidence** (cast, logo, language,
  release cues) to the specific QID.
- If truly unresolvable → pick by **dominant evidence**, set `hard_case: true`,
  and explain the residual ambiguity in `notes`. Do not guess silently.

### 9.4 Other recurring hard cases

- **TikTok original sounds** → `NIL_NO_ID` (record `failed_queries`); a real
  recording the KB lacks — *not* a NON_ENTITY.
- **Named private persons** ("my nutritionist Dr. Sarah") → `NON_ENTITY`;
  outside "public figures / named creators only".
- **Generic products / kinds** ("a good retinol serum") → Concept →
  `NON_ENTITY` if it was extracted as a `product`.

---

## 10. Inter-annotator agreement (IAA) plan

Agreement is measured with **chance-corrected coefficients only. Never report
raw percent agreement** — it is documented to inflate 33–41.2 pp over
chance-corrected coefficients and is uninterpretable under class imbalance
(`_EVAL-METHOD.md` §5).

| What is compared | Metric | Why |
|---|---|---|
| **which mentions were found** (span/set) | **pairwise F1** | Cohen's κ is undefined for span/set tasks without bounded negatives (Hripcsak & Rothschild 2005) |
| **type / NIL / ID decisions** (per matched mention) | **Krippendorff's α** | categorical, chance-corrected, handles missing data |

**Targets:** α **≥ 0.8** (good); **0.667 floor** (below this the label scheme is
too noisy to publish — fix the guideline, don't average through it).

**How the numbers are produced (solo-annotator protocol, §1.4 + `_EVAL-METHOD.md`
§5):**

- **Intra-annotator (test–retest):** re-label 10–15% ≥2 weeks later, prior
  labels hidden → intra-annotator α. This is the solo reliability number.
- **Pre-annotation bias:** the recall gap between the assisted pass and the
  15–20% **blind** control is the measured anchoring bias (report it; don't hide
  it).
- **Inter-annotator (publishable):** 1–2 additional people double-annotate
  50–100 items against *this* document → a publishable pairwise-F1 + α.

**The ceiling rule:** publish the IAA alongside the system score. **A system F1
above the human ceiling is meaningless** — high agreement under vague guidelines
is just *consistent wrongness*, which is exactly the failure this whole
instrument exists to prevent. If IAA is below the 0.667 floor, the fix is to
sharpen a rule in this document and re-label — not to ship the number.
