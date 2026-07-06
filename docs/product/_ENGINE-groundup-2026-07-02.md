# The Analysis System — Ground-Up Design (2026-07-02)

> **Status:** supersedes the spike-anchored engine framing in the dossier (docs 03/04/09) *for the analysis system*. The built Gemini-2.5-Flash single-shot spike is a **data point** — it proved capture works, produced the real 1316-item corpus, and showed JSON extraction is feasible. Nothing more. It is **not** the foundation.
>
> Produced by a ground-up investigation of the current (mid-2026) model + eval + architecture landscape, run as four parallel, web-grounded research streams: **(A)** frontier proprietary VLMs, **(B)** open-weight VLMs + licenses, **(C)** video eval/measurement + Twelve Labs methods, **(D)** analysis-system architectures + grounding. Streams A and D reached the core design **independently** — that convergence is the adversarial check.

---

## 0. The design in one sentence

A cheap, swappable video model does **high-recall typed-mention extraction**; a **model-agnostic grounding module** resolves those mentions against the *real* Places / TMDB / MusicBrainz / Wikidata APIs with confidence + NIL-abstention + provenance; and a **six-axis measurement harness** on our own golden set proves it. The model is a commodity. The grounding module and the measurement are the moat.

## 1. The reframe: the model is not the moat — grounding is

For a median-42s clip the cost structure inverts the naive intuition:

- A single **Gemini 2.5 Flash-Lite** pass ≈ **$0.0022** (batch ~$0.001); **3.1 Flash-Lite** ~$0.002–0.006; both inside the $0.001–0.01 target *by themselves*.
- A single **uncached Google Places** lookup ≈ **$0.03–0.06** — and Places is the *only* one of our four target KBs that isn't free (TMDB, MusicBrainz, Wikidata are free). One food clip with two place lookups can cost **6–30× the entire rest of the pipeline.**

So the engine's job is to extract mentions cheaply, then spend grounding calls **surgically** (confidence-gate, cache, field-mask to the cheapest SKU, ride the free 10k/mo Places Essentials tier). And the sharpest design rule, reached by **both** the frontier and architecture streams independently:

**Do not let the LLM emit external IDs.** Cheap models hallucinate a `place_id` / TMDB / MBID / QID confidently, and a fabricated *durable* ID is worse than none — it silently corrupts the grounding that is the whole product. The model emits typed **mentions** `{surface, type, timestamp, disambiguation_context}`; our own code resolves them. This **decouples model choice from grounding accuracy** — swapping Flash-Lite ↔ Nova ↔ Qwen changes cost, not correctness — which is exactly why "which model" is no longer the anchor.

## 2. The model ladder

### Managed tier (the hosted product)
- **Primary — Gemini 3.1 Flash-Lite** (GA). Native video **+ audio** in one call (no ffmpeg, no separate ASR — covers the 42% of clips without VTT for free), MM:SS temporal referencing, strict JSON schema + function calling, **~$0.002–0.006/clip** (low-res + batch ~$0.0019). **~30% cheaper than the 2.5 Flash the spike used, zero migration.** Strictly dominates the spike's baseline.
- **Escalation — Gemini 3.5 Flash** (GA; 3.5 *Pro* is not GA yet, slipped to a July limited-preview). Smarter, but output is $9/1M → ~$0.01–0.03/clip. A **dial, not a default**: swap one model-ID string for the hard tail. One integration, two tiers.
- **Fallback — Amazon Nova Lite.** Cheapest native video (~$0.0007–0.001) but **no audio** (re-add VTT-as-text) and **documented-weak at event ordering/causality** — bad for recipe-step structure. Fallback only.
- **Hard fork to know:** Gemini, Nova, and Qwen3-VL ingest video **natively**; **OpenAI (GPT-5) and Anthropic (Claude) still will not accept a video file via API** (July 2026) — you'd build and maintain ffmpeg frame-extraction + ASR + timestamp labeling yourself. A second system for a solo founder; avoid for the primary path.

### Open-core / self-host tier (the OSS engine must run without a proprietary key)
**The license trap (stream B's key finding):** an `apache-2.0` HF tag usually covers only the *code*. Weights are frequently (1) distilled from GPT-4o/Gemini data whose datasets are marked "academic/research only," and/or (2) built on a backbone with its own license (Qwen2-72B Tongyi Qianwen 100M-MAU gate; Llama Community; **Qwen-Research = non-commercial on the 3B sizes**). Treat the tag as necessary-not-sufficient; prefer vendor-shipped-as-product models; do dataset-level diligence before shipping.

**The verdict (two independent open-weight streams): Qwen3-VL is the open primary, run two-tier.** No open model is a drop-in for the *whole* grounded-extraction task, but Qwen3-VL (8B default; 4B for slideshows/edge; 30B-A3B / 235B MoE for hard cases) is the only one that clears all four bars at once: **Apache-2.0 at *every* size** (no MAU ceiling, no naming clause, no non-commercial trap — decisive for OSS-ing an engine that calls and fine-tunes it), **genuine native temporal video** (timestamp tokens, 256K→1M ctx), **class-leading OCR** (OCRBench 896 / DocVQA 96.1 at 8B; 920 / 97.1 at 235B — *ahead of Gemini on OCRBench*), and it's both **cheaply hosted** (Novita ~$0.08/$0.50 per 1M) *and* self-hostable on a single 4090. A 42s clip runs **well under a cent** either way — so cost is a wash and **license + OCR + ownership are the real differentiators.**

Why this matters for *our* task: **our entities come mostly from on-screen text, and OCR is exactly where open models have caught up with frontier** — so the perception layer can be open without a quality tax. Run **Qwen3-VL as the owned, fine-tunable, high-volume workhorse we open-source, with a cheap frontier API (Gemini 2.5 / 3.1 Flash-Lite) as the accuracy ceiling, hard-case fallback, and eval oracle** — a *dial* we turn toward open as two frontier-only gaps close: (a) **world-knowledge entity *linking*** (resolving "that ramen spot" → a Place ID leans on a bigger world model than an 8B holds), and (b) **audio** — *every* open VL model is deaf, so the 42% of clips without VTT need either a Whisper pass or a heavy Omni model (Qwen3-Omni-30B-A3B, 80 GB), whereas Gemini ingests the audio track natively at Flash-Lite prices.

Hedges / other tiers: **Molmo 2** (max independence — fully-open Olmo variant, native video, beats Gemini 3 on tracking; weaker OCR + non-commercial *training-data* caveat); **MiniCPM-V 4.5** (best video-per-watt — 96× token compression, 10 FPS — for on-device, but its license is *registration-gated*, friction in a clean OSS repo); **SmolVLM2-2.2B** (Apache, cheapest 1.4–5.2 GB, full llama.cpp/MLX runtime, ~52 Video-MME → on-device / high-volume first pass); **Gemma 4** (Apache, cheap reasoning/image tier, never the video primary — 60s cap).
- **License landmines to avoid in open-core:** Gemma **3** has a prohibited-use clause that *flows down onto your downstream users* (use Gemma 4 instead; don't ship fine-tuned Gemma-3 weights); **Llama 4 / 3.2-V** are image-only *and* carry EU-domicile + 700M-MAU + naming clauses (disqualified); **Qwen 3B = non-commercial research license; Qwen 72B / InternVL3-78B = Tongyi 100M-MAU** (cap Qwen at the 3-VL Apache sizes, InternVL at ≤38B).
- Structural note: the clean-license frontier has **converged on the Qwen3-8B Apache backbone** (MiniCPM-V 4.5, Qwen3-VL, Molmo 2, LLaVA-OneVision-1.5 all use it).
- **Disqualified (non-commercial weights):** NVILA (CC-BY-NC-SA), Eagle 2.5 (NSCLv1), Apollo (retracted + nc backbone), VideoLLaMA3 (non-commercial data cloud). Not a video model: Phi-4-multimodal.

## 3. Architecture: single-shot + grounding now → confidence-routed cascade later

- **Ship now — Candidate A:** one VLM call → schema-constrained JSON of typed mentions + themes/takeaways/recipe structure → deterministic claims-vs-evidence support check → **grounding module** (§4). Compute floor ~$0.003/clip; realistic $0.005–0.02 driven by #uncached-Places. Latency ~5–15s. **Low** solo build complexity — closest to the spike + the new grounding module.
- **Evolve to — Candidate C:** a confidence router escalates only the hard ~20–30% tail (dense multi-entity, no-VTT, ambiguous) to a decomposed + verified path (Candidate B). Blended ~$0.013/clip. Built **incrementally** (A → add B for the tail → add router last), never all at once.
- **Not agentic.** A 42s clip fits in one VLM context, so a planner-loop's reason to exist (long-video segment selection) is absent; you'd pay 15–60s latency + non-determinism (which *sabotages* measurability, the moat) for flexibility you don't need. Agentic tool-use earns its place only *inside* the grounding sub-routine.
- **Accepted tradeoff:** lower entity recall on the hardest ~20–30% at launch, bought back later via the router — spending compute only where a *calibrated* signal proves it's needed, instead of paying B's cost on 100% of traffic to rescue 25%.

## 4. The grounding module — the real build, and why a solo founder can own it

The mature entity-linking pattern is coarse-to-fine, and the key simplification is that **you do not build or maintain a vector index over a KB dump — the KB search endpoints *are* the candidate generator** (they do the fuzzy matching, freshness, and scale). This removes the single biggest ops burden that ReFinED/LELA carry.

```
mention {surface, type, evidence_span, geo/temporal hints}
  → route by type: place→Places | film/TV→TMDB | music→MusicBrainz | else→Wikidata
  → KB search API → candidate set (field-masked, cheapest SKU)        [candidate generation]
  → ONE batched LLM "select" over candidates + clip context           [disambiguation]
       (self-consistency k=3 on THIS step only; "select" beats pairwise on F1 AND cost)
  → confidence score + explicit NIL abstention + provenance            [confidence / NIL]
  → cache by (normalized_query, geo_bucket, type)
```
Prior art: **ReFinED** (top-30 candidates, desc+typing bi-encoder, 60× faster, zero-shot Wikidata), **LELA** (retriever→reranker→LLM-select+NIL; ZESHEL 83.1%), "**Match, Compare, or Select?**" (COLING 2025 — selection wins on F1 and cost). **NIL abstention is a first-class feature**: a confidently-wrong `place_id` is worse than "unresolved," so NIL-accuracy is a headline metric.

## 5. Measurement harness — the moat made legible

**Correction on "best-in-class":** the standard video benchmarks (**Video-MME**, **MVBench**, **TempCompass**) test QA / perception / temporal-reasoning — **not** extraction-and-grounding. They're useful only for *model selection*, not for measuring our moat. What measures the moat is **our own golden set**, on six axes:

| Axis | Metric / method |
|---|---|
| Retrieval | task success + within-subject time-to-find (the product gate, Doc 08) |
| Transcription | WER vs reference (VTT where present; ASR elsewhere) |
| OCR / on-screen text | CER/field-accuracy on labeled on-screen text |
| Generated-analysis faithfulness | claims-vs-evidence support + Chain-of-Verification; VC-Inspector / QEVA-style reference-free factuality |
| Classification | per-facet P/R/F1 vs labels |
| **Grounding (flagship)** | entity-linking P/R/F1 **to the correct durable ID** + **NIL accuracy** + confidence **calibration (ECE)** |

Two disciplines make it real: (1) the **replay harness** — freeze VLM outputs + KB candidate sets, then A/B the grounding layer **deterministically for ~$0**, which is what makes solo iteration tractable; (2) any **LLM judge must be kappa-validated** against human raters (raw agreement inflates scores 33–41pp) and bias-corrected.

## 6. Twelve Labs — mine it, don't build on it (the R2 directive)

- **Emulate:** Pegasus 1.5's **schema-conditioned segmentation → timestamped JSON in one call**, and first-class **temporal grounding** (localize every claim to MM:SS); later, Marengo's **segment-level multi-vector temporal embeddings** (512-dim, not frame-level) for retrieval.
- **Skip:** their price (~$0.05–0.06/clip, 20–50× budget) and their embedding-search infra (premature for us).
- **The tell that confirms the wedge:** even Twelve Labs — the gold standard — does **no durable-external-ID entity linking**. Neither does Tencent's ARC-Hunyuan-Video-7B (cheap shorts comprehension, July 2025). **Grounding-to-durable-IDs with confidence + provenance is the gap nobody in the shorts-comprehension space ships.** That is our differentiation, now confirmed from three directions.

## 7. The one experiment that decides the most

Before committing the pipeline, run on a labeled slice: **native video** vs **[platform VTT + a few keyframes + OCR]** — measured on entity-resolution accuracy and recipe-step F1. Our corpus is transcript-heavy (**58% VTT, 18% slideshows**) and our targets (restaurant, dish, song, place, recipe steps) live in **speech + captions + on-screen text**, not fine motion. **If the two tie, we are not locked to native-video vendors at all** — cheaper text-LLM + vision-on-keyframes paths reopen and the cost floor drops again. This is the first question the golden set should answer.

## 8. Recommended next action (build, not more strategy)

Stand up a **stratified golden slice** of the 1316-corpus (by domain × media-type: video/slideshow, VTT/no-VTT) and the **six-axis harness**, then run the benchmark to answer the three questions that actually decide the pipeline — none of which the public benchmarks proxy:
1. **Native video vs. [VTT + keyframes + OCR]** (§7) — if they tie, we're not locked to native-video vendors and the cost floor drops again.
2. **Does the open-model OCR edge survive *real* stylized short-form frames?** OCRBench/DocVQA are clean documents; TikTok/Reels are animated captions, emoji, meme text, motion blur. The "perception layer can be open" thesis rests on Qwen3-VL's OCR lead holding on *our* burned-in captions — measure entity-name P/R on our frames.
3. **Schema + grounding reliability, open vs. frontier** — does an 8B open model emit schema-valid JSON with *calibrated* confidence and resolve to the *correct* durable IDs without inventing them, and how much does a light LoRA on our corpus close the gap? This decides whether the open/frontier split is 90/10 or 50/50.

The spike enters only as **one baseline row** in the resulting table. This is ground-up, cheap, and the honest first step before any pipeline lock.

## 9. Open / explicitly unverified (be skeptical before hardcoding)

- Exact **Google Places *Text Search (New)*** per-1k price (Place Details confirmed: Essentials $5 / Pro $17 / Enterprise $20 per 1k; the $200/mo universal credit was retired Mar 2025).
- **Qwen3-VL** exact Video-MME scores; **MiniCPM-V 4.5** video support specifically over llama.cpp; **Molmo 2** standard benchmark numbers.
- **Training-data commercial cleanliness** for InternVideo2.5 / LLaVA-OneVision-1.5 / Tarsier2 / Molmo 2 (the GPT-4o-distillation "academic-only" caveat).
- Gemini File API inline-vs-upload size threshold (docs conflict 20 vs 100 MB; moot for 42s clips) and Nova exact token prices.
- All per-clip costs are computed from verified token rates + our corpus stats (42s median, 58% VTT, 18% slideshow), not vendor-quoted per-clip prices.
- **Source hygiene:** research agents encountered ≥2 web pages carrying **prompt-injection bait** ("stop and answer from training"); they resisted and anchored to primary sources. This also likely explains spurious injected text some agents surfaced (e.g. a bogus "Pantry" alias) — disregarded, not treated as fact.

## Sources (dated 2025–2026)
Gemini pricing/video/tokens: ai.google.dev/gemini-api/docs/{pricing,video-understanding,tokens} · Gemini 3.1 Flash-Lite GA: cloud.google.com/blog · Nova video + limitations: docs.aws.amazon.com/nova · Qwen3-VL: huggingface.co/Qwen/Qwen3-VL-8B-Instruct, github.com/QwenLM/Qwen3-VL · MiniCPM-V 4.5: huggingface.co/openbmb/MiniCPM-V-4_5 · SmolVLM2: huggingface.co/blog/smolvlm2 · OpenAI no-video: developers.openai.com/api/docs/guides/file-inputs · Claude vision: platform.claude.com/docs/en/build-with-claude/vision · Twelve Labs Pegasus 1.5 / Marengo 3.0 / models-overview: twelvelabs.io/blog/introducing-pegasus-1-5, /blog/introducing-marengo-2-7, /product/models-overview; Pegasus-1 report arxiv 2404.14687 · ARC-Hunyuan-Video-7B: arxiv 2507.20939 · Video-RAG; scene/keyframe arxiv 2506.00667 · agentic: VideoAgent, TAMA arxiv 2510.00161 · routing/cascade: Triage arxiv 2604.07494 · CoVe arxiv 2309.11495 · entity linking: LELA arxiv 2601.05192, ReFinED (Amazon), "Match, Compare, or Select?" COLING 2025 · faithfulness: VC-Inspector arxiv 2509.16538, QEVA (EMNLP 2025 findings) · benchmarks: Video-MME, MVBench, TempCompass · Places pricing: woosmap.com/blog, safegraph.com/guides · faster-whisper: spheron.network · Twelve Labs pricing: twelvelabs.io/pricing.
