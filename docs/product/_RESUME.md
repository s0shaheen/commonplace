# RESUME POINTER (read me first after a /clear)

**Operating contract now lives in `CLAUDE.md`** (repo root, auto-loaded) — three gates: **Frame** (size the move to the mandate; "continue" ≠ a subsystem), **Truth** (reason from the problem + prior art; verify own-system claims; don't anchor on old work), **Verdict** (self-critique to the bar; lead with a recommendation, not a menu). The `memory/` notes hold the *why*. This supersedes the old "method standard" that used to live in this file. (CLAUDE.md is a v1 pending the founder's standard review.)

## Where things stand (2026-07-06)

- **Product strategy is DONE and canonical:** the 10-doc dossier (`docs/product/00–09` + `README.md`) and the ground-up engine design (`docs/product/_ENGINE-groundup-2026-07-02.md`). Consume, don't re-litigate.
- **The analysis system was re-opened ground-up** (NOT the old throwaway Gemini-2.5 spike — see memory `[[analysis-engine-is-a-datapoint-not-the-plan]]`). Headline: the model is a swappable commodity; the moat is a model-agnostic **grounding module** + a six-axis **measurement harness**. Managed primary = Gemini 3.1 Flash-Lite; open-core engine = Qwen3-VL (Apache).
- **Built + live-proven:** the grounding module — `src/lib/grounding.ts` + `grounding.test.ts` (route → candidate-gen → select → confidence gate → NIL + provenance). MusicBrainz resolver resolves real corpus songs → real MBIDs and correctly NILs on TikTok "original sound". **61 tests green, tsc strict clean.** Demo: `scripts/ground-demo.ts`. *(Uncommitted, on `main` — filesystem persists across a clear; commit is the founder's call.)*
- **Hard constraint:** corpus media (video/audio/subtitle-text) was never persisted (expired signed URLs) — the video benchmark needs a fresh founder-in-loop re-capture. Metadata (incl. `music{name,author}`) is intact.
- **The full board:** an exhaustive **168-item branch map** across 8 workstreams → `docs/product/branch-map.json` + visual artifact: https://claude.ai/code/artifact/8804f895-137a-4644-beca-baab65d1fec1 — 3 done · 15 in-progress · 145 not-started · 5 blocked · **90 need founder input** · 16 open decisions · 27-step critical path · 7 risks.

## RESOLVED (2026-07-06) — the Gate-0 sequencing verdict + turnkey kit

Ran the dynamic execution workflow (13 agents, 0 errors): 4 prior-art readers → 4 candidate judges + 3 red-teamers → synthesis + kit. Verdict, verified against repo & math:

**Recruit-gated, floor-then-defer** — C4 with three repo-grounded patches. Dissolves the DOC-08-§5-vs-CRIT-08 fork by *sizing the word "build"*: §5 is right you need a **real running engine** for a persevere (not a slide deck); Cagan/CRIT-08 is right you must not gate all validation behind the L-effort INST-6. **The persevere instrument is the ~25–40h FLOOR, not INST-6** (~250–400h transitive tree the branch-map hid behind a node-local "40–70h"). Pure concierge is **declined as a standalone gate** (kill-only; its time-delta is invalid because *you* do the retrieval) — folded into Part A + offered as an optional demand-sniff.

The staged plan (full table + gates in **`_GATE0-kit.md`**):
- **Stage 0 · Recruit-feasibility [DEC-06] — the real cheap kill-front. Zero build, this week.** Can't get ≥5 qualified out-of-network heavy-savers → constraint is *access not product* → reroute to Export-Pass / agency.
- **Stage 1 · Ugly floor (parallel):** META-12 enrichment wire-in (~6–12h, a real integration not a rename — verified: no shell file imports `src/lib`; `content.js:66` imports only the 65-line `gemini.js`) + recipe extraction + minimum-fairness search UI + timer. **META-12 is ready-to-execute and worth doing regardless** (the tested engine is currently dead code).
- **Stage 2 · Part A + Part B paired test**, recipes wedge, own corpus captured live.
- **Stage 3 · Restaurant→Places moat probe (mandatory if recipes persevere).** ⚠️ **Recipes ground to themselves — verified `grounding.ts:148` only resolves `type==='media'`, so a recipe NILs and the engine's moat is entirely OFF the recipe path. A recipe pass validates the *pain*, not the *moat*.**
- **Stage 4 · INST-6 unbundled, node-by-node, each gated by a Gate-1 durability signal** — never up front.

**Metric settled** (resolves the live doc-02-vs-doc-08 contradiction): **within-subject paired time-to-find delta is primary; ~70% absolute rate demoted to a directional sanity floor** (a rate is uninterpretable at N=5–10; a one-tailed sign test on paired deltas is significant at 5/5, 7/8, 9/10). Signed-ready in **`_GATE0-preregistration.md`** — this is critical-path step 5; sign & date before session 1.

## Ball is in the founder's court — 2 confirms + 1 defer (see `_GATE0-kit.md` §Stage 0 / blockers)

1. **[DEC-06] Recruit-feasibility — the FIRST gate, needs your action, not a decision.** Can you name ≥5 qualified out-of-network recipe heavy-savers this week? (Recruit msg + screener are written and ready to send.)
2. **[DEC-02] Wedge — confirm only.** Recommended: **recipes first** (max-intensity painkiller, proven WTP, cheapest floor, cleanest decisive kill), **restaurants as the mandatory Stage-3 moat probe**. Override if wrong.
3. **Keys — deferred, don't block the recipe run.** Google Places billing key + price FACT-VERIFY only when the restaurant probe is greenlit. The recipe run needs no new key (Gemini key already in `src/secrets.js`).

Still open (unchanged): **`CLAUDE.md` standard review** (+ deferred FF1 frame-check hook); the leaked Supabase/OpenAI key rotation + un-versioned asset backup (risk #7, founder-only, this week); doc-02 line ~206 hygiene edit (demote the 70% line).

**No background workflows running.** Everything above is uncommitted on `main` (filesystem persists across a clear; commit is the founder's call).
