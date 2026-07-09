# Commonplace Knowledge-Organization Engineering Standard (v1)

> **The answer to "is there a standard we can follow and validate against?"** — There is no single monolithic standard for a universal classification + extraction + grounding schema, and chasing one is a trap (the MPEG-7 failure: an over-expressive schema with no formal, validated semantics fails at the interoperability it promised). The disciplined move is to **compose the mature de-facto standard that already exists, as five layers**, and hold every draft of the schema (`knowledge-ontology.md`) and the eval (`evaluation-methodology.md`) against the validation checklist below. This doc is that standard. Grounded in cited prior art (`2026-07-07-schema-foundations-research.md`).

## The 10 durable tenets (each from named prior art — violate one, and the schema rots)

1. **Conceptualize before you formalize.** Model the domain first; RDF/OWL/JSON-schema serialization is the *last* step. *(METHONTOLOGY lifecycle.)*
2. **Requirements ARE competency questions.** Scope = the finite set of questions the library must answer ("every save that makes a fact-checkable health claim"; "every save grounded to this musician"; "map every restaurant across all my platforms"). CQs are the acceptance tests; a term no CQ needs gets cut. *(Grüninger & Fox / Uschold & King.)*
3. **Minimal ontological commitment.** Say the least that supports the CQs. The direct antidote to MPEG-7. *(Gruber 1995.)*
4. **Separation of concerns is THE durability principle:** identity (opaque URI) ≠ label (`skos:prefLabel/altLabel`, language-tagged) ≠ mapping (`skos:exactMatch` to an external authority) ≠ assertion-about-the-thing (a provenanced statement). This is what lets you relabel, remap, and re-ground **without breaking stored data.** *(SKOS / ISO 25964 / Wikidata.)*
5. **Class-vs-instance discipline.** A small set of OWL classes (the WEMI spine + the Referent kinds); the actual subjects/genres/memes are SKOS concept **instances**, not a proliferating class tree. *(Noy-McGuinness / OntoClean.)*
6. **Stable, opaque identifiers — never semantic.** No `music/pop`; you will need to reclassify. *(Cool-URIs; Wikidata QIDs, MusicBrainz MBIDs.)*
7. **Never delete, only deprecate**, under semantic versioning (`owl:deprecated` + replacement pointer, `owl:versionIRI`); govern the schema as a versioned product with a public changelog. *(schema.org additive-only.)*
8. **Controlled core + open extension.** Controlled-core + open-tag folksonomy hybrid, with a warrant-based promotion pipeline from tags into the core. *(schema.org core→pending; NeOn.)*
9. **Reuse before build; define once, reference everywhere.** Don't mint terms four standards already converged on; map to Wikidata / MusicBrainz / Places / OpenLibrary / schema.org / IPTC. *(NeOn reuse; OBO orthogonality.)*
10. **Orthogonal facets, not one enumerative tree.** Facets (affect/genre/intent) crossed, never a combinatorial mega-hierarchy. *(Ranganathan PMEST; OBO.)*

## The 5-layer standard stack (what to conform to, layer by layer)

| Layer | Standard adopted | Role in Commonplace |
|---|---|---|
| **Methodology** | NeOn (on METHONTOLOGY / Uschold-King / competency questions / Noy-McGuinness 101) | how we *build* the ontology: specify (CQs) → conceptualize → formalize → validate → govern |
| **Conformance** | RDF/RDFS · **thin OWL 2** (EL/RL or just RDFS+SHACL) · **SKOS** (+SKOS-XL) · **SHACL** · **PROV-O** | the graph, the concept schemes, the logical classes, the machine-checkable contract, the provenance |
| **Design theory** | Ranganathan facets · **ISO 25964** (thesauri + interoperability) · Gruber minimal-commitment · Svenonius · Hjørland domain analysis | how the vocabularies are *shaped* (BT/NT/RT, facets, mappings) |
| **Governance** | schema.org core→pending→deprecated additive lifecycle · OBO Foundry (opaque IDs, single authority, orthogonality) · **FAIR** | how it *evolves* without breaking — semver, deprecation, changelog |
| **Validation** | Competency questions as SPARQL/SHACL acceptance tests · OntoClean · OQuaRE/OOPS! quality scans · IAA on guidelines · **TAC-KBP** entity-linking metrics with honest NIL | how we *prove* each draft is sound |

**Upper ontology — defended: NO full BFO/DOLCE/SUMO import.** ISO/IEC 21838 (BFO) exists to coordinate *many organizations'* ontologies — a multi-org interoperability problem a solo builder does not have, at the full modeling cost (the MPEG-7 trap). But not structureless either: adopt **schema.org as a pragmatic pseudo-upper** (the web's de-facto top type system, which crawlers already understand — so the "open schema others adopt" story rides on vocabularies that already have reach).

## The validation checklist (run every schema/eval draft against this)

**Structure & identity**
- [ ] Every concept has an **opaque, stable URI**; no meaning encoded in any ID.
- [ ] **Separation of concerns** holds: identity ≠ label ≠ mapping ≠ assertion are distinct fields/graphs.
- [ ] **Class-vs-instance** is clean: the node *kinds* are few OWL classes; subjects/genres/memes are SKOS instances.
- [ ] Every concept scheme is **SKOS**, ISO-25964-shaped (BT/NT/RT), with `exactMatch/closeMatch` to a reused external authority.

**Scope & minimality**
- [ ] Every term traces to at least one **competency question**; unused terms are cut.
- [ ] **Minimal commitment**: no expressiveness beyond what a CQ needs (MPEG-7 check).
- [ ] Facets are **orthogonal**, not an enumerative tree.

**Provenance & evidence** *(founder directive 1)*
- [ ] Every extraction carries a **REQUIRED, non-empty, multi-valued** `evidence[]`; a zero-evidence extraction is rejected at write time.
- [ ] Each Evidence has a typed **selector** (text quote+position; media temporal `#t=` / spatial `#xywh=`), a **channel** (closed ~6), a **source_role** (extensible), an **assertion_mode** (STATED/SHOWN/REPORTED/INFERRED), and a **confidence** — modeled on **PROV-O** (qualified derivation) + **Web Annotation** + **Media Fragments**.
- [ ] Derived renditions (transcript/OCR) carry `wasDerivedFrom` to their source signal (ASR-misheard ≠ creator-misspoke).

**Cross-platform** *(founder directive 2)*
- [ ] **One base object** (WEMI + reused schema.org/AS2/oEmbed terms); each platform is an **Application Profile** (DCTAP → SHACL), touching **zero base fields**.
- [ ] The **base SHACL shape passes on 100% of items regardless of platform** (the cross-analyzability gate).
- [ ] The four Referent kinds + grounding authorities + eval matrix are **identical across platforms**; only evidence-modalities vary (video↔text).

**Grounding authorities** *(founder directive 3)*
- [ ] Spine authorities are **CC0/CC-BY and locally mirrorable** (the measured, redistributable moat dataset is legally clean).
- [ ] **No non-commercial/proprietary source** (Know Your Meme, TVTropes, Urban Dictionary, BabelNet, Genius) is ingested/redistributed — **link-only / offline-reference only**.
- [ ] A **Wikidata QID** is attached as the canonical hub wherever anything resolves (the cross-platform join key).
- [ ] A coarse **IPTC Media Topic** is always assignable — never fully NIL at the coarse level.
- [ ] **NIL is a first-class, queryable status**; NIL mentions are retained and enter the folksonomy-promotion loop.

**Governance & eval**
- [ ] Schema is **semver'd**, **never-delete-only-deprecate**, with a public changelog.
- [ ] Grounding is evaluated with **TAC-KBP metrics** (candidate→rank→NIL→NIL-cluster), in-KB vs NIL reported separately; the scorecard is a **per-layer matrix**, never one blended number.
- [ ] Annotation guidelines carry a measured **IAA**; system scores above the human ceiling are flagged meaningless.

**This checklist is the contract.** A schema change is not "done" until it passes it; the SHACL shapes make most of it machine-checkable in CI.
