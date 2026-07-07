# Durable-schema foundations — prior art, 2026-07-07 (evidence for `_KOE-STANDARD.md` + `_ONTOLOGY.md` v2)

> 4 parallel Fable research agents (`wf_8d801071-72f`, 4/4, cited live-web). Resolves the founder's four directives: adopt-a-standard, first-class provenance, cross-platform/text-first, generalized+cultural authorities (drop ESCO).


---

## The discipline + the house standard

*confidence: high*

### Verdict
There is no single monolithic "standard" for a universal classification + entity-extraction + grounding schema — and chasing one is a trap. The disciplined, defensible move is to COMPOSE the mature de-facto standard that already exists as five clean layers, each owned by established prior art: (1) an ontology-engineering METHODOLOGY (NeOn, standing on METHONTOLOGY / Uschold-King / Grüninger-Fox competency questions / Noy-McGuinness 101); (2) the W3C Semantic Web CONFORMANCE stack (RDF/RDFS, a deliberately thin slice of OWL 2, SKOS for all concept schemes, SHACL for machine-checkable validation, PROV-O for provenance); (3) knowledge-organization DESIGN THEORY (Ranganathan's facet analysis, ISO 25964 thesaurus discipline, Gruber's minimal-commitment principle, Svenonius's bibliographic objectives, Hjørland's domain analysis); (4) a GOVERNANCE model (schema.org's core→pending→deprecated additive lifecycle + OBO Foundry's opaque-ID/single-authority/orthogonality principles + FAIR); and (5) a VALIDATION regime (competency questions as SPARQL acceptance tests, SHACL shapes as the enforceable contract, OntoClean on the hierarchy, OQuaRE/OOPS! quality scans, inter-annotator agreement on the guidelines, and TAC-KBP entity-linking metrics with honest NIL for grounding). Adopting that composition — with strict separation of concerns (identity ≠ label ≠ mapping ≠ assertion), opaque stable IDs, never-delete-only-deprecate, controlled-core-plus-open-extension, and minimal ontological commitment — IS "following the standard." The MPEG-7 disaster is the cautionary anchor: an over-expressive schema with no formal, validated semantics fails at exactly the interoperability it promised.

### Recommendation
ADOPT THIS AS THE HOUSE STANDARD — "Commonplace Knowledge-Organization Engineering Standard v1" — and validate every schema draft against the checklist below.

== A. WHAT THE DISCIPLINE IS (and its 10 non-negotiable tenets) ==
The discipline is "ontology / knowledge-organization-systems (KOS) engineering." Your job is not to invent a schema but to CONFORM to and VALIDATE AGAINST established standards, one per layer. The durable tenets, each from named prior art:
1. Conceptualize before you formalize. METHONTOLOGY's lifecycle (specification → conceptualization → formalization → implementation → maintenance) says model the domain first; RDF/OWL serialization is the LAST step, not the first.
2. Requirements ARE competency questions (Grüninger & Fox / TOVE; Uschold & King). Scope = the finite set of CQs the library must answer ("show me every save that makes a health claim I can fact-check"; "every save grounded to this musician"). CQs are your acceptance tests; a term that no CQ needs gets cut.
3. Minimal ontological commitment / avoid over-expressiveness (Gruber 1995). Say the least that supports the CQs. This is the direct antidote to the MPEG-7 failure — an XML schema with "no formal grounding" whose elements could be expressed multiple ways, so nothing interoperated.
4. Separation of concerns is THE durability principle: identity (an opaque URI) ≠ label (skos:prefLabel/altLabel, language-tagged) ≠ mapping (skos:exactMatch to an external authority) ≠ assertion-about-the-thing (a provenanced statement). SKOS, ISO 25964 and Wikidata all enforce this split; it is what lets you relabel, remap, and re-ground without breaking stored data.
5. Class-vs-instance discipline (Noy-McGuinness; OntoClean). Keep the WEMI spine + the four Referent KINDS as a small set of OWL classes; model the actual subjects/genres/affects as SKOS concept INSTANCES, not a proliferating class tree. Lighter, and it's what KOS practice does.
6. Stable, opaque identifiers, never semantic ("Cool URIs don't change"; Wikidata QIDs, MusicBrainz MBIDs, OBO numeric IDs). Never encode meaning in an ID (no `music/pop`) — you will need to reclassify.
7. Never delete, only deprecate, under semantic versioning (owl:deprecated + replacement pointer, owl:versionIRI; schema.org's additive-only rule). Govern the schema as a versioned product with a public changelog.
8. Controlled core + open extension (schema.org core+pending+extension; NeOn's scenario for integrating folksonomies/thesauri). Your controlled-core + open-tag folksonomy hybrid is exactly this pattern — keep it, but route open tags through a promotion pipeline into the controlled core.
9. Reuse before build; define once, reference everywhere (NeOn reuse scenarios; OBO orthogonality). Do not build bespoke authorities — map to Wikidata / MusicBrainz / Google Places / OpenLibrary / schema.org.
10. Orthogonal facets, not one enumerative tree (Ranganathan's analytico-synthetic classification / PMEST; OBO orthogonality). Your orthogonal Facets (affect/genre/intent) are the correct, scalable move; enumerative trees combinatorially explode.

== B. THE STANDARD STACK (what to conform to, layer by layer) ==
- Graph + identity: RDF/RDFS.
- Every concept scheme (Concept referents, Facets, the folksonomy): SKOS (+ SKOS-XL where labels need identity), aligned to ISO 25964-1/-2, which gives you thesaurus discipline (BT/NT/RT, generic vs whole-part hierarchy, mapping relationships) and, in Part 2, cross-vocabulary interoperability — the standard for connecting your scheme to external ones.
- Real logical classes/constraints (WEMI spine; the four Referent kinds): OWL 2, but stay in a light profile (EL/RL) or just RDFS+SHACL. Minimal commitment.
- Provenance (Directive 2): PROV-O (W3C Rec) — Entity/Activity/Agent, wasDerivedFrom, wasAttributedTo, wasGeneratedBy, generatedAtTime — is THE standard for "where did this come from." Add PAV for authoring/versioning nuance.
- Stated-vs-inferred (Directive 2): CRMinf (CIDOC-CRM Argumentation extension, v1.0 2023): I5 Inference Making, I2 Belief, premises (J1 used as premise) → conclusion (J2 concluded that) lets you trace a conclusion back to primary evidence. Use it heavyweight where reasoning chains matter; otherwise a lightweight `epistemicStatus ∈ {stated, inferred}` property + prov:wasDerivedFrom.
- Machine-checkable contract: SHACL (W3C Rec 2017) shapes ARE your schema's enforceable spec; run them in CI. (ShEx is the alternative.)
- Metadata record + cross-platform profiles (Directive 3): Dublin Core Terms + the DCMI Application-Profile pattern (Singapore Framework) expressed as DCTAP tables. This is literally the discipline for "base object + per-platform profiles": ONE platform-neutral domain model, MANY application profiles that constrain/extend it. schema.org's CreativeWork subtypes (SocialMediaPosting, VideoObject, Article, DiscussionForumPosting) are ready-made neutral types to specialize per platform.
- Descriptive spine: your FRBR/IFLA-LRM WEMI is sound and standard. Where several sources describe the SAME referent differently, borrow the Europeana Data Model proxy/aggregation pattern so each source's description is separately provenanced.
- Grounding/linking (Directive 4 mechanics): the established science is Entity Linking / Knowledge-Base Population from NIST TAC-KBP — candidate generation → ranking → NIL detection → NIL clustering, each with a confidence score, and precision/recall reported SEPARATELY for in-KB vs NIL. This is exactly your "confidence + honest NIL" moat; adopt its evaluation protocol wholesale. Authority links use skos:exactMatch / closeMatch / broadMatch / relatedMatch.

== C. UPPER ONTOLOGY — DEFENDED ANSWER: no full BFO/DOLCE/SUMO import ==
Do NOT import a full top-level ontology. ISO/IEC 21838 standardized BFO (Part 2) and admits DOLCE/TUpper precisely to coordinate MANY teams' domain ontologies — it solves a multi-org interoperability problem a solo builder does not have, while charging the full modeling cost (the MPEG-7 failure mode). But do NOT go structureless either. Adopt a PRAGMATIC PSEUDO-UPPER: schema.org as the lingua-franca top type-system (it is the web's de-facto upper ontology and is where your grounding targets already live), + PROV-O as the provenance dimension + SKOS as the conceptual dimension. Then BORROW — as review discipline, not imported axioms — a few high-value distinctions: BFO/DOLCE's continuant-vs-occurrent and independent-vs-dependent split (a Referent endures; a Save/extraction is an event), and OntoClean's rigidity/identity/unity meta-properties as a checklist on your subsumption edges. Net: schema.org-as-upper for interoperability + BFO/OntoClean-as-discipline for correctness. That is a defended pick, not a dodge.

== D. PROVENANCE, FIRST-CLASS AND MULTI-VALUED (Directive 2 — the durable pattern) ==
Never store extractions as bare triples. Reify every extracted entity/concept/claim/facet as a STATEMENT NODE (RDF-star, or a named graph, or a Wikidata-style statement object) so it can carry, per-assertion and multi-valued:
- sourceModality (MULTI-VALUED, controlled SKOS vocab): audio/voice, transcript/subtitles, caption, on-screen-text (OCR), visual-scene, creator-identity, platform-metadata. One extraction may cite several.
- epistemicStatus: stated vs inferred (CRMinf, or the light property).
- agent + time: which VLM/LLM (prov:SoftwareAgent, prov:wasAttributedTo) produced it, prov:generatedAtTime, model+prompt version.
- locator (WHERE in the media): W3C Web Annotation target + Media Fragments URI / selector — timecode span, OCR bounding box, transcript char-offset.
- confidence: calibrated score per assertion.
Copy the shape from the class of problem already solved at scale: Wikidata (statement + qualifiers + references + rank), nanopublications (assertion / provenance / publication-info as three named graphs — each atomic claim independently attributable), PROV-O (the vocabulary), Web Annotation + Media Fragments (the "where" pointer), CRMinf (stated vs inferred). A SHACL shape must REJECT any extracted assertion lacking ≥1 sourceModality, an epistemicStatus, an agent, and a locator.

== E. CROSS-PLATFORM FLEX (Directive 3) ==
Base object + per-platform application profiles = the DCMI Application Profile / Singapore Framework / DCTAP discipline. Define ONE platform-neutral core (Post/Save/Referent/Facet on the WEMI spine, described in Dublin Core + schema.org terms). Then ship a DCTAP profile per platform (TikTok, Instagram, X, Reddit, Substack, LinkedIn, YouTube) that constrains/extends the core with platform-specific slots (quote-vs-retweet, subreddit, thread parent, article body). Everything stays cross-analyzable because every profile validates against the SAME core SHACL shapes. Text-first platforms simply exercise different Referent kinds (more Claim/Concept/StructuredContent, less visual-scene provenance) — the base object doesn't change.

== F. GOVERN IT AS A VERSIONED PRODUCT ==
schema.org lifecycle (core → pending → deprecated; additive-only within a minor version) + OBO Foundry principles (unique opaque prefixed IDs, single locus of authority, documented human-readable definitions, versioning, orthogonality, change notification) + semantic versioning + public changelog + never-delete-only-deprecate. FAIR-ify the schema artifact itself (persistent IDs, machine-readable SHACL/SKOS, licensed, documented) so the published grounding accuracy sits on a citable, portable spec — which is the moat.

### Checklist
- CQ COVERAGE: maintain a living competency-question list; each CQ must be expressible as a SPARQL query that returns non-empty against the golden set. No CQ needs a term -> cut the term (kills scope creep).
- SHACL CONFORMANCE: every instance validates against the shapes; CI runs SHACL over the golden corpus; zero violations to ship. Shapes are the enforceable schema contract, not the prose docs.
- PROVENANCE-COMPLETENESS SHAPE: a SHACL shape REQUIRES every extracted assertion to carry >=1 sourceModality, an epistemicStatus (stated|inferred), an agent (prov:wasAttributedTo), a locator (Web Annotation/Media-Fragment target), and a confidence. Reject assertions missing any.
- ONTOCLEAN PASS: on every new subsumption edge, check meta-properties — no anti-rigid class subsumes a rigid one; identity/unity carriers are consistent. Prevents a silently broken hierarchy.
- OQuaRE + OOPS! SCAN: run OOPS! (ontology pitfall scanner) and OQuaRE metrics (built on ISO/IEC 25000 SQuaRE) each release; track structural/functional/maintainability scores across versions; no new critical pitfalls.
- IAA ON GUIDELINES: before trusting the LLM extractor, two humans annotate a sample against the guidelines; measure Cohen's kappa / Krippendorff's alpha (MASI distance for multi-label facets); iterate guidelines (MAMA/MATTER cycle) until kappa >= 0.67 (tentative) / 0.8 (good). Unmeasured guidelines = unmeasurable accuracy = no moat.
- GROUNDING ACCURACY (TAC-KBP PROTOCOL): report precision/recall/F1 of entity links AND, separately, NIL-precision and NIL-recall; verify confidence calibration; publish these numbers each release. This is the measured moat.
- REUSE/MAPPING AUDIT: every Referent either grounds to an external authority via skos:exactMatch/closeMatch/broadMatch, or is an explicit NIL WITH a reason code. No silent orphan concepts; no bespoke authority where a public one exists.
- MINIMAL-COMMITMENT REVIEW: for every proposed axiom/constraint/property, ask 'does a competency question require this?' If not, do not add it. (Anti-MPEG-7 gate.)
- SEPARATION-OF-CONCERNS AUDIT: identity (opaque URI), label (skos:prefLabel/altLabel), mapping (skos:*Match), and assertion (provenanced statement) are stored in distinct positions; no free-text field mixing them.
- IDENTIFIER OPACITY: all internal IDs are opaque and non-semantic; nothing downstream parses meaning out of an ID; renaming a label does not change any ID.
- VERSIONING DISCIPLINE: no deletions or breaking changes in a minor version; every removal is a deprecation (owl:deprecated + replacement pointer); versionIRI bumped; changelog entry written; additive-only within a series (schema.org rule).
- CROSS-PLATFORM PROFILE CHECK: each new platform is onboarded as a DCTAP application profile over the SAME neutral core; it validates against the shared core SHACL shapes so all platforms remain cross-analyzable.
- FAIR-FOR-SCHEMA CHECK: the schema itself has persistent IDs, machine-readable SKOS/SHACL serialization, an open license, and human-readable definitions for every term (OBO Foundry principle).

### Evidence
- Competency questions define ontology scope and act as the litmus test / acceptance tests; ontology development is inherently iterative (Noy & McGuinness, Ontology Development 101, Stanford KSL-01-05). — *https://protege.stanford.edu/publications/ontology_development/ontology101.pdf*
- Grüninger & Fox (TOVE) established competency questions as the formal requirements that an ontology must be able to answer, enabling completeness evaluation. — *https://arxiv.org/pdf/2507.02989*
- NeOn Methodology is a scenario-based (9 scenarios) framework for ontology NETWORKS centered on reuse and re-engineering of ontological and non-ontological resources (incl. folksonomies/thesauri) and ontology design patterns. — *https://link.springer.com/chapter/10.1007/978-3-642-24794-1_2*
- Gruber's five design principles: clarity, coherence, extendibility, minimal encoding bias, and minimal ontological commitment — say the least sufficient to support the intended knowledge sharing. — *https://tomgruber.org/writing/onto-design/*
- MPEG-7 cautionary tale: because it is defined only as an XML Schema, its elements have no formal semantics and features can be described multiple ways, causing ambiguity and interoperability failure — the case against over-expressiveness without formal, validated semantics. — *https://rhizomik.net/html/~roberto/papers/mareso-2007.pdf*
- PROV-O (W3C Recommendation, 2013) is the standard ontology for provenance — Entity/Activity/Agent and relations (wasDerivedFrom, wasAttributedTo, wasGeneratedBy) used to assess quality, reliability, trustworthiness. — *https://www.w3.org/TR/prov-o/*
- SHACL (W3C Recommendation, 2017) validates RDF graphs via node/property shapes and can check membership in a skos:ConceptScheme — the machine-checkable schema contract. — *https://www.w3.org/TR/shacl/*
- SKOS is the W3C standard for concept schemes (prefLabel/altLabel, broader/narrower/related, and mapping relations exactMatch/closeMatch/broadMatch), separating concept identity from labels from cross-scheme mappings. — *https://www.w3.org/TR/skos-reference/*
- OBO Foundry principles: orthogonality (each term defined once, referenced elsewhere), unique opaque prefixed numeric IDs (chosen to ease maintenance/evolution), a shared top-level ontology (BFO), versioning, single locus of authority, documented definitions, change notification. — *http://obofoundry.org/principles/fp-000-summary.html*
- OntoClean (Guarino & Welty) evaluates taxonomies with meta-properties Rigidity, Identity, Unity, Dependence; core constraint: anti-rigid properties cannot subsume rigid ones — a formal check on subsumption correctness. — *https://www.loa.istc.cnr.it/old/Papers/GuarinoWeltyOntoCleanv3.pdf*
- NIST TAC-KBP Entity Linking defines the standard for grounding with honest NIL: systems return a NIL id when no KB entry matches and must cluster NIL mentions referring to the same entity; in-KB vs NIL performance is evaluated — the paradigm for 'confidence + honest no-match'. — *https://tac.nist.gov/2012/KBP/task_guidelines/KBP2012_TaskDefinition_1.1.pdf*
- Nanopublications (Groth, Gibson, Velterop) split each atomic assertion into three RDF named graphs — assertion, provenance, publication info — making every claim independently citable and attributable; the pattern for first-class per-claim provenance. — *https://peerj.com/articles/cs-78/*
- CRMinf (CIDOC-CRM Argumentation extension, v1.0 2023) models inference and belief — I5 Inference Making, I2 Belief, premises (J1) leading to conclusions (J2) — letting you trace a conclusion back to primary evidence: the standard for 'stated vs inferred'. — *https://cidoc-crm.org/crminf*
- W3C Web Annotation Data Model (Annotation/Body/Target with Selector and State, and Media-Fragment targets) plus a documented PROV mapping — the standard for pointing an extraction at WHERE it came from (timecode, region, offset) and who asserted it. — *https://www.w3.org/TR/annotation-model/*
- schema.org governance: a core vocabulary plus a 'pending' staging area; changes must be additive; terms graduate to core or are dropped based on adoption — the model for controlled-core + versioned lifecycle. — *https://schema.org/docs/howwework.html*
- Wikidata models statements (not bare triples) with qualifiers, references (provenance/source), and rank (preferred/normal/deprecated), and uses opaque QIDs/PIDs — the at-scale exemplar for reified, multi-valued, provenanced, versionable assertions. — *https://www.wikidata.org/wiki/Wikidata:Data_model*
- ISO/IEC 21838 standardizes top-level ontologies (Part 1 requirements; Part 2 = BFO; also DOLCE, TUpper) to interoperate MANY teams' domain ontologies — its purpose is cross-organization coordination, which a solo builder does not need. — *https://www.iso.org/standard/74572.html*
- DCTAP (DC Tabular Application Profiles) provides a simple table format to declare an application profile's elements and constraints over reused web vocabularies — the mechanism for 'base object + per-platform profiles'. — *https://dcmi.github.io/dctap/*
- ISO 25964 is the thesaurus + interoperability standard; Part 2 covers interoperability with other structured vocabularies (classification schemes, name authorities, ontologies) and supports exchange formats — pairs with SKOS. — *https://cdn.standards.iteh.ai/samples/53657/808a87d0fbea484bb0013de6a2eea4a9/ISO-25964-1-2011.pdf*
- FAIR principles (Wilkinson et al., 2016, Sci Data) — Findable/Accessible/Interoperable/Reusable — require globally unique persistent identifiers and standardized vocabularies; applies to making the schema artifact itself FAIR. — *https://www.nature.com/articles/sdata201618*

### Pitfalls
- Over-expressiveness (the MPEG-7 trap): modeling everything in rich OWL axioms nobody validates yields ambiguous, un-interoperable, unusable schemas. Gate every axiom on a competency question.
- Semantic identifiers: encoding meaning into IDs (music/pop, claim_health_2024) makes reclassification break every downstream reference. Use opaque IDs always.
- Conflating levels: mixing the concept, its human label, and the external thing it grounds to into one field — destroys the separation of concerns that makes relabeling/remapping safe.
- One giant enumerative tree instead of orthogonal facets: combinatorial explosion, unmaintainable. Ranganathan/OBO orthogonality exists precisely to avoid this.
- Bare-triple extraction with no statement reification: you cannot later attach multi-valued provenance, modality, epistemic status, or confidence, and retrofitting across a corpus is brutally expensive. Reify from day one.
- Delete/rename terms: breaks stored data and portability — and portability IS the moat. Never delete; only deprecate under semver with a replacement pointer.
- Importing a full upper ontology (BFO/DOLCE/SUMO) 'to be safe': a solo-builder time sink with negative ROI; it solves a multi-org coordination problem you do not have. Borrow its distinctions as discipline, not its axioms.
- Treating LLM/VLM output as ground truth without IAA-validated annotation guidelines and a golden set: accuracy becomes unmeasurable, so there is literally no publishable moat.
- Building bespoke authorities instead of mapping to Wikidata/MusicBrainz/Google Places/OpenLibrary: reinvents the wheel and forfeits the interoperability that makes grounding valuable. Reuse and map.
- Provenance as a single free-text field: not multi-valued, not queryable, not durable. It must be structured, controlled-vocabulary, and per-assertion.
- Skipping calibration and NIL-specific metrics: reporting only overall accuracy hides that the honest-NIL behavior (the trust differentiator) is unmeasured. Report in-KB and NIL precision/recall separately, per TAC-KBP.
- No promotion pipeline for open tags: a folksonomy with no path into the controlled core either ossifies or drifts into noise. Define the review/graduation gate (schema.org pending model) up front.

---

## Provenance / evidence (multi-valued, first-class)

*confidence: high*

### Verdict
Do not invent a provenance model and do not adopt a single standard — compose three proven ones and add two small product-owned vocabularies. Use W3C PROV-O as the backbone for HOW an extraction came to be (Activity/Entity/Agent + the qualified-derivation pattern that carries per-source attributes), the W3C Web Annotation Data Model + Media Fragments URI for WHERE it came from (typed selectors: text-quote/position for captions, transcripts, OCR; temporal #t= and spatial #xywh= fragments for video/audio), and the nanopublication three-graph shape (assertion / provenance / publication-info) as the citable "receipt" unit that your eval scores and your UI renders. Make provenance a REQUIRED, non-empty, MULTI-VALUED array of first-class Evidence records on every extraction — never flat fields — because the same entity legitimately arrives via several signals at once, each with its own span, modality, assertion-mode and confidence. Resolve the founder's enumerate-vs-generalize question with BOTH: a two-axis faceted SKOS scheme with a tiny closed top layer (≈6 semiotic channels) that keeps content cross-analyzable across platforms, and an extensible narrower layer of concrete source-roles that grows to new platforms without schema migration. Model stated-vs-inferred as an assertion-mode enum grounded in the linguistic evidentiality typology (STATED / SHOWN / REPORTED / INFERRED), kept orthogonal to modality, with source-certainty (FactBank-style) held separately from your model's calibration confidence. This is the layer that turns a benchmark into a moat: required evidence spans are exactly what let you score faithfulness (AIS/ALCE), stratify accuracy by assertion-mode, and render an honest receipt.

### Recommendation
ADOPT a three-standard stack + two product-owned, versioned vocabularies. Below is the concrete sub-schema.

=== A. THE CORE SHAPE: an intermediate first-class Evidence object (multi-valued) ===
Every occurrence of a Referent (NamedEntity/Concept/Claim/StructuredContent) or Facet on a Save is an EXTRACTION. Each Extraction owns `provenance: Evidence[1..N]` — REQUIRED and NON-EMPTY. Forbid any extraction with zero Evidence (an ungrounded assertion is a bug, not a row). Do NOT attach modality/mode/confidence as flat columns on the extraction: the SAME entity ("Nike") can be SHOWN as a logo AND STATED in the caption — two Evidence records, each with its own span/mode/confidence. This intermediate object IS the PROV "qualified derivation" (a bare prov:wasDerivedFrom cannot carry per-source attributes, which is precisely why PROV-O defines the qualified pattern) and IS the Web Annotation target (source + selector).

Extraction {
  id
  referent_ref                 // grounded thing or facet value
  role: enum{named_entity|concept|claim|structured_slot|facet}
  provenance: Evidence[]        // 1..N, REQUIRED non-empty
  rollup_assertion_mode         // cached: strongest across evidence (SHOWN/STATED > REPORTED > INFERRED)
  rollup_confidence             // cached aggregate
  grounding { authority, external_id | NIL, grounding_confidence }  // the moat field; NIL is first-class
}

Evidence {                      // = PROV qualified derivation + WADM SpecificResource
  id
  // --- WHERE (W3C Web Annotation Data Model + Media Fragments URI) ---
  signal_ref                    // FK -> Signal (the rendition this points into)
  selector {
    type: enum{ text_quote | text_position | media_temporal | media_spatial | media_spatiotemporal | whole_signal }
    exact, prefix, suffix       // TextQuoteSelector (robust to re-indexing)
    start, end                  // TextPositionSelector (char offsets, fast)
    t_start, t_end              // Media Fragments temporal, npt seconds  (#t=start,end)
    xywh                        // Media Fragments spatial (optional)     (#xywh=x,y,w,h)
  }
  quote                         // denormalized literal snippet/label snapshot (for receipt + eval)
  // --- WHICH signal role (product SKOS vocab, Axis A x Axis B) ---
  channel                       // ONE of the 6 closed top-concepts (below)
  source_role                   // ONE narrower concept (extensible)
  // --- HOW / EPISTEMIC ---
  assertion_mode: enum{ STATED | SHOWN | REPORTED | INFERRED }   // orthogonal to channel
  confidence: float 0..1        // MODEL's calibrated confidence this evidence supports the extraction
  extractor_ref                 // FK -> Activity (model id+version, prompt/pipeline version, run ts)
  // --- Claim-only epistemic overlay (FactBank) ---
  source_polarity: enum{+|-|uncertain}      // the CONTENT's own assertion, not the model's
  source_certainty: enum{certain|probable|possible}
}

Signal {                        // renditions registry — resolves the transcript/OCR "derived" nuance
  id
  role                          // channel/source_role of this rendition
  producer                      // asr_model@v | ocr_model@v | creator_authored | platform_api
  wasDerivedFrom                // e.g. transcript wasDerivedFrom spoken-audio track (PROV chain kept)
  content_ref                   // text or media pointer that selectors resolve against
}

Key nuance the founder raised (subtitle/transcript): a transcript/OCR string is NOT a peer signal to voice/frames — it is a DERIVED rendition. Model Signal.wasDerivedFrom so the chain survives: extraction -> (evidence span in transcript) -> transcript -> derivedFrom -> audio track -> partOf -> Post. This preserves the ability to distinguish "the ASR misheard" from "the creator misspoke."

=== B. EVIDENCE-MODALITY VOCABULARY (answers enumerate-vs-generalize: BOTH) ===
Publish as a versioned SKOS concept scheme. Two axes.
Axis A `channel` — CLOSED, ~6, defined by human perception not platform (this is what keeps content cross-analyzable across TikTok/X/Reddit):
  VERBAL_AUDIO        — spoken language (voice/narration/dialogue)
  VERBAL_TEXT         — written language authored AS language (caption, tweet/post body, article, on-screen text, comment)
  NONVERBAL_VISUAL    — what is depicted (scene, objects, faces, actions, logos, landmarks)
  NONVERBAL_AUDIO     — non-speech sound (music, SFX)
  STRUCTURED_METADATA — machine fields (hashtags, geotag, timestamps, attached-sound id, platform category, link cards)
  SOCIAL_CONTEXT      — signal from others (comments, quote-posts, replies, co-engagement)
Axis B `source_role` — OPEN skos:narrower under each channel; new platforms add concepts, never touch Axis A:
  VERBAL_AUDIO -> speech.creator, speech.other, lyrics
  VERBAL_TEXT  -> text.caption, text.overlay_ocr, text.transcript, text.body, text.hashtag, text.comment, text.link_card
  NONVERBAL_VISUAL -> visual.scene, visual.object, visual.person, visual.logo_brand, visual.landmark, visual.text_in_scene(->OCR)
  STRUCTURED_METADATA -> meta.geotag, meta.timestamp, meta.attached_sound, meta.platform_category, meta.author_profile
  SOCIAL_CONTEXT -> social.comment, social.quote, social.creator_identity
Why: SKOS is the W3C standard for exactly this (broader/narrower, versioned, stable skos:notation codes; you already use SKOS for facets). Closed top = cross-platform queryability ("everything SHOWN visually" or "everything the creator SAID" regardless of platform). Open bottom = expandability. This is the "base object + per-platform profile" pattern: the vocab is the base; a platform profile just declares which channels/source_roles are AVAILABLE and how to populate them. For a text-only post (X/Reddit/Substack) the audio/visual channels are simply empty; text.body carries weight, STRUCTURED_METADATA carries subreddit/tags, SOCIAL_CONTEXT carries the reply tree — same vocabulary, different population.

=== C. ASSERTION-MODE ENUM (stated vs inferred, generalized; grounded in evidentiality) ===
Grounded in Aikhenvald's evidentiality typology (grammaticalized information-source: visual / non-visual-sensory / inference / assumption / reportative-hearsay), FactBank (text-based factuality judged from the text, not the world), and AIS ("Attributable to Identified Sources"). Four required values, MUTUALLY DISTINCT, kept ORTHOGONAL to channel (do not merge them):
  STATED    — asserted in language by the creator in a verbal channel (Aikhenvald firsthand; AIS attributable to the item). "Made with oat milk."
  SHOWN     — directly depicted/audible, not verbalized (Aikhenvald visual/sensory). A visible Trader Joe's bag -> brand.
  REPORTED  — attributed within the content to a third party (Aikhenvald reportative/quotative). "My doctor said…", a quoted tweet. Essential for Claims.
  INFERRED  — not stated or shown; model concluded it from signals + world knowledge (Aikhenvald inference/assumption; CRMinf I5 Inference Making). "This is a marathon-training video."
A geotag->place read is expressed as (assertion_mode=STATED, channel=STRUCTURED_METADATA) — no separate metadata mode needed; orthogonality does the work.
TWO CERTAINTIES, DO NOT CONFLATE: (a) source_certainty/source_polarity = the CONTENT's own hedging/negation (FactBank epistemic-modal x polarity), a property of the item; (b) confidence = your MODEL's calibrated confidence it read the evidence correctly. Different fields, different owners, different failure modes.

=== D. STANDARDS MAPPING (make it portable, per the product's "portable library" promise) ===
PROV-O (HOW): Extraction is a prov:Entity; prov:wasGeneratedBy the extraction prov:Activity (model SoftwareAgent via prov:wasAssociatedWith, prompt as prov:Plan via prov:used). Each Evidence = prov:qualifiedDerivation [ a prov:Derivation ; prov:entity <Signal> ; :channel ; :sourceRole ; :assertionMode ; :confidence ; prov:hadActivity <run> ]. Crucially: STATED/SHOWN/REPORTED extractions are ALSO prov:wasAttributedTo the CREATOR agent; INFERRED extractions are attributed ONLY to the model agent — so "did a human assert this or did our model guess?" is answerable in the provenance graph itself.
Web Annotation Data Model + Media Fragments (WHERE): Evidence maps to oa:hasTarget = oa:SpecificResource(oa:hasSource=Signal, oa:hasSelector=typed selector). Text -> TextQuoteSelector (exact+prefix+suffix) PLUS TextPositionSelector (offsets) as refinement/fallback. AV -> FragmentSelector with Media Fragments value (temporal #t=, optional spatial #xywh=). Keep your own assertion_mode; oa:motivation is too coarse (no stated/inferred).
Nanopublication (the RECEIPT): package each extraction as three graphs — assertion (<Save> hasReferent <Nike>), provenance (the PROV: derived-from these Evidence spans/modes/confidences, generated by this run, attributed to creator/model), publication-info (schema version, ontology version, pipeline version, generation ts, NIL-policy version). This is the founder's "receipt" as an independently addressable, portable, citable object; nanopublications are proven at scale in life sciences for exactly this.
ENGINEERING CALL: store Evidence as NATIVE rows in the product DB (fast, simple), and maintain a documented LOSSLESS mapping to PROV-O + WADM for export/portability. Use RDF-star (RDF 1.2) if/when you export to RDF, since statement-level provenance/confidence is its headline use case and it avoids classic reification's 4-5x triple blowup. The moat is the MEASURED provenance, not the serialization — do not build a triplestore runtime on day one.

=== E. HOW THIS ENABLES THE EVAL AND UI (the moat connection) ===
Eval: because every extraction carries evidence spans, the golden-set/NLI judge scores citation faithfulness decomposed into citation RECALL (is the extraction supported by its cited span?) and citation PRECISION (is each cited span actually relevant?) — the ALCE method — and applies the AIS "According to the source, s" test. Without required spans you can only score end-answer correctness and cannot catch "right answer, wrong reason" (a correct-but-hallucinated entity). Report grounding accuracy STRATIFIED by assertion_mode — SHOWN/STATED will beat INFERRED, and publishing that split is the honesty the moat is built on. Calibrate `confidence` against golden outcomes (reliability diagrams) before publishing any accuracy number; gate INFERRED groundings behind a calibrated threshold in the UI. NIL becomes principled: "no Evidence supported a confident grounding" is an evidence-derived state, not a silent drop.
UI receipt: typed selectors render for free — chips per Evidence (icon: said/shown/reported/inferred + a confidence bar) whose click either highlights the caption/transcript passage (text selector) or seeks to t_start and boxes xywh (media fragment). This is the Web Annotation target rendered natively; it is the trust surface that shows the user whether the app SAW it or GUESSED it.

### Checklist
- Every extraction (entity/concept/claim/facet occurrence) has a REQUIRED, non-empty provenance array — an extraction with zero Evidence is rejected at write time.
- Provenance is genuinely MULTI-VALUED: the schema and a real test case represent one entity supported by >=2 signals (e.g. SHOWN logo + STATED caption), each with its own selector, channel, assertion_mode, confidence.
- Each Evidence carries a TYPED selector that resolves: text (quote + position) for captions/transcripts/OCR, temporal (#t=) and optional spatial (#xywh=) for video/audio; a denormalized quote snapshot is stored.
- The modality vocab is a versioned SKOS scheme with a CLOSED top axis (~6 channels) and an EXTENSIBLE narrower axis (source_roles); adding a new platform adds narrower concepts only, with zero change to the top axis or the base object.
- The same schema populates cleanly for a text-only post (X/Reddit/Substack): audio/visual channels empty, text.body/STRUCTURED_METADATA/SOCIAL_CONTEXT populated — validated by a worked text-post example.
- assertion_mode is one of STATED/SHOWN/REPORTED/INFERRED, is ORTHOGONAL to channel (a geotag = STATED + STRUCTURED_METADATA), and maps to a named evidentiality category.
- The two certainties are separate fields: source_certainty/source_polarity (content's own, FactBank) vs confidence (model's, calibrated).
- The transcript/OCR derived-rendition chain is modeled (Signal.wasDerivedFrom), so evidence in a transcript traces back to the underlying spoken-audio signal.
- There is a documented, lossless mapping from every Evidence field to PROV-O (qualifiedDerivation, wasGeneratedBy, wasAttributedTo split by stated/inferred) and to the Web Annotation Data Model (SpecificResource/Selector) for portable export.
- Each extraction can be packaged as a nanopublication-shaped receipt (assertion / provenance / publication-info) with ontology + pipeline versions in pubinfo.
- The eval can compute citation recall + precision (ALCE) and the AIS 'according to source' test from stored spans, and can STRATIFY grounding accuracy by assertion_mode.
- The UI can render each Evidence as a clickable receipt chip that highlights the text span or seeks to the video timestamp/region, with mode icon and calibrated-confidence indicator, and shows NIL honestly.

### Evidence
- PROV-O defines Entity/Activity/Agent with prov:wasGeneratedBy, prov:wasDerivedFrom, prov:wasAttributedTo, and a 'qualified' pattern (prov:qualifiedDerivation -> a prov:Derivation with extra attributes) precisely so influence relations can carry per-source metadata a bare property cannot — the exact mechanism needed to attach modality/assertion-mode/confidence to each evidence source. — *https://www.w3.org/TR/prov-o/*
- The Web Annotation Data Model defines oa:Annotation with oa:hasBody/oa:hasTarget, where a target is an oa:SpecificResource carrying oa:hasSource + oa:hasSelector; TextQuoteSelector (exact/prefix/suffix) and TextPositionSelector (start/end offsets) are self-contained and can be used together for robustness — the standard 'WHERE' layer for spans. — *https://www.w3.org/TR/annotation-model/*
- W3C Media Fragments URI 1.0 gives a media-format-independent way to address temporal segments (#t=start,end in normal-play-time seconds) and spatial regions (#xywh=x,y,w,h), used to anchor annotations to spatio-temporal parts of video/audio — the 'WHERE' layer for VLM evidence in short video. — *https://www.w3.org/TR/media-frags/*
- A nanopublication is composed of three named graphs — assertion (the fact), provenance (where/how it was derived), and publication-info (metadata: who/when/version) — a proven, scaled pattern for packaging a small unit of knowledge with its provenance as an independently citable object; directly maps to the product's per-extraction 'receipt'. — *https://nanopub.net/guidelines/working_draft/*
- FactBank (Saurí & Pustejovsky) annotates event factuality as epistemic-modal {certain, probable, possible} x polarity {+,-}, judged from the TEXT 'avoiding any judgment based on knowledge of how things are in the world' — prior art for separating the content's own asserted certainty/polarity from the extractor's confidence, and the overlay for the Claim referent. — *https://link.springer.com/article/10.1007/s10579-009-9089-9*
- Aikhenvald's evidentiality typology grammaticalizes source-of-information into visual / non-visual-sensory / inference (from results or general knowledge) / reportative-hearsay-quotative, and is argued distinct from epistemic modality (degree of certainty) — the linguistic grounding for a STATED/SHOWN/REPORTED/INFERRED assertion-mode enum kept orthogonal to confidence. — *https://linguistica.sns.it/RdL/19.1/10.aikhenvald.pdf*
- WALS chapter 77 catalogs cross-linguistic semantic distinctions of evidentiality, corroborating that direct (sensory) vs indirect (inference/reported) source marking is a stable, general category — evidence the four-value assertion-mode enum reflects a durable typology, not an ad hoc choice. — *https://wals.info/chapter/77*
- The AIS framework (Rashkin et al., 'Measuring Attribution in NLG Models') formalizes whether generated content about the external world is 'Attributable to Identified Sources' via an intuitive 'According to source P, s' test — the standard that required evidence spans make scorable, distinguishing correct-and-attributable from correct-but-hallucinated. — *https://arxiv.org/abs/2112.12870*
- ALCE (Gao et al., EMNLP 2023) evaluates citation quality with citation RECALL (is the statement supported by its cited passages?) and citation PRECISION (is each citation relevant?), scored with an NLI model — a concrete, published recipe for turning required evidence spans into a faithfulness metric for the moat's accuracy claims. — *https://aclanthology.org/2023.emnlp-main.398/*
- CRMinf (CIDOC-CRM Argumentation Model) formally models inference/belief with I5 Inference Making, I2 Belief, I4 Proposition Set and premise/conclusion properties — cultural-heritage prior art showing 'inferred' assertions and their premises are a first-class, standardized modeling target, reinforcing INFERRED as a distinct provenance-graph state. — *https://cidoc-crm.org/extensions/crminf/html/CRMinf_v1.2.1.html*
- RDF-star (RDF 1.2) adds statement-level metadata — scores, weights, temporal aspects, provenance, modalities/beliefs — to individual edges without classic reification's 4-5x triple blowup; the headline use case is exactly attaching provenance/confidence to a single assertion, making it the right serialization for portable export of the Evidence layer. — *https://www.ontotext.com/blog/rdf-star-metadata-complexity-simplified/*

### Pitfalls
- Do NOT hard-enumerate a flat, platform-specific list of sources (audio/subtitle/caption/OCR/...) — it ossifies and breaks on the next platform. Use the two-axis faceted SKOS scheme: CLOSED ~6 semiotic channels (cross-platform queryability) x OPEN narrower source_roles (expandability).
- Do NOT collapse the two certainties. source_certainty/source_polarity (FactBank: the content's own hedging/negation, a property of the item) is a different field from confidence (your model's calibrated certainty it read the evidence right, a property of the pipeline). Merging them corrupts both the eval and the receipt.
- Do NOT attach provenance as flat fields on the extraction. The same entity can arrive via several signals with different modes/spans simultaneously; you MUST use a multi-valued array of first-class Evidence objects (= PROV qualified derivations). Multi-valued is non-negotiable.
- Do NOT treat transcript/subtitle/OCR text as peer signals to voice/frames — they are DERIVED renditions. Keep Signal.wasDerivedFrom chains or you lose the ability to distinguish 'the ASR misheard' from 'the creator misspoke,' which the eval needs to attribute errors correctly.
- Do NOT fold assertion_mode into Web Annotation oa:motivation — its values (identifying/classifying/describing/commenting) are too coarse to express stated-vs-inferred. Keep assertion_mode as your own property, orthogonal to channel.
- Selector fragility: store TextQuoteSelector (exact+prefix+suffix) ALONGSIDE character offsets and a denormalized `quote` snapshot, so evidence spans survive re-transcription/re-indexing and remain renderable in the receipt and scorable in the eval.
- Do NOT stand up a triplestore / full RDF-star runtime on day one. Store Evidence as native rows for velocity and keep a documented lossless mapping to PROV-O + WADM for export. The moat is the MEASURED provenance, not the serialization.
- Confidence must be CALIBRATED before you publish any accuracy figure — raw LLM self-reported or softmax confidence is miscalibrated. Calibrate against the golden set (reliability diagrams) or report ordinal buckets, and gate INFERRED groundings behind a threshold in the UI or they poison user trust and the headline number.
- Beware attribution to the wrong agent: only STATED/SHOWN/REPORTED extractions should be prov:wasAttributedTo the creator; INFERRED must be attributed solely to the model agent. Getting this wrong makes the product claim a human said something the model guessed — a credibility and possibly liability failure.

---

## Cross-platform text-first base object + profiles

*confidence: high*

### Verdict
The "one base object + per-platform profile" question is not open — the knowledge-organization field settled it two decades ago and runs it at national/continental scale today (Dublin Core Singapore Framework; DCAT → DCAT-AP → DCAT-AP-DE; Europeana EDM). Adopt it verbatim: ONE durable base object (the WEMI Post/Save/Referent core, expressed in reused schema.org CreativeWork + ActivityStreams 2.0 terms), with each platform declared as an APPLICATION PROFILE that (a) pins a schema.org subtype, (b) tightens cardinality, (c) binds controlled vocabularies, and (d) hangs only namespaced, platform-private fields in a proxy sub-object — never touching the base. Validate the whole thing with SHACL: a base shape that must pass on 100% of items regardless of platform (this is what guarantees cross-analyzability and the "map every restaurant in my saves" moat), plus one profile shape per platform. The reason the four Referent kinds survive the video→text modality shift is that the ontology never depended on modality in the first place: only the PROVENANCE evidence-modalities change (spoken/OCR/scene → title/body/link), while the node types, grounding authorities, and eval matrix are byte-identical. Reject per-platform schemas — they fragment exactly the cross-corpus query and the published-accuracy matrix that are the entire moat.

### Recommendation
# Cross-platform durable base object + per-platform profile architecture

## 0. The governance verdict first (directive 5), because it decides everything else
**One base object + per-platform Application Profiles, validated by SHACL per profile. Not per-platform schemas.** This is not a judgment call; it is the unanimous pattern of every metadata system that operates at cross-collection scale:
- **Dublin Core Singapore Framework**: an Application Profile = reuse of existing RDF terms + your own constraints (Description Set Profile / DCTAP table). You do NOT mint terms that already exist.
- **DCAT → DCAT-AP (EU) → DCAT-AP-DE/-IT/-NO**: one base standard, an EU profile that ships SHACL shapes, then national profiles that further constrain it — each shipping its own SHACL. This is the exact "base + jurisdiction profiles, each validated" shape you need, proven in production.
- **Europeana Data Model**: a base integration model that harmonizes thousands of institutions, using OAI-ORE **proxies** to keep each provider's native metadata losslessly *beside* the harmonized core, plus a dedicated provenance extension.

Per-platform schemas without a shared base are precisely what breaks the cross-corpus query. Your moat query ("map every restaurant in my saves," pooled TikTok+IG+Reddit+X) and your published-accuracy matrix both *require* a shared base object. So the base is not a convenience — it is load-bearing for the moat.

**SPEC.md line 139 already asserts this** ("the consensus object that Activity Streams 2.0, schema.org, Open Graph, oEmbed, Media RSS converge on … platform weirdness lives in adapters and never leaks into the core"). This recommendation formalizes that sentence into a validated, versioned profile architecture — it is a ratification + operationalization, not a pivot.

## 1. Vocabulary reuse — pick the canonical term source per field (DCAP tenet #1)
Do not invent what four standards already converged on. Bind each base field to a reused term:
- **schema.org CreativeWork is the class spine.** Its social subtypes already exist AND already carry the right edges: `CreativeWork → Article → SocialMediaPosting → DiscussionForumPosting`; plus `VideoObject`, `ImageObject`, `BlogPosting`. Critically, `SocialMediaPosting` already defines **`sharedContent`** (the quote/repost edge), and Google already consumes `DiscussionForumPosting` for Reddit-shaped data. Reuse this — it means the "open schema others can adopt" story rides on vocabularies crawlers already understand.
- **ActivityStreams 2.0** supplies the graph/edge terms schema.org is thin on: `inReplyTo` (reply edges = Reddit comment tree, X reply thread), `attributedTo` (multi-valued author), `context` (the conversation), `attachment`, `tag`, `url` (array of typed Links = renditions), `Collection`/`OrderedCollection` (the Save's collection membership). AS2 is the fediverse wire format — proven for exactly "portable cross-platform social objects."
- **oEmbed** supplies the polymorphic media enum *verbatim*: the four response types are **`photo · video · rich · link`**. These ARE your four mediaKinds — cite oEmbed, don't reinvent. Its rich→link fallback IS your graceful-degradation ladder.
- **Media RSS `media:group`** supplies the multi-rendition model: N `media:content` renditions of the SAME logical media (url/format/width/height/bitrate), grouped — exactly the eager poster + `video_versions` + `image_versions2` the capture layer already pulls.
- **Open Graph / Twitter Cards** (`og:type` article/video/music; `twitter:card` summary/player) = cheap capture-time hints to seed `mediaKind` before analysis.
- **IPTC** = the per-rendition embedded descriptive/rights metadata (Photo Metadata / Video Metadata Hub) as a capture source; IPTC **Media Topics** is already your subject authority.
- **DCTAP** = the *format you write each profile in* (a 12-column CSV table: property, class, mandatory, repeatable, value-constraint, controlled-vocab). Human-legible governance artifact the founder reviews; compiles to SHACL.
- **PROV-O + PAV + nanopublications** = the provenance spine (§4).
- **W3C PROF (Profiles Vocabulary)** = the registry that publishes base + each profile + its SHACL "resource role" as a versioned, walkable product (matches "governed as a versioned product" + "schema you can walk away with").

**Serialization fork worth a founder decision:** run an ergonomic internal typed JSON (TS types) at runtime, with a *published JSON-LD @context* mapping every field 1:1 to its schema.org/AS2 IRI, so **export = JSON-LD** but runtime carries no RDF tax. Recommend this over native RDF-at-runtime.

## 2. The base object (the durable core)
Keep the WEMI spine Save→Post→Referent. Profile work is almost entirely on **Post** (captured item) and **Save** (relationship); **Referent** is platform-independent by construction.

**Post (base) — schema.org CreativeWork + AS2. Core fields, each a reused term:**
| field | reused term | note |
|---|---|---|
| `postType` | schema.org subtype (VideoObject / ImageObject / SocialMediaPosting / DiscussionForumPosting / BlogPosting) | the profile PINS this |
| `canonicalId` + `permalink` | own IRI + `schema:sameAs` | MANDATORY + unique in every profile — the join key that lets a thin ZIP import be deepened later by live capture |
| `platform` | own closed enum | selects the profile |
| `creator[]` | `schema:author` / `as:attributedTo` | MULTI-VALUED (co-authors; reposter + original) |
| `datePublished` | `schema:datePublished` / `as:published` | |
| `headline` | `schema:headline` / `as:name` | Reddit/Substack title; null for X/TikTok |
| `body` | `schema:articleBody` / `schema:text` / `as:content` | the text-first core — caption OR long-form HTML; must accommodate both length regimes |
| `media[]` | Media RSS `media:group` of renditions | polymorphic; EMPTY for pure text |
| `mediaKind` | oEmbed {photo,video,rich,link} | on each rendition; a post-level *primary* derived |
| `references[]` | typed edges: `as:inReplyTo`, `schema:sharedContent`, `schema:citation` | quote / reply / repost / link-out — ONE typed-relation model for all platforms |
| `partOf` / `context` | `as:context` / `schema:isPartOf` | the thread/conversation |
| `tags[]` | `as:tag` | hashtags, native tags |
| `engagement` | `schema:InteractionCounter` | optional, platform-shaped |
| `profileData` | namespaced proxy (EDM/OAI-ORE proxy pattern; mirrors Reddit `{kind,data}`) | ALL platform-private fields live here, never in base |
| `rawPayloadRef` | provenance artifact pointer | native blob, versioned, out of core (rots fastest) |

**Save (base):** `savedAt`, `sourceSurface` (favorites/likes/posts/bookmarks — distinct intents), `collectionMembership[]` (AS2 Collection), `savedFromAccount`. Thin, already cross-platform.

**Referent (base):** the four kinds unchanged. Platform-independent — that is the point.

**The load-bearing rule:** platform-specific fields live ONLY in `profileData` (namespaced) and NEVER enter cross-platform analysis. A profile may: (a) pin a subtype, (b) tighten cardinality / make-mandatory, (c) bind a controlled vocab, (d) add namespaced profile-only fields. A profile may NOT add a field with cross-platform semantics, nor redefine a base term. New platform = new profile + new SHACL shape + new adapter, **zero base-schema change** — that is the maintainability proof and the same "expressiveness paid for with a constraint" discipline as the Referent ontology.

## 3. The three example profiles
**A — Short-video (TikTok / IG Reels / Shorts).** Pins `VideoObject`, primary `mediaKind=video`. Mandatory: ≥1 video rendition + a poster (ImageObject) rendition captured EAGERLY (expiring-signed-URL constraint); `body`=caption (may be empty). `profileData` (`tiktok:`/`ig:`): `soundId`/original-sound handle, `carouselChildren` (IG slideshow → OrderedCollection of ImageObjects), `effectIds`, `duetOf`/`stitchOf` (→ mapped up to base `references[]` typed relations). SHACL S_shortvideo: video rendition present, poster captured, `sourceSurface ∈ {favorites,likes,posts}`.

**B — Reddit (DiscussionForumPosting + comment tree).** Reddit's `thing` model (`kind` t3=post/link, t1=comment; `fullname`=kind_id; `Listing`=collection) maps ~1:1 onto schema.org `DiscussionForumPosting` (the mapping Google already consumes). Comment tree = nested `Comment` linked by `as:inReplyTo` — native, no new machinery. Reddit exercises ALL FOUR mediaKinds ({link post, image/video post, rich self-post}), so it's the best degradation stress test. `profileData` (`reddit:`): `subreddit` (also → base `partOf`), `flair`, `score`/`upvoteRatio` (→ base engagement), `fullname`, `isSelfPost`; `crosspostParent` → base `references[]`. SHACL S_reddit: `subreddit` mandatory; link-post ⇒ `references[]` contains outbound link (relation=links_to); comment nodes carry `inReplyTo`.

**C — X/Twitter (thread + quote/reply).** Pins `SocialMediaPosting`, primary `mediaKind` usually `rich` (text) else photo/video. X's `referenced_tweets` typed edges map DIRECTLY onto base `references[]`: `replied_to`→`as:inReplyTo`, `quoted`→`schema:sharedContent` (a quote *is* shared content), `retweeted`→a repost/Announce. `conversation_id`→base `context`/`partOf`; a thread = OrderedCollection sharing a conversation, self-replied. `profileData` (`x:`): `conversationId`, `quoteTweetId`, `isRetweet`, `tweetId`. SHACL S_x: replies carry `inReplyTo`; quotes carry `sharedContent`; thread membership carries `context`.

**Substack/LinkedIn** (no new base machinery): `BlogPosting`/`Article`, `mediaKind=rich`, `body`=long-form HTML; `profileData`: `section`/`newsletter` (Substack), `articleType` (LinkedIn).

## 4. Provenance — first-class, multi-valued, stated-vs-inferred (directive 2), and WHY the ontology survives the modality shift (directive 3)
The single insight that makes video↔text work: **the four Referent kinds never depended on modality. Only the set of available PROVENANCE evidence-modalities changes.** So promote `evidence_modality` (today a Claim-only field, `_RESEARCH-ontology` line 67) to a **first-class evidence array on EVERY extracted attachment** — entity/concept/claim/facet alike — and make the *available* modalities a function of the profile, not the ontology.

**Evidence node (one shape, serves video AND text — that generality is the durability):**
```
Evidence {
  modality: spoken_audio | transcript | on_screen_text | caption | title | body_text
          | visual_scene | link_target | creator_identity | platform_metadata | thumbnail_text,
  assertionMode: stated | inferred,      // PROV: wasQuotedFrom vs wasDerivedFrom
  locator: { span?:[s,e], timecode?, bbox?, url? },   // union: text span OR video timecode+bbox
  extractionMethod: asr | ocr | vlm | llm | rule | platform,   // PAV: pav:createdBy agent
  confidence: 0..1, extractedAt, modelVersion
}
```
- **Multi-valued** (PROV-O qualified pattern; nanopublications): each Referent edge carries an `evidence[]` ARRAY of *reified, annotatable* Evidence nodes — not a scalar `source` — because a restaurant may be BOTH stated in the caption AND visible on-screen, and you must hang {modality, span, confidence, method} on each. PROV's `prov:qualifiedDerivation` is the exact prior art for annotating a derivation from multiple sources.
- **Stated vs inferred** = the clean PROV distinction: `prov:wasQuotedFrom` (verbatim repeat of source text/image = **stated**) vs `prov:wasDerivedFrom` (a model derivation = **inferred**). "Caption says Joe's Pizza" → stated (quoted from caption span); "the dish looks like carbonara" → inferred (derived from visual scene). This is what makes NIL and faithfulness auditable — it IS the receipts moat rendered in the provenance strip. PAV (`pav:derivedFrom`/`importedFrom`/`createdBy`) adds the "imported from platform metadata vs created by our extractor" axis if needed.

**Modality sets by input type:**
- Short video populates {spoken_audio, on_screen_text, caption, visual_scene, creator_identity, platform_metadata} → needs VLM+ASR.
- Text post (X/Reddit/Substack) populates {title, body_text, caption, link_target, creator_identity, platform_metadata} → **LLM only, no VLM/ASR**.
- Same four Referent kinds emit from both; a restaurant NamedEntity grounded from a TikTok's on-screen text vs a Reddit post's body_text is the SAME node, SAME regime, SAME Place-ID resolver — only `evidence[].modality` differs. The moat query runs over NamedEntity(place) nodes regardless of source modality. **That invariance is the cross-analyzability guarantee.**

## 5. WEMI + graceful degradation for no-AV text (directives 3, 4)
Save→Post→Referent is modality-agnostic. Text-only X post: Save = bookmark + collection; Post = SocialMediaPosting/rich/body=text/references=quote+reply; Referent = the same four kinds from {body_text, title, link_target, creator_identity}. Provenance modalities "shift left" from AV to text channels; node types, authorities, and eval matrix are byte-identical. A book recommended in a tweet grounds to the same OpenLibrary OLID as a book shown on-screen in a TikTok.

**mediaKind degradation ladder (oEmbed fallback):** `video`/`photo` (rendition + poster) → `rich` (embeddable HTML: a tweet, a self-post) → `link` (resolvable permalink + card). Every Post resolves to AT LEAST `link` (permalink guaranteed = join key). Eager poster capture means an expired video URL still leaves a `photo` poster; even with no media, `link` + analysis-derived text remains. **Cross-platform analysis never depends on media presence** — it runs on the Referent layer, populated from whatever modalities exist.

## 6. Cross-platform validation (the CI contract)
- **Base SHACL shape** runs over EVERY item regardless of platform → guarantees the cross-analyzable core (canonicalId, creator, datePublished, body-or-media, well-typed references) is always present. Failing this = the item cannot enter the pooled corpus.
- **Profile SHACL shape** runs over items of that platform → enforces profile constraints (Reddit requires subreddit; X reply requires inReplyTo).
- **Author profiles as DCTAP tables → compile to SHACL** (known toolchain); the table is the founder-reviewable governance doc.
- **Publish base + all profiles + versions via PROF** = the walkable open schema.
- **Eval consequence:** because platform lives as a *covariate* on a shared base (not a separate schema), the published accuracy matrix reports **pooled AND sliced by platform/modality** — the benchmark stays one instrument as platforms are added, instead of fragmenting into N incommensurable per-platform numbers.

### Checklist
- Every profile reuses existing schema.org/AS2 terms; zero net-new BASE terms without a documented warrant (Singapore Framework tenet).
- Base SHACL shape passes on 100% of items regardless of platform (the cross-analyzability gate).
- Each platform ships three artifacts and only three: a DCTAP table + a SHACL shape + an adapter — and adding one touches ZERO base fields.
- Every Referent attachment (entity/concept/claim/facet) carries evidence[] with >=1 element; each element has modality + assertionMode(stated|inferred) + locator + confidence + extractionMethod.
- mediaKind is drawn from oEmbed {photo,video,rich,link} at the rendition level; every post degrades to at least a resolvable link.
- The four Referent kinds and their grounding authorities are identical across all profiles; only evidence-modalities vary between video and text.
- canonicalId + permalink are mandatory and unique in every profile (the join key).
- PROF registry publishes base + all platform profiles + version numbers (the walk-away open schema).
- The moat query (pooled cross-platform 'map every restaurant') is validated on a mixed-platform gold slice, with accuracy reportable both pooled and sliced by platform/modality.
- A text-only post (X/Reddit self-post) produces the same output SHAPE as a rich-AV post — verified by running the base analysis with the VLM/ASR path disabled and confirming NamedEntity/Concept/Claim/Facet still populate from text modalities.

### Evidence
- Singapore Framework defines a Dublin Core Application Profile as reuse of existing terms plus documented constraints (a stack of work items incl. Description Set Profile); DCTAP is the 12-element table format for writing one, machine-actionable as CSV. — *https://www.dublincore.org/specifications/dublin-core/singapore-framework/ and https://www.dublincore.org/specifications/dctap/*
- schema.org hierarchy CreativeWork > Article > SocialMediaPosting > DiscussionForumPosting; SocialMediaPosting adds sharedContent (a CreativeWork shared/reposted as part of the posting), inherited by DiscussionForumPosting; Google consumes DiscussionForumPosting/SocialMediaPosting for forum data. — *https://schema.org/SocialMediaPosting and https://schema.org/DiscussionForumPosting and https://schema.org/sharedContent and https://developers.google.com/search/docs/appearance/structured-data/discussion-forum*
- ActivityStreams 2.0 Object properties include attributedTo, inReplyTo, context, attachment, tag, url, replies (all optional/repeatable); Collection/OrderedCollection group objects; extended object types include Article, Image, Video, Note, Page. — *https://www.w3.org/TR/activitystreams-vocabulary/ and https://www.w3.org/ns/activitystreams*
- oEmbed defines exactly four response types — photo, video, link, rich — where rich is generic embeddable HTML and link is a bare link with metadata (the graceful-degradation fallback chain). — *https://oembed.com/*
- Media RSS media:group groups multiple media:content renditions that are the same logical content in different representations/resolutions/formats; namespace http://search.yahoo.com/mrss/. — *https://www.rssboard.org/media-rss and https://en.wikipedia.org/wiki/Media_RSS*
- PROV-O provides direct relations (wasDerivedFrom, wasAttributedTo) AND qualified counterparts (qualifiedDerivation, qualifiedAttribution) that attach an annotatable object to a relationship, enabling detail on derivations from multiple sources. — *https://www.w3.org/TR/prov-o/*
- prov:wasQuotedFrom = a verbatim repeat of source text/image (maps to STATED); prov:wasDerivedFrom = a derivation (maps to INFERRED); nanopublications separate Assertion / Provenance / PublicationInfo graphs so each claim carries its own provenance; PAV adds authored/derived/imported/retrieved axes. — *https://link.springer.com/article/10.1007/s00799-025-00431-x and https://pmc.ncbi.nlm.nih.gov/articles/PMC4177195/ and http://www.nanopub.org/guidelines/*
- DCAT-AP and its national profiles (DCAT-AP-DE etc.) each ship SHACL shapes for instance validation; W3C PROF (Profiles Vocabulary) describes the resources that define/implement a profile and can carry a SHACL validator role — the 'base standard + jurisdiction profiles, each SHACL-validated' pattern in production. — *https://www.w3.org/TR/dx-prof/ and https://journal.code4lib.org/articles/14711*
- Europeana Data Model is a base integration/application-profile framework that harmonizes cross-collection metadata while preserving each provider's native metadata via OAI-ORE proxies/aggregations, with a dedicated provenance extension — the base + per-source proxy pattern. — *https://msi.dublincore.org/standards/europeana-data-model/ and https://pro.europeana.eu/page/edm-profiles*
- Reddit 'thing' model: every object has a kind (t1=comment, t3=link/post), a fullname (kind_underscore_base36id), and Listings paginate collections; wrapper is {kind, data} — maps ~1:1 to schema.org DiscussionForumPosting + nested Comment/inReplyTo. — *https://github.com/reddit-archive/reddit/wiki/JSON*
- X API v2 tweet.referenced_tweets carries typed edges with type in {replied_to, quoted, retweeted} plus conversation_id — mapping directly to a single base references[] typed-relation model (inReplyTo / sharedContent / repost). — *https://developer.x.com/en/docs/twitter-api/data-dictionary/object-model/tweet*
- SHACL (W3C Rec) validates RDF graphs via node/property shapes and produces a conformance report; application profiles ship SHACL shapes so users validate instances against the profile — the mechanism for base-shape-on-all-items + profile-shape-per-platform CI. — *https://www.ontotext.com/knowledgehub/fundamentals/what-is-shacl/ and https://www.w3.org/TR/dx-prof/*
- Open Graph og:type (article/video/music/…) and Twitter Card twitter:card (summary/summary_large_image/player/app) are platform-declared coarse type hints usable at capture time to seed mediaKind before analysis. — *https://ogp.me/ and https://developer.x.com/en/docs/twitter-for-websites/cards/overview/abouts-cards*

### Pitfalls
- Platform fields leaking into the base object — the #1 failure that kills cross-analysis. Enforce with base-SHACL running on 100% of items + all platform-private fields namespaced inside profileData (EDM/OAI-ORE proxy discipline).
- Minting new terms when schema.org/AS2 already have them (e.g. inventing a 'quote' field instead of reusing schema:sharedContent, or a 'reply' field instead of as:inReplyTo). Violates DCAP tenet #1 and breaks the 'open schema others adopt' story — crawlers already understand the standard terms.
- Modeling mediaKind as the type of the POST rather than of each RENDITION. Reddit posts are multi-kind (a post can be link + preview image); model mediaKind on renditions and derive a post-level primary.
- Modeling provenance as a scalar 'source' field — directive 2 requires multi-valued. A single source cannot express 'stated in caption AND visible on-screen.' Must be an array of reified, qualified Evidence nodes (PROV qualifiedDerivation).
- Collapsing stated vs inferred. Without wasQuotedFrom/wasDerivedFrom distinction, faithfulness eval and honest NIL are unauditable — it is the entire receipts/provenance-strip moat.
- Per-platform eval schemas. If each platform has its own schema the published accuracy MATRIX cannot aggregate and the benchmark fragments into N incommensurable numbers. Keep platform as a covariate on ONE base so accuracy reports pooled AND sliced.
- Over-analyzing the full comment tree. Capture the tree structure (preserve inReplyTo edges) but scope Referent EXTRACTION to the saved node in v1 — analyzing every comment explodes annotation cost, mirroring the v1-cut discipline already in the ontology.
- Forgetting the permalink-as-join-key invariant. canonicalId/permalink must be MANDATORY + unique in every profile — it is what lets a thin ZIP-imported item later be deepened by live capture (SPEC already depends on this).
- Capping body at caption length. Substack/LinkedIn long-form HTML and a TikTok caption share the base body field; it must accommodate both length regimes or long-form content silently truncates.

---

## Generalized + cultural grounding authorities (ESCO demoted; Know Your Meme)

*confidence: high*

### Verdict
Build the grounding moat on a CC0/CC-BY spine you can legally mirror and redistribute, not on a niche taxonomy. Wikidata (CC0) is the canonical identifier hub for both general knowledge AND internet culture; IPTC Media Topics (CC BY 4.0, native SKOS) is the always-resolvable coarse subject backbone; Open English WordNet (CC BY 4.0) + ConceptNet (CC BY-SA 4.0) supply senses and commonsense relations; OpenAlex Topics (CC0) is an optional scholarly overlay. ESCO is correctly demoted: saved short-video is rarely about occupations, so occupation/skill grounding becomes an OFF-by-default add-on (and if you ever need it, O*NET at CC BY 4.0 is a cleaner license than ESCO). The founder's cultural-grounding instinct is right and under-served, but there is NO clean, API-accessible, licensable meme authority. The correct architecture is therefore: make "CulturalReference" a first-class Referent with its OWN internal SKOS anchor, ground it to Wikidata QIDs where they exist (the only commercially-clean meme-bearing authority), and treat Know Your Meme, TVTropes, and Urban Dictionary as link-only references you consult and deep-link to but NEVER ingest, because they are proprietary or non-commercial. The long tail that Wikidata misses is captured by a NIL + folksonomy-promotion loop — which is where your moat actually compounds.

### Recommendation
THE GENERALIZED + CULTURAL GROUNDING STACK (per concept sub-type -> authority), with the KYM assessment and routing/NIL rules.

== A. GENERAL-KNOWLEDGE / COMMONSENSE SPINE (de-ESCO'd) ==
Design rule that drives every pick: the moat is a dataset you MEASURE, STORE, and REDISTRIBUTE, so favor CC0/CC-BY authorities you can mirror locally; use ShareAlike/NC/proprietary sources only by reference (query/link), never by bulk ingestion.

1) Wikidata (CC0) = the universal identifier HUB and interlingua. Every NamedEntity that routes to a domain authority (MusicBrainz, Google Places, OpenLibrary) also carries a Wikidata QID, so Wikidata is the backbone that ties the whole graph together, and it is the ONE authority that also covers internet culture (see C). Mirror the dumps; do not depend on the public SPARQL endpoint at scale (row/rate limits).
2) IPTC Media Topics (CC BY 4.0, ~1,100 terms, shipped as SKOS + RDF/Turtle/NewsML-G2) = the CONTROLLED-CORE coarse subject backbone. It was built for exactly your question — "what is this media item about" — is editorially curated, broad, and neutral, and is the single best de-niche-ification lever. It is coarse, so it is the browse/facet layer, always assignable (worst case the broad parent), never fully NIL at the coarse level.
3) Wikidata items (CC0) = FINE-GRAINED concept grounding for the specific topic ("sourdough fermentation", "cortisol", "quiet quitting"), with hierarchy via P279/P31. This is the specificity layer IPTC lacks.
4) Open English WordNet 2024 (CC BY 4.0) = sense inventory for disambiguation (which "spring"). ConceptNet 5.7 (CC BY-SA 4.0, live JSON-LD REST API at api.conceptnet.io) = commonsense relation edges (UsedFor, CapableOf, AtLocation) that support the VLM's INFERRED facets. Both are queryable; store IDs/edges you need, not bulk graph, to respect CC-BY-SA.
5) OpenAlex Topics (CC0; 4 domains > 26 fields > 254 subfields > ~4,500 topics, maps to Wikipedia) = OPTIONAL scholarly overlay, switched on only for educational/explainer/scientific content.
REJECT as PRIMARY runtime authorities: BabelNet (technically the best multilingual hub that fuses WordNet+Wikipedia+Wikidata+ConceptNet, but its free/API tier is CC BY-NC-SA 3.0 = NON-COMMERCIAL; commercial use requires a paid Babelscape license — disqualified for a commercial product; use only offline as a mapping aid during vocabulary construction). DBpedia (CC BY-SA 3.0 — the ShareAlike copyleft is a hazard for a stored, redistributed proprietary graph; prefer Wikidata CC0 for the same facts).
ESCO REASSESSMENT (explicit): correct to DE-EMPHASIZE. ESCO is an EU occupations/skills lens — the exact niche over-orientation the founder rejects; saved videos are rarely about jobs. Relegate occupation/skill grounding to an OFF-by-default "Occupation/Skill profile" add-on, gated behind a career/how-to-job content classifier. If ever needed, prefer O*NET (CC BY 4.0, US DOL) over ESCO — cleaner license and comparable coverage — but it is NOT on the primary spine.

== B. HOW THEY MAP TO EACH OTHER ==
Wikidata is the join key: NamedEntity domain IDs (MusicBrainz/Places/OpenLibrary) all reconcile to QIDs; OEWN synsets and Wiktionary entries carry Wikidata links; OpenAlex Topics map to Wikipedia (hence QIDs); IPTC Media Topics have partial Wikidata mappings; ConceptNet nodes expose external-URL edges to Wikidata/DBpedia/WordNet. Practical rule: store the native authority ID for precision AND the Wikidata QID for cross-analysis, joined by skos:exactMatch/closeMatch.

== C. CULTURAL / INTERNET-CULTURE GROUNDING (the under-served wedge) ==
Honest reality: there is NO clean, licensable, API-accessible meme authority. So model "CulturalReference" (meme / format / trend / slang) as a first-class Referent with its OWN internal SKOS node as the durable anchor, and skos:closeMatch OUT to external IDs only where a persistent one exists. Ranked usable stack:
1) Wikidata (CC0) = the cultural SPINE. It is the only commercially-clean, SPARQL/API-accessible, persistent-ID authority that actually contains internet culture: "internet meme" is Q2927074, used as P31 on thousands of meme/format/trend items. Ground meme -> QID via reconciliation; gender-neutral, governed, redistributable.
2) KNOW YOUR MEME = richest meme knowledge base, but ACCESS/LEGAL VERDICT: do NOT ingest. Owned by Literally Media (acquired 2016; KYM had earlier passed Rocketboom->Cheezburger 2011). There is NO maintained official public API — only unofficial scrapers (PerceiveYourMeme, nodeyourmeme, memescraper); any early API is defunct/undocumented. Content is proprietary/copyrighted (NOT Creative Commons) and governed by a ToS that restricts scraping and commercial reuse. Use it two SAFE ways only: (a) human-facing "learn more" DEEP LINK — store the KYM slug/URL on the CulturalReference node (linking is fine); (b) OFFLINE reference during vocabulary curation — a human/agent reads KYM to author YOUR OWN neutral SKOS meme node + scope note; do not store or redistribute KYM prose. Optionally seed an initial internal meme vocabulary from ACADEMIC meme corpora (DH2020 KYM-derived corpus; MET-Meme; MemeInterpret) — but each is research-licensed; verify before any commercial use.
3) Wiktionary via Kaikki/wiktextract (tool MIT; data CC BY-SA/GFDL, JSONL, carries Wikidata links) + Wikidata Lexemes (CC0) = slang/neologism/phrase grounding ("rizz", "delulu", "brat summer"). Prefer Wikidata Lexemes (CC0) where present.
4) Genius (free-token API; annotations + referents model) = music/lyric references and crowd annotations. TRAP: lyrics text is licensed/withheld — you get metadata, annotation/referent IDs, and song/artist entities (which carry MusicBrainz/Wikidata links). Use for "this audio references song X"; deep-link the annotation, never store lyric text.
5) TVTropes = narrative/format tropes, but CC BY-NC-SA 3.0 = NON-COMMERCIAL (plus contested 2012 relicensing) -> cannot ingest/redistribute commercially. Link-only + offline reference, same posture as KYM.
6) Urban Dictionary = official API only "with express permission"; unofficial scrapers exist but content stays under UD ToS; high offensive/biased-content risk that conflicts with the neutrality requirement. Allow at most as an opt-in human-facing gloss link; NOT a grounding authority.
7) GDELT (free; redistribution allowed WITH citation) = TREND/EVENT grounding via its Global Knowledge Graph themes — "what real-world event/trend does this reference." Complement for news-adjacent short video, not memes per se.
8) Fandom/wikis (CC BY-SA) = franchise/fictional-universe entities. Copyleft — prefer to ground the underlying character/work to Wikidata and deep-link to Fandom.
Cultural grounding pattern = internal SKOS CulturalReference node (controlled-core + folksonomy hybrid) as anchor + skos:closeMatch to {Wikidata QID (preferred, CC0) | KYM URL | Genius/MusicBrainz ID | Fandom URL} + NIL when nothing durable exists.

== D. THE DECIDABLE ROUTING (mention -> authority, with graceful NIL) ==
A deterministic router keyed on Referent sub-type, priority-ordered, each step emitting {authority, external_id|NIL, confidence, method(stated|inferred), provenance_source}:
1. NamedEntity? -> type routes to domain authority (music->MusicBrainz; place->Google Places/GeoNames; book->OpenLibrary; person/org/work->Wikidata), ALL reconciled to a Wikidata QID hub.
2. Concept/topic? -> (a) assign coarse IPTC Media Topic (always resolvable); (b) attempt fine Wikidata QID above a confidence threshold, else NIL; (c) attach OEWN synset for sense + ConceptNet edges for commonsense (enrichment); (d) if educational/scientific signal, also map OpenAlex Topic.
3. CulturalReference (meme/format/trend/slang)? -> (a) try Wikidata QID (P31 internet meme, or the referenced work/song/person); (b) if slang/phrase -> Wiktionary(Kaikki)/Wikidata Lexeme; (c) if music/lyric -> Genius + MusicBrainz/Wikidata; (d) ALWAYS also mint/attach the internal SKOS CulturalReference node (durable even when externals NIL) and record KYM/TVTropes/Fandom deep-links as references, not ingested data.
4. Occupation/Skill (rare)? -> OPTIONAL O*NET(CC BY)/ESCO add-on, OFF by default, gated by a career/skills classifier.
NIL RULES (honest "no match"): if no external authority clears the threshold, status=NIL, but the mention is RETAINED as (i) a free-text label and (ii) an internal SKOS candidate in the folksonomy layer. PROMOTION: when a candidate recurs across >=N items or >=M users (or an agent proposes it high-confidence), promote it to a governed SKOS concept in the versioned vocabulary and RE-ATTEMPT external grounding on the next release. This is graceful degradation AND the capture mechanism for the emergent long tail — the compounding core of the moat.

== E. GENDER-NEUTRALITY / BIAS / GENERALIZATION GUARDRAILS ==
- Neutral-by-construction backbones: IPTC Media Topics (news-subject neutral), Wikidata (CC0, community-governed), OEWN, OpenAlex. Avoid any vocabulary scoped to one demographic/domain — that IS the ESCO failure mode (an occupations lens forced onto general content).
- Debiased candidate generation: if you use embeddings to propose grounding candidates, use ConceptNet Numberbatch, which bakes in Speer's multi-axis debiasing (gender/ethnic/religious) while preserving legitimate gender signal — cite it as the standard of care over raw word2vec/GloVe.
- Exclude Urban-Dictionary-class sources as authorities (offensiveness/bias); opt-in human gloss only.
- Governance tenet: the vocabulary is a versioned product with neutral scope notes; affect/intent/genre FACETS defined behaviorally, not demographically; the stated-vs-inferred provenance flag is itself a bias control — inferred cultural/demographic attributes must be marked inferred and be suppressible; each release runs a bias/neutrality review and re-attempts NIL grounding.

### Checklist
- Every grounding record is multi-valued and carries {authority, external_id|NIL, confidence, method(stated|inferred), provenance_source(s)}.
- All SPINE authorities are CC0 or CC-BY and locally mirrorable, so the measured, redistributable moat dataset is legally clean.
- No non-commercial or proprietary source (KYM, TVTropes, Urban Dictionary, BabelNet, Genius lyrics) is ingested or redistributed — link-only / offline-reference only.
- A Wikidata QID is attached as the canonical hub wherever any entity or meme resolves, enabling cross-platform cross-analysis.
- A controlled coarse subject (IPTC Media Topic) is always assignable — the item is never fully NIL at the coarse level.
- CulturalReference has its own internal SKOS anchor node that is independent of, and survives, any external NIL.
- NIL is a first-class, queryable status; NIL mentions are retained (label + candidate node) and enter the folksonomy-promotion loop with re-grounding on the next vocabulary release.
- Occupation/skill authorities (O*NET/ESCO) are OFF by default and gated behind a career/skills content classifier — ESCO is never on the primary spine.
- Inferred cultural/demographic attributes are flagged 'inferred' and are suppressible; facet labels (affect/intent/genre) are defined behaviorally, not demographically.
- If embeddings drive candidate generation, they are debiased (ConceptNet Numberbatch class), not raw word2vec/GloVe.
- The vocabulary is a versioned product; each release runs a documented bias/neutrality review and re-attempts previously-NIL groundings.
- Native domain IDs (MusicBrainz/Places/OpenLibrary) are stored alongside the QID via skos:exactMatch/closeMatch, not instead of it.

### Evidence
- Wikidata data is CC0 (public-domain dedication), making it the one commercially-clean, redistributable identifier hub; it also models internet culture ('internet meme' = Q2927074, used as P31 on many meme items). — *https://www.wikidata.org/wiki/Q2927074 ; https://www.wikidata.org/wiki/Wikidata:SPARQL_query_service/Copyright*
- IPTC NewsCodes / Media Topics are licensed CC BY 4.0, free of royalty, and downloadable as SKOS + RDF/XML + RDF/Turtle — purpose-built to describe what a media item is about (~1,100 terms). — *https://iptc.org/standards/newscodes/ ; https://iptc.org/standards/media-topics/*
- ConceptNet 5.7 is CC BY-SA 4.0 with a live read-only JSON-LD REST API (api.conceptnet.io) serving ~250k queries/day — usable for commonsense relations but ShareAlike constrains bulk redistribution. — *https://conceptnet.io/ ; https://github.com/commonsense/conceptnet5/wiki/Copying-and-sharing-ConceptNet*
- ConceptNet Numberbatch (17.04+) applies Robyn Speer's multi-axis debiasing (extending Bolukbasi) to reduce gender/ethnic/religious stereotypes while preserving legitimate gender signal — the standard-of-care for debiased embeddings. — *http://blog.conceptnet.io/posts/2017/conceptnet-numberbatch-17-04-better-less-stereotyped-word-vectors/*
- Open English WordNet 2024 edition (released 1 Nov 2024; 120,630 synsets) is CC BY 4.0 — a permissively licensed sense inventory for disambiguation. — *https://en-word.net/ ; https://github.com/globalwordnet/english-wordnet*
- BabelNet's free version and API are CC BY-NC-SA 3.0 (NON-COMMERCIAL); commercial use requires a paid license via Babelscape — disqualifying it as a primary runtime authority for a commercial product. — *https://babelnet.org/license*
- OpenAlex Topics is CC0 with a 4-level hierarchy (4 domains, 26 fields, 254 subfields, ~4,500 topics) mapped to Wikipedia — a clean optional scholarly overlay. — *https://help.openalex.org/hc/en-us/articles/24736129405719-Topics ; https://help.openalex.org/hc/en-us/articles/24397762024087-Pricing*
- DBpedia is CC BY-SA 3.0 (ShareAlike copyleft) and its public SPARQL endpoint caps results (~10k rows, fair-use limits) — prefer Wikidata CC0 for the same facts and avoid SA contamination of a redistributed graph. — *https://en.wikipedia.org/wiki/DBpedia ; https://www.dbpedia.org/resources/sparql/*
- Know Your Meme is owned by Literally Media (since 2016; earlier Rocketboom->Cheezburger 2011) and has NO maintained official public API — only unofficial scrapers (PerceiveYourMeme, nodeyourmeme); content is proprietary and governed by a restrictive ToS. — *https://en.wikipedia.org/wiki/Know_Your_Meme ; https://github.com/dinhanhx/PerceiveYourMeme ; https://github.com/beastwilson/nodeyourmeme*
- Academic meme corpora exist as potential offline seeds (DH2020 KYM-derived corpus; MET-Meme; MemeInterpret 2025) but are research-licensed — verify before commercial use. — *https://dh2020.adho.org/wp-content/uploads/2020/07/590_AcquisitionandAnalysisofaMemeCorpustoInvestigateWebCulture.html ; https://aclanthology.org/2025.findings-emnlp.871.pdf*
- TVTropes content is CC BY-NC-SA 3.0 (NON-COMMERCIAL) with a contested 2012 relicensing — cannot be ingested/redistributed commercially; link-only. — *https://tvtropes.org/pmwiki/pmwiki.php/MediaNotes/Copyright ; https://tvtropes.org/pmwiki/posts.php?discussion=13850739750A54111300*
- Genius API (free token) exposes song/artist metadata, annotations and referents, but does NOT provide reusable lyrics text (legally licensed/withheld) — use for reference IDs, not lyric storage. — *https://lyricsgenius.readthedocs.io/en/master/reference/api.html ; https://docs.genius.com*
- Wiktionary is machine-readable via wiktextract (MIT-licensed tool) / Kaikki (JSONL, updated ~weekly, includes Wikidata IDs); underlying data is CC BY-SA + GFDL — good for slang/neologism grounding; prefer CC0 Wikidata Lexemes where present. — *https://github.com/tatuylonen/wiktextract ; https://kaikki.org/dictionary/rawdata.html*
- Urban Dictionary's official API requires express permission and content stays under UD ToS; only unofficial scrapers exist — plus high offensive/biased-content risk that conflicts with neutrality. — *https://urbandictionary.help/tos/ ; https://github.com/kashyap010/unofficial-urban-dictionary-api*
- GDELT datasets (incl. the Global Knowledge Graph themes/events) may be redistributed/rehosted freely provided a citation/link to GDELT is included — usable for trend/event grounding. — *https://www.gdeltproject.org/data.html*
- O*NET database content is CC BY 4.0 (US DOL, attribution required) — a cleaner license than ESCO for the rare career/skill video, confirming ESCO can be demoted to an optional niche add-on. — *https://www.onetcenter.org/license_db.html ; https://www.onetonline.org/help/license*

### Pitfalls
- ShareAlike contamination: bulk-ingesting ConceptNet (CC BY-SA), DBpedia (CC BY-SA), Wiktionary/Fandom (CC BY-SA/GFDL) into a proprietary, redistributed moat dataset can trigger copyleft. Mitigation: store only IDs + closeMatch links + your OWN scope notes; query/enrich at runtime; keep the redistributable core sourced from CC0/CC-BY (Wikidata, IPTC, OEWN, OpenAlex, O*NET).
- Proprietary/NC scraping trap: Know Your Meme, TVTropes, and Urban Dictionary are proprietary or non-commercial. Scraping them into the product for grounding is a ToS/copyright risk. Deep-link and consult offline only — never ingest or redistribute their text.
- BabelNet trap: technically the ideal multilingual WordNet+Wikipedia+Wikidata+ConceptNet hub, but its free/API tier is CC BY-NC-SA 3.0. Do NOT wire it into runtime; commercial licensing cost is unquantified. Use offline as a mapping aid only.
- Genius lyrics trap: the API deliberately withholds reusable lyrics. Store only annotation/referent IDs and song/artist entities; storing lyric text invites a licensing claim.
- Wikidata long-tail coverage is uneven for emergent/niche memes and fresh slang — reconciliation will frequently return NIL. The NIL + folksonomy-promotion loop is therefore load-bearing, not a nice-to-have; without it the cultural wedge silently degrades.
- Urban Dictionary offensiveness/bias directly conflicts with the gender-neutrality mandate — keep it out of the authority set; opt-in human gloss at most.
- Embedding-based candidate generation reintroduces demographic bias if trained on raw word2vec/GloVe. Use debiased Numberbatch-class vectors and always mark cultural/demographic attributes as inferred + suppressible.
- Public SPARQL endpoints (Wikidata, DBpedia) impose row/rate limits and fair-use throttling — do not depend on them at ingestion scale; mirror the CC0/CC-BY dumps locally.
- IPTC Media Topics (~1,100 terms) is deliberately coarse — excellent as the browse/facet backbone but insufficient as the only concept grounding; it MUST be paired with Wikidata for specificity or the grounding looks shallow.
- 'Cultural reference' with no internal anchor: if you only closeMatch to external IDs, every external NIL loses the concept. The internal SKOS CulturalReference node must be the durable anchor so meaning survives when externals fail.