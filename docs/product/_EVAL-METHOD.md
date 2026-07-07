# The Evaluation Method — governing (Block 0.5)

> **This is the governing method for the engine.** Commonplace's entire moat is *published, measured grounding accuracy*, so the evaluation instrument **is the core product asset** — not a QA afterthought. This doc defines how it is built, in what order, and how it is reported. Nothing about the engine — prompt, ontology, model, ingestion path — is decided except *through* this instrument. Grounded in current (2026) prior art; sources inline. Companion to `SPEC.md` §13/§15.

## 0. The principle, and the mistake that motivated it

**Instrument before experiment. Reliability ≠ validity.** On 2026-07-07 a native-video-vs-keyframes ablation was run before any measurement instrument existed — ad-hoc ontology, exact-string matching, no ground truth — and its inter-run agreement number ("38%") was written into the spec as a design decision. That number is *uninterpretable*: two pipelines can agree on the same wrong answers, and exact-string+exact-type matching mechanically scores benign variation (`place` vs `restaurant`, `Kill Bill by SZA` vs `SZA — Kill Bill`) as total error. Agreement measures **consistency, not correctness**, and can never rank pipelines. The construct-validity literature names this exact failure (a 445-benchmark NeurIPS review, arXiv:2511.04703); Anthropic's engineering team showed its magnitude — fixing a rigid grader alone moved a measured score **42% → 95%**, i.e. grader artifacts dwarf true system differences. That ablation is retracted (see `spikes/pipeline/RESULT.md`); its only salvage is feasibility/plumbing (a cheap keyframes path exists; native has a reliability tail).

**The instrument = ontology + output schema + annotation guidelines + gold dev/test sets + a validated matcher + the metric stack.** It is built and validated *first*; the prompt is tuned on dev *only*; the test set is sealed and scored *once*; ablations (incl. native-vs-VTT) come *last*, through the validated instrument.

## 1. The sequence (each phase gates the next — no skipping forward)

```
0  Construct        define "an entity worth grounding" (1 page)                → construct.md
1  Ontology+Schema  ONE groundability-anchored type set + frozen JSON schema   → this doc §2 + schema
2  Guidelines       the codebook, written BEFORE any label (MATTER: Model→Annotate) → guidelines.md
3  Gold set         stratified sample → pilot+IAA → dev/TEST split, test SEALED → gold/{dev,test}
4  Matcher+Metric   validate the scorer against humans BEFORE trusting it      → this doc §3–4
5  Prompt iteration on DEV only, regression-gated (promptfoo)                  → prompts + eval CI
6  Freeze           lock instrument + prompt
7  Ablations        native-vs-VTT, model size, open-vs-frontier — on dev, paired-bootstrap CIs
8  Report           TEST opened ONCE: per-type P/R/F1 + NIL + calibration + CIs → the published page
```
This is the corpus-annotation lifecycle (Pustejovsky & Stubbs' MATTER/MAMA cycle) fused with entity-linking eval convention (GERBIL / ELEVANT / TAC-KBP). My error was running phase 7 with none of 0–6.

## 2. Phase 0–1: the construct + the ONE ontology (proposed v0 — the first real decision)

Today three inconsistent ontologies exist: `src/lib/types.ts` (10 types, only `media` is wired to ground), `prompts/observe_video.md` (a different, thoughtful 21-type taxonomy), and the retracted spike's ad-hoc set. They must collapse into **one**, and the organizing principle is **groundability**: the flagship metric scores entities that resolve to a *durable external ID*. Everything else (recipe steps, topics, moods, techniques) is useful **facet / structured-content** — kept in the schema, but **not** part of the grounding headline and scored separately (if at all).

**Proposed v0 groundable ontology** — each type pinned to a KB target + a Wikidata P31/P279 anchor so "is this a place-entity?" is *decidable, not vibes* (the ad-freiburg type-whitelist approach):

| type | grounds to | ID namespace | notes |
|---|---|---|---|
| `music_recording` | MusicBrainz | MBID (recording) | **built.** Use AcoustID/Chromaprint audio fingerprint when the song *is* the audio — never gold-label from a title string |
| `place` | Google Places | Place ID | **absorbs "restaurant"** as a facet/subtype — the `place`/`restaurant` split is exactly what broke the retracted matcher |
| `screen_work` | Wikidata | QID (P31: film/TV/series) | carries TMDB/IMDb/Letterboxd as link-outs (no TMDB API) |
| `book` | Wikidata / OpenLibrary | QID / ISBN | |
| `person` | Wikidata | QID | public figures / named creators only |
| `product` | Wikidata | QID | notable products only; **high legitimate-NIL rate** — that's fine, NIL is a valid gold answer |
| `brand_org` | Wikidata | QID | |
| `software_app` | Wikidata | QID | else NIL |
| `game` | Wikidata | QID | |

**NIL is two distinct gold labels** (per "Learn to Not Link"): `NIL-no-id` (a real entity the KB genuinely lacks — a *legitimate* gold answer, e.g. a TikTok "original sound") vs `non-entity` (an extraction error). Annotators record the *failed search queries* before assigning NIL. Non-grounded facets (`recipe`/structured-content, `topic`/`genre`/`affect`, `technique`, `trend`) stay in the schema under `facets`/`structured_content` and are out of the grounding metric.

**→ Founder decision (scope):** which groundable types are in the **v1 published benchmark**? **Recommendation: the 4 clean-ID, high-save-intent types first — `music_recording` (built), `place`, `screen_work`, `book`** — defer `product`/`brand_org`/`software_app`/`game` (messier grounding, higher NIL, more annotation cost) to v1.1. A tight, credible first benchmark beats a broad, noisy one. This is the real gap the retraction exposed: the moat is grounding, and **1 of ~8 types is wired today.**

**Schema:** freeze the output as a flat, enum-typed JSON Schema used with **Gemini `response_schema` constrained decoding** — but schema-validity is a **hard gate, not a metric** (2026 benchmarking: models pass schema checks 96%+ while *value* accuracy is 0.69–0.83; JSONSchemaBench arXiv:2501.10868). `observe_video.md` is valuable raw material for the *content* of the prompt, but the ontology is redesigned around groundability, not inherited.

## 3. Phase 3: the gold set (the single most important artifact)

- **Exhaustive, per-video, ID-level.** Gold unit = `(video_id, mention surface + aliases, type, external_ID or NIL-label)`. Annotate *every* in-scope entity per video. **Never** build gold from the union of system outputs (pooling bias inflates recall).
- **Stratified** on the axes that plausibly drive difficulty: VTT-present (53%) vs absent, slideshow (17%) vs video, duration terciles, and entity-type coverage. Oversample rare strata to ≥50 items, reweight for the overall figure.
- **Size by mentions, via CI width** (plan `n = z²p(1−p)/E²`, report with Wilson): at expected accuracy ~0.8, n=384→±4pp, n=500→±3.5pp, n=683→±3pp. Mentions cluster within videos, so **compute CIs with a per-video cluster bootstrap** (Miller, "Adding Error Bars to Evals", arXiv:2411.00640), and size for **mentions** (~3–5/video). Detecting a 3–5pt F1 ablation difference at ~80% power needs ~1,000+ mentions (Card et al. 2020, EMNLP power analysis).
- **Phased, founder-labor-aware:** **Pilot ~150 videos** first (estimates mention density + IAA, and *unblocks dev-set prompt iteration immediately*); scale the **sealed test to ~350** for the publishable claim. Split **eyes-off: dev ~100–150 (all tuning + ablations) / test ~350 (opened once)**.
- **Every gold ID verified against the authoritative API at label time** (MB lookup, Wikidata P31 check, Places Details — and store name+address+lat/lng because Place IDs go stale). **Record KB snapshot dates** (Wikidata dump, MB date, Places retrieval) per label so the benchmark is reproducible against a moving KB.
- **Seed a hard slice** deliberately (cover songs, chain restaurants, ambiguous film titles) — ambiguous-name seeding.

## 4. Phase 4: the metric stack (validate the scorer before trusting it)

**Extraction (mention-level), exact-string BANNED.** Adopt the MUC-5 / SemEval-2013 Task 9.1 family via **nervaluate** — categories COR/INC/PAR/MIS/SPU, schemes strict / exact / partial / type (partial = 0.5 credit: `P=(COR+0.5·PAR)/ACT`). For span-free video output: mention-match = unicode-normalized, casefolded, article/punct-stripped equality vs gold surface+aliases (the "exact" analog) + a fuzzy tier (rapidfuzz token-set) as "partial"; **Hungarian bipartite alignment** so each gold entity pairs with ≤1 prediction. Report **micro AND macro P/R/F1, per-type table, all four schemes**; **pre-designate strict (normalized mention + type) as the headline.**

**Grounding (ID-level), decomposed GERBIL/ELEVANT-style** — because extraction noise and grounding noise must not be confounded:
- **disambiguation accuracy given gold mention** (isolates the resolver),
- **end-to-end InKB micro/macro F1** (gold has an ID),
- **NIL as its own class:** NIL-precision = correct-NILs / predicted-NILs, NIL-recall = correct-NILs / gold-NILs, NIL-F1 (TAC-KBP penalizes never-say-NIL).
- **Asymmetric headline — Effective Reliability Φ_c:** +1 for a correct ID, **0 for NIL/abstain, −c for a wrong ID (c ≥ 10)** — this *is* "honesty over fluency" as a number: a confidently-wrong durable ID is far worse than an honest NIL. Pair with a **risk–coverage curve / AURC** and the product-facing figure: *coverage at ≤X% error at the shipped confidence threshold.*

**Calibration** (we publish confidence): **smECE + reliability diagram** (`relplot`; Błasiok & Nakkiran ICLR 2024 — plain binned ECE is bin-sensitive and gameable) + Brier score.

**Validate the matcher itself:** run it on ~100 human-judged match/non-match pairs and report *its* precision and recall (Hamel Husain's rule — raw agreement misleads under class imbalance). The matcher is part of the instrument.

**LLM-as-judge only for the residue** — paraphrase mention-equivalence deterministic matching can't settle (`"that pizza spot Joe's" ≡ "Joe's Pizza"`), **never for grounding correctness** (that's deterministic ID equality). Validate the judge: ~200 dual-labeled examples, require **Cohen's κ ≥ 0.6** (≥0.8 strong) vs human, held-out adversarial slice, periodic drift re-sampling.

## 5. Phase 3 detail: the solo-annotator protocol (bounding the bias, honestly)

A solo founder *can* build a credible benchmark if the biases are measured, not ignored:
1. **Pre-annotate with a *different model family* than the pipeline** (pipeline = Gemini/Qwen → pre-annotate with **Claude**) to avoid correlated errors and self-preference; import as *suggestions* into **Argilla** (HF-owned, free, HF-Spaces-deployable) or **Label Studio** (native video player).
2. **Human pass:** verify/correct every suggestion, add missed entities, and **confirm every ID by opening the actual MB/Wikidata/Maps record** — never accept an ID by name similarity.
3. **Anchoring-bias control:** annotate a random **15–20% blind from scratch** (no pre-labels); the recall gap vs the assisted pass *is* your measured pre-annotation bias (pre-annotation mainly suppresses recall).
4. **Test-retest:** ≥2 weeks later re-label **10–15%** with prior labels hidden → **intra-annotator Krippendorff's α (target ≥0.8, 0.667 floor)**.
5. **External seed:** have **1–2 people double-annotate 50–100 videos** → a *publishable* inter-annotator number.
- **IAA uses pairwise F1 for mentions** (Cohen's κ is undefined for span/set tasks without bounded negatives — Hripcsak & Rothschild 2005) and **Krippendorff's α for type/NIL/ID** decisions. **Never raw % agreement** (documented 33–41.2pp inflation over chance-corrected coefficients across all 21 LLM judges tested, arXiv:2606.19544). Publish the IAA — **system F1 above the human ceiling is meaningless.**

## 6. Phases 5–8: iterate, freeze, ablate, report

- **Prompt/ontology/schema iterate on DEV only,** wired into CI (**promptfoo**: `is-json` + JS assertions + model matrix; or **DeepEval** pytest-style gates). Consider **DSPy 3.x (MIPROv2/GEPA)** *after* dev plateaus and only with a train split carved from dev (never touching dev-eval). Stop when dev plateaus — high agreement under vague guidelines is just consistent wrongness.
- **Freeze** the whole instrument + prompt.
- **Ablations (this is where native-vs-VTT finally belongs):** one factor per arm, **same frozen instrument**, ground-truth metric, **3 runs each** for decoding variance (mean±sd), **paired bootstrap resampling (B=10,000, 95% CI on ΔF1, p<0.05** — Berg-Kirkpatrick 2012; Dror et al. 2018 "hitchhiker's guide"), **per-stratum breakouts** (VTT/no-VTT, slideshow). **Pre-register the headline metric and the minimum ΔF1 that would change the decision, before looking.**
- **Report on TEST once:** per-type P/R/F1, NIL-F1, Φ_c, calibration, all with clustered CIs — *that* is the published-accuracy artifact and the moat.

## 7. Tooling (2026-current)
Annotation: **Argilla** (primary) / Label Studio / Prodigy / doccano. Matching: **nervaluate**. EL metric conventions: **GERBIL / ELEVANT** (adopt definitions, not necessarily the harness). Calibration: **relplot** (smECE), netcal, TorchUncertainty (AURC). Eval/CI: **promptfoo / DeepEval**; **DSPy 3.x** for post-plateau optimization. Significance: `scipy.stats.bootstrap`. Constrained decoding: Gemini `response_schema`. Audio ID: AcoustID/Chromaprint.

## 8. What this changes in the plan
- New **Block 0.5 — Eval Foundation** precedes Block 1's engine wiring. Its deliverables: `construct.md`, this ontology frozen + JSON schema, `guidelines.md`, the pilot gold set + IAA, the validated matcher + metric harness (open-sourced — it's the moat artifact).
- Block 1 (`src/lib` wiring) proceeds in parallel where it doesn't depend on the ontology (capture, queue, storage), but the **grounding resolvers grow from 1 type to the v1-scope types** *against* this instrument.
- SPEC §15's "promptfoo slice" and "golden set re-stratified on the real corpus" are **subsumed and made rigorous** by this doc.

## Founder decisions this needs
1. **Ontology scope** for the v1 published benchmark — recommend the 4 clean types (music/place/screen_work/book), defer the messy 4. (§2)
2. **Annotation labor:** ~150-video pilot then ~350 test is ~30–40 hrs of founder time *or* recruit 1–2 people for the double-annotated seed (needed for a *publishable* IAA). Which?
3. Everything else (matcher, metrics, tooling, sequence) is settled by prior art above — no decision needed, just execution.
