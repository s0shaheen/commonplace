# Extraction stack audit — is it fit for gemini-3.6-flash + native video?

```
Date:   2026-07-27
Ask:    The pilot's numeric-loop bug exposed that the extractor (prompt, output
        structure, decoding config, ingestion) was built for gemini-2.5 + keyframes,
        never re-evaluated for gemini-3.6-flash native video. Founder: "audit first,
        then decide" — no implementation or eval build yet.
Method: Read the shipping artifacts (prompts/extract_v1.md, geminiClient.ts,
        extractor-output.schema.json) + the pilot evidence + Google's current
        Gemini 3.x docs (video understanding, structured output, thinking, migration).
Verdict below is a DESIGN assessment. Whether a v2 is actually BETTER than v1 is a
        MEASUREMENT question that needs the gold set (see §6).
```

## 1. Verdict

The output *structure* is mostly sound; the *decoding config* is where the staleness and the bug both live, and it's the bulk of the rework. Three of the current config choices are now explicit anti-patterns in Google's own Gemini 3.x guidance, and the numeric loop falls out of them directly. This is a real re-evaluation, but a bounded one — it's a v2 of the config + the timestamp representation + a tightened prompt + an ingestion-default flip, not a ground-up rewrite of the ontology.

## 2. The decoding config (`geminiClient.ts`) — stale, and the bug's cause

| Current | Gemini 3.x guidance (Google docs, 2026) | Change |
|---|---|---|
| `temperature: 0` | "strongly recommend **not** changing" temperature/top_p/top_k — "Gemini 3's reasoning is optimized for the default settings." temp 0 + constrained decoding is a known degenerate-loop trigger. | **Remove temperature** (and top_p/top_k). Likely the single biggest cause of the `0.0101…` loop. |
| no `thinking_level` | gemini-3.6-flash defaults thinking **ON (medium)** — billed thinking tokens. For extraction/classification, "minimal or low" is recommended. | **Add `thinking_level: "low"`** (or minimal). Cheaper, less over-analysis, no legacy `thinking_budget`. |
| no `maxOutputTokens` | — | **Cap output** so a runaway can't spew 70k tokens (the pilot's one runaway was ~70k). |
| no `media_resolution` | Gemini 3 knob: LOW/MEDIUM = 70 tok/frame, HIGH = 280. The prompt leans hard on reading on-screen text (menus, signs, prices). | **Tune per goal**: `high` helps read fine on-screen text; `low` cuts cost. A real lever to measure. |
| video via `inlineData` (base64) | Inline is for <20MB / <1min; use the **File API** for larger/longer video. | **File API for the native-video path** (inline stays fine for keyframe images). Today's inline path would fail on bigger videos. |
| strict `responseSchema` with unbounded `number` timestamps | supported, but unbounded numbers under temp-0 are what loop. | see §3. |

## 3. The output structure — sound, except the timestamp representation

The five-key output (`mentions / concepts / facets / claims / structured`) with a per-element `evidence` array (channel · assertion_mode · confidence · quote · timestamps) is the ontology-grounded design, and the pilot shows the model produces it well (it pulled 7 steakhouses, UPS+ORION, etc. with correct channels). Keep it. The one defect:

- **`t_start`/`t_end` as float seconds fights the model.** Gemini 3 natively refers to video time in **`MM:SS`** format; forcing an unbounded float is both unnatural and the literal thing that loops. Fix: represent the evidence timestamp as an **`MM:SS` string** (or drop it — it's optional and used only to build a media-fragment selector in `openSchema.ts`, which can parse `MM:SS`). This removes the loop at the representation level, independent of the config fix. Note this touches the frozen schema (`number` → string), so it's a versioned schema change (small; no shipped data yet).
- Everything else in the structure is model-agnostic and fine. The `additionalProperties:false` runtime gate (the "iron rule" — no model-emitted IDs) is good and stays.

## 4. The prompt (`extract_v1.md`) — tighten for 3.x, reframe for native

- It's 126 lines of detailed instruction. Gemini 3.x guidance: "Be concise… verbose prompt engineering designed for older models may cause the model to **over-analyze**." The closed vocabularies (9 entity types, 9 facet axes) genuinely need to be conveyed, but the framing can be much tighter and more direct.
- It's written for frames + VTT ("subtitles" in the VERBAL_TEXT channel). For native video, reframe to "watch and listen to the video," and specify **`MM:SS`** for any timestamp.
- Best-practice placement (media before text) is already correct in `buildMediaBody`. Keep.

## 5. The ingestion default — flip to native (measure the cost)

`keyframes_vtt` is the current default (DEC-017), chosen because native was ~8× costlier on gemini-2.5. On 3.6-flash, native video is **~300 tokens/sec at default resolution (~100/sec at low)** — a 60s clip is ~18k tokens (~6k at low res), trivially cheap — and it gives the model the real audio + full visual stream instead of sampled frames + a separate VTT. The pilot shows native extraction is rich and accurate. **Strong case to make native the managed-lane default.** The exact cost delta vs keyframes is a number to confirm, but the order of magnitude says the old cost reason is gone. (Local/Ollama lane stays keyframes_vtt — deaf VLMs, unchanged.)

## 6. What this audit CANNOT settle — and why the gold set is now on the path

Everything above is a *design* judgment grounded in Google's guidance + the pilot. Whether a v2 (no temp, thinking:low, MM:SS timestamps, native ingestion, tighter prompt) actually **extracts better** than v1 — more real entities, fewer hallucinations, better facet accuracy — is a **measurement** question. Deciding it by eyeballing a few outputs is the exact "vibes over instrument" failure the project's own methodology forbids. So the honest path is: build a **lean gold set** (a stratified ~100–150 items the founder adjudicates) and score v1-vs-v2 on it. The extraction re-evaluation and the pilot gate are now the same work.

## 7. Recommendation

1. **Build the v2 extractor config + prompt** as one change: drop temperature, add `thinking_level:low` + `maxOutputTokens` + `media_resolution`, File API for native video, `MM:SS` timestamps (schema bump), tightened native-oriented prompt, native as the managed default. The loop dissolves as a consequence, correctly.
2. **Gate the choice on a lean gold set** — build it, score v1 vs v2, keep what wins. This is the pilot, now clearly justified by a real engineering need rather than as standalone "validation apparatus."
3. Cost is not a blocker: the whole 6-video pilot (with one runaway) was ~174k tokens; a fixed config with thinking:low + low media-resolution puts a 6-video run in the low tens of thousands of tokens — cents.

The one real fork for the founder: do we build v2 **and** the gold set together (measured), or ship v2 on judgment now and measure after. The audit's own logic points to measured — but that's the founder's call on rigor vs speed.
