# Document 03 — Engine: Classification Methodology and Cross-Domain Prior Art

**A Technical Design Document (argued)**

---

## BLUF (read this first)

**The recommendation, in three sentences.** Build the classification layer the way libraries, biomedical informatics, and the semantic web built theirs: a small governed faceted core, identified by stable opaque IDs, published as SKOS and mapped to external authorities, wrapped in an ungoverned open-tag layer for whatever social media invents next, and governed by a never-delete lifecycle so old labels never rot. Treat the concrete TypeScript schema in §5.2 as the *output* of that method — defended term by term — not a list we invented. This layer outlasts the pipeline, the models, and the UI, which is why it, and not they, is where the design effort belongs.

**The thesis, in five sentences.** (1) A saved social item is not one monolithic "type"; it is a core entity type crossed with orthogonal facets and resolved to a durable external referent. (2) Model those three things — post, save, referent — as separate nodes, or de-duplication and grounding break. (3) Govern the core as a versioned product with stable IDs and a never-delete lifecycle, so a label applied to item #37 in 2026 still means the same thing at item #40,000 in 2028. (4) Let an ungoverned open-tag layer absorb the emergent ("girl dinner") with zero governance latency, and promote from it into the core only on evidence (warrant). (5) The schema's first test is not kappa but Maya's retrieval success — can a real user refind and act on what she saved.

---

## Header block (status, authorship, keywords)

- **Status:** Proposed (v0.9). Supersedes the implicit, as-built model in `src/lib/types.ts` and `src/lib/ontology.ts`. Review is sought *before* the golden set grows past its ~106-item seed, because every label added under the wrong model must later be re-annotated.
- **Author:** Engine. **Reviewers sought:** the maintainers of the Grounding & Entity-Resolution and Evaluation designs, whose contracts this document constrains.
- **Requirement keywords (RFC 2119).** The numbered `REQ-n` items are load-bearing obligations handed to sibling docs; ordinary prose is argument, not contract. **MUST** = a hard requirement a downstream doc inherits. **SHOULD** = a strong recommendation, overridable with a recorded reason. **MAY** = a genuine option.
- **Place in the dossier.** Third of the engine documents. It answers the founder's four questions — how do we classify a saved item; what is common across platforms vs. per-platform; how do we build a taxonomy that is durable yet adaptable and govern it; how is this solved elsewhere — and *derives*, rather than asserts, the schema the rest of the engine builds on. It sits downstream of strategy (Market & Competitive Analysis; the JTBD/wedge memo) and upstream of the docs it hands contracts to (Capture & Data-Model; Grounding & Entity-Resolution; Evaluation).[^dossier]

---

## 1. Working backwards from Maya

### 1.1 The person this schema is for

Start with one user, because the schema exists to serve her.

**Maya** saves roughly 40 short-form videos a week — mostly recipes, some restaurants, the occasional workout. On Wednesday at 6pm she is in her kitchen, hungry, trying to remember the miso-salmon recipe she saved "a couple months ago." She opens TikTok, scrolls her Saved tab, gives up after two minutes of near-identical thumbnails, and orders takeout. That is the struggling moment: a recurring, deadline-bearing decision where the answer is trapped inside something she once saved.[^jtbd]

Maya does not care about our ontology. She cares whether she can refind the thing fast enough to act on it tonight. Every load-bearing decision in this document earns its place by producing an observable benefit for her:

- **The Post/Save/Referent split.** The miso-salmon *dish* is a durable Referent, distinct from the post. The four TikToks she saved about it collapse to one card; "salmon" + "miso" resolves to that card, not four look-alikes. Without the split she re-lives the Saved-tab scroll.
- **The open-tag layer.** When Maya searches "girl dinner" — a category no committee ratified — the open layer already captured it at save time and returns results immediately. A closed vocabulary would have dropped the term.
- **Grounding to external IDs.** The saved restaurant resolves to a real Google Place with hours and a map pin, so Maya acts instead of re-searching. That is the only way we beat her actual competitor: "just Google it again."[^jtbd]

**The success metric is hers.** The primary bar this schema must clear is a *retrieval* bar, measured on real users' own corpora: task success ≥ ~70% and time-to-refind meaningfully below the native-app baseline, across 5–10 users, with ≥40% answering "very disappointed" if the tool vanished.[^validation] Kappa and per-facet macro-F1 recur throughout this document, but they are *internal engineering proxies* — instruments that tell us whether the labels are consistent enough to trust. They are necessary, never sufficient. A schema with a beautiful kappa that does not shorten Maya's time-to-refind has failed the only test that matters.

### 1.2 What is being built, and why classification is load-bearing

The engine ingests items a user saved on social platforms (TikTok and Instagram first; X, Reddit, YouTube later) and produces, per item, three things: a **type** (restaurant, recipe, product, film, place…), a set of **facets** (cuisine, intent, medium, mood, price band), and a set of **grounded entities** (a Google Place ID, a TMDB ID, a MusicBrainz MBID). That triple is what the synthesis stage's `responseSchema` emits, what the golden set is annotated against, what grounding resolves into, what search and browse are built on, and — because the product is open-core — what a third party inherits when they adopt the ontology.

So the classification model is not a schema chore to defer. It is the contract between capture and everything downstream. Get it wrong and every stage inherits the mistake. The eval golden-set cannot assert what the model cannot represent. The grounding stage cannot resolve what the model conflates. The agency API cannot expose what the model buried.

The temptation for a solo builder is to model each platform's raw payload verbatim and unify "later." That is the trap. The raw payloads — TikTok's `itemStruct`, Instagram's Graph shape, X's v2 object — are the assets that rot *fastest*. They drift with every deprecation and carry signed CDN URLs that expire in hours. The durable core MUST therefore be an **abstraction over the platforms**, with the raw payload demoted to a captured, versioned artifact.

### 1.3 The as-built v0 we are evolving

The engine already classifies. `types.ts` defines a flat `EntityType` union of ten values (`place | restaurant | product | book | media | recipe | person | brand | link | other`), an `Enrichment` object (`entities`, `takeaways`, `on_screen_text`, `transcript`, a flat `facets` of `topic?`/`genre?`/`affect?`), and an `EntityIndexEntry` keyed by the string `` `${type}:${normalizedName}` ``. `ontology.ts` mirrors the entity list and adds a ten-value `FACET_TOPICS` enum. Fifty-four Vitest tests pin this; ~106 items are labelled against it; a 1,313-item real corpus exists as raw material.

This v0 works, but read against the prior art it has five latent defects that compound as the corpus grows:

1. **A flat enumeration, not a faceted decomposition.** `restaurant` and `place` overlap; `media` collapses film/TV/music/podcast; `product` and `brand` blur instance and class. Enumerative lists explode multiplicatively the moment real diversity arrives.
2. **Concept identity is the display string.** The index key *is* the English word, so renaming `media` or adding `workout` invalidates stored labels.
3. **No durable-referent node.** The model conflates "the TikTok" with "the restaurant it depicts," so fifty saves cannot collapse to one entity and the golden set cannot annotate the referent independently of the post.
4. **Facets are three fixed optional strings, ungoverned, with no open layer.** "Girl dinner" has nowhere to live but free text.
5. **Nothing is published, mapped, or versioned.** No SKOS export, no external mappings, no retirement lifecycle — so the open-core promise is unbacked and a golden-set label has no forward-migration path.

### 1.4 System context

```
  Platform (TikTok/IG/…)                    Engine (this doc governs the middle box)
  ─────────────────────      capture       ┌───────────────────────────────────────┐   ground     External authorities
  signed API responses  ───────────────▶   │  Adapter → Unified Item  → Classify    │ ───────────▶  Places / TMDB /
  (itemStruct, Graph,                       │   (per-platform)  (core model, §5.2)   │              MusicBrainz / OL / Wikidata
   v2 tweet, listing)                       │                    ├ core type+facets  │
                                            │                    ├ open tags         │              (SKOS mappings)
                                            │                    └ WEMI referent ────┼──────────────▶ durable external IDs
                                            └───────────────────────────────────────┘
                                                     │                    │
                                                golden set            responseSchema      →  search / browse / export / API+MCP
                                              (Eval doc)             (synthesis stage)         (consumer app + agency tier)
```

**In scope:** the unified cross-platform data model; the per-platform-vs-cross-platform analysis; the taxonomy methodology and its governance; the derived schema. **Out of scope (owned elsewhere):** capture/interception mechanics (Capture doc); the candidate-generation/rerank/NIL grounding algorithm (Grounding doc); the scorecard metrics (Eval doc). This document defines the *shapes* those docs operate on.

---

## 2. Goals and non-goals

**Goals.**

- **G1 — One unified item model** for any platform, with per-platform quirks confined to adapters, never leaked into the core.
- **G2 — Durable *and* adaptable.** Durable enough that a 2026 label still means the same thing at item #40,000 in 2028 (so the golden set doesn't rot and downstream IDs don't churn). Adaptable enough to absorb "girl dinner" the week it trends. Success is judged first by Maya's retrieval metric, only secondarily by the consistency proxies.
- **G3 — Derived from and traceable to prior art**, so every degree of freedom is paid for by a constraint and every choice can be defended by pointing at a system that survived decades of the same pressure.
- **G4 — Grounding is a typed projection, not a translation.** Classification output MUST line up with schema.org / external-authority classes, so resolving to a Place/Movie/Recipe is a projection of the model, not a rewrite.
- **G5 — Governable by one person** at ~10–20 hrs/wk: a written editorial guide, versioned releases, never-delete migration, warrant-based promotion — each cheap enough to be real.

**Non-goals.**

- **NG1 — No maximally expressive multimedia schema.** MPEG-7 is our cautionary tale: expressiveness without constraint destroys inter-annotator agreement and thus the golden set. We choose a modest core with strong constraints.
- **NG2 — No platform-breadth race for v1.** Depth on TikTok+Instagram beats shallow coverage of fourteen platforms. The model MUST *admit* new platforms cheaply without our *chasing* them.
- **NG3 — No full OWL ontology with arbitrary typed relations.** We build a taxonomy plus faceted controlled vocabulary plus open tags. Relations beyond broader/narrower/related and cross-scheme mapping are out.
- **NG4 — No real-time committee governance.** Governance is asynchronous, scheduled, and data-driven.
- **NG5 — No ad-sales / brand-safety scoring as such** — but we borrow the *orthogonal safety axis* as an actionability/confidence facet, because "is this a genuine rec or ragebait dressed as one" is a real need for Maya.

---

## 3. Prior art: twelve disciplines, then five media standards, converge on the same properties

This is the intellectual core. The founder's fourth question — *how is this solved elsewhere?* — is not a literature review for its own sake; each system dictates a specific, non-optional property of our schema. §3.1–§3.12 work through **twelve governed-vocabulary disciplines across five fields** (library science, biomedical informatics, the semantic web, ad-tech, and collaborative-knowledge systems). §3.13 then collects the **five media-interchange standards** that answer the separate cross-platform question. The convergence across centuries-to-decades of independent practice is the strongest possible signal that these properties are necessity, not taste.

### 3.1 Ranganathan / faceted classification — *decompose before you enumerate*

Colon Classification (1933) is the first fully faceted scheme, and its move is *analytico-synthetic*: rather than pre-enumerate every subject as a fixed pigeonhole (the Dewey/LCC way), decompose it into a few orthogonal **facets**, classify along each independently, and *synthesize* the compound at retrieval time. His PMEST — Personality, Matter, Energy, Space, Time — matters less than its **combinatorial economics**: N facets of k values each cover kⁿ concepts with only N·k governed terms.[^ranganathan]

Our v0's flat ten-value list is the enumerative anti-pattern. A saved item is a *core entity type* (Personality: restaurant, film, recipe, product) crossed with facets — cuisine/genre (Matter), intent/action (Energy: how-to, review, haul, demo), place (Space), trend/era (Time). Faceting is also what makes *per-facet* macro-F1 possible: you can score each dimension and revise "cuisine" without touching "intent."

> **REQ-1 (MUST).** The core MUST declare its fundamental categories before populating them: a small closed set of core entity types, plus a small set of independently-governed orthogonal facets. Each facet MUST map to exactly one field in the synthesis `responseSchema`.

### 3.2 Dublin Core — *small stable core + application profiles + graceful degradation*

Dublin Core is Ranganathan's counterweight: fifteen deliberately generic elements.[^dc] Two inventions are load-bearing.

The **application profile** — how a shared vocabulary is "used, constrained, or combined with more specialized vocabularies to meet the requirements of specific applications" — reconciles a stable shared core with per-tier extension. Publish a small core; let the consumer app, the agency tier, and any external adopter each declare a profile that *constrains and extends* the core, never forking it. The consumer profile might use six entity types and three facets; the agency profile the same core plus twenty vertical facets. A label under either still validates against, and degrades to, the shared core. This is the mechanism behind the two-depth product strategy.

> **REQ-2a (SHOULD).** The consumer-v1 profile SHOULD surface ≤3 facets to the user, even though the core MAY compute more. Facets computed but not shown remain available to search and export.

The **dumb-down principle** — a consumer that doesn't understand a refinement drops the qualifier and treats the value as the broader element, "still generally correct and useful for discovery" — is a hard constraint. If the engine coins "natural-wine bar," a client that knows only "restaurant/bar" must still get a correct, coarser answer. This is what lets the taxonomy grow at the leaves forever without breaking older data — the precondition for a version-locked golden set to survive.

> **REQ-2b (MUST).** Every specialization MUST roll up losslessly to a concept in the stable core.

### 3.3 FRBR / IFLA-LRM — *model the durable referent separately from the post and the save*

WEMI separates **Work** (the abstract creation) → **Expression** (a realization) → **Manifestation** (a published embodiment) → **Item** (the copy in hand).[^frbr] The parallel to saved video is exact, and v0 gets it wrong. Save a TikTok *about Dune* and there are four entities. The **Work** is the film — grounds to a stable TMDB ID, dedupe target across the fifty TikToks that mention it. The **Expression** is this creator's review. The **Manifestation** is the specific post plus caption. The **Item** is the user's save, with their collection membership and save-date. A restaurant clip is the same shape: the restaurant is the Work-analogue (a durable Place ID, stable across every clip); each clip a Manifestation; each save an Item.

Collapsing "the post" and "the referent" — which v0 does — is what makes competitors' de-dup and grounding brittle. This split is what gives Maya her one miso-salmon card. It also lets the golden set score the referent (grounding P/R/F1) independently from the post's type (classification accuracy). YouTube already ships this: a `playlistItem` (the saved-reference, with position and note) is distinct from the `video` it references.[^yt]

> **REQ-3 (MUST).** The model MUST represent the grounded external referent (Work) as a first-class node, distinct from the captured post (Manifestation) and the save event (Item).

### 3.4 IPTC Media Topics — *a taxonomy is a released product, and healthy ones shrink*

IPTC's ~1,100-term Media Topics vocabulary is the closest analogue on the *subject* axis. It is published as SKOS, on a quarterly release cadence, with a published governance process. The instructive part: its 2023-Q1 update modified nearly 200 terms and executed many **retirements**, deliberately trimming the vocabulary back to exactly 1,100 terms.[^iptc]

Two lessons. A media taxonomy ships on a schedule with changelogs, so downstream systems can plan migrations. And — counter-intuitively — healthy vocabularies shrink as well as grow, the antidote to the folksonomy failure mode where a vocabulary only accretes. IPTC also validates publishing our core *as SKOS*, the lingua franca that makes it interoperable and mappable.

### 3.5 MPEG-7 — the cautionary tale: *death by expressiveness*

MPEG-7 aimed to describe multimedia comprehensively and became "extremely large and difficult to implement fully," with redundancy and overlap; its flexibility "increase[d] the complexity of descriptions and cause[d] ambiguities which hinder interoperability." Profiles were bolted on to tame it but "lack the semantic constraints necessary for interoperability." It never achieved mainstream adoption.[^mpeg7]

This is the direct justification for NG1 and for a *closed enumeration at the core with a genuinely restrictive `responseSchema`* rather than "let the VLM emit any tags it likes." An expressive vocabulary with weak constraints is *worse* than a modest one with strong constraints: two VLM runs describe the same clip differently, agreement collapses, kappa craters, and the golden set stops being ground truth.

> **REQ-4 (MUST).** Every degree of freedom in the schema MUST be paid for with a constraint: a definition, an enumeration, a scope note, or a validation rule. The `responseSchema` MUST constrain governed facets to closed enumerations. Unpaid freedom is prohibited in the governed core.

### 3.6 schema.org — *core + `additionalType` + `pending`: a three-tier lifecycle at web scale*

schema.org solved "one shared vocabulary, thousands of independent extenders." It has stable spines (`CreativeWork` → `MediaObject` → `VideoObject`), decouples extension from the core (the steering group "does not officially approve external extensions"), provides `additionalType` to attach "more specific types from external vocabularies or authorities like Wikidata … in the form of URLs," and incubates candidate terms in a **`pending`** area before promotion. Its `SocialMediaPosting.sharedContent` property models a quote-tweet or crosspost vendor-neutrally, beating any platform's ad-hoc `quoted_status`.[^schemaorg]

This is the exact three-tier lifecycle a fast-moving taxonomy needs. A **stable core** is safe to build on. A **`pending`** tier is usable but explicitly provisional — where a "girl dinner"-class concept lives before it earns promotion. An **`additionalType`-by-URI escape hatch** attaches a Wikidata Q-ID or IPTC topic for anything the core doesn't cover, without a core change. That escape hatch is *also the grounding story stated as vocabulary policy*: an unknown niche concept degrades to a linked-data pointer, not a garbage free-text tag.

> **REQ-5 (MUST / MAY).** The taxonomy MUST provide three tiers — stable core, `pending` staging, and an external-URI escape hatch. Concepts the core does not yet cover MUST degrade to an `additionalType` URI rather than an uncontrolled free-text type. Emergent concepts MAY live in `pending` and MUST be flagged provisional until promoted.

### 3.7 IAB Content Taxonomy / GARM — *stable IDs, mutable labels; safety as an orthogonal facet*

IAB Content Taxonomy 3.0 is a tiered tree with stable numeric IDs; its 3.0 release "did not introduce new concepts" yet caused breaking changes by removing parent categories — a lesson in confining breaking changes to *structure* and versioning them. GARM's Brand Safety & Suitability framework layers *orthogonally* on top: the same topic is Low-risk as news, higher-risk as entertainment, scored High/Medium/Low.[^iab]

Two things follow. Identity must be decoupled from display, so renames never break stored data (the fix for v0 defect #2). And safety/quality is not a content type but a separate axis: the same restaurant clip is "restaurant" on the content axis *and* carries an independent actionability/confidence signal (genuine rec vs. ragebait), which is where the agentic-verification stage's confidence escalation surfaces. This is a consumer feature, not just ad-tech: it is how Maya tells a real rec from ragebait dressed as one.

> **REQ-6 (MUST).** Concept identity MUST be an opaque, stable `conceptId`. Display labels (`prefLabel`) MAY change freely. Every category MUST be referenced by its `conceptId`, never its English string. Actionability/confidence MUST be an orthogonal facet, MUST NOT be baked into the entity type, and MAY be graded (see Q3).

### 3.8 Wikidata / DBpedia — *distinguish class from instance, or the VLM will not*

Wikidata separates **`instance of` (P31)** — Everest *is an instance of* mountain — from **`subclass of` (P279)** — volcano *is a subclass of* mountain — with P279 aligned to `rdfs:subClassOf` so external OWL/RDFS ontologies interoperate. Its documented pathologies (making "baker" a subclass of "occupation" wrongly implies every baker is an occupation) are the *exact* error a VLM commits unprompted: it will tag a specific restaurant as a *subtype* rather than an *instance*.[^wikidata]

So the taxonomy defines *classes* (restaurant, film); grounding links *instances* (this restaurant → this Place ID). And because P279 is `rdfs:subClassOf`, publishing our core as SKOS/RDF lets every core type be mapped to a Wikidata class — a durable external anchor and the same graceful-degradation hatch as `additionalType`.

> **REQ-7 (MUST NOT).** The schema MUST enforce the instance-vs-class distinction. Class-level taxonomy concepts and instance-level grounded entities MUST NOT be conflated.

### 3.9 Folksonomy vs. taxonomy vs. ontology — *the controlled-core / open-tag hybrid*

The design space has three archetypes with a well-documented trade curve. Folksonomies (flat, uncontrolled user tags) "scale to user intent rapidly but produce synonym chaos" and respond "swiftly to changes in terminology and world events"; controlled vocabularies are "characterized by rigid structures and slow responsiveness to new terminology." The literature's resolution is an explicit **hybrid**: a governed core *complements* the disadvantages of folksonomies, and several bodies of work *derive* ontologies from folksonomy plus controlled-vocabulary combinations.[^folksonomy]

This is the central architectural recommendation, corroborated by every other system here. The open layer captures "girl dinner" the day it trends, giving embedding/full-text search something to bite on immediately — Maya's "searchable today" benefit. The open tags are then the *raw material* for principled promotion (§3.12). Note the corroborating observation that taxonomies alone are too rigid and text search alone too weak, which is exactly why the engine pairs a controlled schema with embedding retrieval.

> **REQ-8 (MUST / MAY).** The engine MUST run a governed controlled core (closed enumerations, stable IDs) alongside an ungoverned open-tag layer. `openTags` MAY be free text, MUST be stored and searchable, and MUST NOT be used as the golden-set classification target.

### 3.10 SKOS — *the interchange format that makes all of the above composable*

SKOS models **concepts** identified by **URIs**, grouped into **concept schemes**, each with one `prefLabel` per language plus many `altLabel` synonyms, hierarchy via `broader`/`narrower`, association via `related`, and cross-scheme mapping via `exactMatch`/`closeMatch`/`broadMatch`/`narrowMatch`.[^skos]

Three features are load-bearing and together make "open-core, durable, mappable, versionable" true *simultaneously*. **URIs as identity** operationalize "stable ID, mutable label": the concept *is* its URI, `prefLabel` is presentation, and `altLabel` absorbs the synonym chaos the open layer generates — "restaurant," "resto," "eatery," "spot" collapse to alt-labels of one concept. **Mapping properties** attach our core to grounding authorities: `exactMatch` from our "film" concept to the TMDB/Wikidata class — the grounding-and-degradation policy expressed in a standard vocabulary. **Concept schemes** are the application-profile boundary: the consumer and agency profiles are distinct schemes over shared concepts.

> **REQ-9 (MUST).** The core MUST be published as SKOS: every core type and facet value is a `skos:Concept` with a URI, one `prefLabel`, zero-or-more `altLabel`s, and a scope-note definition. IPTC proves this works at ~1,100 terms.

### 3.11 SNOMED CT / Gene Ontology / MeSH — *never delete; account for every edit; govern as a released product*

The three largest continuously-maintained scientific vocabularies independently converged on the same lifecycle — the strongest signal in this survey.

**Never delete — deprecate with provenance.** GO never deletes terms; status changes to obsolete, the label is prefixed "obsolete," and the rationale is recorded. SNOMED CT *inactivates* rather than deletes and — the part to copy exactly — requires a **coded inactivation reason** (Duplicate, Ambiguous, Outdated, Erroneous, Non-conformance) plus, where possible, a **historical association** ("Replaced by," "Possibly replaced by").[^snomed] This keeps historical data valid across versions: a golden-set label on a retired concept resolves forward through its replacement, so retirements never silently invalidate old annotations — the property that lets a version-locked golden set survive taxonomy evolution.

**A logical invariant on every edit.** GO's **True Path Rule** — the path from any child up to its top parent must always be true, so anything annotated to a term is correctly described by *all* its ancestors — is Dublin Core's dumb-down principle restated as an ontology invariant.[^go] It becomes a tested CI invariant of our taxonomy: every leaf's ancestor chain must be semantically true, checked on every release.

**Scheduled releases + QA sampling + written editorial policy.** SNOMED ships versioned editions with release notes; MeSH revises descriptors annually with entry-terms (the `altLabel` layer) and scope notes; GO runs continuous biocuration in which a large majority of annotations flagged for review are subsequently modified or removed — a figure reported at roughly **70–80%**, though the exact percentage should be confirmed against the primary GO curation report before any external citation.[^go] Even at the lower end this is an empirical reminder that expert labels carry substantial error, which is why the Eval doc's LLM-judge MUST be kappa-validated against humans and never trusted raw. Each body keeps a *written editorial guide*. For a solo maintainer this matters *more*, not less: it is what lets the VLM prompt, the human annotator, and future-you apply the taxonomy consistently.

> **REQ-10 (MUST / MUST NOT).** Concepts MUST be inactivated, never deleted; each inactivation MUST carry a coded reason and (where one exists) a replacement association. Every release MUST pass a True-Path CI invariant. The LLM-judge MUST be kappa-validated against human labels and MUST NOT be trusted raw.

### 3.12 Warrant — *the discipline for when a term earns its place*

LIS answers "on what basis does an open-layer tag get promoted?" with **warrant**: literary (attested in the actual documents), user (what users search/say), structural (fits the scheme), plus epistemic.[^warrant] Promotion becomes an objective, auditable, logged test, not one person's whim. Literary warrant = frequency in the captured corpus (a candidate appears in ≥N distinct items across ≥M users); user warrant = search-log demand; structural warrant = it fits a facet and obeys the True Path Rule. This stops the core bloating (the MPEG-7 failure) *and* ossifying against usage (the controlled-vocab failure), and makes the open-core's growth *evidenced*.

> **REQ-11 (MUST).** An open tag MUST clear literary, user, and structural warrant before promotion to the core, and each promotion MUST be logged.

### 3.13 The per-platform vs. cross-platform question: five standards already converged on the base object

The founder's second question — what is common vs. per-platform — has a clean answer, because five independent open standards already solved "an item someone did something to" and *converged*.[^standards]

- **Activity Streams 2.0 / ActivityPub** gives the **actor–activity–object–target quad**: someone (actor) does something (activity) to content (object), optionally into a container (target) — almost exactly "user saved a TikTok into a collection." Mastodon's serialization carries an `attachment[]` array with `remote_url`, `thumbnail_remote_url`, `description` (alt text), and — reportedly — a `blurhash` placeholder as a first-class field, which would validate our ThumbHash/eager-poster-capture plan as standard practice rather than a hack.
- **schema.org** supplies the type hierarchy and the grounding vocabulary; aligning to it makes grounding a projection (G4).
- **Open Graph** is the universal degraded path: whatever a platform withholds, the shared outbound URL almost always yields an `og:*` card — a modeled capture field, not a render-time scrape.
- **oEmbed** collapses embeddable content to four types — `photo`, `video`, `rich`, `link` — which is almost exactly the right top-level `mediaKind` enum and the template for our presentation projection.
- **Media RSS** contributes `media:group` — "a grouping of `media:content` elements that are effectively the same content, yet different representations" — which is precisely TikTok's `playAddr` / `downloadAddr` / `bitRateList` tiers: one logical asset, many renditions.

The convergence is the signal. A federation protocol, a search vocabulary, a share-card protocol, an embed protocol, and a syndication format independently landed on the same base object. That object has a type, a canonical URL/id, an author/actor, a timestamp, and a text body. It carries a set of attached media renditions. It optionally wraps another object, and optionally sits inside an ordered collection. That is our base entity — the intersection of five battle-tested standards, not a guess.

Against that base, the per-platform divergences are the flesh, and they are exactly what adapters localize. **These platform-shape claims describe current APIs and MUST be re-verified against live payloads before the adapter is built** — social APIs deprecate without notice:[^platforms]

- **TikTok** `itemStruct`: a single struct is *either* a video *or* a slideshow, reportedly discriminated by `imagePost` / `image_post_info.images[]`; `music` is a first-class licensed entity with a stable id (a MusicBrainz/Spotify grounding hook); `subtitleInfos` sometimes gives platform-authored captions (prefer over WhisperX to save cost); `poi` gives a location tag; `diversificationLabels` is TikTok's *own* classification (a useful weak-supervision signal, never ground truth).
- **Instagram** Graph: `media_type ∈ {CAROUSEL_ALBUM, IMAGE, VIDEO}`; carousel *children* reportedly expose media but no independent `permalink` and no per-child metrics — so a naïve peer model produces phantom nulls. Model a carousel as a parent-with-identity-and-metrics owning child-media-without-identity.
- **X** v2: `referenced_tweets[]` reportedly unifies retweet, quote, and reply into one `{type, id}` mechanism distinguished only by an enum; media is normalized into an `includes.media[]` sidecar via `media_keys`. This is the strongest argument for a *reference-typed edge* between items.
- **YouTube** v3: the part-based `video` (`snippet`/`contentDetails`/`statistics`) plus the thin `playlistItem` wrapper — the cleanest real-world model of saved-reference-vs-content.
- **Reddit** is the stress test: a `Listing` of `{kind, data}` things with fullname-prefixed types (`t1_`/`t3_`/…), and a single `t3` link can be self-text, link, gallery, native video, *or* crosspost — the ultimate argument for a discriminated-union content model with a wrapping edge.

> **REQ-12 (MUST / MUST NOT).** The core MUST be a single unified object at the intersection of the five standards. Platform quirks MUST be confined to adapters. The raw payload MUST be demoted to a versioned, captured artifact and MUST NOT leak past the adapter boundary. Commonality lives in the core; divergence lives in adapters.

---

## 4. A faceted SKOS core with a Post/Save/Referent split, derived not asserted

The design *is* the methodology; the TypeScript is its **output**. §4.1 gives the method, §4.2 derives the schema term by term, §4.3–§4.4 give the flows and the explicit trade-offs. Presenting the schema first would be asserting it; the brief demands it be defended as a derivation.

### 4.1 The seven-step methodology

Each step traces to the disciplines above; the parenthetical REQs are the obligations it satisfies.

**A. Declare the fundamental categories first, then populate** (REQ-1, REQ-4). Fix a *closed* set of ~6–10 core entity types (Personality) and a small set of orthogonal facets (intent/Energy, domain/Matter, space, trend/time, and an orthogonal actionability/confidence facet). Each facet is a closed enumeration mapping to one `responseSchema` field. This closed set is core v1.0, and it is what the golden set is (re-)annotated against.

**B. Structure it as SKOS with stable opaque URIs** (REQ-6, REQ-9). Every type and facet value is a `skos:Concept` with an opaque URI, a `prefLabel`, `altLabel`s (the synonym sink), and a scope-note definition (the constraint that keeps annotation reproducible). The consumer-v1 and agency profiles are two `skos:ConceptScheme`s over shared concepts. This SKOS file *is* the open-core artifact.

**C. Map every core concept to an external authority** (G4). `exactMatch`/`closeMatch` to a Wikidata class plus the per-type grounding authority (Places, TMDB, MusicBrainz, Open Library). This makes grounding a *typed* operation — `type → authority → instance ID` — and gives every unknown a graceful degradation target.

**D. Run three layers at inference** (REQ-3, REQ-8). (1) Synthesis assigns core type + facets under a restrictive `responseSchema`. (2) It also emits free **open tags** — stored, searchable, ungoverned. (3) Grounding links the WEMI *referent* to an external ID, kept distinct from post and save.

**E. Enforce invariants in CI** (REQ-7, REQ-10). True-Path/dumb-down check on every release (every leaf rolls up truthfully); class-vs-instance check; every retired concept has a coded reason + replacement.

**F. Govern as a versioned product** (REQ-10). Semver taxonomy releases with a changelog; never delete — inactivate with reason + successor so the golden set migrates forward; a written editorial guide as the solo-maintainer reproducibility substrate. Re-run the six-axis eval each release; validate any LLM-judge against human labels with kappa.

**G. Promote by warrant** (REQ-11). Periodically mine open tags; a candidate earns promotion when it clears literary, user, and structural warrant. Promotion is logged — this is how the open core *visibly, defensibly* grows.

### 4.2 The derived schema (the output — defended, not asserted)

The unified item is the AS2 / schema.org / oEmbed intersection with WEMI separation. Concretely, evolving the as-built `types.ts`:

**(1) `CapturedItem` → three separated nodes** (REQ-3, REQ-12). The single struct splits into the WEMI-informed trio:

- **`Post`** (Manifestation): platform, canonical URL, author/actor, `createTime`, `desc`, `mediaKind ∈ {photo|video|rich|link}` (oEmbed), a `renditions[]` list (Media RSS `media:group`), `references?: {relation: "quote"|"reply"|"crosspost"|"repost", postId}[]` (the X `referenced_tweets` / schema.org `sharedContent` unification), and `rawPayloadRef` (the demoted, versioned raw artifact). Instagram carousels model as a Post with `children: Post[]` where children carry media but no independent metrics.
- **`Save`** (Item): `savedAt`, `collectionIds`, user note, position — the YouTube-`playlistItem` analogue. This is the only node that is *the user's*.
- **`Referent`** (Work): the grounded external entity — `{ typeUri, authority, externalId, confidence, prefLabelResolved }` — deduped across all Posts that depict it. Owned jointly with the Grounding doc.

Why this and not v0's flat struct: it is the only shape that lets fifty saves of one restaurant collapse to one `Referent` (Maya's card), lets the golden set score classification (on `Post`) and grounding (on `Referent`) on separate axes, and confines platform quirks to the adapter that produces `Post`.

**(2) `EntityType` (flat union) → a faceted core keyed by stable URI** (REQ-1, REQ-6, REQ-7). The v0 ten-value union is replaced by a closed set of core entity types as SKOS concepts. Each concept has an opaque `conceptId` (e.g. `atc:type/eatery`), a mutable `prefLabel`, `altLabel[]`, a `scopeNote`, and `mappings` (`exactMatch` → Wikidata Q-ID + grounding authority).

The **proposed v1.0 starting core** — a *proposal*, not a settled fact; some concepts may start in `pending` rather than the stable core, per Q4 — consolidates and de-blurs v0: `place`, `eatery`, `recipe`, `film_or_show`, `music`, `book`, `product`, `workout`, plus two provisional candidates, `style_look` and `general` (the latter replacing the semantic dead-end `other`). Whether `style_look` and `general` earn stable-core membership or begin in `pending` is Q4 — an open question, not a decided REQ.

Three deliberate changes, each with a reason. `media` splits into `film_or_show` + `music`: they ground to *different* authorities (TMDB vs MusicBrainz), so the typed-grounding rule forbids collapsing them. `brand` is demoted from a type to a facet/instance: it was a class/instance confusion. `person` and `link` are demoted too — `link` is a `mediaKind`, not an entity type, and `person` is a facet. The English words are display labels; the durable identity is the `conceptId`. This alone fixes the rename-breaks-everything defect.

**(3) Flat `facets: {topic, genre, affect}` → a governed faceted block + an open-tag list** (REQ-1, REQ-4, REQ-6, REQ-8). The three fixed strings become closed-enumeration facets: `intent` (Energy: how-to|review|haul|recommendation|demo|meme|explainer), `domain` (Matter: the `FACET_TOPICS` vocab promoted to SKOS concepts), `trend` (Time), and an orthogonal `actionability` (graded genuine-rec ↔ ragebait/spam, carrying the agentic-verification confidence). *These facet enum values are also a v1.0 proposal, tunable per the editorial guide.* They are joined by `openTags: string[]` (the ungoverned folksonomy layer) and `additionalTypes: string[]` (URIs for anything the core doesn't cover). The `responseSchema` constrains governed facets tightly and lets `openTags` be free.

**(4) `EntityIndexEntry` key `type:normalizedName` → concept-URI + referent-id** (REQ-6). The index keys on the stable `conceptId` and the `Referent.externalId`, not the English string — so renames and synonyms never fracture the index.

This schema is a strict, backward-*migratable* evolution of the 54-test v0. Adapters keep producing the same fields, which are *lifted* into `Post`/`Save`/`Referent`; the ten `EntityType` values map to core concepts via a one-time recorded migration, so the ~106 golden labels carry forward rather than being thrown away.

### 4.3 Key flows

- **Ingest:** raw payload → *adapter* (per-platform) → `Post` (+ `children`, `references`, `renditions`) + `Save`; raw demoted to `rawPayloadRef`.
- **Classify:** synthesis emits, under `responseSchema`, `{coreType: conceptId, facets: {...}, openTags: [...], additionalTypes: [...]}`.
- **Ground:** for the `coreType`, look up `mappings.authority`, run candidate-gen + rerank + NIL (Grounding doc), write/dedupe a `Referent`.
- **Govern (offline, scheduled):** mine `openTags` → warrant test → promote to core → cut a semver release → run CI invariants → migrate golden set forward → re-run scorecard.

### 4.4 Trade-offs made

- **A heavier three-node model over v0's single struct.** More code, more joins. Accepted because de-dup, dual-axis eval, and multi-platform all collapse without it. The cost is paid once; the mistake would be paid on every downstream stage forever.
- **The up-front cost of SKOS + stable URIs + an editorial guide.** Real work for a solo maintainer. Accepted because it is the *only* thing that makes durable-yet-adaptable, open-core, and forward-migratable golden sets simultaneously true. Kept cheap by scripting the SKOS export from the TS source of truth and governing quarterly, not continuously.
- **A deliberately small core with an open-tag pressure valve** over a rich schema. Trades recall of niche concepts *in the governed layer* for inter-annotator agreement and a healthy kappa. The open layer plus `additionalType` URIs recover the niche concepts without polluting the core.
- **Coupling our core to external authority classes** — a soft dependency on Wikidata/TMDB/Places schemas. Accepted because it turns grounding into a projection and gives free graceful degradation. The coupling is via `closeMatch` (loose), not schema inheritance (tight).

---

## 5. Alternatives considered

Each plausible alternative fails on de-dup, agreement, or governance cost.

- **A1 — Flat enumerated type list (the v0 status quo, and every Rung-3 competitor's implicit model).** Rejected: enumerative blow-up plus class/instance and rename fragility, already visible at 106 labels and worsening monotonically. Its only virtue, simplicity, is recovered by SKOS-with-a-TS-source.
- **A2 — Per-platform models, unify later.** Rejected: raw payloads rot fastest, so "later" means re-annotating against a moving target. The five-standard convergence shows unification is available now and low-risk.
- **A3 — A rich OWL ontology with arbitrary typed relations.** Rejected as NG3 and by the MPEG-7 tale: expressiveness without constraint destroys agreement, and a solo maintainer cannot govern rich inference. Taxonomy + facets + open tags gets ~90% of the value at ~10% of the governance cost.
- **A4 — Pure folksonomy / "let the VLM emit any tags."** Rejected: synonym chaos and un-evaluable output; the golden set needs a controlled target. We keep the folksonomy *as a layer*, not the whole system.
- **A5 — Adopt an existing vocabulary wholesale (IPTC, or schema.org types directly).** Rejected as the *core*, adopted as *mappings*: IPTC's news-shaped terms and schema.org's web-shaped hierarchy don't fit "actionable saved short-form video," but mapping to them gives interop for free. We build a small purpose-fit core and `exactMatch` outward.
- **A6 — Skip the durable-referent node; ground inline on the post.** Rejected: this is v0's actual behaviour; it makes de-dup impossible and conflates the two eval axes. YouTube's `playlistItem`/`video` split is the standing proof the separation is worth its cost.

---

## 6. Architectural decision records

**ADR-1 — Faceted core over enumerated types.** *Proposed (supersedes the implicit v0 enum).* *Context:* v0's flat `EntityType` overlaps, blurs class/instance, blows up combinatorially. *Decision:* decompose classification into a small closed set of core types plus orthogonal facets. *Consequences:* +per-facet eval, +combinatorial coverage, +independent governance; −more schema surface; forces an explicit facet inventory up front.

**ADR-2 — Concept identity is an opaque URI; labels are mutable.** *Proposed.* *Context:* v0 keys on the English type string, so renames/synonyms break stored data. *Decision:* identify every concept by a stable opaque `conceptId`, with `prefLabel`/`altLabel` as mutable presentation. *Consequences:* +renames and synonym-merges never invalidate labels or the index; −a lookup indirection; requires a SKOS/TS source of truth.

**ADR-3 — Model Post, Save, and Referent as separate nodes.** *Proposed.* *Context:* v0 conflates the post with the depicted entity, blocking de-dup and dual-axis eval. *Decision:* model captured post (Manifestation), save (Item), and grounded referent (Work) as distinct nodes. *Consequences:* +50-saves-collapse-to-1, +clean grounding vs. classification axes; −joins and more code; aligns with AS2 actor–activity–object–target.

**ADR-4 — Controlled core + open-tag layer + `additionalType` URIs.** *Proposed.* *Context:* social media invents categories faster than any governed vocab can ratify, but ungoverned tags are un-evaluable. *Decision:* run a governed closed core alongside an ungoverned open-tag layer, with external-URI `additionalType`s as the escape hatch. *Consequences:* +zero-latency capture of the emergent, +evaluable core; −two layers to search over; open tags become the warrant-promotion feedstock.

**ADR-5 — Publish as SKOS and map to external authorities.** *Proposed.* *Context:* open-core positioning and typed grounding both need a standard, mappable representation. *Decision:* publish the core as SKOS with `exactMatch`/`closeMatch` to Wikidata/TMDB/Places/MusicBrainz/Open Library. *Consequences:* +grounding becomes a projection, +interop, +credible open-core artifact; −maintain SKOS export; soft coupling to external schemas via loose match.

**ADR-6 — Never delete; deprecate with coded reason + replacement.** *Proposed.* *Context:* a version-locked golden set must survive taxonomy change. *Decision:* inactivate rather than delete, recording a coded reason and a replacement association. *Consequences:* +old labels migrate forward automatically, +auditable history; −the vocabulary carries tombstones; enables the "healthy taxonomies shrink" discipline.

**ADR-7 — Promote to core by warrant only.** *Proposed.* *Context:* the core must neither bloat on whim (MPEG-7) nor ossify against usage (controlled-vocab). *Decision:* promote an open tag only when it clears literary + user + structural warrant, logged. *Consequences:* +evidenced, defensible growth; −promotion is a deliberate, gated act; ties governance to the corpus and search logs.

---

## 7. Trust, openness, and eval fall out of the schema, not bolted on

- **Privacy / local-first.** The `Save` node — the only *user* data — stays local-first; the `conceptId` core and SKOS export contain no user data and are the shareable open artifact. Classification runs on the item, not on a user profile. This keeps "your understood data is yours, in an open schema, and it leaves cleanly" architectural, and turns the export upsell into a *default*.
- **Openness.** SKOS + external mappings make the ontology inspectable and portable — the open-core wedge against closed incumbents. The written editorial guide is part of the open artifact.
- **Observability / eval.** The faceted model yields *per-facet* metrics; the Post/Referent split separates classification accuracy from grounding P/R/F1. Every taxonomy release triggers a scorecard re-run. But these are internal proxies: the release gate MUST also hold against the customer-facing retrieval bar, and the LLM-judge is kappa-validated, never trusted raw.
- **Security / adversarial suppliers.** Because concept identity is decoupled from platform payloads and raw payloads are demoted, platform-side breakage (expired signed URLs, changed `itemStruct`) is contained in the adapter and cannot corrupt stored classifications or the golden set.
- **Cost.** The small constrained core keeps the `responseSchema` tight, which keeps the single VLM pass cheap and its output parseable — directly serving the <$50/mo infra constraint.

---

## 8. Rollout is a golden-set migration, not a rewrite

1. **Author the core v1.0** as a TS source of truth (evolving `ontology.ts`/`types.ts`), generate the SKOS export, and write the editorial guide (a scope note for every concept). *(Steps A–C.)*
2. **Write the CI invariants** — True-Path/dumb-down, class-vs-instance, retirement-has-reason+successor — as tests alongside the existing 54. *(Step E.)*
3. **Migrate the ~106-label golden set forward** via a one-time recorded `EntityType → conceptId` map (`media → {film_or_show | music}` adjudicated by hand; `restaurant/place → eatery/place` per scope note; `brand/person/link` → facet/mediaKind). Because migration is recorded, no labels are discarded.
4. **Re-annotate against facets** (the new dimensions v0 lacked) — stratified, targeting the ~30/50/20 golden-set split.
5. **Ship as a versioned release** with a changelog; run the full scorecard *and* the retrieval bar as the release gate. *(Step F.)*
6. **Stand up the quarterly governance cadence** (IPTC-style): mine open tags → warrant test → promote/retire → release → migrate → re-score. Quarterly, not continuous, is what makes this runnable at 10–20 hrs/wk. *(Steps F–G.)*

**Testing posture.** The taxonomy is code: invariants are unit tests, releases are gated on the scorecard and the retrieval bar, and the editorial guide is the human-review substrate. This is the discipline SNOMED/GO/MeSH/IPTC all keep, scaled to one maintainer.

---

## 9. Open questions

These are tuning parameters, not architectural doubts.

- **Q1 — Warrant thresholds** (the N distinct items / M users for promotion). Cannot be set a priori; tuned once the corpus grows past 1,313 items and search logs exist. Owned jointly with GTM.
- **Q2 — Consumer-profile facet count.** How many facets the v1 app *surfaces* vs. *computes*. REQ-2a sets ≤3 surfaced; the exact set is a JTBD/design decision (the wedge is a single acute job — recipes first), not a taxonomy decision. The taxonomy MUST support more facets than the UI shows.
- **Q3 — Confidence/actionability scale granularity** (3-level vs. continuous). Depends on how the agentic-verification stage surfaces confidence (Grounding/Eval docs).
- **Q4 — Whether `style_look` and `general` earn stable-core membership or start in `pending`.** They are marked provisional in §4.2's proposed core precisely because of this question. This is the first live test of the promotion machinery.

---

## Appendix — traceability matrix (design property → prior-art source → requirement)

| Design property | Prior-art source | §  | REQ |
|---|---|---|---|
| Faceted core | Ranganathan | 3.1 | REQ-1 |
| Core + profiles + dumb-down | Dublin Core | 3.2 | REQ-2a/2b |
| Post/Save/Referent | FRBR-LRM + YouTube | 3.3, 3.13 | REQ-3 |
| Released-with-retirements | IPTC | 3.4 | — |
| Constrain-every-DOF | MPEG-7 | 3.5 | REQ-4 |
| Three-tier core/pending/additionalType | schema.org | 3.6 | REQ-5 |
| Stable-ID / orthogonal-safety | IAB / GARM | 3.7 | REQ-6 |
| Class-vs-instance | Wikidata | 3.8 | REQ-7 |
| Controlled-core + open-tag | Folksonomy literature | 3.9 | REQ-8 |
| SKOS URIs + mappings + schemes | SKOS | 3.10 | REQ-9 |
| Never-delete + True-Path + editorial guide | SNOMED / GO / MeSH | 3.11 | REQ-10 |
| Warrant-based promotion | LIS warrant | 3.12 | REQ-11 |
| Five-standard base object | AS2 / schema.org / OGP / oEmbed / MRSS | 3.13 | REQ-12 |

---

*End of Document 03. The claim to agree or disagree with: the classification layer, not the pipeline or the models, is the durable core of this product. It exists to let Maya refind and act on what she saved; its first test is her retrieval success, and only then the internal consistency proxies. The disciplines that already solved "classify a huge, evolving, heterogeneous corpus" prescribe — with striking unanimity — a small faceted governed core with stable IDs, published as SKOS, mapped outward, wrapped by an open-tag layer, and never deleted. The schema in §4.2 is what that prescription produces for saved short-form video; it is defended, term by term, rather than asserted.*

---

### Notes and sources

[^dossier]: Companion engine documents: Capture & Data-Model; Grounding & Entity-Resolution; Evaluation (six-axis scorecard). Strategy inputs: Market & Competitive Analysis (Doc 02); the JTBD/wedge memo. Where a decision here is really a strategy decision in disguise, it is flagged in place.

[^jtbd]: JTBD/wedge memo (painkiller-vs-vitamin analysis). Key sources: Christensen, *Milkshake Marketing* (HBS Working Knowledge; MIT Sloan); Moesta, *Four Forces of Progress* (jobstobedone.org); recipe-job intensity (The Kitchn 2023; Némos survey, figures directional); restaurant discovery/verification seam (Toast 2026 via BEApp; NYT 2022). The wedge: a single acute domain job — recipes first, restaurants second (resolve-to-Maps).

[^validation]: Users-validation memo. NN/g, *Why You Only Need to Test with 5 Users*; Sean Ellis 40% PMF survey (LearningLoop; FitSignal); The Mom Test (Fitzpatrick) for commitment-based, behavior-anchored testing.

[^ranganathan]: LISEDU on PMEST (lisedunetwork.com); Britannica, *Colon Classification*.

[^dc]: DCMI DCES (dublincore.org/specifications/dublin-core/dces); RFC 5013; DCMI glossary (application profile); DCMI usage guide (dumb-down principle).

[^frbr]: Code4Lib, *WEMI ontology* (journal.code4lib.org/articles/16491); LOC/Tillett, *The FRBR Model*; librarianshipstudies, *IFLA LRM*.

[^yt]: YouTube Data API v3: `playlistItem` vs. `video` resource separation (as of current API — verify before build).

[^iptc]: IPTC, *NewsCodes 2023-Q1 update: the biggest update in years*; IPTC Media Topics (iptc.org/standards/media-topics); NewsCodes Guidelines.

[^mpeg7]: Hunter, *D-Lib*, *MPEG-7 Behind the Scenes* (dlib.org/dlib/september99/hunter/09hunter.html); W3C MMSEM, *MPEG-7 Profiles Overview*; VideoExpertsGroup glossary, MPEG-7.

[^schemaorg]: schema.org/CreativeWork, /MediaObject, /docs/schemas.html (pending area); Schema App, *disambiguating properties* (`additionalType`). `SocialMediaPosting.sharedContent` per schema.org — verify current definition before build.

[^iab]: IAB Tech Lab, *Content Taxonomy 3.0 Implementation Guide*; TextRazor on IAB v3; IAB *Brand Suitability with Content Taxonomy 2.2* (GARM Floor & Suitability); Zefr on GARM definitions.

[^wikidata]: Wikidata Property:P31 (`instance of`) and Property:P279 (`subclass of`, aligned to `rdfs:subClassOf`); P279 talk-page pathologies (e.g. "baker"/"occupation").

[^skos]: W3C SKOS Recommendation: `skos:Concept`, `ConceptScheme`, `prefLabel`/`altLabel`, `broader`/`narrower`/`related`, and `exactMatch`/`closeMatch`/`broadMatch`/`narrowMatch`.

[^snomed]: SNOMED International, Editorial Guide, *Inactivating a Concept* (coded inactivation reasons; historical associations).

[^go]: GO Consortium ontology documentation (obsoletion policy; ontology-relations / True Path Rule); GO biocuration/QC reporting for the ~70–80% review-modification figure — *confirm against the primary GO curation report before external citation*. MeSH annual descriptor revision with entry-terms and scope notes (NLM).

[^folksonomy]: ScienceDirect topic overview, *Folksonomies*; Gruber, *Ontology of Folksonomy*; IDEALS, *Deriving Ontology from Folksonomy and Controlled Vocabulary*; noveltyjournals / IA Authority on the taxonomy-vs-folksonomy trade curve.

[^warrant]: LIS literature on literary, user, structural, and epistemic warrant for controlled-vocabulary term inclusion.

[^standards]: Activity Streams 2.0 / ActivityPub (W3C) actor–activity–object–target; schema.org type hierarchy; Open Graph protocol; oEmbed spec (`photo`/`video`/`rich`/`link`); Media RSS `media:group`. Convergence claim is structural, not tied to a single spec version.

[^platforms]: **Verify-before-build.** All per-platform payload shapes below reflect current public APIs as of this writing and MUST be re-verified against live payloads before an adapter is built — social APIs deprecate without notice. Specifically flagged as recall-based and needing confirmation: TikTok `itemStruct` video/slideshow discriminator (`imagePost`/`image_post_info.images[]`) and `diversificationLabels`; Instagram carousel children lacking an independent `permalink` and per-child metrics; Mastodon serializing a first-class `blurhash`; X `referenced_tweets[]` unifying quote/reply/retweet via an enum; oEmbed's four content types.