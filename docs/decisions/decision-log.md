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

## First-iteration re-cut (2026-07-21)

**DEC-029 · Milestone 1 re-cut: MCP + minimal inspection UI before the full library; import lanes become a first-class front door (founder, 2026-07-21).** Order: capture control plane (ratified same day) → import lanes (IG ZIP importer + TikTok DYD onboarding/reconciliation) → pilot gold set + tuning → MCP server with shipped prompts + plain inspection UI → public artifacts (open-core carve + accuracy page) → full Paper & Proof library (G2 unchanged as a gate, no longer on the demo's critical path). Rationale + full order: `docs/strategy/2026-07-21-first-iteration-decision.md`. Founder's stated driver: an agent project he can demo and write about, and a pipeline not gated on the live extension.

**DEC-030 · Publishing: hybrid build-in-public (founder, 2026-07-21).** Safe posts start now (framing essay, receipts/NIL, eval methodology); capture forensics (fake-done, trusted scroll, throttle behavior) are embargoed until after launch — best story we have, also the playbook.

**DEC-031 · Agencies: discovery calls only, zero code, zero gating (founder, 2026-07-21).** Founder is arranging calls with agency operators he knows; question kit in the decision doc §5. Nothing in the build accommodates agencies until someone tries to pay. Reaffirms the 2026-07-02 tertiary/deferred posture.

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

---

## Operating system + first-iteration re-cut (2026-07-26)

**DEC-032 · Spec-driven development via OpenSpec (founder-directed).** Adopted `@fission-ai/openspec` (v1.6.0) as the execution system. `openspec init . --tools claude` generated 6 Claude Code skills + 6 `/opsx:*` slash commands. Roadmap = 10 tracked changes under `openspec/changes/` (capture-control-plane, zip-import-and-upload, enrichment-lane, content-search, pilot-gold-set, engine-tuning, mcp-server, accuracy-page-and-open-core, library-ui, launch). Locked context lives in `openspec/config.yaml` (inherited by every proposal). Progress surface = `openspec list` / `openspec view` — no more plan pile. Per-change loop: `/opsx:propose` → `/opsx:apply` → `/opsx:verify` → `/opsx:archive`. The single narrative doc is `docs/strategy/2026-07-26-release-plan.md`.

**DEC-033 · OpenSpec dashboard (ToruAI/openspec-ui, MIT) as mission control.** `tools/openspec-ui/run.sh` (self-downloading v0.2.0 binary, gitignored) serves a read-only kanban + specs browser at `localhost:4599`, watching `openspec/`. Optional; the terminal equivalent is `openspec view`.

**DEC-034 · Enrichment providers locked (founder, 2026-07-26): tikwm PRIMARY, Apify BACKUP.** Cheaper default, redundancy, and a lower customer price. Free path stays oEmbed + own-session (through the control plane). Detail folded into `openspec/config.yaml` and `docs/archive/superseded/2026-07-22-zip-and-enrichment.md`.

**DEC-035 · Doc consolidation.** The interim strategy/decision docs (2026-07-21 first-iteration, 2026-07-22 interface backtest, 2026-07-22 zip+enrichment) moved to `docs/archive/superseded/`; their decisions now live in `openspec/config.yaml` + the release plan + this log. `docs/strategy/roadmap.md` is a redirect. `session-handoff.md` top points at the release plan + OpenSpec. The 2026-07-13 framing investigation stays in `docs/research/` as the "why."

---

## Engine economics + business model (2026-07-27)

**DEC-036 · Flex service tier for production analysis; standard for testing (founder, 2026-07-27).** Gemini Flex is 50% off (identical to Batch) but **synchronous** with a 1–15 min target, versus Batch's async 24h job/polling. Flex is "sheddable" (503s under load) — already handled by the resumable job queue's retry/backoff/checkpointing. One parameter (`service_tier: "flex"`). Benchmarks and experiments run at **standard** for clean comparison.

**DEC-037 · Moving away from pure open-source; MCP becomes part of the managed/SaaS offering (founder, 2026-07-27).** The MCP server is no longer planned as an open-source npm package — it is a paid/managed product surface. **SCOPE RESOLVED (founder, 2026-07-27): the engine, schema, and eval harness STAY OPEN** (the credibility + career artifacts, and what keeps "leave anytime" honest); only MCP closes. `accuracy-page-and-open-core` survives intact. This affects `accuracy-page-and-open-core`, the mcp-server change (npm-first distribution was written on the open-source assumption), SPEC v5's "Open where it counts" commitment, DEC-001, and the career-artifact story.

**DEC-038 · Model choice is an open bake-off, not an assumption (founder, 2026-07-27).** gemini-3.6-flash at ~$73/5,000-item library (flex) is ~2× the planned $39 Deep Scan price. gemini-3.5-flash-lite is ~3.7× cheaper (~$20/5k at flex) and natively multimodal. Public benchmarks (Video-MME-v2) shortlist but cannot decide — they are multiple-choice QA on general/long-form video and structurally cannot measure honest abstention, our core bar. Decision comes from a bake-off on the real corpus, scored against the gold set. Analysis: `docs/research/2026-07-27-extractor-architecture-and-unit-economics.md` §5–6.

**DEC-039 · Experiment design: eliminate → pair → screen → optimize (2026-07-27).** Full factorial over models × resolution × ingestion × architecture × prompt × thinking = 1,728 configs ≈ 104k calls — not viable. Design: (1) eliminate 4 dimensions by reasoning/prior evidence for $0 (service tier is cost-only not a quality variable; 3.5-flash already dominated; keyframes obsolete on the managed lane; Qwen3-Omni unavailable on DeepInfra so open-weight can only be a split's perception stage); (2) PAIR all arms on identical videos (kills the dominant variance term); (3) OFAT screening from the shipped baseline on ~20 videos, Holm-corrected, survivors only; (4) small factorial on the 60-item gold set, with two pre-declared interactions (resolution × content-type, model-size × prompt-verbosity). Primary metrics pre-registered: Φ_c + strict mention F1; practical-significance ≥3pt F1 / ≥0.05 Φ_c; everything else descriptive. Per-stratum analysis yields ROUTING RULES, more valuable than a global winner. ~500 calls, ~$25–35 of the $50 ceiling. Design: `docs/research/2026-07-27-experiment-design.md`.

**DEC-040 · Keys + budget provisioned (founder, 2026-07-27).** Anthropic (Claude pre-annotation — methodology §5.1 different-family requirement), DeepInfra (open-weight arm), $50 experiment ceiling. All in gitignored `.env.local`; verified live. Note: DeepInfra serves Qwen3-VL 30B/235B but NOT Qwen3-Omni — Qwen3-VL is deaf, so the open-weight path requires separate ASR and is only testable inside the perception/extraction split.

**DEC-041 · Open-weight arm corrected: Fireworks, not DeepInfra (founder, 2026-07-27).** DEC-039 pruned Qwen3-Omni on DeepInfra's catalog (deaf Qwen3-VL only). **Fireworks serves `qwen3-omni-30b-a3b-instruct` (video+audio+text in one request)** — so open-weight IS a legitimate one-shot arm, not merely a perception stage. Operational reality, verified: video/audio models are **not serverless** (our key lists 6 serverless models, none Omni) and need a **dedicated deployment at $7/GPU-hour (H100)** — so its unit economics are throughput-dependent and must be MEASURED (≈$97/5k single-stream vs ≈$12/5k well-batched, straddling flash-lite's $36). Payload <10MB base64 and ≤~60s video force compression, which is a CONFOUND — controlled by running flash-lite on the identical compressed videos as a paired control. Placed in Phase 2. Fireworks key provisioned (gitignored, verified).

**DEC-042 · Twelve Labs: quality-ceiling reference arm, not the pipeline (2026-07-27).** Assessed live (`docs/research/2026-07-27-twelve-labs-assessment.md`). **Cost rules out adoption:** Pegasus Analyze is $0.0292/min ⇒ **~$158 per 5k library** (4.4× flash-lite standard, 8.8× flex); with Marengo search it is ~$385 one-time + ~$8/mo recurring — 4–10× a $39 product. **But three of their choices validate ours and one is a gap:** (a) Marengo's "index once, query many" is independent external validation of the perception/extraction split we proposed on cost grounds; (b) video-native-over-frame-sampling confirms extractor-v2's native default; (c) timestamped JSON as native output confirms the rc.7 MM:SS decision; (d) GAP — they treat video segmentation (speaker change / brand appearance / scene cut → timestamped JSON) as a first-class primitive and we have no equivalent (low priority at 42s median, matters for long-form). **Action:** run Pegasus 1.5 as a $0 reference arm in Phase 2 on the free tier (600 cumulative min; our 60-item set ≈65 min). First live datapoint: on the Chicago steakhouse video flash-lite found 8 venues vs Pegasus's 6 unique — encouraging but n=1. Do NOT adopt Marengo search: local content-search already does 4,661 items in 80ms for $0.
