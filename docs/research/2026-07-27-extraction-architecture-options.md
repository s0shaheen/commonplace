# Beyond one-shotting: extraction architecture options

```
Date:   2026-07-27
Ask:    "Combine open-weight models? Multiple flash-lite calls? There must be a better
        way than 1-shotting this."
Status: Analysis + a recommendation. Every option below is a QUALITY tradeoff that
        cannot be settled without the gold set — see §6. Cost numbers are measured
        from the 10-video bake-off; model claims are cited to vendor/paper sources.
```

## 1. The number that reframes the question

From the bake-off, per video, `gemini-3.5-flash-lite` at HIGH resolution:

| | tokens/video | cost | share |
|---|---|---|---|
| **Input** (the video itself) | 11,505 | $0.035 /10 videos | **48%** |
| **Output** (our structured JSON) | 1,498 | $0.037 /10 videos | **52%** |

At MEDIUM resolution the output share rises to **69%**.

**This kills the intuition that video input dominates.** At flash-lite prices it does not. So
the classic cheap-input moves — a cheaper open-weight model, fewer frames, lower resolution —
are capped at roughly **half** the bill no matter how good they are. The other half is our own
schema: ~1,500 output tokens of entities-with-evidence per video.

That splits the real architectural question in two:
1. **How many times do we pay video tokens?** (currently: every time we change anything)
2. **How expensive is the model that writes the JSON?** (currently: the same premium multimodal model that watched the video — which is overkill for what is, at that point, a text task)

## 2. Option A — split perception from extraction (the structurally strongest idea)

```
NOW:   video ──────────────► [one multimodal call] ──────────► structured JSON
SPLIT: video ──► [perception call] ──► durable rich text ──► [cheap text call] ──► structured JSON
                  (expensive, ONCE)      transcript +           (cheap, re-runnable)
                                         on-screen text +
                                         scene, timestamped
```

**Why this is more than a cost tweak: you pay video tokens once, ever.** Today, changing the
ontology, the prompt, or the facet vocabulary means re-uploading and re-watching all 5,000
videos at full price. With the split, the perception artifact is durable — schema iteration
becomes a cheap text-only re-run over stored text. For a product whose ontology is explicitly
expected to evolve (the facets are versioned hypotheses), that is a large structural win.

Secondary wins: the extraction step is a pure text task, so it can use a dirt-cheap model
(open-weight text models are ~10–30× cheaper per output token than flash-lite); each stage is
independently testable and swappable; the perception artifact is itself useful (it is exactly
what content-search indexes).

**Risks, honestly:** information is lost at the text boundary — visually-inferred facets
(`presentation: talking_head`, `content_provenance`) and "shown, not said" evidence may degrade;
two calls means more latency and one more failure mode; and total output tokens may *rise*
(prose + JSON) unless the second model is much cheaper, which is exactly why the second model
must be cheap for this to pay.

## 3. Option B — open-weight models

| Model | Audio? | Video? | Notes |
|---|---|---|---|
| **Qwen3-Omni-30B-A3B** | **yes, native** | yes | The real candidate. Open-source SOTA on 32/36 audio-video benchmarks, SOTA on 22; ASR "comparable to Gemini 2.5 Pro" (Librispeech-clean WER 1.22 vs 2.89). MoE with only ~3B active params → cheap to serve. |
| Qwen3-VL (2B–235B) | **no — deaf** | frames | Excellent OCR (DocVQA 96.5, OCRBench 89.6, ScreenSpot 95.4) and the 235B beats Gemini 3 Flash on VideoMMMU (86.9 vs 80.0). But no audio: needs a separate ASR stage. |

The audio gap is the crux and it is why the repo's local lane is already VTT-only ("deaf VLMs",
DEC-018). Most open VLMs see but do not hear; our task needs speech. **Qwen3-Omni is the
exception worth testing** — and it pairs naturally with Option A as the *perception* model,
where its ASR strength is exactly what matters and its structured-output weakness does not.

Real costs of this path: hosting/ops (or a provider like DeepInfra/Together/Fireworks), quality
on *our* task unproven, and it re-opens a maintenance surface. It is not a drop-in swap.

## 4. Option C — multiple calls of the same cheap model

- **Ensemble / self-consistency** (run N, keep what appears in ≥k): 3× flash-lite = **$108/5k**,
  which is *cheaper than one* 3.6-flash pass ($155) and may be more reliable via voting. A
  legitimate quality play, unproven, 3× latency.
- **Cascade / router** (cheap default, escalate hard items): directly addresses the one gap the
  bake-off found — dense small on-screen UI text on screen recordings. Only pays off if "hard"
  is cheaply detectable up front; escalating 10% costs ~$48/5k, *worse* than plain lite ($36)
  unless the escalation genuinely buys accuracy.
- **Decomposition into several cheap calls** (one per output array) multiplies input cost — the
  video would be re-read per call — unless it sits on top of Option A's text artifact, where it
  becomes cheap and attractive.

## 5. Where this lands on cost

| Architecture | ~$/5,000-item library | Confidence |
|---|---|---|
| 3.6-flash one-shot (before today) | $155 | measured |
| **flash-lite one-shot (recommended now)** | **$36** ($18 flex) | measured |
| flash-lite ensemble ×3 | ~$108 | measured × 3 |
| Split, flash-lite perception + cheap text extractor | **~$20–25**, and near-zero to re-extract later | estimated |
| Split, open-weight perception + open-weight extractor | ~$5–10 + hosting | speculative |

## 6. The wall — and the recommendation

Every option above trades quality for cost, and **we currently cannot measure quality.** We are
now four architectural decisions deep (model choice, media resolution, split-vs-one-shot,
open-weight-vs-hosted) with no instrument. That is precisely the failure the project's own
methodology forbids (DEC-003: instrument before experiment).

**Recommendation, in order:**

1. **Ship the flash-lite switch now.** It is measured, it is a 77% cut with no observed loss,
   and it makes the unit economics work. Do not block it on architecture.
2. **Build the gold set next.** It is no longer just the accuracy-page input — it is the
   blocking dependency for *every* remaining engine decision, including all of the above.
3. **Then evaluate Option A (perception/extraction split) as the first architecture change**,
   because its payoff is structural (video paid once; free schema iteration), not merely a few
   dollars — and it is the natural host for an open-weight perception model if that proves out.
4. **Treat open-weight as a follow-on to A, not a replacement for the current pipeline.**
   Qwen3-Omni is the candidate; the audio requirement disqualifies most alternatives.
5. **Park ensembles and routing** until the gold set can say whether they buy anything.
