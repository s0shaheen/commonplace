# Extractor v2 — how it works, what's still broken, and what it costs at scale

```
Date:   2026-07-27
Status: Reference + an OPEN ECONOMIC DECISION for the founder (§4). The architecture
        (§1–§3) is shipped and archived as openspec/specs/extraction. The pricing in
        §4 is from Google's live pricing page, same day; the token numbers are MEASURED
        from the 6-video pilot re-run, not estimated.
```

---

## 1. The pipeline, end to end

An item moves through four stages. Each is checkpointed in the resumable job queue, so a
service-worker death or a crash resumes rather than loses work.

```
CAPTURE / IMPORT        →  ENRICH            →  ANALYZE (extractor)   →  GROUND
live session or ZIP        fill missing         gemini-3.6-flash         mentions → real IDs
= id, url, savedAt         caption/poster/      watches + listens        MusicBrainz/Wikidata/
(TikTok ZIP = skeleton)    media bytes          → structured JSON        Places + confidence/NIL
```

**The extractor is stage 3.** Input: the video's actual bytes (plus, optionally, platform
metadata). Output: one JSON object with five arrays, every element carrying evidence.

## 2. What the extractor emits (the contract)

```
{ mentions[], concepts[], facets[], claims[], structured[] }
```

- **mentions** — specific real-world things, typed to one of 9 (`music_recording`, `place`,
  `screen_work`, `book`, `person`, `product`, `brand_org`, `software_app`, `game`).
- **concepts** — non-named subjects ("progressive overload", "flow state").
- **facets** — closed-vocabulary descriptors across 9 axes (affect, topic, genre, intent,
  creator_role, viewer_orientation, presentation, content_provenance, actionability).
- **claims** — the video's own theses (what it asserts, not what's true).
- **structured** — recipe/workout/list content as schema.org slots + steps.

Every element carries `evidence[]`: **channel** (VERBAL_AUDIO · VERBAL_TEXT · VISUAL_SCENE ·
VISUAL_TEXT · NONVERBAL_AUDIO · STRUCTURED_METADATA), **assertion_mode** (STATED · SHOWN ·
REPORTED · INFERRED), **confidence** 0–1, an optional verbatim `quote`, and optional
`t_start`/`t_end` timestamps. That evidence is what makes the provenance strip real — every
claim in the UI can point at where it came from.

**The iron rule:** the model emits *surfaces and types*, never external IDs. A separate
deterministic grounding stage resolves them to durable IDs with confidence and an honest NIL.
This is enforced structurally by an `additionalProperties:false` runtime gate — a model that
tries to emit an `mbid` is rejected, not trusted.

## 3. What v2 changed, and why (the problems, and the fixes)

| Problem (v1) | Cause | Fix (v2) | Status |
|---|---|---|---|
| **The numeric loop** — model emitted a repeating decimal for tens of thousands of tokens until JSON truncated and the whole extraction was dropped. Hit 4/6 pilot videos. | `temperature: 0` on a Gemini 3 model (explicitly discouraged) + unbounded `number` timestamps under constrained decoding. | Removed temperature/top_p/top_k; timestamps became `MM:SS` strings (the model's native form). | **FIXED — 6/6 clean in the re-run** |
| **Silent truncation** — a cut-off response returned nothing usable. | No repair path; parse failure = total loss. | Truncation now salvages the valid prefix as an **honest marked partial** (never a fake-complete, never a silent drop). | FIXED |
| **Paying for unused thinking** | 3.6-flash thinks by default (billed). | `thinkingLevel: "low"` — extraction is classification-shaped. | FIXED |
| **Native video broke >20MB** | Inline base64 has a hard limit. | File API upload (resumable protocol) + poll-until-ACTIVE. | FIXED |
| **Silent quality degradation** | `fetchVideoBytes` capped at 18MB, and **4 of 6 real pilot videos exceed it** — native would have quietly fallen back to keyframes for most videos. | Raised to a documented 128MB memory bound. | FIXED (caught by the live run, not by tests) |
| **Prompt built for frames+VTT** | Written for gemini-2.5 fed sampled frames + subtitles. | `extract_v2.md`: tighter (3.x over-analyzes verbose prompts), reframed for a model that watches + listens. | FIXED |

**Still open, honestly:**
- **Is v2 *better* than v1 at extraction quality?** Unmeasured. v2 is demonstrably better-*behaved*
  (no loops, 60% cheaper, no silent degradation), but a real richness comparison needs the gold
  set. The subagent that built v2 initially asserted a richness win using invented per-video
  baselines, caught itself, and retracted — the correct call. This is the pilot gate's job.
- **`media_resolution: HIGH` is unvalidated.** Chosen because on-screen text (menus, signs,
  prices) carries entities the audio never names. Nobody has measured HIGH vs MEDIUM quality —
  and per §4 it is the single biggest cost lever.

---

## 4. THE OPEN DECISION — unit economics at 1,000s of items

### Measured, not estimated

The 6-video pilot re-run on real corpus videos: **69,666 tokens for 6 videos ≈ 11,600 tokens
per video**, at `MEDIA_RESOLUTION_HIGH`, thinking low, mixed durations (17s–164s).

### Gemini 3.6 Flash pricing (paid tier, per 1M tokens, live 2026-07-27)

| Tier | Input | Output | Latency | Interface | Notes |
|---|---|---|---|---|---|
| **Standard** | $1.50 | $7.50 | seconds–minutes | sync | default |
| **Flex** | **$0.75** | **$3.75** | **1–15 min target** | **sync** | 50% off; "sheddable" (may 503, retry) |
| **Batch** | $0.75 | $3.75 | up to 24h | async | 50% off; job/polling management |
| Priority | $2.70 | $13.50 | seconds | sync | for user-facing realtime |
| Context caching | 90% off + storage/hr | | | | only helps repeated queries on the *same* file |

### The cost, per library

Assuming ~9,600 input / ~2,000 output per video (the split is an estimate; the total is measured):

| Depth | Per video | **5,000-item library** |
|---|---|---|
| Standard | ~$0.029 | **~$147** |
| **Flex or Batch** | ~$0.015 | **~$73** |

**This is the finding: at the planned $39 Deep Scan for 5,000 items, COGS at Flex (~$73) is
nearly double the price.** The $39/65%-margin pricing in the spec was modeled on
gemini-2.5-flash-lite with keyframes — a much cheaper path that no longer exists as specced.
The pricing and the analysis depth cannot both stay as they are.

### The levers, in order of impact

1. **Flex over Batch — take this one now.** Identical 50% discount, but **synchronous** with a
   1–15 min target instead of a 24-hour async job with file/polling management. Its one
   downside (sheddable, 503s under load) is already handled: the resumable job queue has
   retry, backoff, and checkpointing built in. Flex fits the architecture we already have, and
   analysis is inherently background work. `service_tier: "flex"`, one parameter.
2. **`media_resolution` HIGH → MEDIUM** — roughly a 3–4× cut in frame tokens (280 → 70 per
   frame). Unvalidated quality tradeoff; on-screen text is exactly what HIGH buys. **Measure it
   on the gold set** rather than guessing — this is the difference between ~$73 and maybe ~$30.
3. **Don't analyze everything at full depth.** The corpus backtest says ~12% is actionable and
   ~51% is dark matter. A tiered policy — native video for items that warrant it, a cheap
   caption/poster pass for the rest, deep analysis on demand — is the biggest structural saving
   and matches how people actually use a library.
4. **Revisit the $39 price** against whatever the real COGS lands at. It's a G3 decision that
   was explicitly deferred; it now has real numbers to be decided against.

Context caching is *not* useful here — it discounts repeated queries against the same file, and
we analyze each video once.

### Recommendation

Ship **Flex** immediately (pure win, no quality question). Fold **media_resolution** and the
**tiered-depth policy** into the gold-set measurement, because both are quality-vs-cost tradeoffs
that should be decided with the instrument rather than by argument. Then set pricing against
measured COGS, not the 2.5-era model.
