# The Semantic Ontology — governing (Block 0.5), v3

> **The ontology the extractor emits, the schema types, and the grounder routes on — one, canonical.** Conforms to `knowledge-organization-standard.md` and is validatable against its checklist. **v3 status: stress-tested and founder-approved (2026-07-07).** The v2 draft was tested categorically against a live-web census of every major platform's content types plus the non-platform cases (web pages, bare links, local files) — **32 structural archetypes, adversarially instantiated; 45 gaps found (14 blocking / 25 important / 6 minor) and folded in below** (`2026-07-07-media-census.md` is the ledger). The ground-up derivation of this schema — the teaching companion, 16 steps, 15 rules — is `schema-derivation-walkthrough.html`.
>
> Lineage: builds on doc 03 (SKOS-faceted core + FRBR/LRM WEMI + typed grounding), the original build's 8-facet ontology, and the four founder directives of 2026-07-07 (first-class provenance · cross-platform/text-first · generalized+cultural authorities · standard-conformance). Evidence: `2026-07-07-ontology-research.md`, `2026-07-07-schema-foundations-research.md`, `2026-07-07-media-census.md`.

## 1. The core idea

A saved item is *about* several **kinds** of thing; each kind resolves to a different authority by a different mechanism, and is therefore **measured by a different metric**. The model is a small discriminated union of four Referent kinds + orthogonal Facets (§3), inside a cross-platform container (§2), with required multi-valued provenance on every extraction (§4). Minimal commitment throughout: 4× expressiveness for +1 governed vocabulary.

## 2. The container, v3 (one base object + per-platform profiles)

One base object; each platform/origin is an Application Profile (a DCTAP table + a SHACL shape + an adapter) touching zero base fields; **the base SHACL shape passes on 100% of items** — TikTok video, Reddit thread, PDF, or camera-roll screenshot — which is what makes the pooled library and the pooled benchmark possible. Reuses schema.org CreativeWork / ActivityStreams 2.0 / oEmbed / Media RSS / W3C PROV-O + Web Annotation. The WEMI spine holds: `Save (Item) → Post (Manifestation) → [Work] → Referents`.

**2.1 Identity & admission (the minimal legal item).** The ONLY write-time requirements are **identity (at least one handle) + savedAt**. Everything else is profile-level or optional.
- `identity { status ∈ platform_verified|inferred|synthetic · permalink? + permalinkStatus ∈ live|login_gated|expired|none · canonicalId? · contentHash? (RFC 6920 ni:///sha-256) }` — invariant: ≥1 handle present; permalink/canonicalId required-unique **only** when `status=platform_verified`; uniqueness scoped to `(canonicalId, versionRef)`. `givenUrl` vs `resolvedUrl` + `resolutionStatus` for bare links.
- **Honest absence** everywhere else: `creator ∈ {value, SELF, ASSERTED_NONE, UNKNOWN}` (SELF = user-authored notes — they fit with zero new machinery); every timestamp is `{value, source ∈ platform|exif|file_mtime|http_header|user|inferred, confidence}`. Four clocks, never shared: `createdAt · savedAt · capturedAt · lastCheckedAt`.

**2.2 Content & assets.**
- `title?` · `body?` · `mediaKind ∈ {photo, video, audio, document, rich, link, file}` (oEmbed's 4 remain the export/degradation view; degradation bottoms out at `file`+hash, not `link`) · optional `contentForm` descriptor (carousel, poll, route, source_code…) · `mediaKind:null` permitted on containers.
- `assets[] { url|blobRef · declaredMime · sniffedFormat · role ∈ rendition|attachment|sidecar|export · contentHash · perceptualHash? }` — generalizes renditions (Media RSS semantics preserved for `role:rendition`); covers GPX/ICS/PDF/file-trees; content-hash enables cross-platform dedup.
- `timeline[] { tStart, tEnd?, title, author ∈ creator|platform|derived }` — chapters/key-moments.
- `interactive { kind ∈ poll|quiz|form · options[{name, count, isViewerChoice}] · closesAt · resultsFinal · resultsGated · snapshotAt }` (AS2 Question lifted into base).
- `contentCredentials { c2paManifestRef? · generator{name, model}? · isAIGenerated ∈ declared|detected|none · remixParentRef? }` — the STATED layer of AI provenance; the `content_provenance` facet stays the INFERRED layer.

**2.3 Plurality (containment ≠ curation).**
- `children[] { order · post · ownTimestamp? · perChildAnnotations? }` — intrinsic, ordered, recursive (carousel slides, story segments, multi-image sets).
- membership edges `Post↔Post { order · addedAt · memberAnnotation? }` + `collectionKind ∈ carousel|playlist|album|board|series|course|thread|list` — curated reference-containers, nestable, snapshot-able.

**2.4 Relations.**
- `references[] { rel · target · targetSnapshotRef? · resolutionStatus ∈ resolved|tombstone_deleted|tombstone_unavailable|never_resolved · lastCheckedAt }` — rel vocabulary: AS2 core (quote/reply/repost) as the stable spine + a namespaced extensible registry (`tiktok:stitch_of`, `uses_audio`, `clipped_from`, `crosspost_of`, `version_of`, `promoted_to`…), each degrading to a generic supertype (`derived_from`) for cross-platform queries.
- **`depicts`/`captures`** (the recursion edge): `{ target: Post|NamedEntity|StructuredContent · resolutionStatus ∈ unresolved|candidate|resolved|offline_referent|dead · assertion_mode=INFERRED · confidence }` — chainable (screenshot → quote-tweet → TikTok); kept strictly separate from platform-asserted `references[]`; dedup keys on the resolved end of the chain above threshold.
- `workRef { scheme ∈ doi|isbn|arxiv|podcast_guid|isrc|iswc|issn|platform · id }` + `versionRef` (revision oldid / vN / commit SHA) — instantiates the Work level; same episode on Spotify+Apple, preprint vs published paper, syndicated article all join here. `versions[] { canonicalId? · capturedAt · bodyRef }` records edit drift (X edit-history, living documents).

**2.5 State & capture honesty.**
- `lifecycle { state ∈ scheduled|live|changed|archived|expired|highlighted|delisted|deleted · stateTimestamps{scheduledStart, actualStart, endedAt, archiveExpiresAt, expiresAt} · capturedDuringState · lastCheckedAt }` — Twitch VODs decay on 7/14/60-day timers, stories expire, premieres pass through live; the capture records which state it caught.
- `captureFidelity { level ∈ complete|partial|metadata_only|reference_only · gates[∈ paywall|regwall|login_wall|vote_gate|js_required|drm|expired] }` + `captureStatus`, repeatable `capturedAt` on re-capture.
- `status ∈ live|removed|author_deleted|locked|archived|unavailable` + `statusObservedAt` (moderation states — a `[removed]` body is explicable).

**2.6 Context.**
- `scope { containerType ∈ community|channel|group|none · containerId · name }` + `visibility ∈ public|gated|private` + `gates{replyControls?, quoteControls?}` (subreddit / Discord guild / X Community).
- `metrics { likes? shares? views? score? comments? · observedAt }` — an Observation (§6); platform-unique metrics stay in `platformExtras{}` (the namespaced proxy — never in base).

**2.7 The Save (yours).**
- `sources[] { kind ∈ favorites|likes|bookmark|upload|… · at }` — **per-source timestamps** (favorited Tuesday, liked Friday = two moments).
- `scope { kind ∈ post|thread|tree|container|fragment · materializedMembers[postId, order] · materializedAt }` — what the save *meant*, snapshotted.
- `targetSelector?` — "slide 7", "minutes 2:00–3:00", "the blue variant" — reuses the §4 selector machinery.
- `annotations[]` — the user's own highlights/marginalia, W3C Web Annotation shaped, **same selector machinery as machine extractions** (one system; Hypothes.is is the prior art). For a product named after the commonplace book, marginalia is core data.
- `collections`, `note`.

## 3. The four Referent kinds + Facets (what it's about)

| # | Kind | Axis / example | Grounds to | Regime | Metric |
|---|---|---|---|---|---|
| 1 | **NamedEntity** | instance: *this song, this restaurant, Dune* | KB **instance ID** (MBID · Place ID · QID · OLID · DOI/ISBN via workRef) | closed-world linking | linking P/R/F1 + NIL + disambiguation — **FLAGSHIP** |
| 2 | **Concept** | kind/idea: *ADHD, flow state, sourdough hydration*; incl. **CulturalReference** (memes/trends) | subject authority (§5): own SKOS → Wikidata classes + IPTC; cultural → own anchor + Wikidata | open multi-label subject indexing | hierarchical F1@k, partial credit |
| 3 | **Claim** | proposition: *"worth the hype"* | **nothing external** — the evidence span; `about[]` reuses kinds 1–2 | faithfulness-to-source | faithfulness + coverage (both), never truth |
| 4 | **StructuredContent** | shaped content | schema.org shell (open registry: Recipe, HowTo, ItemList, ExercisePlan + Product, Event, LocalBusiness, NewsArticle, Menu, SoftwareSourceCode, Trip seeded) | slot-filling; **slot values are Observations** (§6) | Field + Document Accuracy |
| — | **Facets** (8-facet IP) | affect · topic · genre · intent · creator-role · viewer-orientation · presentation · provenance (+actionability) | closed enums (own SKOS → IAB/IPTC) | classification | per-facet macro-F1 + κ |

Extractions are **unbounded** — an item carries as many entities/concepts/claims/facet values as it contains, each with its own provenance.

## 4. Provenance — first-class, REQUIRED, multi-valued

Every extraction owns `evidence: Evidence[1..N]`, non-empty; zero-evidence extractions are rejected at write time. Composed from PROV-O (qualified derivation) + Web Annotation (selectors) + Media Fragments; the nanopublication shape is the citable receipt.

- `Evidence { signal_ref · selector · quote (denormalized snapshot) · channel · source_role · assertion_mode ∈ STATED|SHOWN|REPORTED|INFERRED · confidence · extractor_ref (model+version+prompt+run) · [claims only:] source_polarity/certainty }`
- **Selectors (completed in v3):** the full W3C Web Annotation suite — TextQuote/TextPosition, `FragmentSelector` with `conformsTo` → Media Fragments (`#t=`, `#xywh=`), **RFC 8118 PDF (`#page=`)**, **EPUB CFI**, RFC 5147 plain text — composable via `refinedBy` (page 2 → region → quote). The selector registry is **extensible** like `source_role` (geo selectors seeded: bounding-box, track-offset). Every extraction from a PDF, EPUB, or scanned page is now citable.
- **Channels (closed, 6):** VERBAL_AUDIO · VERBAL_TEXT · VISUAL_SCENE · VISUAL_TEXT · NONVERBAL_AUDIO · STRUCTURED_METADATA. `source_role` = the extensible narrower axis (caption, narration, subtitle, comment, title, flair…). Text-only posts simply open fewer channels.
- **Signals** carry `producer`, **`language` (BCP-47)**, and `wasDerivedFrom` — a transcript derives from audio, OCR from frames, **a translation derives from a transcript** (ASR-misheard stays distinguishable from creator-misspoke; Korean transcript + English translation are two signals, chained).
- Extraction rollups: strongest assertion mode + aggregate confidence; `grounding { authority · externalId|NIL · grounding_confidence }`; optional `referentLocator { scheme ∈ page|chapter|timestamp|CFI · value }` ("page 137 of this book").

## 5. Grounding authorities — three explicit tiers

**Design rule:** the benchmark dataset is measured, stored, and redistributed → the ingested spine must be legally mirrorable.
1. **Ingested spine (CC0/CC-BY, mirrorable):** Wikidata (universal hub + join key; also the one clean meme-bearing authority) · IPTC Media Topics (coarse subject backbone, always assignable) · Open English WordNet · ConceptNet (query-only per SA) · OpenAlex Topics (optional overlay) · **DOI/Crossref + ISBN (added in v3** for workRef joins).
2. **Identifier-only (IDs + deep links stored; content never ingested):** Google Places · ASIN/GTIN · OSM (ODbL) · Know Your Meme, TVTropes, Genius (link-only) · TMDB/IMDb/Letterboxd/Spotify IDs as Wikidata link-outs.
3. **Platform-native (v3):** namespaced platform IDs (`platform:tiktok` soundId etc.) as an explicitly lower-trust tier — a TikTok original sound shared by 40 saves joins **within the library** on its soundId instead of NIL-ing 40 times; promoted to an external authority when a match appears.
- ESCO stays demoted (occupation/skill = off-by-default add-on; O*NET preferred if ever needed). BabelNet/DBpedia/Dewey rejected as primary (licenses).

## 6. The Observation pattern (v3, unifying)

Any **volatile value** is stored as `{ value, observedAt, source }`, repeatable — one pattern for `metrics`, StructuredContent slot values (a price without a date is future misinformation), lifecycle checks, and poll snapshots. Re-observing appends; nothing is overwritten.

## 7. The decidable typing rule (unchanged)

Per mention: rigid individual? → **NamedEntity** (instance ID / honest NIL). Else a kind with an authority node above τ? → **Concept** (hierarchical). Else → **free tag** (NIL, warrant-promotion loop). Orthogonally: proposition → **Claim**; known shape → **StructuredContent**. Role, not string, decides. Over-typing generic services/skills into entities remains the named failure mode.

## 8. The scorecard is a per-layer MATRIX (unchanged; governs `evaluation-methodology.md`)

One row per layer (metric + n + CI + publish-gate + authority); NamedEntity-linking is the flagship; TAC-KBP metrics for grounding; accuracy stratified by `assertion_mode` (STATED should beat INFERRED — the provenance layer makes this checkable). Never one blended number.

## 9. The v1 populate-cut (corrected)

The **schema defines everything above now** (durability is the point — every v3 fix was additive and pre-ingestion). What v1 **populates and labels** is decided by **measured corpus distribution from the ~150-video pilot**, not by assumption (the earlier "Recipe-only" pick is retracted — a crude hashtag proxy already showed workout/how-to signals ≥ recipe in the founder's own corpus). Working hypothesis pending pilot data: NamedEntity music/place/screen_work/book · Concept subjects+skills+CulturalReference · 8 Facets · 1 primary Takeaway claim · structured shells per pilot prevalence. Platform profiles v1: TikTok + Instagram (+local-file), then Reddit/X/Substack/YouTube as pure additions.

**Deferred (minor, logged):** live-chat/audience co-produced signal model (decide before capturing live content) · Live-Photo/multi-page-scan rendition roles · block-structured body model for long articles (HTML snapshot + text signal suffices until annotation UX demands more) · full geo selector semantics · sensitivity flags beyond facets.

## 10. Preserves / changes / the rules

- **Preserves:** WEMI spine, SKOS governance, class-vs-instance, controlled-core+open-tag+warrant, the 8 facets, the built MusicBrainz resolver, base+profiles+SHACL architecture, the four Referent kinds.
- **v2 → v3:** identity de-URL-ed (handles + status + hash) · admission shrunk to identity+savedAt with honest absence · mediaKind {+audio, document, file} · assets[] generalization · children/membership plurality · workRef/versionRef (the Work level instantiated) · lifecycle/captureFidelity/moderation state · depicts/captures recursion edge · open relation registry + tombstones · interactive/timeline/metrics/scope/title/contentCredentials in base · selector suite completed (PDF/EPUB) · Save scope/targetSelector/annotations/per-source timestamps · signal language + translations · platform-native authority tier + DOI/ISBN · the Observation pattern · StructuredContent open registry.
- **The 15 derivation rules** (the teachable form of all of the above): `schema-derivation-walkthrough.html`, epilogue section.
