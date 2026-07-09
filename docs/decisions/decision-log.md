# Decision log

ADR-style, append-only. Each entry: context → decision → why → status. Decisions marked **founder** were made by Salman; **controller** were made by the build orchestrator (Fable) under an already-locked founder principle, and were surfaced rather than hidden. Reversals get a new entry, never an edit.

Governing precedence when entries conflict with docs: `specs/` govern; this log records *why* they say what they say.

---

## Foundational (pre-build, ratified 2026-07-02 → 2026-07-07)

**DEC-001 · Wedge and scope (founder, 2026-07-02).** TikTok-first capture of saved content; Instagram/X follow. Open-core; career-artifact quality first, revenue optional.

**DEC-002 · Name: Commonplace (founder, G1 ✓).** "A commonplace book for the video age." Repo codename `attic` retired at the 2026-07-09 cleanup (repo renamed `commonplace`).

**DEC-003 · Instrument before experiment (founder correction, 2026-07-07).** The native-vs-VTT ablation was retracted: run before any valid instrument existed, its number was uninterpretable. Rule: nothing about the engine is decided except through a validated instrument (ontology → schema → guidelines → gold set → validated matcher → then experiments). Full method: `specs/evaluation-methodology.md`.

**DEC-004 · One ontology, groundability-anchored (founder-approved v3, 2026-07-07).** Four referent kinds (NamedEntity / Concept / Claim / StructuredContent) + 9 facets; NamedEntity types pinned to KB targets; provenance (evidence) required on every extraction; stress-tested against a 32-archetype media census. Doc: `specs/knowledge-ontology.md`.

**DEC-005 · The scorecard is a per-layer matrix, never one blended number (founder principle).** Different layers have different metrics, denominators, and meanings of "correct." Enforced in code by a test that fails if a blended score exists.

---

## Phase 1 — schema freeze + eval harness (2026-07-08)

**DEC-006 · Python for the eval harness, TypeScript for the product (controller).** The measurement ecosystem's proven libraries (rapidfuzz, scipy, relplot/smECE) are Python; hand-reimplementing statistics is how benchmarks go quietly wrong. The two sides meet at the frozen `schema/` files.

**DEC-007 · Schema versioning: semver with an rc lifecycle (controller).** `1.0.0-rc.N` while pre-freeze; 1.0.0 at the formal freeze (evaluation-methodology step 6). Never-delete-only-deprecate; every change in `schema/CHANGELOG.md`.

**DEC-008 · Matcher normalization rules (controller; two were plan-bug fixes found in review).** (a) Intra-word apostrophes removed ("Joe's" ≡ "Joes"); (b) leading-article stripping is English-only (`the/a/an` — "Die Hard" must not become "hard"); (c) punctuation normalization runs before article stripping. Foreign-article variants belong in gold aliases.

**DEC-009 · Deterministic matcher ties (controller, review-found).** Exact matches always outrank fuzzy-at-100 (cap 0.999); within equal-similarity ties, type-matching candidates win via a sub-tier epsilon. An instrument must be order-independent.

**DEC-010 · Φ_c penalizes grounding a non-entity at −c; extraction never credits traps (controller, under "honesty over fluency").** NON_ENTITY gold rows are the benchmark's adversarial traps; a durable ID confidently attached to "a good pizza place" is the exact failure the headline metric exists to expose. Abstention is always free; wrong IDs cost c=10.

**DEC-011 · NON_ENTITY records are created only when something proposed the surface as an entity, and are never deleted (controller, review-found ambiguity).** Keeps the mention set deterministic across annotators and keeps NON_ENTITY a scored gold label.

**DEC-012 · Add-one bootstrap p-value floor (controller, review-found).** `p = 2·min((1+k)/(B+1), …)` — the harness can never print p = 0. Every published point estimate carries per-video cluster-bootstrap CIs.

**DEC-013 · Structured Places verification on gold labels (controller).** Place IDs go stale; gold mentions carry `verification {name, address, lat, lng, url}` captured at label time.

**DEC-014 · InKB macro-F1 averages over the fixed 9 types (plan-mandated; flagged).** ⚠️ Caps the macro if v1 publishes only 4 types — **founder must confirm macro semantics before the accuracy page publishes.**

**DEC-015 · Claim-layer metrics deferred (controller).** Faithfulness/coverage need a validated LLM judge (κ ≥ 0.6 vs human); until then the scorecard row reads "in calibration" — no fake numbers.

---

## Phase 3 — MV3 wiring (2026-07-08 → 09)

**DEC-016 · esbuild, not WXT (controller).** Phase 3 needs "compile TS → MV3" with zero churn to the proven capture shell. WXT is the right tool at the multi-store phase — as its own decision then.

**DEC-017 · Both ingestion paths built; native escalation ships OFF (controller, per the DEC-003 retraction).** `keyframes_vtt` is the provisional default (~8× cheaper, no reliability tail); the Phase-4 ablation — run through the validated instrument — flips config, not code.

**DEC-018 · Local lane is VTT-only in v1 (controller).** Whisper-in-extension means shipping a ~40MB model; the managed lane covers no-subtitle items, and the instrument's has-VTT stratification will measure exactly what the gap costs before we spend on it.

**DEC-019 · Grounding disambiguation routes through the active lane (controller).** Local mode's promise is that nothing leaves the machine — a silent cloud call for candidate selection would break it structurally.

**DEC-020 · Facet assignments carry real model-emitted evidence — schema rc.6 (controller, overruling the plan).** The plan had the pipeline stamping synthetic evidence on facets; a provenance-first product must never manufacture receipts. The only pipeline-stamped field is `extractor_ref` (which records the pipeline itself).

**DEC-021 · Unavailable ≠ NIL (controller).** A mention whose resolver is off (Places without a key) gets *no* grounding and a `regroundPending` marker — never a fake "not found." NIL is a measured, published statistic; polluting it is lying to ourselves.

**DEC-022 · Security posture mechanized (controller, per spec §25).** Keys live only in `chrome.storage.local` (options page); `web_accessible_resources` removed; keys sent in headers never URLs; secrets files deleted; a build-time audit (`scripts/audit-dist.mjs`) fails the package if a key-shaped string or disallowed permission appears.

**DEC-023 · Store writes are single-transaction read-modify-writes (review-found Critical).** The classic IndexedDB lost-update race (get-then-put across separate transactions) was closed in `saveAnalysis`/`saveGroundings`/`putPoster`; regression test proves both concurrent writers survive.

**DEC-024 · Queue checkpoints before work; alarms revive after service-worker death (controller).** A job is persisted as in-flight *before* processing starts, so a Chrome kill loses nothing; proven by a 500-item kill-survival unit test (502 invocations / 500 done / 0 failed / none double-processed). Known cost (logged): a kill between analyze and ground re-runs the full item, re-spending analyze tokens on a rare path.

**DEC-025 · KB etiquette enforced at assembly (carry-forward from Task-5 review).** Every resolver call routes through a rate limiter — MusicBrainz 1 req/s (their hard rule), Wikidata/Places 200 ms — with identifying headers. The LLM lanes rely on queue backoff instead (BYO-key quota, not an IP-ban risk).

**DEC-026 · Schema namespace unified on `commonplace.app` as a pre-1.0 placeholder (controller).** ⚠️ **Founder decides the permanent domain at the 1.0.0 freeze** (commonplacehq.com vs usecommonplace.app) — schema `$id`s must never change after 1.0.0.

---

## Process (2026-07-09 cleanup)

**DEC-027 · Superpowers (subagent-driven development) retained for build execution (controller, founder-reviewed).** Evidence: across 15 task cycles it caught, pre-merge — a data-loss race (DEC-023), a nondeterministic grader (DEC-009), synthetic provenance (DEC-020), a version drift stamped into every export, and an ontology-fidelity gap. Complemented, not replaced: documentation now follows this repo's own IA (`docs/README.md`) and decisions land here — plans live in `docs/plans/` (not the tool-named folder).

**DEC-028 · Docs information architecture + naming convention (founder-directed).** `strategy / specs / research / decisions / plans / design / archive`; kebab-case descriptive names; dated research; archive-never-delete. Convention recorded in `docs/README.md` and in agent memory.

---

## Open founder decisions (blocking or pre-publish)

| ID | Decision needed | Blocks |
|---|---|---|
| G2 | Design direction pick (Paper & Proof leading) | Phase 5 (the library UI) — critical path |
| — | Google Places API key | Place grounding + the restaurant demo beat |
| — | Chrome Web Store dev account ($5) + submit click | Phase 3 Task 9's actual submission |
| DEC-026 | Permanent schema domain | The 1.0.0 schema freeze |
| DEC-014 | Published-benchmark type scope + macro semantics | The accuracy page (Phase 7) |
| G3 | Pricing sign-off (recommended: defer until after launch) | Phase 10 only |
