# The Semantic Ontology — governing (Block 0.5), v2

> **The ontology the extractor emits, the schema types, and the grounder routes on — one, canonical.** Built to the **Commonplace Knowledge-Organization Engineering Standard** (`_KOE-STANDARD.md`); every section is validatable against its checklist. Builds up from the dossier (doc 03: SKOS-faceted core + FRBR/IFLA-LRM WEMI + typed grounding + class-vs-instance) and the original build's 8-facet ontology (the founder's prior IP). v2 folds the four founder upgrades (2026-07-07): **first-class multi-valued provenance**, a **cross-platform text-first base object**, **generalized + cultural grounding** (ESCO demoted), and conformance to an adopted standard. Evidence + citations: `_RESEARCH-ontology-2026-07-07.md`, `_RESEARCH-schema-foundations-2026-07-07.md`. Governs `_EVAL-METHOD.md`'s per-layer matrix scorecard.

## 1. The core idea: "grounding" is not one operation

A saved item is *about* several **kinds** of thing, and each resolves to a different authority by a different mechanism, and is therefore **measured by a different metric**. Forcing them into named-entity instance-linking is the error that produced a flood of false NILs. The durable model is a **small discriminated union of four Referent kinds + orthogonal Facets**, sitting inside a **cross-platform container** (§2), with **first-class provenance on every extraction** (§4). Four kinds, one new governed vocabulary (the subject scheme) — 4× expressiveness for +1 governance unit — the anti-MPEG-7 ratio the standard demands (minimal commitment).

## 2. The container: one cross-platform base object + per-platform profiles

Settled KO practice — *one base object + Application Profiles, SHACL-validated; never per-platform schemas* (Dublin Core Singapore Framework; DCAT→DCAT-AP→national profiles; Europeana EDM). This is what makes "map every restaurant across TikTok + IG + Reddit + X" possible and what makes the published-accuracy matrix poolable — the base is **load-bearing for the moat**, not a convenience.

- **The WEMI spine (unchanged):** `Save (Item) → Post (Manifestation) → Referent (Work)`.
- **Reused vocabularies (tenet 9 — reuse before build):** schema.org `CreativeWork` subtypes as the class spine (`SocialMediaPosting` w/ `sharedContent`, `DiscussionForumPosting` — Google already consumes it for Reddit, `VideoObject`, `Article`, `BlogPosting`); ActivityStreams 2.0 for graph edges (`inReplyTo`, `attributedTo`, `context`, `Collection`); **oEmbed's four types `photo · video · rich · link` ARE our `mediaKind`** (verbatim, with rich→link graceful degradation); Media RSS `media:group` for multi-rendition; OG/Twitter Cards as capture-time hints.
- **Base object core fields** (platform-neutral, mandatory): `canonicalId` + `permalink` (unique — the join key), `platform`, `actor/creator`, `createdAt`, `body/text`, `mediaKind`, `renditions[]`, `references[]` (quote/reply/repost edges), `collectionMembership`, `rawPayloadRef` (demoted, versioned).
- **A platform = exactly three artifacts:** a **DCTAP** table (12-column CSV the founder can read — pins the schema.org subtype, tightens cardinality, binds vocabularies) + a **SHACL** shape + an **adapter**. Adding a platform touches **zero base fields**. The **base SHACL shape must pass on 100% of items regardless of platform** (the cross-analyzability gate); platform-private fields (Reddit flair/score, X quote-edges, Substack sections) hang in a namespaced proxy sub-object (Europeana EDM proxy pattern), never in the base.
- **Why the four Referent kinds survive video→text:** the ontology never depended on modality. A Reddit essay or X thread flows through the *same* Referent/Concept/Claim/Facet machinery, the *same* grounding authorities, the *same* eval matrix — **only the provenance evidence-modalities shift** (spoken/OCR/scene → title/body/link). That invariance is the point.

## 3. The four Referent kinds + Facets (what the item is *about*)

| # | Referent kind | Axis / example | Grounds to | Regime | Metric |
|---|---|---|---|---|---|
| 1 | **NamedEntity** | instance (P31): *this song, this restaurant, Dune* | KB **instance ID** — MBID · Place ID · Wikidata QID · OLID | closed-world linking | linking P/R/F1 + NIL + disambiguation — **FLAGSHIP** |
| 2 | **Concept** | class/subject (P279): *ADHD, flow state, sourdough hydration*; incl. **CulturalReference** (memes/trends/formats) and, off-by-default, skill/occupation | **subject authority** (§5) — own SKOS → Wikidata classes + IPTC + ConceptNet/WordNet; cultural → own anchor + Wikidata QID | open multi-label **subject indexing** | hierarchical F1@k (micro+macro), True-Path partial credit |
| 3 | **Claim** | proposition: *"cable laterals isolate the medial delt better"* | **nothing external** — target is the **evidence span** (§4); `about[]` reuses layers 1–2 | faithfulness-to-source | faithfulness + coverage (both mandatory) |
| 4 | **StructuredContent** | schema.org shell: *Recipe · HowTo · ItemList* | schema.org **fields**; slots point down to 1–2 | slot-filling | Field + Document Accuracy |
| — | **Facets** *(8-facet IP)* | orthogonal: affect · genre · intent · creator-role… | closed enums (own SKOS → IAB/IPTC) | classification | per-facet macro-F1 + κ |

A single save typically carries **several at once** (a *Dune* review = NamedEntity(Dune→QID) + Concepts(science-fiction, film-criticism) + a Claim + Facets), and each occurrence carries its own provenance (§4).

## 4. Provenance is first-class, REQUIRED, and multi-valued (founder directive 1)

The layer that turns a benchmark into a moat: required evidence spans are exactly what let you *score faithfulness*, *stratify accuracy by how-we-knew*, and *render an honest receipt*. Composed from three standards — **PROV-O** (how it came to be: qualified derivation), **Web Annotation Data Model + Media Fragments URI** (where: typed selectors), **nanopublication** three-graph shape (the citable receipt). **Every extraction owns `evidence: Evidence[1..N]` — REQUIRED, non-empty. A zero-evidence extraction is a bug, rejected at write time.** The *same* entity legitimately arrives via several signals (Nike SHOWN as a logo *and* STATED in the caption) → two Evidence records, each with its own span, modality, assertion-mode, confidence.

```
Extraction { referent_ref · role∈{named_entity|concept|claim|structured_slot|facet}
             evidence: Evidence[1..N]   // required, non-empty
             grounding { authority · external_id | NIL · grounding_confidence }   // NIL first-class
             rollup_assertion_mode · rollup_confidence }
Evidence   { signal_ref
             selector { type∈{text_quote|text_position|media_temporal|media_spatial|whole_signal}
                        exact/prefix/suffix · start/end · t_start/t_end (#t=) · xywh (#xywh=) }
             quote                       // denormalized snapshot (receipt + eval)
             channel                     // Axis A — CLOSED ~6 (below)
             source_role                 // Axis B — EXTENSIBLE narrower concept
             assertion_mode∈{STATED|SHOWN|REPORTED|INFERRED}   // orthogonal to channel
             confidence                  // model's calibrated confidence THIS evidence supports it
             extractor_ref               // model id+version, prompt/pipeline version, run ts
             source_polarity/certainty   // claims only — the CONTENT's own stance (FactBank), ≠ model confidence }
Signal     { role · producer(asr@v|ocr@v|creator|platform_api) · wasDerivedFrom · content_ref }
```

**Enumerate vs generalize — the founder's question, answered with BOTH** (a two-axis SKOS scheme):
- **Axis A `channel` — CLOSED, ~6, by human perception not platform** (this is what keeps content cross-analyzable): `VERBAL_AUDIO` (speech) · `VERBAL_TEXT` (written language) · `VISUAL_SCENE` (imagery/objects/setting) · `VISUAL_TEXT` (on-screen/OCR) · `NONVERBAL_AUDIO` (music/sound) · `STRUCTURED_METADATA` (platform fields: creator, hashtags, music tag, subreddit).
- **Axis B `source_role` — EXTENSIBLE narrower concepts** that grow per platform *with zero base migration* (caption, narration, subtitle, comment, title, body, flair, quote-tweet…).
- **`assertion_mode` (STATED/SHOWN/REPORTED/INFERRED)** grounded in the linguistic evidentiality typology, **orthogonal** to channel — so "inferred from the visual scene" and "stated in the caption" are both first-class and distinguishable.
- **Derived-rendition nuance** (the founder's subtitle/transcript point): a transcript/OCR string is **not a peer signal** — it's a *derived* rendition. `Signal.wasDerivedFrom` keeps the chain (`extraction → span in transcript → transcript → derivedFrom → audio → partOf → Post`) so "the ASR misheard" stays distinguishable from "the creator misspoke."

The same shape populates cleanly for a **text-only post**: audio/visual channels empty, `VERBAL_TEXT` + `STRUCTURED_METADATA` populated — a valid, cross-analyzable item.

## 5. Grounding authorities — generalized + cultural, ESCO demoted (founder directive 3)

**Design rule (from the standard):** the moat is a dataset we *measure, store, and redistribute*, so the spine is **CC0/CC-BY authorities we can legally mirror**; ShareAlike/NC/proprietary sources are used **by reference/link only, never bulk-ingested.**

- **General-knowledge / commonsense spine:** **Wikidata (CC0)** = the universal ID hub + interlingua (every NamedEntity's domain ID reconciles to a QID; the cross-platform join key) — *and* the one clean authority that also covers internet culture. **IPTC Media Topics (CC-BY-4.0, native SKOS, ~1,100)** = the controlled-core **coarse subject backbone**, always assignable (never fully NIL at the coarse level) — the single best **de-niche-ification** lever. **Wikidata items** = fine concept grounding (P279/P31 hierarchy). **Open English WordNet (CC-BY)** = senses for disambiguation; **ConceptNet (CC-BY-SA, query-only)** = commonsense edges supporting INFERRED facets. **OpenAlex Topics (CC0)** = optional scholarly overlay, on only for educational/explainer content.
- **CulturalReference (memes / trends / formats / slang) — the under-served wedge:** modeled as a first-class **Concept sub-scheme with its own internal SKOS anchor** (durable, survives any external NIL), `closeMatch` out to a **Wikidata QID** where one exists (`internet meme` = Q2927074 is `P31` on thousands of items — the only commercially-clean meme-bearing authority). **Know Your Meme, TVTropes, Urban Dictionary, Genius = LINK-ONLY** (proprietary/NC — we deep-link and consult, **never ingest/redistribute**). The long tail Wikidata misses → **NIL + folksonomy-promotion loop**, which is exactly *where the moat compounds*.
- **ESCO reassessment (explicit, per the founder):** **demoted.** ESCO is an EU jobs/skills lens — the niche over-orientation to reject; saved videos are rarely about occupations. Occupation/skill grounding becomes an **off-by-default add-on** gated behind a career-content classifier; if ever needed, prefer **O*NET (CC-BY-4.0)** over ESCO (cleaner license). Not on the primary spine.
- **Rejected as primary runtime authorities:** BabelNet (NC — offline mapping aid only), DBpedia (ShareAlike hazard for a redistributed graph — prefer Wikidata CC0), TMDB/Spotify APIs (ToS — Wikidata carries their IDs as link-outs), Dewey/UDC (proprietary).
- **Join rule:** store the native authority ID for precision **and** the Wikidata QID for cross-analysis, linked by `skos:exactMatch/closeMatch`.

## 6. The decidable typing rule (the extractor's contract)

Per normalized mention: **(1)** rigid individual (P31 — one specific Joe's Pizza, this recording)? → **NamedEntity** → instance ID. **(2)** else a kind/idea/topic/meme/skill (P279) with an authority node above confidence τ? → **Concept** (routed by §5: subject→IPTC/Wikidata; cultural→Wikidata-meme+own-anchor; skill→off-by-default) → hierarchical. **(3)** else emergent (no authority above τ) → **free TAG** → NIL, queued for warrant-promotion. Orthogonally: a **proposition** → **Claim** (faithfulness); a **procedure** (recipe/how-to/ranking) → **StructuredContent** (slot-filling). Role, not string, decides (Stoicism-as-subject vs a named org). Over-typing generic services/skills into entities is the main failure mode.

## 7. The scorecard is a per-layer MATRIX (governs `_EVAL-METHOD.md`)

Four regimes, different denominators, chance baselines, and meanings of "correct" — a blended "accuracy %" is statistically incoherent **and** dishonest. The published artifact is a **matrix, one row per layer** (metric + n + CI + publish-gate + grounds-to authority), **NamedEntity-linking the named flagship**, others "in calibration" until powered. Grounding rows use **TAC-KBP metrics** (candidate→rank→NIL→NIL-cluster; in-KB vs NIL reported separately). Accuracy can additionally be **stratified by `assertion_mode`** (STATED entities should score higher than INFERRED — a check the provenance layer makes possible). Publishing all regimes honestly, with real NILs and a human ceiling, is rigor no competitor performs — it *is* the moat.

## 8. The v1 cut (durable ontology, shippable first benchmark)

Full ontology **defined now** (durable, additive-only); v1 **populates a slice**; v2+ grows **without new node types**:
- **v1 ships:** **base object** (TikTok + IG profiles, SHACL-validated) · **provenance** (Evidence required on every extraction — the receipt) · **NamedEntity** (grow resolvers 1→4: music/place/screen_work/book) · **Concept** (subjects via IPTC+Wikidata; **CulturalReference** via Wikidata-meme — the differentiator) · **Facets** (the 8-facet IP) · **Claim** (one primary Takeaway, faithfulness+coverage) · **StructuredContent** (Recipe only).
- **v2+ grows (no new node types):** more platform profiles (Reddit/X/Substack/LinkedIn/YouTube — each = DCTAP+SHACL+adapter); multi-claim + cross-video Key-Point Analysis; occupation/skill add-on (O*NET, gated); more structured shells; more entity types (product/brand/app/game/person).

## 9. What changes / preserves
- **Preserves:** doc 03's WEMI split, SKOS governance, class-vs-instance, controlled-core+open-tag, warrant promotion; the 8-facet ontology (as Facets); the built MusicBrainz resolver (a NamedEntity resolver); SPEC.md's consensus-base-object sentence (now formalized into validated profiles).
- **Changes (v1→v2):** flat `EntityType` → the 4-kind union *inside a cross-platform base object*; provenance promoted from a buried field to a **required, multi-valued, standard-based Evidence layer**; grounding authorities **generalized + cultural**, ESCO demoted; **CulturalReference** promoted to first-class; the whole design now **conforms to and is validated against `_KOE-STANDARD.md`**.

## Founder decision this needs
Confirm the **v1 cut (§8)** — recommendation as written. (This is a *populate-what* decision; the full ontology is durable either way, and the standard/provenance/cross-platform/authority architecture above is settled by the adopted prior art — no decision needed there, just execution + validation against the checklist.)
