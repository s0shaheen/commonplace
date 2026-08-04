# Model cost + BYOK connector verdict — 2026-08-04

> Prompted by a founder review: "model usage costs too much for whole-collection import; is BYOK the answer; is there a connector-style key flow; did we already decide this?" This doc answers from two sources: the repo's own recorded decisions/benchmarks (cited by file), and live web research dated 2026-08-04 (cited by URL). **Nothing here re-opens a settled decision — it confirms the settled decision still holds at today's prices and adds one new fact (OpenRouter PKCE) to the BYOK UX.** Founder ratifies the two proposed DEC entries at the end or strikes them.

---

## 1. The remembered problem is not the recorded problem

The trigger for this review was a remembered benchmark: *"$37 for 5,000 videos on Gemini 2.5 Flash."* That number appears nowhere in the repo. What is actually recorded:

| Recorded figure | Source |
|---|---|
| **~$3.7** — 5k items, tiered ladder, Batch API, 2.5 Flash-Lite | `docs/archive/dossier/04-engine-analysis-architecture-eval.md` §5.6 |
| **~$10** — 5k items, full visual pass, non-batch upper bound | same table, footnote [c] |
| **$12.11** — 5k-item Deep Scan batch COGS on 3.1 Flash-Lite, vs the $39 SKU (65% margin) | `docs/research/2026-07-06-refounding-research.md` §unit-economics |
| **~$40–70** — a **20k**-item backfill, batch, 3.1 Flash-Lite | `docs/archive/superseded/fable-phase1-findings.md` |
| Measured: **~$0.002/clip native, ~$0.0003/clip keyframes+VTT** (54 real clips, 2026-07-07) | `spikes/pipeline/RESULT.md` |

The likely memory collision is the $39 Deep Scan *price* (revenue, not cost) or the ~$40 *20k* upper bound, remembered as a 5k cost. **At the recorded architecture, whole-collection import is not objectively too expensive — it is the margin engine of the business model.** A 5k Deep Scan sold at $39 costs ~$12–13 to serve (verified again at today's prices, §3).

Also a naming correction that matters: the app has never run on **2.5 Flash**. It is pinned to **2.5 Flash-Lite** (`src/lib/config.ts:41`), a ~7× cheaper model. Any remembered sticker shock from "Flash" pricing does not describe the shipped pipeline.

## 2. This was already decided — the decision stack, restated

Per the decision log and governing spec, all four questions in this review were answered in July:

1. **Model: pinned `gemini-2.5-flash-lite`, migrate to `gemini-3.1-flash-lite` "the day it ships"** (SPEC §15, reality-check 2026-07-07). The model is a commodity; the grounding module and measurement are the moat (`docs/research/2026-07-02-engine-groundup-analysis.md`).
2. **Cost architecture: tiered ladder + mandatory Batch API (−50%).** ~50% of items resolve at the text tier (caption/VTT only, ~$0.0006 batch), ~50% escalate to the visual tier, ~15% of those escalate again to a verify tier. Batch integration "must ship with the paywall, not after it" — margin falls 65%→34% without it (`2026-07-06-refounding-research.md`).
3. **BYOK: decided 2026-05-27 and already shipped.** Keys live in `chrome.storage.local` via the options page; free tier is BYO-key at zero markup (SPEC §17; `results/0.8-spike-decision.md`; DEC-022).
4. **Quality worry ("Flash-Lite output isn't detailed enough") is an open hypothesis, not a finding.** The one experiment that compared output quality was **retracted as a decision instrument** (DEC-003; no ground truth, incoherent matcher). The legitimate ablation is Phase 4, run through the validated eval harness. Until it runs, "not enough value in the output" is untested — and it has never been tested on 3.1 Flash-Lite at all, which is the model the spec actually targets.

**Verdict on the rabbit hole: closed. The path forward was already designed; the correct move is to execute it, not re-derive it.** Two facts have changed since July, and both make the plan better, not worse — see next.

## 3. What changed since 2026-07-07 (live research, 2026-08-04)

**(a) `gemini-3.1-flash-lite` went GA on 2026-05-07** *(the July reality-check pre-dated its visibility on the rotated key or the note is stale — either way it is GA now)*, and **`gemini-2.5-flash-lite` — the pinned model — retires 2026-10-16**. The "migrate the day it ships" decision is ~3 months past due and becomes forced in ~10 weeks. Migration is one config line by design (`src/lib/config.ts:41`).

**(b) Current price ladder** (ai.google.dev/gemini-api/docs/pricing, fetched 2026-08-04; per 1M tokens, standard / batch):

| Model | Input | Output | Role in our ladder |
|---|---|---|---|
| 2.5 Flash-Lite (dies 10-16) | $0.10 / $0.05 | $0.40 / $0.20 | current pin — exit |
| **3.1 Flash-Lite (GA)** | $0.25 / $0.125 | $1.50 / $0.75 | **new pin: text + visual tiers** |
| 3.5 Flash-Lite | $0.30 | $2.50 | skip — worse $/quality than 3.1 FL for our schema-constrained call |
| 3.6 Flash | $1.50 / $0.75 | $7.50 / $3.75 | verify/escalation tier only (~10–15% of items) |
| 3.1 Pro | $2.00 / — | $12.00 / — | eval/golden-set labeling only; never the pipeline |

Re-derived Deep Scan COGS at today's prices, same token model as dossier 04 (~11k in / 1.5k out visual; ~1.5k/0.5k text), batch, tiered, **with the verify tier upgraded to 3.6 Flash** (this is the direct answer to "the cheap model's output isn't rich enough" — buy 3.6-Flash quality on the hard 10–15%, not on everything):

- 5k items ≈ 2.5k × $0.0006 (text, 3.1 FL) + 2.5k × $0.0025 (visual, 3.1 FL) + ~375 × $0.014 (verify, 3.6 Flash) ≈ **$13/5k → 67% margin on $39.** NF1 (≤$40 per 20k tiered) still holds: 20k ≈ $52 with the 3.6-Flash verify tier, ~$31 with 3.1-FL verify — the knob is the escalation rate, and it is config, not code.
- Running **everything** on 3.6 Flash batch would be ~$70/5k — that is the "objectively too expensive" scenario, and the ladder exists precisely so we never do it. 3.1 Pro on everything (~$200/5k) likewise.

**(c) Free-tier note for BYOK:** Flash-Lite-class models keep a real standing free quota on AI Studio keys (order of 10²–10³ requests/day; Google cut free tiers in Dec 2025 and the authoritative numbers now live only in the AI Studio dashboard). Treat BYOK free tier as a bonus for patient users (a 5k import trickling over days), never as promised capacity. Also: Google requires migration of standard keys to "auth keys" by **Sept 2026** — the options-page help text should say "create an API key in Google AI Studio" and link the current flow; no code change expected (`x-goog-api-key` header unchanged).

## 4. The connector question: does one-click key provisioning exist?

**For Google directly: no, and it is moving the wrong way.** There is no OAuth/connector flow that provisions a Gemini API key for a third-party app. Google *ended* consumer OAuth access for third-party tools (Gemini CLI "Login with Google", June 2026) and is tightening key handling (auth-key migration, Sept 2026). Copy-paste from AI Studio is, and will remain, the only Google-direct BYOK path. The founder's instinct ("why doesn't this exist?") is correct — it doesn't, for Google.

**But the exact thing wished for exists one layer up: OpenRouter's OAuth PKCE flow** (openrouter.ai/docs — OAuth PKCE). The app redirects the user to OpenRouter, they log in / sign up and click Authorize, and the callback returns a **freshly provisioned, app-scoped API key** — no copy-paste, works from an extension/SPA with no server secret (S256 PKCE). OpenRouter serves the Gemini models at provider passthrough pricing plus ~5% credit fee, and the user can cap spend on their side. Trade-offs, stated: adds a middleman to a trust-first product (mitigable: it's opt-in, clearly labeled, key stays in `chrome.storage.local` like the Gemini key); no Batch API through OpenRouter (irrelevant — batch is only used by the *hosted* Deep Scan lane on the founder's own Google key); model IDs differ (`google/gemini-3.1-flash-lite`), a ~20-line lane variant on the existing OpenAI-compatible shape.

**Verdict: three key paths, one product story.**
1. **Hosted credits / Deep Scan ($39)** — zero-friction default for normal humans; founder's key + Batch API; this is the business.
2. **"Connect a key" one-click (OpenRouter PKCE)** — the wizard UX for BYOK users who won't touch AI Studio; new, small, post-M1 work.
3. **Paste an AI Studio key** — already shipped; the power-user/free-tier path; keep as-is.

Local models stay exactly where the spec put them (Qwen3-VL via Ollama, VTT-only v1, DEC-018) — a lane for tinkerers, not the answer to import economics; no change.

## 5. Roadmap position — what this does and does not change

**Nothing in this verdict is the current bottleneck.** The roadmap's next block is **Wave A (capture resilience)** → Wave-A live proof run → Phase 2 pilot corpus → Phase 4 ablation (`docs/strategy/roadmap.md`, `session-handoff.md`). Model economics were never the blocker; capture is. Extension: CWS package is submit-ready, not submitted (M1 work). ZIP importers (TikTok DYD + IG): decided and specced (G4, 2026-07-07) as the guaranteed fallback lane, scoped for Block 3 / Phase 9 — retained, not yet built; no change to that sequencing.

Actions that fall out of this review, in order:

| # | Action | Size | When |
|---|---|---|---|
| 1 | Flip `managedModel` pin → `gemini-3.1-flash-lite`; re-run eval + smoke on the rotated key | 1 line + a re-run | now (forced by 10-16 retirement; already decided) |
| 2 | Phase 4 ablation adds one arm: 3.1 FL vs "3.1 FL + 3.6-Flash verify tier" on the golden set — settles the "enough detail?" hypothesis with the instrument, not vibes | config, not code | Phase 4 as scheduled |
| 3 | OpenRouter PKCE "Connect a key" button + lane variant | ~1–2 days | post-M1, with paywall/Phase 8 |
| 4 | Batch API integration (already decided: ships with the paywall) | real work | Phase 8, unchanged |
| 5 | Options-page help text → AI Studio auth-key flow | copy edit | with #1 |

**Proposed DEC entries (founder ratifies):**
- *DEC-025:* Model pin migrates to `gemini-3.1-flash-lite` (GA 2026-05-07; 2.5 FL retires 2026-10-16). Executes the standing SPEC §15 decision; not a new decision.
- *DEC-026:* BYOK gains a second, one-click path via OpenRouter OAuth PKCE at zero markup, post-M1. Google-direct copy-paste remains; hosted lane unaffected.

---

*Live-web sources (2026-08-04):* Gemini pricing — ai.google.dev/gemini-api/docs/pricing; 3.1 Flash-Lite GA + 2.5 FL retirement — ai.google.dev/gemini-api/docs/changelog, /docs/deprecations; auth-key migration — ai.google.dev/gemini-api/docs/api-key; OpenRouter PKCE — openrouter.ai/docs/guides/overview/auth/oauth; OpenRouter BYOK/fees — openrouter.ai/docs/use-cases/byok. Repo sources cited inline.
