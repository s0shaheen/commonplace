# The Semantic Ontology — governing (Block 0.5)

> **The ontology the extractor emits, the schema types, and the grounder routes on — one, canonical.** It replaces the three conflicting type sets (`src/lib/types.ts`, `prompts/observe_video.md`, the retracted spike). It **builds up from** the dossier's researched foundation (doc 03: SKOS-faceted core + FRBR/IFLA-LRM Post/Save/Referent + typed grounding + class-vs-instance discipline) and the original build's **8-facet ontology** (the founder's prior "actual IP"), and **closes their shared gap**: both are *entity-centric*, so ideas/subjects/claims/skills fell through to a coarse domain facet or ungoverned tags. Grounded in current prior art; evidence + citations in `_RESEARCH-ontology-2026-07-07.md`. Governs `_EVAL-METHOD.md`'s scorecard.

## 1. The core idea: "grounding" is not one operation

A saved short video is *about* several different **kinds** of thing, and each kind resolves to a different authority by a different mechanism, and therefore is **measured by a different metric**. Forcing them all into named-entity instance-linking is the exact error that produced a flood of false NILs and an uninterpretable number. The durable model is a **small discriminated union of four Referent kinds + orthogonal Facets**, on the existing WEMI (Post/Save/Referent) spine. This *quadruples expressiveness for one new governed vocabulary* (the subject scheme) — claims are ungoverned-but-measured, structured content is governed externally by schema.org, skills/occupations adopt ESCO/O*NET wholesale. That 4×-for-+1 ratio is the anti-MPEG-7 discipline (expressiveness without governance cost).

## 2. The four Referent kinds + Facets (each: what it is · grounds to · metric)

| # | Referent kind | Axis / example | Grounds to (authority) | Grounding regime | Eval metric |
|---|---|---|---|---|---|
| 1 | **NamedEntity** | instance (Wikidata P31): *this song, this restaurant, Dune* | closed-KB **instance ID** — MusicBrainz MBID · Google Place ID · Wikidata QID · OpenLibrary OLID | closed-world entity-linking | **linking P/R/F1 + NIL + disambiguation** — *FLAGSHIP* |
| 2 | **Concept** | class/subject (P279): *ADHD, flow state, stoicism, sourdough hydration, progressive overload, UX design* | **pluggable authority** — own small SKOS scheme → `exactMatch` out to Wikidata classes + IPTC Media Topics (subjects) · ESCO skills P4644 (skills/techniques) · ESCO/O*NET P4652 (occupations, later) · MeSH (health) · LCSH (governed tree) | open-world, **multi-label ranked subject indexing** (NOT 1:1 linking) | **hierarchical F1@k** (micro+macro), True-Path partial credit, R-precision@k (k≈5) |
| 3 | **Claim** | proposition: *"cable lateral raises isolate the medial delt better"* | **nothing external** — target is the **source span** (grounded to the video, not the world); its `about[]` args reuse layers 1–2 | faithfulness-to-source | **faithfulness** (fraction entailed by the video) **+ coverage** (fraction of salient takeaways caught) — both mandatory |
| 4 | **StructuredContent** | schema.org shell: *Recipe · ExercisePlan · HowTo · ItemList* | schema.org **fields**; slot values point *down* into layers 1–2 | slot-filling | **Field Accuracy + Document Accuracy** + step recall/order |
| — | **Facets** *(the 8-facet IP)* | orthogonal: affect · topic · genre · intent · creator-role · viewer-orientation · presentation · provenance (+ actionability) | closed enums (own SKOS, mapped to IAB/IPTC) | classification | **per-facet macro-F1 + Cohen's κ** |

**Composition (WEMI):** `Save → Post → Referent`, and `Referent —isAbout (dcterms:subject / Wikidata P921)→ Concept —exactMatch→ wd:Q… (+lcsh +esco)`. A single save typically carries **both** an entity and concepts (a *Dune* review = NamedEntity(Dune→QID) + Concepts(science-fiction, film-criticism)) plus maybe a Claim and Facets. Concept is *one node type at different tree levels* — "subject/field" is just a `broader` concept than "theme"; do **not** make theme/subject/skill/occupation separate node types (that's the MPEG-7 explosion). Class-vs-instance is decided by **role, not string**: the same Wikidata item can be a NamedEntity instance elsewhere and a Concept subject here.

## 3. The decidable typing rule (a 3-way cascade — the extractor's contract)

For each normalized mention / aboutness candidate:
1. **Rigidity/cardinality (P31) test** — *is it a rigid individual?* ("one specific Joe's Pizza"; "this exact recording") → **NamedEntity** → instance ID.
2. Else it's a kind/idea/topic/skill/occupation (P279 character) → **Groundability test** — does a licensed concept authority hold a node above confidence τ? → **Concept** → subject vocabulary (hierarchical).
3. Else (emergent slang — "cortisol face", "body doubling", hyper-specific phrasing; no authority node above τ) → **free TAG** → NIL to authorities, **queued for warrant-promotion** into the controlled spine when it recurs and stabilizes (doc 03's folksonomy pressure-valve).

Orthogonally: a **proposition** (advice/thesis) → **Claim** (faithfulness, never linking); a **structured procedure** (recipe/workout/how-to/ranking) → **StructuredContent** (slot-filling). Over-typing generic services/skills into entities is the main failure mode — "coaching", "physiotherapy", "tax prep" are Concepts, not entities; only a proper name with one legal identity ("ClassPass") is a NamedEntity.

## 4. The scorecard is a MATRIX, never a scalar (this governs `_EVAL-METHOD.md`)

The four regimes have different denominators, chance baselines, and *meanings of "correct"* — so averaging them into one "accuracy %" is statistically incoherent **and dishonest**. The published artifact is a **matrix: one row per layer**, each with its own metric + n + confidence interval + publish-gate + grounds-to authority. **NamedEntity-linking is the named flagship**; the others are marked "in calibration" until powered. Publishing all four regimes, per-layer, with honest NILs and a human-ceiling comparison, is a rigor **no consumer competitor performs** — it *is* the moat, stated more honestly than a single number ever could.

## 5. The v1 cut (durable ontology, shippable first benchmark)

The full ontology above is **defined now** (so it's durable and additive-only later), but v1 **populates a deliberate slice**, and v2+ grows **without new node types**:

- **v1 ships:**
  - **NamedEntity** — grow resolvers from the 1 wired today (music) to the **4 clean-ID, high-save-intent types: `music_recording` (built) · `place` · `screen_work` (film/TV) · `book`.**
  - **Concept** — general subjects + skills, grounded to Wikidata classes + IPTC Media Topics + ESCO skills, hierarchical-F1@k eval.
  - **Facets** — the 8-facet layer (the founder's IP), classification eval.
  - **Claim** — exactly **one primary Takeaway** per video, faithfulness + coverage eval, honest NIL (no crisp thesis → no claim).
  - **StructuredContent** — **Recipe only** (highest-frequency actionable type), field+document accuracy.
- **v2+ grows (no new node types, just more authorities/rows/slots):** multi-claim graphs + cross-video Key-Point Analysis (canonical claims + prevalence + contradiction surfacing); occupations & service-categories (slot into Concept-with-ESCO/O*NET-authority); more structured shells (ExercisePlan, HowTo, ItemList); more entity types (`product`, `brand_org`, `software_app`, `game`).

## 6. The type hierarchy (machine-readable)

The node typology in `source|relation|target` form is `docs/product/_ONTOLOGY-hierarchy.txt` (taxonomist format) — the SKOS-exportable source of truth from which the TS types + JSON schema + `responseSchema` are generated. Core entity types, concept sub-schemes, facet vocabularies, and their `exactMatch` external anchors are enumerated there.

## 7. What this changes / preserves
- **Preserves:** doc 03's WEMI split, SKOS governance, class-vs-instance discipline, controlled-core + open-tag hybrid, warrant-based promotion; the 8-facet ontology (as the Facet layer); the built MusicBrainz grounding (a NamedEntity resolver).
- **Changes:** `EntityType` (flat 10-value union, only `media` wired) → the 4-kind discriminated union above; the single "grounding accuracy" number → the per-layer matrix; concepts/subjects/skills promoted from coarse facet/open-tag to a first-class, hierarchically-grounded Concept layer; claims promoted from a prompt field to a first-class faithfulness-scored node.
- **Grounding authorities (licensing-checked, commercial-safe):** Wikidata (CC0), IPTC Media Topics (royalty-free w/ attribution), ESCO (CC-BY-4.0), O*NET (CC-BY-4.0), LCSH & MeSH (public domain), OpenLibrary. **Rejected:** Dewey/UDC (proprietary), TMDB/Spotify APIs (ToS, per D3 — Wikidata carries their IDs as link-outs).

## Founder decision this needs
**Confirm the v1 layer cut (§5).** Recommendation: exactly as written — 4 entity types + Concept(subjects+skills) + 8 Facets + 1 Takeaway + Recipe-only. It's durable (the other layers are defined, just unpopulated), shippable (a tight first benchmark), and honest (per-layer matrix). The alternative — populating occupations/services/multi-claim/all-structured-types in v1 — multiplies annotation labor and NIL noise before the first publishable number, for breadth the schema already guarantees we can add later.
