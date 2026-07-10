# Roadmap — from here to a launchable, showable Commonplace

> **Read `session-handoff.md` first, then this.** This is the single execution plan from now to the version Salman can install, demo, and put on his resume / website / a blog post / X. It sequences by **dependency and founder-gate, never by calendar** (the build is agentic; the only real bottleneck is Salman's decisions, provisioning, and taste). Progress is measured by phases committed with passing tests, not by time.

## The target: two milestones

**Milestone 1 — Showable.** A working extension that captures your saved TikToks, deeply understands and grounds them, shows them in a beautiful library with the provenance "receipt," exports freely, and answers your AI agent over MCP — backed by a **published accuracy page** (the moat), in a **clean public open-core repo** (the career artifact), with a **demo video + blog post**. This is what goes on the resume/site and gets posted. TikTok-first (it's already built); Instagram/X follow in Milestone 2.

**Milestone 2 — Full v1.** Instagram (ZIP + live, spike already passed) + X bookmarks, cross-device sync, the paid tier + money. Completes the decided v1 scope as fast-follows after the public launch.

## Where we are now (verified 2026-07-08)
- **Design & spec: done.** SPEC v5, `evaluation-methodology.md`, `knowledge-organization-standard.md`, `knowledge-ontology.md` v3 (stress-tested, 45 gaps folded), `schema-derivation-walkthrough.html` (the teaching/blog artifact).
- **Built & green:** `src/lib` engine + grounding module (61 tests), TikTok capture (8 tests), the 4,661-item corpus, 60 harvested eval videos.
- **Spikes passed:** IG-live interception, zero-knowledge sync (backend live in `attic-dev`), the (reframed) pipeline ablation.
- **Name:** Commonplace (G1 ✓).

---

## The phase sequence

Legend: **[AUTO]** = I run it end-to-end, no touchpoint. **[GATE]** = needs you (marked with what). Phases with no dependency between them can run in parallel.

### Milestone 1 — Showable

**Phase 1 — Freeze the schema + build the eval harness** · [AUTO]
Generate the JSON Schema + SHACL validation shapes from ontology v3; build the open-source matcher + per-layer metric harness; write the annotation guidelines. Output: the frozen contract everything else builds on.

**Phase 2A — Capture hardening + autopilot** · [AUTO] · *inserted 2026-07-09; gates Phase 2*
Rebuild the capture driver: honest `hasMore:false` completion (kills false-finish), human-cadence throttle-aware scroll, DOM-eviction + off-thread handoff (kills the 1k-slowdown / 3k-crash), decoupled media pass, and a resumable **Sync supervisor** with two self-driving modes (semi-auto default + autonomous opt-in) across all four sources. Plan: `docs/plans/2026-07-09-capture-hardening-and-autopilot.md`. Output: the founder's full TikTok library captures in one unattended run, no crash — **which produces the Phase-2 pilot corpus** (founder chose to wait for this tool rather than a hand-driven capture).

**Phase 2 — The pilot gold set** · [GATE: your spot-check] · *needs the corpus from Phase 2A*
Auto-label a ~150-video stratified pilot (using a *different* model family, per the method) into a fast review format; **you spot-check/adjudicate** (async, bounded — a few sittings). This is the one unavoidable data-judgment gate, and it produces the first real accuracy numbers *and* sets which entity/concept/structured types v1 populates (data decides, not a guess).

**Phase 3 — Wire the engine into the extension** · [AUTO · needs Google Places key] · *runs parallel to 1–2*
Wire `src/lib` into the MV3 shell end-to-end (capture → analyze → ground → library-data → export); resumable offscreen queue; storage + eager posters; both engine lanes; Wikidata + Places resolvers join MusicBrainz; open-schema export; promptfoo eval in CI; submit the early minimal CWS dry-run listing. Output: a real capture flows all the way through, untouched by hand.

**Phase 4 — Tune the engine + run the ablation** · [AUTO]
Iterate the extraction prompt on the dev set against the harness; run the (now valid) native-vs-VTT ablation. Output: the tuned engine + the settled ingestion path + the accuracy numbers for the page.

**Phase 5 — The library + design system** · [GATE: G2 design pick] · *the critical-path gate*
You finish the Claude Design sprint and pick a direction. Then: the design system/tokens/kit; the library (grid at 60fps, item detail, the **provenance-strip signature**, cmdk search, entity lenses, This-Week shelf, onboarding, every empty/loading/error state). Output: the beautiful, demo-able library.

**Phase 6 — The personal MCP** · [AUTO]
The local MCP server over the library (`search_library` / `get_entity` / `resolve_item` / `list_by_type`). Output: the "map every restaurant in my saves" demo beat working in Claude Desktop.

**Phase 7 — Public artifacts (the moat, made visible)** · [AUTO]
Synthetic fixtures (replace real usernames); secret scan; fresh **public open-core engine repo** (the app consumes it); published eval harness; **THE ACCURACY PAGE**; schema docs site (the derivation piece as a blog post). Output: the public repo + accuracy page.

**Phase 8 — Career layer + launch** · [GATE: writing voice + press publish]
Demo video (the 90-second arc on the real corpus); the "how it's built" essay; the design case study; a recruiter one-pager; the X thread + Show HN + Reddit drafts; the full CWS listing. You give a writing-voice sample and approve/publish. **→ Milestone 1 done: install it, demo it, put it on the resume/site, post the blog + X + Show HN.**

### Milestone 2 — Full v1 (fast-follows)
**Phase 9** — Instagram (ZIP + live) + X bookmarks · [AUTO · needs your TikTok/IG "Download Your Data" ZIPs].
**Phase 10** — Cross-device sync (productionize the passed spike) + the paid tier + billing · [GATE: G3 price sign-off].
**Phase 11** — Broader launch (Edge/Firefox, wider platform coverage, ongoing accuracy publishing).

---

## The critical path (what actually gates the showable milestone)
Two of your inputs are the long poles; everything else I run:
1. **Finish the Claude Design sprint → pick G2.** This unblocks Phase 5 (the library), which is the biggest showable piece. Highest-leverage thing you can do.
2. **The pilot spot-check (Phase 2).** Your data judgment; it feeds the accuracy page (the moat). I'll hand it to you in the fastest-to-review form I can build.
Do those two promptly and the showable milestone assembles quickly behind them.

---

## Your one-time punch-list (batch it, and I can run nearly end-to-end)

**Provisioning:**
- [ ] Register `commonplacehq.com` + `usecommonplace.app` (in progress).
- [ ] **Google Places API key** (Google Cloud Console, billing on) — needed for place grounding (Phase 3). I'll keep it SKU-disciplined.
- [ ] **Chrome Web Store developer account** ($5 one-time) — for the listing (Phase 3/8).
- [ ] Drop the **TikTok "Download Your Data" ZIP** into the repo when you can (feeds Phase 9; also a second cross-check corpus).
- [ ] Keep the **Claude Chrome extension connected** + TikTok/IG logged in (for capture testing).
- [ ] (I can do this) A prod **Supabase** project for Commonplace, or reuse `attic-dev` — say which.
- [ ] (Later, deferred) An OSS-inference account (Together/Fireworks/HF) once the local lane is pinned.

**Decisions that remove gates (pre-make these to maximize autonomy):**
- [ ] **G3 prices:** either pre-approve the recommended card (Free · $39 one-time Deep Scan · $7/mo managed) or say "defer money until after launch." Recommend deferring — it's not needed for the showable milestone.
- [ ] **Writing voice:** paste a sample of your own writing (a post, an essay — anything) so the blog/X/essay sound like you, not like an AI.
- [ ] **v1 populate-cut:** no decision needed — it's set by the Phase-2 pilot data, per the method.

---

## Orchestration + how we stay on track
- **This file is the track.** Every session (including a fresh one after a clear) reads `session-handoff.md` → this roadmap → picks up the next unchecked phase. No calendar to slip; the plan is the state.
- **How I run each phase:** autonomous phases run as multi-agent workflows or focused build sessions, each ending with a **committed, test-passing, reviewable artifact** and a one-line status update to the `## Status log` below. Progress is always verifiable (green tests, a working capture, a rendered page), never a claim.
- **Gates are surfaced, never silent.** When a phase needs you, it lands in the punch-list above with exactly what's needed. Nothing stalls without you seeing why.
- **Autonomous-run option (the "ongoing run"):** once the punch-list is cleared and G2 is picked, a fresh session can drive Phases 1→8 in sequence — running each autonomous phase to completion, pausing only at the two gates. Ask for it explicitly ("execute the roadmap") and it self-paces through, updating the status log as it goes.

## Status log (newest first — update one line per phase)
- 2026-07-10 · Capture live test + RESILIENCE AUDIT → new governing spec. Live run proved the crash fix (1,437 items, flat heap/DOM, hasMore read) but exposed the core defect: the scroll MOTION (`nudgeToBottom` teleport) fails to re-trigger TikTok's IntersectionObserver → misread as a rate-limit → false giveup (NOT actually rate-limiting — founder correction). A 16-agent audit (`capture-resilience-audit`, 1.5M tokens) then mapped the full surface: **28 ranked failures (4 critical) · 17 overlooked gaps · 18 missing capabilities**, grounded in GitHub/SO prior art. Governing spec = `docs/specs/capture-resilience.md`; ordered build = `docs/plans/2026-07-10-capture-resilience-plan.md`. **Next = Wave A** (scroll-motion engine · storage self-heal · idempotent alarm · honest completion) — the gate to a trustworthy live run, which also produces the Phase-2 pilot corpus. (Dev DB was corrupted by my inspection probes; clean extension remove+reload resets it before the Wave-A proof.)
- 2026-07-09 · Phase 2A CODE COMPLETE (Tasks 0-5 + whole-branch review + pre-live safety wave; 248 vitest + 8 capture + AUDIT PASS) — capture rebuilt: honest `hasMore:false` completion (kills false-finish), human-cadence pacing (dodges the ~360 throttle), DOM tile eviction + slim off-thread handoff (kills the 1k-slowdown/3k-crash), decoupled resumable poster pass, and a Sync supervisor with semi-auto (default) + autonomous (opt-in) modes, resumable across SW death. Adversarially verified: no failure path can fabricate a "done" or lose captured data. **Remaining: the live proof run on the founder's real library** (`docs/plans/2026-07-09-capture-live-proof-run.md` — load `dist/` unpacked, click Sync, watch heap/DOM stay flat) → then SPEC §7 update + this capture produces the Phase-2 pilot corpus. Extension built to `dist/`.
- 2026-07-09 · Phase 3 COMPLETE (final whole-branch review passed after one fix wave) — engine wired into MV3 end-to-end: frozen-contract migration, esbuild toolchain, IndexedDB library + eager posters, Gemini/Ollama lanes (keyframes+VTT provisional default, native flag off), MusicBrainz+Wikidata+flag-gated-Places grounding w/ honest NIL, kill-surviving offscreen queue, open-schema export Ajv-validated against rc.6 (per-record extractor_ref provenance), promptfoo replay slice + 3-job CI, submit-ready CWS dry-run package + key-exposure audit. 145 vitest + 8 capture + 198 pytest green. Founder queue: ratify per-record extractor_ref ruling · contact email · listing "Search" forward-claim · live Chrome smokes · Places key · CWS account. Next: Phase 2 pilot prep (spot-check gate) and Phase 4 (prompt tuning + ablation).
- 2026-07-09 · Repo professionalized at founder direction — renamed to `commonplace` (GitHub + package), docs restructured to strategy/specs/research/decisions/plans/archive with enforced kebab-case naming, decision log added (DEC-001..028), all 32 commits pushed. Founder briefing artifact published. P3 Task 7 (export) pending re-dispatch after spend-limit interruption.
- 2026-07-08 · Phase 1 COMPLETE (final review passed) — schema frozen (JSON Schema 1.0.0-rc.5 + SHACL base/TikTok + JSON-LD context + facet vocab), eval harness green (194 tests: Hungarian MUC-5 matcher, per-layer matrix, Φ_c w/ trap penalties, cluster-bootstrap CIs, calibration), construct.md + guidelines.md codebook. Carry-forwards into Phase-2 prep: signals[] object (ontology §4, additive rc.6) · QID-hub slot + book-authority pin in gold · free-tag notes home · $id domain confirm at 1.0.0. Next: Phase 3 wiring + Phase 2 pilot prep.
- 2026-07-08 · Roadmap written; foundation (spec, eval method, standard, ontology v3, derivation) complete and committed; awaiting punch-list + G2 to begin Phase 1/3.
