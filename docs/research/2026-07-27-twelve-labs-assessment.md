# Twelve Labs: what best-in-class does, and whether we should just use it

```
Date:   2026-07-27
Ask:    "Look into how Twelve Labs approaches this vs how we are, implement best
        practices from best-in-class — or just use it entirely if cost allows."
Method: Read their docs + pricing, then ran Pegasus 1.5 live on a real corpus video
        and compared against our own bake-off numbers for the SAME video.
Verdict: Cost does NOT allow wholesale adoption (4–9× our price point). But two of
        their architectural choices validate decisions we'd already reached, one is
        a genuine gap, and their free tier lets us use them as a quality ceiling for $0.
```

## 1. The live test — best-in-class on our content

Ran Pegasus 1.5 (synchronous `/analyze`, no pre-indexing) on pilot video #6, the Chicago
steakhouse list — chosen because we already have two models' output for it.

**Pegasus returned**, in 27.1s (6,798 input / 102 output tokens):
```
Chicago Cut: Restaurant, 00:02      Tre Dita: Restaurant, 00:10
Smith and Wollensky: Restaurant, 00:05   Gibsons: Restaurant, 00:12
RPM Steakhouse: Restaurant, 00:06        Drew's on Halsted and Belmont: 00:14
```
Six unique venues, precisely timestamped.

**Our bake-off on the identical video:** `gemini-3.6-flash` found 7 venues; **`gemini-3.5-flash-lite`
matched venue-for-venue and added one (8)**.

So on this video, the model we ship at **~$18 per 5k library** found *at least as many* entities as
the video-understanding specialist at **~$158 per 5k**. One video is not a finding — but it is a
strong early signal that we are not leaving much on the table, and it is the first evidence we've
had of where our ceiling actually is.

## 2. The economics — this is the blocker

Their pricing (2026-07-27), against our corpus (5,000 videos, mean 65s ≈ 1.08 min):

| Component | Rate | Cost per 5k library |
|---|---|---|
| **Pegasus Analyze** (generate structured text) | $0.0292 / min analyzed | **$158** |
| Marengo indexing (if we also want their search) | $0.042 / min one-time | +$227 one-time |
| Marengo infrastructure (stored embeddings) | $0.0015 / min / month | +$8 / month, forever |
| Marengo search | $4 / 1,000 queries | usage |

**Analyze alone is ~4.4× flash-lite standard ($36) and ~8.8× flash-lite flex ($18).** The full
stack with search is ~$385 one-time plus recurring. Against a $39 product, that is 4–10× revenue.

**Answer to "just use it entirely if cost allows": cost does not allow.** Not close, and not a
rounding error away from working.

## 3. What they do that we should learn from

This is the more valuable half of the question.

1. **"Index once, query many" (Marengo) — external validation of the perception/extraction split.**
   Their entire architecture separates an expensive one-time video-encoding pass from cheap
   repeated queries against it. That is exactly the Option A split I proposed on cost grounds
   before seeing this. Best-in-class independently arrived at the same shape, which raises my
   confidence in it considerably.
2. **Video-native, not frame-sampling.** Their explicit pitch: *"General-purpose VLMs paste frames
   together and call it understanding. Pegasus processes the entire video."* They benchmark
   against Gemini 3.1 Pro / GPT-5.5 on max single-call duration (120 vs 90 min) and claim native
   temporal segmentation the general models lack. Our native-video default (extractor v2) is on
   the right side of this line; our keyframes path was on the wrong side.
3. **Timestamped structured JSON as the native output** — "time-coded JSON in one API call",
   "JSON-native, schema-conditioned". Validates our rc.7 MM:SS timestamp decision.
4. **Video segmentation as a first-class primitive** — *a genuine gap*. You define a segment
   (speaker change, brand appearance, scene cut) and get timestamped JSON per segment. We have no
   equivalent. Low priority for 42-second clips; would matter for long-form.
5. **Batch analysis** — up to 1,000 analysis requests in one call, with a single batch id to poll.
   Worth copying the *shape* if we ever run library-wide re-analysis.
6. **Billing discipline worth stealing:** they bill Segment as `duration × number of segment
   definitions`, and document that trimming the window is the main cost lever. A useful reminder
   that our own cost lever is the analyzed window, not just the model.

## 4. What we should actually do

**Use them as a quality ceiling, not as the pipeline.** Their free tier is **600 minutes
cumulative** (playground samples already consume ~1 hour of it). Our 60-item gold set averages
~1.08 min/video ≈ **65 minutes** — comfortably inside the free allowance.

So: add **Pegasus 1.5 as a reference arm** in Phase 2 of the benchmark. It costs $0, it runs on the
same paired videos as every other arm, and it answers the question that actually matters —
*how much quality are we giving up by shipping a general-purpose model at 1/9th the price?* If
flash-lite tracks Pegasus, that's a publishable result and a strong story. If there's a real gap,
we learn exactly where it is (and it becomes a routing candidate, like the screen-recording case).

**Do not** adopt Marengo search: our content-search already runs locally at 80ms over 4,661 items
for $0, and their embedding-plus-infra model adds recurring cost for a capability we have.

## 5. Honest limits of this assessment

- **n=1 video.** The comparison above is one item; it is a signal, not a result. The reference arm
  in Phase 2 is what makes it real.
- **Prompt asymmetry.** Pegasus got a short natural-language prompt; our pipeline runs a
  schema-conditioned extraction prompt. A fair arm must give both the same task, which is exactly
  what the benchmark harness does.
- **We tested Analyze, not their full product.** Marengo search, segmentation, and embeddings are
  unevaluated here — assessed on docs and price only.
