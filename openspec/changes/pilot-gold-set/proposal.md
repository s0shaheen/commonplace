# Proposal — pilot-gold-set

## Why

We are four engine decisions deep with no instrument: model choice (flash-lite shipped on a cost
argument, not a quality one), `media_resolution` HIGH vs MEDIUM, one-shot vs perception/extraction
split, and hosted vs open-weight. Every one is a quality tradeoff currently decided by argument.
DEC-003 forbids exactly this ("instrument before experiment"). The eval harness already exists and
is green (198 pytest: Hungarian MUC-5 matcher, per-layer scorecard, Φ_c, cluster-bootstrap CIs,
calibration) — **what is missing is the gold data it scores against.** This change produces it.

The founder has granted standing permission (2026-07-27) to benchmark models, prompts, and
architectures freely **once the gold set exists**. So this is the single blocking artifact for
all remaining engine work, and it is scoped to unblock that fastest.

## What changes

**Staged, to respect the one genuinely scarce resource (founder adjudication time):**

- **Stage 1 — the dev slice (~60 videos), the unblock.** Enough for *paired* model/prompt
  comparison (A-vs-B on identical items is far more powerful than absolute accuracy estimates).
  This is what lets benchmarking start.
- **Stage 2 — scale to the methodology's dev ~150** for stable absolute figures and ablations.
- **Stage 3 — the sealed test ~350**, opened once, for the published accuracy claim. Not now.

**Built here (all of Stage 1's apparatus):**
- **Stratified sampler** over the real corpus on the axes the methodology names: VTT-present vs
  absent, slideshow vs video, duration terciles, entity-type coverage, plus a deliberately seeded
  hard slice (cover songs, chain restaurants, ambiguous titles) and the dark-matter/no-caption bucket.
- **Pre-annotation with a different model family (Claude, not Gemini)** — the methodology's
  anti-correlated-error requirement. Suggestions only; never gold on their own.
- **A local review tool** (self-contained HTML, keyboard-driven) that loads suggestions, lets the
  founder confirm/correct/add per item, opens each candidate ID's authoritative record for
  verification, and writes gold JSONL in the harness's existing schema. Chosen over Argilla /
  Label Studio deliberately: no deployment, no account, no video-player plumbing — the founder's
  time is the constraint, and this is the shortest path from "open a file" to "labelled."
- **Bias controls from §5:** a blind-from-scratch subset (15–20%, no pre-labels) to measure
  pre-annotation recall suppression, and the hooks for a later test-retest pass.
- **ID verification at label time** — MusicBrainz / Wikidata / Places records opened and confirmed,
  with the name/address/lat-lng snapshot and KB snapshot dates stored per label (IDs go stale).

Non-goals: the sealed test set; inter-annotator (needs other people); the LLM-judge for the claim
layer (stays "in calibration"); any model/prompt decision — this change builds the ruler, it does
not use it.

## Capabilities

- **New capability**: `evaluation` — how the gold set is sampled, pre-annotated, adjudicated, and
  turned into a scored per-layer report.

## Impact

- New: `eval/gold/` (the sampler, the pre-annotation runner, the review tool, the gold JSONL), all
  feeding the existing `commonplace_eval` harness unchanged.
- Requires: an **Anthropic API key** (the different-model-family pre-annotator — a methodology
  requirement, not a preference), and bounded founder adjudication sittings.
- Invariants: gold is NEVER built from the union of system outputs (pooling bias inflates recall);
  every ID confirmed against its authoritative record, never accepted on name similarity;
  dev/test stay eyes-off separated.
