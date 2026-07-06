# Document 04 — Engine: Analysis Architecture & Eval/Quality

## A Technical Design Document (Google design-doc body · IETF-RFC review stance · Nygard ADRs for load-bearing decisions)

> **Requirements-language conventions.** The key words **MUST**, **MUST NOT**, **SHOULD**, **SHOULD NOT**, and **MAY** are used as defined in RFC 2119: MUST is a hard obligation, SHOULD is a strong default that may be overridden with a stated reason, MAY is a genuine option. §4 (requirements) and §7 (ADRs) use them deliberately so a reader can tell what is required from what is merely preferred.

---

### 1. The engine is built; its proof regime is not — and that gap is the whole design

- **Title:** The Attic Content-Understanding Engine — Analysis Architecture, and the Eval Regime that Makes Grounding a *Measured* Promise
- **Author:** Founder/eng (solo), ~10–20 hrs/wk
- **Status:** **Proposed** (RFC — open for review). The capture spike and the `src/lib` enrichment core (54 Vitest tests, strict TypeScript) are **Accepted-and-built**. The grounding stage, the six-axis eval harness, and the model-routing fallback are **Proposed**. Each ADR in §7 carries its own status.
- **Reviewers / sign-off surfaces:** the sibling dossier docs — Product Strategy (**01**), PRD (**02**), Competitive Analysis (**03**), Business Model & Pricing (**05**), GTM (**06**) — and the two sibling engine techdesigns this one depends on: **Capture** (page-context interception, eager media capture) and **Taxonomy/Ontology** (the controlled-core-plus-open-tag vocabulary). This document owns *analysis, grounding, and eval*. It consumes capture and taxonomy; it feeds cost into 05 and positioning into 03.

**Thesis (agree or disagree with this one sentence).** The defensible core of this product is not the pipeline that reads a video. Reading a video is now a metered API call any competent solo dev can wire up in a weekend. The core is the **eval regime** — the harness that proves, on a public scorecard, that a saved TikTok resolves to the right external ID (a Google Place ID, a TMDB movie id — *The Movie Database* — a MusicBrainz recording id, i.e. an MBID) more reliably than the user's default of "just search again." Grounding-to-external-ID is therefore both the flagship engineered artifact and the flagship measured number. Every decision below is subordinated to making that one number honest, reproducible, and best-in-class.

---

### 2. Reading a video has commoditized; only proving the read is uncontested ground

**The pipeline, stated as fact.** The engine ingests items the user already saved on TikTok and Instagram (X, Reddit, YouTube later). Capture is passive: it intercepts the platform's own signed responses (see the Capture techdesign). Media and posters are grabbed *eagerly at capture time*, because the signed URLs expire within hours. Each item arrives as a normalized `CapturedItem` — a shape already built and tested (`src/lib/types.ts`): id, `desc` (caption), `hashtags`, `music`, `subtitleUrl`, `playUrl`, `isSlideshow`, `stats`. The engine turns that raw item into an `EnrichedItem` carrying a transcript, on-screen text, a typed and deduplicated entity list, facets, and takeaways — and then takes the step the built code does *not yet* take: it resolves each entity to a durable external identifier.

**Why eval-first, not model-first.** Doc 03 is decisive here. On the consumer side, auto-tagging, OCR, transcript search, and light entity extraction have commoditized in public. Stasht ships our literal v1 feature list for free; a dozen apps (Sorti, Sprink, Albo, ReelRecall, ARCHV) converge on identical language. On the business side, Twelve Labs (on AWS Bedrock, NVIDIA-backed), Mixpeek, dig.ai, and VidContext all do grounded video understanding — but all closed, none publishing an eval. The JTBD analysis (Jobs-To-Be-Done) sharpens the *why*: the value lives entirely in **Job B**, resolving a saved item into a real-world action *at the decision moment*. Grounding "is not a feature, it is the anxiety-and-habit reducer" that lets a user trust an answer enough to skip re-searching Google. Everything upstream of grounding is table stakes. Grounding-with-proof is the only uncontested ground.

**System-context diagram.**

```
                         ┌──────────────────────────────────────────────┐
   PLATFORMS             │                 ATTIC ENGINE                   │        EXTERNAL AUTHORITIES
 (adversarial supplier)  │                                                │        (grounding targets)
 TikTok / IG / X / …     │  ┌────────┐  scene   ┌───────────┐            │        Google Places (IDs free)
        │  signed resp.  │  │ INGEST │─detect──▶│ TRANSCRIBE │            │        TMDB (free) / Trakt
        ▼                │  │Captured│  ffmpeg  │ subtitle▶  │            │        MusicBrainz (free, durable)
  ┌────────────┐  passive│  │  Item  │  PyScene │ WhisperX   │            │        Open Library / Google Books
  │  CAPTURE   │─────────┼─▶└────────┘          └─────┬─────┘            │              ▲
  │ (sibling   │  eager  │       │                    │                  │              │ candidate-gen
  │ techdesign)│ poster/ │       ▼                    ▼                  │  ┌───────────┴──────────┐
  └────────────┘ media   │  ┌──────────────────────────────────┐        │  │  GROUNDING /         │
                         │  │ ONE VLM+OCR PASS  (schema-driven) │────────┼─▶│  ENTITY RESOLUTION   │
                         │  │ Gemini Flash-Lite | Qwen3-VL(OSS) │        │  │ cand→rerank→conf→NIL │
                         │  └───────────────┬──────────────────┘        │  └───────────┬──────────┘
                         │                  ▼                            │              │ external IDs
                         │  ┌──────────────────────────────────┐        │              ▼
                         │  │ STRUCTURED SYNTHESIS (responseSchema)│      │   ┌────────────────────┐
                         │  └───────────────┬──────────────────┘        │   │ AGENTIC VERIFY     │
                         │                  ▼                            │   │ (Supervisor/Workers│
                         │  ┌──────────────────────────────────┐  low   │   │  confidence escal.)│
                         │  │  ENRICHED + GROUNDED ITEM         │◀─conf──┼───┤                    │
                         │  └───────────────┬──────────────────┘        │   └────────────────────┘
                         │                  ▼                            │
                         │   local-first store · open schema · exporters │
                         └──────────────────┬───────────────────────────┘
                                            ▼
                      SIX-AXIS EVAL HARNESS  ◀── version-locked golden set
                      (retrieval · WER · OCR-F1 · faithfulness · classification · GROUNDING P/R/F1)
                                            │
                                            ▼
                     CONSUMER app (v1)   ·   AGENCY API/MCP (same engine, deeper config)  [docs 02/05/06]
```

The engine is one core. The two product depths (doc 01's locked decision) are **pipeline *configurations*** over it, not two codebases: the consumer profile runs shallow and cheap; the agency profile runs deep and high-volume. This is the Dublin-Core "application profile" idea — one stable core, many profiles — applied at the pipeline level. It is *why* the eval regime must be shared: a single scorecard governs both.

---

### 3. Grounding-with-proof is the wedge; everything upstream is table stakes

**Goals.**

1. Ship a multi-stage grounded pipeline from `CapturedItem` to grounded `EnrichedItem` at ≤ ~$0.002/clip (visual, non-batch), reusing the built `enrich.ts` tier logic.
2. Make grounding-to-external-ID a first-class, measured output: every resolvable entity carries an authority, an ID, and a confidence — or an explicit NIL.
3. Stand up the six-axis eval scorecard against a version-locked golden set, with an LLM judge validated against human labels, and **publish it** (open-core). The published scorecard is at once the consumer trust artifact (03), the agency sales artifact (03/06), and the career/portfolio artifact (01).
4. Route models so the hosted default (Gemini 2.5 Flash-Lite) is substitutable by open-source (Qwen3-VL/Gemma3; whisper.cpp/WhisperX) — capping supplier power (Porter, doc 03) and keeping infra under ~$50/mo.
5. Adopt Twelve Labs' *methods* without competing on their *axis* (doc 03: do **not** position "cheaper than Twelve Labs"): schema-driven segmentation (their Pegasus model — schema-conditioned video-to-text), entity-focused embeddings (their Marengo model — multimodal embeddings), claim-level faithfulness eval, and agentic verification (their Jockey framework — an agentic video-agent loop).

**Non-goals (deliberate).**

- **Beating public video benchmarks.** Public sets leak shortcuts, so a leaderboard score would not measure our job. Our golden set is private, version-locked, and stratified to our corpus.
- **A social/discovery feed** (doc 03 Blue-Ocean "Eliminate") — an engagement arms race a solo founder cannot win, and one that dilutes trust.
- **Platform breadth in v1** (doc 03 "Reduce"): TikTok+Instagram done demonstrably deeper beats fourteen platforms done shallow.
- **Real-time analysis.** Backfill is a human-paced, resumable, batch job. Latency budget is hours, not seconds. Backfill therefore MUST use the Batch API (−50%).
- **Owning the "verification" surface for restaurants** (JTBD): we complete the journey to Maps; we do not replace it. Grounding is the bridge, not the destination.
- **Novel RAG plumbing** (doc 03: Mixpeek already proves grounded-pipeline-with-citations is not novel at the infrastructure layer). Our novelty is ontology, eval, and domain grounding — not the retriever.

---

### 4. The design serves one journey: resolve a save to action at the decision moment

**Critical User Journey (CUJ).** *"Weeks ago I saved a ramen place, a recipe, a film. I'm now in the struggling moment — hungry near that neighborhood, deciding dinner, choosing what to watch. I open Attic. In seconds it hands me the resolved, verified, tappable answer — a Maps pin, an ingredient list, a Letterboxd/TMDB page — faster and more trustworthy than re-searching."* (JTBD Job B; the 5–10-user retrieval test in the users-validation memo is the *gate* on the heavy build.)

**Functional requirements.**

- **F1.** For every item, the engine MUST produce a transcript, on-screen text (OCR), a typed entity list, facets, and takeaways. It SHOULD prefer platform subtitles over WhisperX to save cost (built: `mediaFetch.parseVtt`). It MAY fall back to whisper.cpp when subtitles are absent and hosted transcription is unavailable.
- **F2 (grounding, flagship).** For each entity of a groundable type, the engine MUST run candidate-generation → rerank → confidence → NIL against that type's authority, and MUST emit either `{authority, externalId, confidence, evidence}` or an explicit `NIL`. It MUST NOT emit a grounded ID whose calibrated confidence is below the type's threshold.
- **F3 (referent separation).** The engine MUST model the *referent* (the grounded Work) as a first-class node, distinct from the *post* (Manifestation) and the *save* (Item), so fifty saves of one restaurant collapse to one grounded Place (ADR-6). This is FRBR/WEMI — *Functional Requirements for Bibliographic Records* and its Work / Expression / Manifestation / Item layering, the library-science model that separates an abstract creation from the copy in hand.
- **F4 (confidence escalation).** Items or entities below their confidence threshold SHOULD escalate to an agentic verification pass; items at or above threshold MUST short-circuit (no verification spend).
- **F5 (open export).** The engine MUST support open export of understood data (built: `exporters/{json,obsidian,csv}`). Export SHOULD be lossless against the open schema. Portability-as-default is the consumer trust move and the Segment-1 upsell (03/05).
- **F6 (eval harness).** The harness MUST run all six axes against the golden set on every engine or taxonomy release, and MUST block publication of any number that fails the admissibility gates in §5.6.

**Non-functional requirements.**

- **NF1 (cost).** Visual-tier analysis MUST cost ≤ ~$0.002/clip non-batch. Backfill MUST use the Batch API (−50%), targeting ≤ ~$0.001/clip. A full 20k backfill MUST stay ≤ ~$40 (non-batch upper bound) and SHOULD land near ~$15 tiered (§5.5). Ongoing incremental analysis (new saves only) MUST be a small fraction of that.
- **NF2 (trust / local-first).** No remote code MUST execute in the extension. The store MUST be local-first. Understood data MUST export cleanly. Hosted inference MAY be called for analysis, but an on-device OSS configuration MUST remain supported as the escape hatch (ADR-3).
- **NF3 (determinism where it matters).** Grounding resolution and entity-keying MUST be deterministic and reproducible (built: `normalizeName`/`entityKey`). LLM stages MUST be constrained (temperature 0.2, JSON response mode, ontology-validated coercion — built in `geminiClient.coerceEntities`).
- **NF4 (substitutability).** Any single model provider MUST be swappable without changing orchestration, via the `ModelAdapter` boundary (ADR-3, §5.3).
- **NF5 (golden-set survivability).** Taxonomy evolution MUST NOT silently invalidate labels. The taxonomy MUST use never-delete plus replacement associations, with a True-Path roll-up check (taxonomy techdesign).

---

### 5. One constrained pass, then a measured grounding stage — trade-offs first

I am **not** re-deriving the pipeline; I commit to it and specify the seams. **Stages:** scene-detect (ffmpeg / PySceneDetect) → transcript (prefer platform subtitle; else WhisperX/whisper.cpp) → **one** VLM+OCR pass (Gemini Flash-Lite default; Qwen3-VL / dots.ocr OSS) → structured synthesis via `responseSchema` → **deterministic entity grounding** → **agentic verification with confidence escalation**. Embeddings are computed once and reused, so retrieval is marginal-free after the first pass.

**The single most important trade-off: one VLM pass, not many.** The MPEG-7 cautionary tale governs here: an expressive vocabulary with weak constraints is worse than a modest one with strong constraints. Two runs describe the same clip differently, inter-run agreement collapses, and Cohen's κ (kappa — chance-corrected agreement) craters, destroying the golden set's value. So we pay for every degree of freedom with a constraint: one schema-conditioned pass emitting timestamped JSON (the Pegasus method), against a *closed* entity enumeration. The built engine already does the constrained version — `coerceEntities` hard-rejects any type not in the ontology, temperature is 0.2, JSON response mode is on. We extend it; we do not reinvent it.

**Where the built code is, and the one gap this doc closes.** `enrich.ts` already implements a three-tier escalation: `raw` → `text` (caption + subtitle only, near-free) → `visual` (VLM+OCR). That *is* the confidence/cost ladder in miniature, and it is the right shape — cheap first, escalate only when needed. `entities.ts` already produces a deterministic `entityKey = ${type}:${normalizedName}` and a cross-item `EntityIndex`. The gap: that key is proto-grounding — a normalized string, not a durable external ID. This document's central new work is promoting `entityKey` into a resolved external identity via the grounding stage (F2/F3) and measuring it (axis 6).

#### 5.1 Data model

Extend the built `Entity`/`Enrichment`; do not replace them, because the 54 tests are an asset.

```
GroundedEntity extends Entity {           // Entity = {type, name, raw, specs?} today
  referentId: string;                     // stable internal id for the WEMI "Work" / referent
  grounding: {
    authority: "google_places" | "tmdb" | "musicbrainz" | "open_library" | "trakt" | null;
    externalId: string | null;            // Place ID / TMDB id / MBID / OLID …
    confidence: number;                    // 0–1, calibrated
    status: "resolved" | "nil" | "ambiguous";
    evidence: { frameTs?: number; transcriptSpan?: [number, number]; candidateSet: string[] };
  };
}
Referent { referentId; type; canonicalName; authority; externalId; itemIds[]; }   // FRBR Work
```

Three model choices, each traced to prior art:

1. **Referent is first-class, separate from post and save** (FRBR/WEMI). Collapsing "the TikTok" and "the restaurant it depicts" is what makes competitors' dedupe and grounding brittle. A separate referent node is what lets fifty saves collapse to one Place, and it lets the golden set annotate *the referent* (axis 6) independently of *the post* (axis 5). (ADR-6.)
2. **Stable ID, mutable label** (from IAB's content-taxonomy discipline). The referent's identity is its external ID; the display name is presentation. Renaming never invalidates stored labels or golden-set annotations.
3. **`evidence` is mandatory, not optional.** This is doc 03's Blue-Ocean "Raise" axis: nobody in the consumer field shows their work. Every resolution carries the frame timestamp and transcript span it came from, so the UI can say *"resolved to Place ID X — here's the frame and the line; correct me if wrong."* Traceability is the consumer-facing expression of axis 6 and the agency-facing faithfulness guarantee.

#### 5.2 The grounding stage (flagship): candidate-gen → rerank → confidence → NIL

This is the standard entity-linking pipeline, and I adopt the GERBIL/ELEVANT evaluation idioms (the two standard entity-linking benchmark frameworks) so our numbers are comparable to the literature. Per entity type, the resolver routes to that type's authority, generates candidates, reranks them (lexical similarity + embedding similarity + type/facet priors + geo-proximity for places), assigns a calibrated confidence, and emits **NIL** when no candidate clears threshold. NIL is a first-class outcome, not an error: "the saved place has no clean match" is a *correct* answer the eval must reward.

**Authority choice is an engineering-taste moat** (doc 03 advantage #4). Prefer durable, open IDs: MusicBrainz MBID over Spotify id (MusicBrainz is free and open, so it survives); TMDB (free) for film/TV with Trakt as a backstop (Letterboxd and IMDb have no free API); Google Places (its IDs-only tier is free); Open Library / Google Books (free). This is invisible to a fast follower and hard to copy quickly.

**Why grounding is the flagship metric, not, say, transcription WER.** Three reasons converge. (a) JTBD: grounding is the payoff surface of Job B; WER (word error rate) is a means, grounding is the end. (b) Competitive: it is the one axis where doc 03 says we can be measurably, defensibly best, because incumbents assert it and never prove it. (c) Sales: for the agency tier, measurable faithfulness is the sales artifact that converts skeptical buyers. So the north-star quality number is **end-to-end grounding entity-linking F1**, with disambiguation accuracy and NIL accuracy alongside it. Every other axis is instrumental to it.

#### 5.3 Interface contracts (the substitutability claim, designed rather than asserted)

"Swappable without touching orchestration" (NF4, ADR-3) and "authority adapters" (ADR-2) are load-bearing claims. They require contracts, given here.

**Result and error types.** Adapters never throw on expected failures; they return a discriminated union:

```
type Result<T, E> = { ok: true; value: T } | { ok: false; error: E };
type AdapterOpts  = { timeoutMs: number; maxRetries: number; locale?: string };
```

**Model adapter (ADR-3).** Orchestration depends only on this interface. Swapping Gemini for Qwen3-VL, or WhisperX for whisper.cpp, MUST NOT change any caller.

```
interface VisionModelAdapter {
  readonly id: string;                    // "gemini-2.5-flash-lite" | "qwen3-vl" | ...
  readonly caps: { batch: boolean; maxImages: number; jsonMode: boolean };
  analyze(
    input: { frames: FrameRef[]; text: { caption?; subtitleVtt?; hashtags? }; schema: JSONSchema },
    opts:  AdapterOpts & { temperature: number; batch: boolean }
  ): Promise<Result<AnalysisJSON, ModelError>>;
}
interface TranscriptModelAdapter {
  readonly id: string;
  transcribe(input: { audioRef: MediaRef; lang?: string }, opts: AdapterOpts)
    : Promise<Result<Transcript, ModelError>>;
}
type ModelError =
  | { kind: "timeout" }
  | { kind: "rate_limited"; retryAfterMs?: number }
  | { kind: "safety_block" }               // refusal / content block
  | { kind: "malformed_output" }           // schema-invalid after coercion
  | { kind: "provider_down" };
```

*Error / timeout / retry semantics (normative).* Default `timeoutMs` = 30 000, `maxRetries` = 2. The caller MUST retry `rate_limited` (honoring `retryAfterMs`) and `provider_down` with exponential backoff plus jitter, up to `maxRetries`. It MUST NOT retry `safety_block`. It SHOULD retry `malformed_output` exactly once with a repair prompt, then surface it. On terminal failure the item is left at its last successful tier and re-queued (backfill is resumable).

**Authority adapter (ADR-2).** One interface, five implementations. The reranker/resolver depends only on this; adding or swapping an authority MUST NOT touch orchestration.

```
interface AuthorityAdapter {
  readonly authority: "google_places" | "tmdb" | "musicbrainz" | "open_library" | "trakt";
  readonly groundableTypes: EntityType[];
  search(q: GroundingQuery, opts: AdapterOpts): Promise<Result<Candidate[], AuthorityError>>;
  fetch(externalId: string, opts: AdapterOpts): Promise<Result<AuthorityRecord, AuthorityError>>;
}
type GroundingQuery = { name: string; facets?: Record<string,string>;
                        geo?: { lat; lng; radiusM? }; locale?: string };
type Candidate      = { externalId: string; displayName: string; score: number; raw: unknown };
type AuthorityError = { kind: "timeout" | "rate_limited" | "unavailable" | "bad_request";
                        retryAfterMs?: number };
```

*Shared NIL/error contract (normative).* Default `timeoutMs` = 5 000, `maxRetries` = 2 (backoff + jitter). **Zero candidates MUST return `Ok([])`, never an error** — an empty candidate set is the legitimate driver of NIL. Transport failures, 5xx, and quota exhaustion MUST return `Err`, and the resolver MUST treat `Err` as *unknown/unavailable* → `status: "nil"` with `reason: "authority_unavailable"`, **never** as a confident negative. A candidate becomes a resolution only when calibrated confidence ≥ τ_type; if two or more candidates sit within Δ of each other and of τ, status is `"ambiguous"`.

| Authority | Groundable types | ID emitted | Rate/quota | `Ok([])` → | `Err` → | NIL / ambiguity rule |
|---|---|---|---|---|---|---|
| `google_places` | restaurant, bar, cafe, place | Place ID | free IDs tier; QPS-limited | empty (drives NIL) | `authority_unavailable` | NIL if no candidate within geo radius clears τ_place; ambiguous if ≥2 within Δ |
| `tmdb` | film, tv, person | TMDB id | free, key-gated | empty | `authority_unavailable` | NIL if no title+year match; then query `trakt` |
| `musicbrainz` | track, release, artist | MBID | free, ~1 req/s | empty | `authority_unavailable` (honor 503 + Retry-After) | NIL if no recording/release clears τ; MBID preferred over Spotify id |
| `open_library` | book | OLID (+ ISBN) | free | empty | `authority_unavailable` | NIL if no work/edition match; Google Books is the fallback |
| `trakt` | film, tv (fallback) | Trakt / IMDb id | free, key-gated | empty | `authority_unavailable` | queried **only** when `tmdb` returned NIL or ambiguous |

#### 5.4 Structured synthesis (Pegasus method)

The synthesis stage emits schema-conditioned, timestamped JSON — Twelve Labs' Pegasus pattern of "define segment types and fields, get timestamped JSON back." The built `responseMimeType: "application/json"` plus ontology validation is the v0. The schema is the *consumer profile* of the shared ontology; the agency profile extends it with vertical facets without forking the core (Dublin-Core application profiles). The VLM also emits free **open tags** — the folksonomy layer — which are stored, searchable, and un-governed. They capture "girl dinner" the day it trends, and are later promoted into the controlled core by *warrant* (corpus frequency + search demand + structural fit). This is how the open-core ontology visibly, defensibly grows.

#### 5.5 Agentic verification (Jockey method)

Low-confidence entities and items escalate to a Supervisor/Planner/Workers loop (Twelve Labs' Jockey pattern). The Supervisor picks which workers to run — re-OCR a specific frame, re-query the authority with a relaxed candidate set, cross-check transcript against on-screen text — and confidence is re-scored. The escalation gate is a cost lever, not a quality nicety: the built ladder already embodies "cheap first, escalate only when needed," and verification is the top rung. Budget: escalate roughly 10–20% of items (sensitivity analysis in ADR-4).

#### 5.6 Cost model at 5k / 10k / 20k (feeds doc 05)

Assumptions are stated per-row in the footnotes so a reviewer can reconcile every figure. Two regimes are shown: a **full visual pass** (every item, upper bound on the analysis regime) and the **tiered/realistic** ladder the built `enrich.ts` makes the default.

| Corpus | Full visual pass, batch [a] | Tiered/realistic, batch [b] | Non-batch upper bound [c] |
|---|---|---|---|
| **5k** | ~$5 | **~$3.7** | ~$10 |
| **10k** | ~$10 | **~$7.3** | ~$20 |
| **20k** | ~$20 | **~$14.6** | ~$40 |

> **[a] Full visual pass (batch).** Model: Gemini 2.5 Flash-Lite, Batch API (−50%). Assumed list price **$0.10 / 1M input tokens, $0.40 / 1M output tokens, as of 2026-07-02** — re-verify before hardcoding (ADR-3). Per-clip token assumption: ~16 sampled keyframes × ~600 image tokens ≈ 9.6k image tokens, plus ~1.5k text context = ~11k input; ~1.5k structured-JSON output. Non-batch = (0.011 × $0.10) + (0.0015 × $0.40) ≈ $0.0017, rounded to **~$0.002/clip** to cover higher-res tiling and one repair retry. Batch (−50%) ≈ **$0.001/clip**. 5k × $0.001 = $5.
>
> **[b] Tiered/realistic (batch).** The built raw→text→visual ladder. Assume ~50% of items resolve at the text tier, ~50% escalate to the visual tier, and ~15% of the visual items escalate again to verification. **Text tier per item:** caption + subtitle + hashtags only, ~1.5k input + ~0.5k output = (0.0015 × $0.10) + (0.0005 × $0.40) = $0.00035 ≈ **$0.0003/item**. Visual and verify at ~$0.001/clip batch (see [a]). **20k worked example:** text 10k × $0.0003 = $3.0; visual 10k × $0.001 = $10.0; verify 1.5k × $0.001 = $1.5; grounding + embeddings ≈ $0 [d] → **≈ $14.5–14.6**. (5k and 10k scale linearly: $3.6 and $7.25.)
>
> **[c] Non-batch upper bound.** Same token assumptions as [a] without the Batch discount → ~$0.002/clip. 5k × $0.002 = $10.
>
> **[d] Grounding + embeddings ≈ $0.** Google Places (IDs-only tier free), TMDB and Trakt (free, key-gated), MusicBrainz (free), Open Library (free); embeddings computed once and cached. Marginal ≈ $0 **assuming** rate-limit compliance and caching — not paid per-query geocoding.

These are **one-time per-user backfill** costs, not monthly. Ongoing incremental analysis (only new saves) is cents/user/month. The under-$50/mo infra budget therefore covers hosting plus a trickle of new-item analysis until a managed tier monetizes; the few-dollar backfill is the key input to doc 05's willingness-to-pay math (consumer WTP ~$5–13/mo). Comparison to avoid making publicly (doc 03): Twelve Labs' Pegasus analyze ($0.0292/min) and Marengo index ($0.042/min) are *not* expensive at small scale — do not position on price; position on proof and openness.

#### 5.7 The six-axis eval scorecard (the real product)

The durable moat is this harness, not the pipeline (doc 03: "building an honest, version-locked golden set and a validated LLM-judge is slow, unglamorous work almost no consumer app will do — and it is exactly what wins skeptical agency buyers"). Six axes, each with a cited rubric:

1. **Retrieval** — Recall@k, MRR (mean reciprocal rank), nDCG (normalized discounted cumulative gain). The CUJ is "find the thing"; this measures the payoff directly.
2. **Transcription** — WER / CER (word / character error rate). Instrumental to entities.
3. **On-screen OCR** — F1. Recipes and prices flash on-screen for half a second — the documented pain.
4. **Generated-analysis faithfulness** — VidFactScore (claim-level faithfulness + coverage) plus ALOHa/VALOR-style hallucination detection. These are the Twelve Labs eval methods, adopted.
5. **Classification** — accuracy, macro-F1, and Cohen's κ, computed **per facet** because facets are independently governed (Ranganathan's faceted analysis).
6. **Grounding (flagship)** — end-to-end entity-linking P / R / F1, plus disambiguation accuracy and NIL accuracy (GERBIL/ELEVANT idioms). **This is the headline number.**

**Golden set.** 100–500 items, version-locked, stratified roughly 30/50/20 by platform × domain × difficulty, targeting ~245 annotations per slice where a slice needs a hard number (5% margin at 95% confidence). Seed: ~106 labeled items from the real 1,313-item corpus plus `fixtures/`. Annotated against the controlled core; survives taxonomy evolution via never-delete plus replacement associations plus a CI True-Path roll-up check. Expect ~20–30% expert-label error (the Gene Ontology's observed rate), so labels are double-checked, not trusted raw.

**Publish gate for grounding F1 (resolves the former OQ1).** No grounding F1 MAY be published — on the public scorecard or in any sales material — until the golden set reaches a hard minimum:

- **Aggregate headline grounding F1:** requires **≥ 245 groundable-entity annotations** (5% margin, 95% confidence). The current ~106-item seed does **not** clear this; it is sufficient only for internal, clearly-labeled *provisional* iteration, never for a published number.
- **Per-surface breakdown** (places / film-TV / music / books): a surface's F1 MUST NOT be published until that surface has **≥ 100 annotated groundable entities**, and when published between 100 and 245 it MUST carry its confidence interval explicitly. Below 100, the surface is withheld.

This is a gate, not an open question. Until it is met, the scorecard publishes the axes that *are* adequately powered and marks grounding "in calibration."

**Validated LLM-judge — the non-negotiable rigor.** We use an LLM judge to scale axes 4–6, but a raw judge is inadmissible: raw agreement inflates 33–41 percentage points versus a debiased measurement. So the judge MUST be validated against human labels using Cohen's/Fleiss' κ and ICC (intra-class correlation), and swap-debiased (answer order randomized to kill position bias), before any published number depends on it. This discipline separates our scorecard from a marketing claim — and, being open-core, it is auditable.

---

### 6. Every alternative trades away the eval moat

Alternatives are rejected against the same yardstick — the eval moat — and the *residual cost* of the live tensions is quantified rather than waved away.

- **A1 — Multi-pass VLM ensemble (one pass per facet).** Higher per-facet recall, but 3–5× cost *and* collapsing inter-run agreement (the MPEG-7 lesson), which poisons the golden set. **Residual cost we accept, quantified:** a single constrained pass plausibly forgoes **~5–15% of facet-level entities** on multi-topic clips — to be measured directly as the axis-5 macro-F1 gap between single-pass and an *offline* ensemble on the golden set. We accept that loss **only while** confidence-gated re-checks (ADR-4) close it to within ~5 macro-F1 points. **Rejected for v1**, revisited if the re-checks cannot close the gap.
- **A2 — Hosted-only (Gemini forever), no OSS path.** Simpler and cheaper to build. **Rejected:** leaves supplier power at 5/5 (Porter, doc 03) and forfeits the open-core, on-device story that is part of the trust and portfolio thesis. OSS routing holds supplier power at 3/5 (ADR-3).
- **A3 — Ship normalized-string entities, skip external-ID grounding (what's built today).** Fastest to ship, and Stasht/Sorti already do it. **Rejected:** it lands us in the commoditized quadrant of doc 03's map with no moat. Grounding-to-durable-ID *with evidence* is the entire wedge.
- **A4 — Adopt a public video benchmark as the headline metric.** Free credibility. **Rejected:** public sets leak shortcuts and don't measure our job; a private, stratified golden set is both more honest and non-gameable (non-goal, §3).
- **A5 — Cross-platform unified raw model now.** **Rejected for v1:** raw payloads rot fastest (signed URLs, drifting `itemStruct`/Graph shapes). Model the durable abstraction (an Activity-Streams / schema.org base object), demote the raw payload to a versioned artifact, and localize platform quirks in adapters. TikTok+IG first.
- **A6 — Per-platform entity/analysis models.** **Rejected:** the standards converge on one base object; per-platform divergences (IG carousel children lack identity/metrics; X `referenced_tweets` enum; YouTube playlistItem-vs-video) belong in adapters, not in a forked engine.

---

### 7. Seven decisions carry the design — each with a revisit trigger (ADRs)

**ADR-1 — One schema-conditioned VLM pass over a closed enumeration.** *Status: Accepted (v0 built).* **Context:** expressiveness vs. inter-run agreement, and cost. **Decision:** one constrained, timestamped-JSON pass (Pegasus method) against a closed core enumeration plus an open free-tag layer, at temperature 0.2, JSON mode, ontology-validated coercion. **Consequences:** (+) reproducible, κ-preserving, cheap; (+) already built and tested; (−) misses facets a multi-pass would catch — mitigated by ADR-4. **Revisit trigger:** if the measured single-pass axis-5 macro-F1 or axis-6 F1 sits >10 points below the offline ensemble after 3 golden-set iterations, and ADR-4 re-checks cannot close it.

**ADR-2 — Grounding-to-external-ID is the flagship, measured on axis 6.** *Status: Proposed.* **Context:** consumer features commoditized; incumbents assert grounding but never prove it; agency buyers need faithfulness evidence. **Decision:** resolve entities to durable external IDs via candidate-gen→rerank→confidence→NIL (contracts in §5.3), and make end-to-end grounding F1 the headline. **Consequences:** (+) occupies the empty quadrant of both competitive maps; (+) serves JTBD Job B directly; (−) the hardest stage to get right and the most expensive to evaluate. **Revisit trigger:** if aggregate grounding F1 cannot clear the v1 target (initial target 0.85 on the ≥245-item set) after 5 harness iterations, re-scope the surface set (e.g. ship places-only) before widening.

**ADR-3 — Model routing: hosted default, OSS-substitutable.** *Status: Proposed.* **Context:** supplier power; cost ceiling; on-device trust story. **Decision:** keep the `ModelAdapter` boundary (§5.3) so Gemini Flash-Lite is swappable for Qwen3-VL/Gemma3/InternVL (Ollama/vLLM local; Fal/Modal/Replicate for burst) and WhisperX/whisper.cpp, with no orchestration change. **Consequences:** (+) supplier power 5→3; (+) enables a future zero-hosted-cost config; (−) OSS quality must be tracked per-axis. **Revisit trigger:** if any OSS candidate scores >8 points below hosted on axes 3/4/6, or if the hosted provider's price rises >2× or its policy blocks our use, re-evaluate the default.

**ADR-4 — Confidence-gated agentic verification, not always-on.** *Status: Proposed.* **Context:** cost vs. accuracy on the long tail. **Decision:** escalate only sub-threshold entities/items to a Supervisor/Workers loop (Jockey pattern); the built raw→text→visual ladder is the lower rungs. **Consequences:** (+) at the assumed ~15% verify rate, cost tracks the §5.6 tiered model; (−) the rate is an assumption that drives the whole cost model. **Sensitivity, quantified:** the 20k tiered total scales roughly linearly with escalation — at a 40% verify rate the verify line moves from $1.5 to ~$4.0 (~$17 total); if the visual-tier share is actually ~80% rather than 50%, the visual line alone moves from $10 to ~$16 and the total passes $20. **Revisit trigger:** if the measured escalation rate exceeds 25%, or the visual-tier share exceeds 65%, on the golden set, re-tune thresholds before backfilling at scale.

**ADR-5 — LLM-judge admissible only after κ/ICC validation + swap-debias.** *Status: Proposed.* **Context:** raw LLM-judge agreement inflates 33–41 points. **Decision:** no published number depends on an unvalidated judge; every judge is validated against human labels (Cohen's/Fleiss' κ, ICC) and swap-debiased. **Consequences:** (+) the public scorecard is defensible and auditable; (−) slows each release — accepted, it *is* the moat. **Revisit trigger:** if judge-vs-human κ falls below 0.6 on any axis, that axis reverts to human-only scoring until the judge is re-validated.

**ADR-6 — Model the referent (WEMI Work) separately from post and save.** *Status: Proposed.* **Context:** dedupe and grounding brittleness when post ≡ referent. **Decision:** referent is a first-class node holding the external ID; posts (Manifestations) and saves (Items) link to it. **Consequences:** (+) fifty saves → one Place; (+) golden set annotates referent and post on different axes; (−) a schema migration from today's inline `entities[]` — bounded, and the 54 tests protect it. **Revisit trigger:** if referent-dedupe precision drops below 0.9 on the golden set (over- or under-merging), revisit the keying strategy.

**ADR-7 — Private, version-locked golden set over public benchmarks.** *Status: Accepted.* **Context:** public video sets leak shortcuts. **Decision:** evaluate on a private, stratified, version-locked golden set (100–500), seeded from the real corpus, subject to the §5.6 publish gate. **Consequences:** (+) honest, non-gameable, job-relevant; (−) no free external credibility — bought back by publishing our methodology and numbers. **Revisit trigger:** if a public benchmark emerges that is demonstrably representative of our corpus, or an agency buyer contractually requires one, add it as a secondary reference (never the headline).

---

### 8. Trust is architected here, not sloganized

- **Privacy / local-first (NF2).** The store is local-first; understood data is the user's and exports cleanly (built `exporters/*`). This is doc 03's Blue-Ocean "Create" move — portability-as-default — and ARCHV's trust posture, architected rather than sloganized. Hosted inference is the one place user media leaves the device; it is disclosed and batched, and on-device OSS is the escape hatch (ADR-3). **No remote code MUST ever execute in the extension.**
- **Security / adversarial suppliers.** Platforms are adversarial suppliers (Porter, doc 03): signed URLs expire in hours (hence eager capture), and a scroll throttle caps item-list capture (hence human-paced, resumable backfill). We never forge signatures; we only intercept the platform's own signed responses. Grounding keys and the Gemini key (`src/secrets.js`) MUST NOT ship to clients.
- **Observability.** Per-stage cost, latency, tier distribution, escalation rate, and per-axis eval deltas are logged every release (feeds §5.6 and doc 05). The users-validation memo's session logging — task success, time-to-find — is wired for the retrieval gate.
- **Reproducibility / governance.** The taxonomy is a versioned product with a written editorial guide (SNOMED/MeSH/GO discipline). Never-delete plus replacement associations keep the golden set valid across releases. CI enforces True-Path roll-up and the class-vs-instance invariant (Wikidata's P31 "instance of" vs. P279 "subclass of").

---

### 9. Validate the job before building the moat

1. **Gate first (users-validation memo).** Before the heavy grounding build, run the 5–10-user retrieval test on users' *own* corpora, each session ending in a commitment ask, plus the Sean-Ellis 40% survey at two weeks. Pre-registered kill/persevere thresholds: ≥ ~70% task success with lower time-to-find than the native baseline; ≥ 40% "very disappointed"; ≥ 1 commitment per satisfied user. Miss → it's a vitamin → pivot to the Segment-1 export-pass funnel (doc 05), not the retention-dependent subscription.
2. **Grounding stage, recipes-first** (JTBD's strongest painkiller, WTP proven by Preplo/Némos/Paprika): recipe → ingredient/step extraction + product grounding; then restaurants (Places, "complete the journey to Maps"); then films (TMDB) as an engagement/SEO surface, not a revenue surface.
3. **Eval harness in CI** — six axes on every engine/taxonomy release. Publish the scorecard once the §5.6 publish gate is met and the judge is validated (ADR-5); until then, publish the powered axes and mark grounding "in calibration."
4. **Agency concierge in parallel** (users-validation): run the deep pipeline config overnight on one warm agency contact's folder, hand back the grounded JSON *as a manual service*, and drive to an LOI or paid pilot — build-then-show, no scaled pipeline until validated.
5. **Testing.** Extend the 54-test suite to grounding (candidate-gen, rerank, NIL, referent dedupe); the built `dedupeEntities`/`buildEntityIndex` tests are the template.

---

### 10. What remains open is calibration, not direction

- **OQ1 (publish order under the n-budget).** Given the §5.6 gate, which surface reaches ≥245 annotations first — places or recipes — and therefore anchors the first published grounding F1? (Resolution is procedural, not directional; the gate itself is settled.)
- **OQ2 (referent-migration timing).** Does the ADR-6 migration land before the retrieval gate (cleaner) or after (only if the gate passes)? Leaning after, to avoid building moat for an unvalidated job.
- **OQ3 (OSS OCR quality).** Does Qwen3-VL / dots.ocr clear the axis-3 bar that makes a zero-hosted-cost config viable, and at what latency? (Feeds the ADR-3 revisit trigger.)
- **OQ4 (honest NIL as UX).** A high correct-NIL rate is good eval hygiene but may read to users as "it didn't find it." The UX for honest NIL is a doc-02 question.

**Appendix — built vs. proposed inventory.** *Built (`src/lib`, 54 tests):* `CapturedItem`/`Enrichment` types; the raw→text→visual tier ladder (`enrich.ts`); the constrained Gemini client with ontology-validated coercion (`geminiClient.ts`); deterministic entity keying/dedupe/index (`entities.ts`); VTT→transcript and inline-media fetch (`mediaFetch.ts`); the flat closed ontology and facets (`ontology.ts`); json/obsidian/csv exporters. *Proposed (this doc):* the grounding stage (F2) with the §5.3 authority contracts; the referent/WEMI model (ADR-6); agentic verification (ADR-4); the OSS routing adapter (ADR-3); the six-axis harness and validated judge (§5.7). The flat `ontology.ts` enum is explicitly a v0, to be superseded by the faceted controlled core.