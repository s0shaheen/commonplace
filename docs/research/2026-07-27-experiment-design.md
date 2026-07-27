# How we test the permutation space without testing everything

```
Date:   2026-07-27
Ask:    "There are multiple permutations of processes / models / approaches. How do you
        test between them, isolating variables, WITHOUT testing everything — we don't
        have the time or spend. How would a scientist approach it?"
Budget: $50 ceiling (founder-set). Projected spend below: ~$25–35.
Status: Pre-registered design. Written BEFORE running, deliberately — see §5.
```

## The problem, sized honestly

Full factorial over what's actually on the table — 4 models × 3 resolutions × 3 ingestion paths
× 4 architectures × 3 prompts × 4 thinking levels — is **1,728 configurations**. At 60 videos
each that's ~104,000 model calls. Not a budget problem; a *category* problem. No serious
experimentalist runs a full factorial. Four moves shrink this to ~500 calls without giving up
the ability to make defensible claims.

---

## Move 1 — Eliminate by reasoning and existing evidence, before spending anything

The cheapest experiment is the one you don't run. Four dimensions collapse immediately:

| Dimension | Verdict | Basis |
|---|---|---|
| **Service tier** (standard/flex/batch/priority) | **Not an experimental variable at all** | Same model, same weights, same output distribution. It changes only price and latency. Testing it for *quality* is a category error. Decided on cost: flex for production, standard for experiments. |
| **gemini-3.5-flash** | **Eliminated** | Already measured, strictly dominated: 3.8× flash-lite's cost, fewer elements, worst VISUAL_TEXT of four arms, slowest. No further spend. |
| **Keyframes+VTT ingestion (managed lane)** | **Eliminated** | Native video is now both cheaper and richer on 3.x. Keyframes survives only for the deaf local/Ollama lane, where it isn't a choice. |
| **Qwen3-Omni as a drop-in** | **Eliminated (availability)** | Verified 2026-07-27: DeepInfra serves Qwen3-VL 30B/235B but **not** Qwen3-Omni. Qwen3-VL has no audio. So open-weight cannot be a one-shot swap — it can only enter as the *perception* stage of a split, paired with separate ASR. |

**1,728 → 24 candidate configurations, for $0.**

---

## Move 2 — Pair everything (the single biggest power gain)

Every arm runs on **the same videos**, not on independent samples. Video-to-video variance is by
far the dominant noise source here (a dense screen-recording and a 15-second meme are not
comparable units), and pairing removes it entirely from the comparison. This is the difference
between needing ~500 items and needing ~50 for the same sensitivity.

Consequences, all deliberate:
- analysis uses **paired** tests (Wilcoxon signed-rank / paired cluster bootstrap over per-video
  deltas), not two-sample tests;
- the harness already computes per-video cluster-bootstrap CIs — pairing plugs straight into it;
- scoring is mechanical and arm-blind (the scorer never sees which config produced a record), so
  no scorer bias is possible.

---

## Move 3 — Screen first, optimize second (sparsity of effects)

The design principle: in most systems a few factors dominate and high-order interactions are
rare. So spend a little to find out *which factors matter at all*, then spend the rest only on
those. Two phases:

### Phase 1 — Screening: one factor at a time from the shipped baseline · ~20 videos

**Baseline** = exactly what we ship: `flash-lite · native · HIGH · prompt-v2 · thinking-low · one-shot`.
Each arm changes **one** thing, so any difference is attributable:

| # | Factor varied | Arm | Why it's plausible (not a guess) |
|---|---|---|---|
| 0 | — | baseline | the reference |
| 1 | Model | 3.6-flash | bake-off found a real gap on dense on-screen UI text |
| 2 | Resolution | MEDIUM | cuts input tokens 60%; bake-off halved VISUAL_TEXT evidence |
| 3 | Prompt | terse-v3 | Gemini 3.x is documented to over-analyze verbose prompts |
| 4 | Prompt | v2 + platform metadata | metadata added narrow but real value (creator identity, caption-only entities) |
| 5 | Thinking | minimal | never tested; pure cost win if quality holds |
| 6 | Thinking | medium | tests whether we're under-thinking |
| 7 | Architecture | perception→extraction split | the structural bet (video paid once, free schema iteration) |

8 arms × 20 paired videos = **160 calls (~$3–6)**.

**Decision rule, pre-registered:** an arm advances only if its paired delta on the primary metric
exceeds the practical-significance threshold (§4) *and* survives Holm correction across the 7
comparisons. Everything else is eliminated and never re-tested.

### Phase 2 — Optimize: small factorial over survivors only · full 60-video gold set

Only the factors that actually moved the needle get combined. Realistically that's 2–3 factors →
**4–8 cells × 60 videos ≈ 240–480 calls (~$6–12)**. This is also where the **open-weight arm**
enters *if and only if* the split architecture survived Phase 1 — because Qwen3-VL can only be a
perception stage (Move 1), so testing it before knowing the split works would be wasted spend.

**Interactions, handled honestly.** One-factor-at-a-time's real weakness is that it misses
interactions. Rather than pretend otherwise, we pre-declare the two we have a *mechanistic* reason
to suspect and test them explicitly in Phase 2:
- **resolution × content type** — MEDIUM may be fine on talking-heads and catastrophic on screen
  recordings (the bake-off hints at exactly this);
- **model size × prompt verbosity** — a smaller model may degrade more on a long prompt.

---

## Move 4 — Analyze by stratum, not just overall (turns a tie into a routing rule)

The gold set is stratified (transcript present/absent, slideshow, duration terciles, content
buckets, hard slice). So every comparison is also run per-stratum. This is where the real product
value is: "flash-lite ties overall but loses badly on screen recordings" is not a tie — it's a
**routing rule** (cheap model by default, escalate the detectable hard class). A single global
winner is the least useful possible output of this exercise.

---

## The statistics, pre-registered before any run

- **Primary metric (co-primary, both pre-designated):** **Φ_c** (effective reliability: +1 correct
  ID, 0 for honest NIL, −10 for a confident wrong ID — this *is* the product's honesty bar as a
  number) and **strict mention F1** (normalized surface + type, Hungarian-aligned). Every other
  layer — concepts, facets, claims, structured, calibration — is reported but **descriptive only**,
  so we can't shop for a metric that flatters a preferred arm.
- **Practical significance declared upfront:** ≥3 points strict-F1 or ≥0.05 Φ_c. Differences
  smaller than that are treated as ties and decided on **cost**, not on noise.
- **Multiplicity:** Holm–Bonferroni across the 7 screening comparisons.
- **Uncertainty:** paired per-video cluster bootstrap (the harness already does this), reported as
  CIs on the *delta*, not as two separate point estimates.
- **Power honesty:** ~20 videos (≈60–100 mentions) can only detect *large* effects — which is
  exactly what screening is for. Small-but-real differences are explicitly out of scope until
  Phase 2's 60 items, and the methodology's ~1,000 mentions for a 3–5pt claim remains the bar for
  anything we *publish*. Screening results are directional, and will be labelled as such.

## Budget

| Item | Calls | Est. |
|---|---|---|
| Claude pre-annotation (60 videos, different family) | 60 | $3–8 |
| Phase 1 screening (8 arms × 20 paired) | 160 | $3–6 |
| Phase 2 factorial (survivors × 60) | 240–480 | $6–12 |
| Re-runs / open-weight arm / slack | — | ~$10 |
| **Total** | **~500** | **~$25–35** (ceiling $50) |

## What this buys, stated plainly

A defensible answer to "which configuration, and why" for roughly 0.5% of the full-factorial cost
— plus per-stratum routing rules, which are worth more than the global winner. What it does *not*
buy: publishable absolute accuracy (that needs the sealed ~350-item test), or confidence about
interactions we didn't pre-declare. Both limits are stated rather than papered over.
