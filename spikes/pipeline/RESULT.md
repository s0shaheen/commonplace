# Block-0 Spike #3 — the pipeline experiment (native-video vs VTT+keyframes)

**Result: the two ingestion paths are strongly COMPLEMENTARY, not equivalent. Decision → hybrid / confidence-routed cascade (SPEC §13), with fusion for the golden set. We are NOT locked to native-video vendors, and native video is NOT strictly better.**

Run 2026-07-07 on 54 of 59 harvested live TikToks (5 skipped — see reliability note), `gemini-2.5-flash-lite`, same model + same typed-mention schema on both paths so the ingestion method is the only variable. `experiment.mjs`; per-item data in `results.jsonl` (gitignored — real IDs).

## The numbers

| stratum | n | jaccard (agreement) | B-recall-of-A | A-recall-of-B |
|---|---|---|---|---|
| overall | 54 | **38%** | 48% | 61% |
| with VTT | 29 | 32% | 44% | 58% |
| without VTT | 25 | 45% | 53% | 65% |

- **Complementarity:** native-only **2.8 entities/item** (mostly audio-derived — spoken names the frames don't show); keyframes-only **1.9/item** (mostly on-screen text — burned-in captions the audio doesn't say). **Union = 6.4/item vs native-alone 4.5 → running both surfaces 42% more than native video alone.**
- **Cost:** native **~14,100 tok/clip (~$0.002)** vs keyframes+VTT **~1,700 tok/clip (~$0.0003)** → **B is ~8.4× cheaper.**

## What it means (the decision)

The naive question was "does the cheap path tie native video, so we can drop native-video vendors?" The honest answer from the data is **neither path dominates**:
- If they'd agreed (high jaccard), one path would suffice. They agree only 38% — so **one path is insufficient**; picking either alone leaves ~40–50% of the other's real entities on the table.
- Native video is **not** strictly better: it only recovers 61% of what keyframes+VTT finds, misses ~1.9 on-screen-text entities/item, costs 8.4×, and has a reliability tail (below).
- Keyframes+VTT is **not** a drop-in replacement: it misses ~2.8 audio-derived entities/item.

→ This **validates SPEC §13's confidence-routed cascade** as the managed-lane design, and sharpens it:
1. **Default = keyframes + VTT (Path B).** 8.4× cheaper, strong on on-screen text (where most short-form entities live), no native-video dependency — so the OPEN local lane (Qwen, no native video, no audio) is viable for the bulk with a Whisper pass for audio.
2. **Escalate to native video (Path A)** on a confidence signal that audio is load-bearing (music-heavy, talking-head, low on-screen text).
3. **Golden set / hard cases = fuse both** — the union is 42% richer than either alone; the published-accuracy corpus should be labeled against the union, not one path.

Counter-intuitive detail worth keeping: agreement is **lower** WITH VTT (32%) than WITHOUT (45%) — because VTT-present clips are entity-denser (more surface to disagree on), while no-VTT clips are often simple (many trivial 2-entity, 100%-jaccard cases). Disagreement scales with content richness, which is exactly where fusion pays off.

## Honest limits
- **This measures inter-path AGREEMENT, not accuracy.** Neither path is ground truth, so "B finds entities A misses" doesn't prove those are all correct (some may be noise/hallucination). That's fine for THIS decision (are we locked to one path? → no), but true precision/recall needs the labeled golden set — a Block-1 eval task, and exactly why the eval harness exists.
- **Reliability tail (a real finding):** 5/59 items skipped, and one clip's native-video `generateContent` **hung indefinitely** (never returned; abandoned at a 90s cap). The native-video path has a latency/reliability tail the keyframes path does not — another point for keyframes-as-default.
- Costs are token-derived on 2.5-flash-lite; 3.1-flash-lite (not GA yet) will shift absolute cost, not the ~8× ratio.

## Consequence for the plan
- SPEC §13 managed lane: **keyframes+VTT default → native-video escalation → fuse-for-eval.** Recorded.
- The open local lane (deaf VLM + Whisper) is viable for the bulk precisely because on-screen text — where keyframes win — carries most entities.
- Block-1 eval labels the golden slice against the **union** of both paths.
