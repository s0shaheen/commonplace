# RESUME POINTER (read me first after a /clear)

**Operating contract now lives in `CLAUDE.md`** (repo root, auto-loaded) — three gates: **Frame** (size the move to the mandate; "continue" ≠ a subsystem), **Truth** (reason from the problem + prior art; verify own-system claims; don't anchor on old work), **Verdict** (self-critique to the bar; lead with a recommendation, not a menu). The `memory/` notes hold the *why*. This supersedes the old "method standard" that used to live in this file. (CLAUDE.md is a v1 pending the founder's standard review.)

## Where things stand (2026-07-06)

- **Product strategy is DONE and canonical:** the 10-doc dossier (`docs/product/00–09` + `README.md`) and the ground-up engine design (`docs/product/_ENGINE-groundup-2026-07-02.md`). Consume, don't re-litigate.
- **The analysis system was re-opened ground-up** (NOT the old throwaway Gemini-2.5 spike — see memory `[[analysis-engine-is-a-datapoint-not-the-plan]]`). Headline: the model is a swappable commodity; the moat is a model-agnostic **grounding module** + a six-axis **measurement harness**. Managed primary = Gemini 3.1 Flash-Lite; open-core engine = Qwen3-VL (Apache).
- **Built + live-proven:** the grounding module — `src/lib/grounding.ts` + `grounding.test.ts` (route → candidate-gen → select → confidence gate → NIL + provenance). MusicBrainz resolver resolves real corpus songs → real MBIDs and correctly NILs on TikTok "original sound". **61 tests green, tsc strict clean.** Demo: `scripts/ground-demo.ts`. *(Committed + pushed 2026-07-06.)*
- **Hard constraint:** corpus media (video/audio/subtitle-text) was never persisted (expired signed URLs) — the video benchmark needs a fresh founder-in-loop re-capture. Metadata (incl. `music{name,author}`) is intact.
- **The full board:** an exhaustive **168-item branch map** across 8 workstreams → `docs/product/branch-map.json` + visual artifact: https://claude.ai/code/artifact/8804f895-137a-4644-beca-baab65d1fec1 — 3 done · 15 in-progress · 145 not-started · 5 blocked · **90 need founder input** · 16 open decisions · 27-step critical path · 7 risks.

## STATE (2026-07-06) — validation dropped; Fable brief v4 is the single governing spec; Phase 1 done

Gate-0 consumer-validation (wedge/recruiting/retrieval kill-test) is **dropped** (founder called it over-engineered). Direction: hand **Fable** the brief; it converges a **build-ready plan** (not code) for the **full v1**, with real feasibility spikes.

- **`docs/product/_FABLE-BRIEF.md` (v4) is THE governing spec.** It folds the Phase-1 findings + all ratified decisions into one coherent doc (supersedes v3, the v2 brief, doc 09). Evidence trail = `_FABLE-PHASE1-findings.md`. Engine design = `_ENGINE-groundup` (now governing per D2). **Consume v4, not the scattered earlier docs.**
- **Phase 1 ran** (6 Claude Fable 5 agents, `walqy2twr`): grounded + pressure-tested v3 vs 2026 reality → 18 holds / 11 shaky / 8 contradicted / 15 decisions. Verdict **GO for Phase 2** — spine holds, every gap has a cheap fix.
- **Founder ratified:** D4 (IG = **ZIP-primary + spike-gated live**), D5 (agency = **split; personal MCP in v1, bulk API deferred**). **D9 THROWN OUT** — no timelines/effort estimates (build is agentic; the scarce resource is founder decisions, not hours). The ~9 evidence corrections folded into v4: 3.1-Flash-Lite economics (2.5 dies Oct 2026); **two-lane engine** (Qwen-local / Gemini-hosted); **drop TMDB+Spotify APIs → Wikidata+MusicBrainz**; moat = payload+published-accuracy (MCP is table-stakes; distribution demoted); Quiki = deepest competitor; extension-hosted library + code-SoT + View Transitions + Base UI; WXT + Edge/Firefox; in-house zero-knowledge sync; promptfoo eval + re-stratified golden set; telemetry = 3-plane + opt-in.
- **Security:** the exposed-Gemini-key `web_accessible_resources` hole was **found + fixed + pushed** (`0cf04e3`). **Founder must ROTATE the key.** (Alt+Shift+E enrichment disabled as a result — a spike path being replaced.)

**Repo:** `github.com/s0shaheen/attic` (private, pushed). Corpus = real **4,661-item** source-tagged capture registered as the dev corpus. `attic-saas`/`attic-sandbox` archived.

## Next move: Phase 2 — build the plan from v4

Fable Phase 2 (a gated multi-agent run, phase-per-workflow) opens by **running the three spikes** (live-IG interception · zero-knowledge sync · native-video-vs-VTT pipeline experiment), then converges the build-ready, dependency-sequenced plan + designs + name shortlist. Founder gate between each block.

**Provisioning it needs (parallel; corrected per D3):** 🔴 rotate the Gemini key · a logged-in **IG session** + **DYD ZIP** for the spike. 🟡 **Google Places** key (billing, SKU-disciplined) · Twelve Labs free acct · OSS-inference acct once Fable pins the local model · a backend sandbox (Vercel+Supabase MCPs) · CWS dev acct + domain. **No TMDB/Spotify keys.** 🟢 name pick from Fable's shortlist + design taste gut-checks. (Optional hygiene: GitHub private-contrib toggle; `CLAUDE.md` standard review.)

**No background workflows running.**
