# RESUME POINTER (read me first after a /clear)

> **⚠ LOCAL PATH (2026-07-10):** the repo is at **`~/Dev/attic-extension`** (it was briefly renamed to `~/Dev/commonplace` on 2026-07-09 then renamed back). Remote: `github.com/s0shaheen/commonplace`. **Gotcha:** the running dev browser's profile (with TikTok/IG logins + the extension's IndexedDB) lives at **`~/Dev/commonplace/.dev-profile`** because `npm run dev:browser` was launched while the repo was at that path — do NOT delete `~/Dev/commonplace`; it holds that live profile. Recommend the founder pick ONE directory name and stop flipping it (the flip orphaned files + split the dev-profile from the repo). Memory project dir stays keyed to `-Users-s0shaheen-Dev-attic-extension`.

**Operating contract lives in `CLAUDE.md`** (repo root, auto-loaded) — Frame / Truth / Verdict. The `memory/` notes hold the *why*.

> ## ▶ EXECUTION PLAN: `docs/strategy/roadmap.md`
> After reading this pointer, go to the roadmap — it's the single from-here-to-launch plan (phases, founder gates, the provisioning punch-list, how to run it). To drive the build, say **"execute the roadmap"**. Governing spec = `docs/specs/product-specification.md`; schema = `knowledge-ontology.md` v3; eval = `evaluation-methodology.md`; standard = `knowledge-organization-standard.md`.

## STATE (2026-07-06, evening) — the re-founding is done; SPEC v5 governs; next = BUILD

**`docs/specs/product-specification.md` (v5) is THE single governing document.** Written by Fable from intention down at the founder's directive ("start with the intention and work your way from there… get this whole thing ready to just go and build"). It supersedes `archive/superseded/fable-brief-v4.md` (v4) and everything before it. A build session starts at product-specification.md and should not need to re-decide anything.

What SPEC v5 settles (evidence: `2026-07-06-refounding-research.md`, 7 Fable research tracks, 2026-07-06 + `archive/superseded/fable-phase1-findings.md`):
- **Intention layer:** the humanist thesis as 5 architectural commitments; three founder goals resolved (trust/craft > usefulness > revenue); five measurable best-in-class bars.
- **Name (G1 pending):** **Commonplace** — "A commonplace book for the video age" (availability-checked; shortlist + collision scans in the research file). Attic stays as repo codename until G1.
- **Prices (G3 pending):** Free (100 hosted signup credits) · **$39 Deep Scan** (5,000 never-expiring credits, Batch API, ~65% GM; top-up $10/2k) · **$7/mo / $60/yr Managed** (annual includes one Deep Scan). Paywall line: "You pay for our compute and our servers — never for your data."
- **Design (G2 pending):** **Paper & Proof** — Literata + IBM Plex Mono, no grotesque sans, rubrication-red accent, oklch tokens specified, motion constitution, provenance strip as the signature component, design constitution checked into repo.
- **Distribution (corrected):** CWS search PRIMARY (myfaveTT proves the intent at 100k installs) · Reddit ignition SECONDARY (r/DataHoarder, Karakeep-shaped) · published-eval + one Show HN TERTIARY · **Product Hunt = zero hours** · doorways in miniature only (2–4 real utility pages).
- **Demo arc:** scripted 90s (capture-posture first, receipts + NIL beat, "map every restaurant in my saves" via MCP — the query Quiki's text-blob MCP can't answer).
- **Build sequence:** Block 0 spikes (IG-live · zero-knowledge sync · native-vs-VTT) → 1 artifact core → 2 library+design system → 3 platforms → 4 sync+money → 5 MCP → 6 public artifacts (accuracy page BEFORE launch) → 7 launch. Gates G1–G5. **No timelines anywhere, ever.**

**Verified this session (2026-07-06):** 61/61 engine tests · 8/8 capture tests · corpus = 4,661 items (fav 1,367 / likes 4,132 / posts 2; ∩ 840) · live grounding demo re-run (berlioz → MBID conf 1.00; 7 honest NILs).

## Next move: BUILD — Block 0 (in motion since 2026-07-06 evening)

## ▶▶▶▶ CURRENT (2026-07-13): TRUE ROOT CAUSE FOUND + FIXED — trusted-scroll is the moat; needs live verify

**The real bug, live-confirmed on the founder's logged-in TikTok (via claude-in-chrome):** TikTok's profile grid ignores ALL programmatic scrolling — `window.scrollBy`, `scrollTop=`, `scrollIntoView`, AND synthetic `WheelEvent` all move it **0px**. Only a REAL TRUSTED wheel scrolls it (a trusted wheel flew the grid 32→110 tiles in ~5s, smooth). This is why capture always "had to be pushed along by hand" — the extension physically could not move TikTok. All the pacing + continuous-scroll work was polishing a scroll that never landed. (Full story: memory `scroll-must-be-continuous-fast.md`.)

**THE FIX — BUILT + COMMITTED (140f4c7), founder-ratified as THE MOAT:** trusted wheel events via `chrome.debugger`. The SW attaches the debugger to the capture tab and runs a trusted-wheel pump (`Input.dispatchMouseEvent` mouseWheel, 30ms cadence), steered by the content-script observer's `scroll_mode` messages. All the brains stayed (scrollDrive/overlay/session-recovery/completion/preflight). Cost the founder accepted: the "Commonplace started debugging this browser" banner (`debugger` permission). Detach-safety on every exit path is load-bearing. 365 vitest green, tsc/build/audit clean.

**FOUNDER RULING (2026-07-13):** trusted-scroll = the moat, pick away at it, do NOT give up, do NOT fall back to DYD. **DYD ZIP import = a 2nd lane alongside** (task queued; needs the actual TikTok export format).

**▶ NEXT = LIVE VERIFY (blocked on env only):** needs a browser with BOTH our extension loaded AND a logged-in TikTok. Neither browser has both right now (main Chrome = logged in, no extension; dev browser `:9222` = extension loaded, logged OUT). Unblock: log the dev browser into TikTok, OR Load-Unpacked `dist/` into main Chrome. Then drive Sync and verify: the debugger banner appears on Sync and ALWAYS clears on run-end; the grid actually scrolls + count climbs fast/smooth; opening DevTools mid-run ends the run with a reason (not a hang). WATCH: does `hold` at the frontier stall loading? if so map hold→slow-wheel.

**Also this session:** README rewritten (lowercase, dev-first, de-slopped — 3fb173c). Folder-rename (`attic-extension`→`commonplace`) has a verified safe script (run with Claude CLOSED; copy `~/.claude/projects/-Users-...-attic-extension/` to the `-commonplace` key FIRST — that copy was the missing step that orphaned history last time; then clear the `~/Dev/commonplace` collision holding the live `.dev-profile`, `mv`, `git worktree repair`). Full script was delivered to the founder in-chat.

---

## (superseded 2026-07-13) 2026-07-10 late: WAVE A CODE COMPLETE — resume at the LIVE PROOF

**Wave A (the 4 capture criticals + overlay + session recovery) is CODE COMPLETE and committed (36c671a..5a15e71), NOT yet live-proven.** Built via the SDD loop (4 parallel Opus core implementers → Fable review each → Opus integrator → adversarial Fable whole-wave review → Opus fix wave → Fable re-review). 337 vitest green · tsc clean · build clean · AUDIT PASS. Full close-out + the LIVE-WATCH checklist are in `.superpowers/sdd/progress.md` (the "WAVE A — CODE COMPLETE" block).

**What changed, in one line:** capture no longer reads every platform signal as "scrolling stopped" — it classifies (healthy / backpressure / flagged-empty-200 / captcha / screen-time-overlay / offline) and responds like a person (human-cadence scroll + IO re-trigger, no teleport; snooze the reminder; pause+notify+auto-resume on captcha; one auto-refresh on a flagged empty page; honest incompleteness never faked as done). Founder's 3 live interruptions (SESS-01 empty-200, OVLY-01 screen-time modal, CHAL-UX captcha) are all handled. Wire format pinned from a real envelope (`fixtures/tiktok-post-item-list-envelope.json`).

**▶ NEXT = the WAVE-A LIVE PROOF (needs the founder at the browser).** Steps:
1. Confirm the dev browser (:9222, ext `holif…gefj`) hot-reloaded the new `dist/` (watcher on :9012); if not, Load-Unpacked `~/Dev/attic-extension/dist`.
2. A2 self-heal is expected to repair the corrupted dev DB on first store open (watch the SW console for a "self-heal / reopening at v… " or "STORAGE REBUILD" log); if it can't, a clean extension remove+reload resets it.
3. Founder on their TikTok **profile**, TikTok **foregrounded**, **no other TikTok tab / no FYP** (the interceptor also matches `recommend/item_list` → would inflate `count`, CONC-01). Solve any captcha in-tab (capture should pause+notify then auto-resume).
4. Click **Sync** (or Alt+Shift+A on the profile) → real Likes/Favorites capture. VERIFY against the live-watch checklist: the grid actually scrolls and page-2 fetches within ~1 min (false-giveup signature = HUD "re-triggering n/3"→"waiting k/8" with frozen captured); flat heap/DOM; captcha pause+resume; empty-200 auto-refresh if it fires; screen-time Snooze if it fires; honest done/giveup. **This run also produces the Phase-2 pilot corpus.**
5. After the proof: pin the `collect`/`favorite` envelope shapes (only `post` is pinned), then Waves B–D per the plan.

**Below is the pre-Wave-A pointer (kept for lineage):**

## (pre-Wave-A) 2026-07-10: CAPTURE RESILIENCE — resume at WAVE A

**What just happened.** A live capture test proved the Phase-2A crash fix works (1,437 items, flat heap/DOM, `hasMore` read) but exposed the core defect: the scroll **motion** (`nudgeToBottom` teleport) fails to re-trigger TikTok's IntersectionObserver → misread as a rate-limit → false giveup. Founder correction: it is NOT rate-limiting. A 16-agent audit (`capture-resilience-audit`, 1.5M tokens, 0 errors) then mapped the FULL surface → **28 ranked failures (4 critical) · 17 gaps · 18 missing capabilities**, grounded in GitHub/SO prior art.

**Governing docs (committed + pushed, HEAD `bce52ce`):**
- `docs/specs/capture-resilience.md` — THE governing spec (register · gaps · 7 invariants · 6 domain solutions incl. the full `scrollMotion.ts` pure-core design · exit criteria). Extends/supersedes §8 of the Phase-2A plan.
- `docs/plans/2026-07-10-capture-resilience-plan.md` — ordered **Waves A–D**. **RESUME HERE.**

**▶ NEXT = WAVE A** (the gate; run via superpowers SDD, Opus implementers / Fable reviewers per `subagent-model-policy`):
- **A1 · Scroll-motion engine** (SCROLL-01, rank #1) — new pure `src/lib/capture/scrollMotion.ts` (incremental `wheelBy` down + up-then-down IO re-trigger + `requestIssued` motion-vs-throttle oracle from `main-world.js`; `scrollState`/`pacing` logic UNCHANGED, only inputs cleaned). Full design + 12 acceptance criteria in spec §6.1.
- **A2 · Storage self-heal** (STORE-01) — assert stores exist on open → contains-guarded `version+1` reopen → deleteDB+rebuild; never memoize a rejected open; unrecoverable DB HALTS + surfaces (no swallowed-write-as-done).
- **A3 · Idempotent alarm** (S-SW-4) — register `cp_queue_revive` via `alarms.get`-guard/`onInstalled`+`onStartup` only (never unconditional top-level create).
- **A4 · Honest completion** (COMPL-01/02, INJ-02) — typed transport signal (ok/http_error/challenge/api_error/offline); accept `hasMore:false` only on a healthy 2xx non-challenge page; PIN the real `hasMore`/`cursor` field from a live `item_list` fixture.
- Then the **Wave-A live proof** (founder session): clean extension remove+reload (resets the dev DB I corrupted), real Likes/Favorites capture → confirms scroll fix + flat memory + honest completion + pinned field names → **produces the Phase-2 pilot corpus.**

**LIVE ENVIRONMENT (as of this handoff — a cleared session should re-verify, may have died):**
- Repo = **`~/Dev/attic-extension`** (renamed to `commonplace` then back on 2026-07-09/10; see the path banner at top). Remote `github.com/s0shaheen/commonplace`.
- **Dev browser RUNNING** on CDP `http://localhost:9222` — logged into TikTok (`@bhaihours`) + Instagram; extension loaded (id `holifbdfpkpcjhebaehobkpepfihgefj`). **Its dev IndexedDB is CORRUPTED** (my bare-`indexedDB.open` probes — never do that again; see [[scroll-motion-not-timing]]) → a clean **remove + Load-Unpacked** of `~/Dev/attic-extension/dist` resets it before the Wave-A proof. Profile lives at `~/Dev/commonplace/.dev-profile` (do NOT delete).
- **`npm run dev` watcher RUNNING** (port 9012 · dev `dist/` with hot-reload). Stable Chrome ignores `--load-extension` → the extension is Load-Unpacked once and hot-reloads after (see `docs/dev-workflow.md`).
- To drive the browser myself: a CDP helper pattern (Node built-in `WebSocket`, no `ws` dep) — reachable via `http://localhost:9222/json`. Never bare-open the app's IndexedDB; read via the app's own code paths.

**Dev tooling shipped (2026-07-10):** `npm run dev` (hot-reload watcher + `ws://localhost:9012`), `npm run dev:browser` (persistent `.dev-profile`, CDP :9222); reload client is gated out of prod by `__DEV_RELOAD__` + a named audit guard; `docs/dev-workflow.md` covers the two-terminal flow + the auth stance (persistent profile, NOT cookie-copy).

---

## (superseded 2026-07-10) 2026-07-09 eve: PHASE 3 COMPLETE — was next = Phase 2 pilot prep, Phase 4 in parallel

**Phase 3 CLOSED (final whole-branch review: Ready to merge YES).** All 9 tasks + rc.6 + one final fix wave (e9a527f) on main: capture→analyze→ground→library-data→export end-to-end, kill-surviving offscreen queue, open-schema export Ajv-valid against rc.6 with per-record `extractor_ref` provenance, promptfoo replay + 3-job CI, submit-ready (NOT submitted) CWS package + key-exposure audit. 145 vitest + 8 capture + 198 pytest green. Ledger (`.superpowers/sdd/progress.md`) holds the Phase-4/5 backlog of accepted minors — trust it over memory.

**FOUNDER QUEUE (nothing blocks silently):** ① ratify the per-record `extractor_ref` ruling (final review found the plan's uniform export stamp mislabels mixed-lane libraries; fixed to derive from `rec.analysis` — provenance-first-class governs); ② confirm contact email `hello@commonplacehq.com`; ③ listing name keeps "Search" (SPEC §18 keyword trade) while the dry-run build has no search UI — deliberate, roadmap-labeled; ④ dev-manifest name must change before any PUBLIC listing; ⑤ live Chrome smokes (steps in task-6 + task-7 reports); ⑥ Places key; ⑦ CWS $5 account; ⑧ G2 design pick (gates Phase 5).

**Next build move:** Phase 2 pilot prep (auto-label ~150-video stratified pilot → founder spot-check gate) and/or Phase 4 (prompt tuning + native-vs-VTT ablation — needs the eval instrument, which exists). Process: superpowers SDD loop per DEC-027; plans → `docs/plans/`; decisions → `docs/decisions/decision-log.md`.

**2026-07-09 also:** repo renamed `attic`→`commonplace` (GitHub + package.json; local folder still `~/Dev/attic-extension`); docs restructured to the `docs/README.md` IA (kebab-case convention enforced); founder briefing artifact published.

## (superseded) 2026-07-08: Phase 1 COMPLETE
Phase 1 (schema freeze + eval harness) is done and final-reviewed: `schema/` (JSON Schema 1.0.0-rc.5, SHACL base+TikTok, JSON-LD context, facet vocab, fixtures) + `eval/` (`commonplace_eval`, 194 tests green: matcher, per-layer metric matrix, Φ_c, bootstrap CIs, calibration, scorecard CLI) + `eval/construct.md` + `eval/guidelines.md`. Status log + carry-forwards live in `roadmap.md`. Next unchecked phases: **Phase 3** (wire engine into MV3 shell — AUTO; Places resolver waits on the API key) and **Phase 2 prep** (pilot gold set auto-label → founder spot-check gate).

## (superseded 2026-07-08 — kept for lineage) Block 0.5 — Eval Foundation (the engine's real first work)

Capture + backend feasibility are done (IG-live + zero-knowledge sync spikes PASS). But the **pipeline experiment (native-vs-VTT) was retracted** — it was run before any eval instrument existed (ad-hoc ontology, exact-string matching, no ground truth → uninterpretable). Founder correction: *"think like an ai engineer/scientist… don't skip steps."* → **Block 0.5 now precedes the engine build.** Two governing docs written (cited research in `_RESEARCH-eval-method-*` + `_RESEARCH-ontology-*`):
- **`evaluation-methodology.md`** — instrument-before-experiment; the full sequence (construct → ontology+schema → guidelines → gold set dev/**sealed-test** → validated matcher/metric → prompt-on-dev → freeze → ablations → report-once); nervaluate matching, GERBIL/ELEVANT grounding, Φ_c asymmetric headline, smECE, cluster-bootstrap CIs, solo-annotator protocol.
- **`knowledge-ontology.md`** (+ `knowledge-ontology-hierarchy.txt`) — the ONE ontology, answering the founder's "how do we capture ideas/concepts/subjects/services/jobs": **four Referent kinds — NamedEntity (→instance ID, flagship) · Concept (→subject vocabulary, hierarchical) · Claim (→proposition, faithfulness) · StructuredContent (→schema.org slot-filling) — + Facets (the original 8-facet IP)**, on doc-03's WEMI/SKOS spine. Scorecard = per-layer **matrix**, never one blended number. Grounding authorities licensing-checked (Wikidata/IPTC/ESCO/O*NET/LCSH/MeSH; reject Dewey/UDC/TMDB-API).

**ONTOLOGY v3 COMMITTED (2026-07-07, founder-approved).** v2 was stress-tested categorically per the founder's directive: a live-web census of every major platform's content types + non-platform cases (web pages, bare links, local files) → **32 archetypes, 45 gaps (14 blocking), all folded** (`2026-07-07-media-census.md`). Headline v3 fixes: identity de-URL-ed (handle union + content hash; admission = identity+savedAt only), mediaKind +audio/document/file, children/membership plurality, workRef (Work level: DOI/ISBN/podcast-GUID), depicts recursion edge (screenshot-of-a-tweet), lifecycle+captureFidelity, selectors completed (PDF/EPUB), Save annotations/scope/per-source timestamps, signal language+translations, platform-native authority tier, the Observation pattern. **The teaching companion — the 16-step derivation with 15 rules — is `schema-derivation-walkthrough.html`** (also the artifact the founder can present from). **v1 populate-cut: decided by pilot data, not assumption** ("Recipe-only" retracted). Annotation = auto-label + founder spot-check (chosen); 2nd-labeler seed at publish-time.

**Next concrete steps (Block 0.5):** freeze the JSON schema + SHACL shapes from `knowledge-ontology.md` v3 → annotation guidelines (`guidelines.md`) → matcher + per-layer metric harness (open-source) → ~150-video pilot gold set (auto-label + spot-check; its distribution sets the v1 populate-cut) → then prompt iteration + the (re-run, valid) native-vs-VTT ablation. Block 1 (`src/lib`→MV3 wiring) proceeds in parallel where it doesn't touch the ontology (capture, queue, storage).

### (superseded) earlier framing: "Block 0 complete → Block 1"

**Block-0 status (2026-07-07) — all 3 spikes DONE:**
- ✅ **Spike #1 IG-live: PASS** (`spikes/ig-live/RESULT.md`) — saved view fires `GET /api/v1/feed/saved/posts/` (200, single JSON blob, `max_id` cursor, enrichable `{media}`); REST-cursor not GraphQL-doc_id (no rotation tax); constructing 400s → passive-observe only. **G4 → live-IG PROMOTED to a v1 headline lane.** IG DYD ZIP schema verified richer than assumed (`URL·Caption·Title·Hashtags·Owner`/post + collections; fixture `fixtures/ig-saved-sample.json`).
- ✅ **Spike #2 zero-knowledge sync: PASS both legs** (`spikes/sync-zk/RESULT.md`) — protocol (200 items) + **remote on live Supabase Postgres** (50 items, authed user + RLS, 6/6 incl. server-blindness verified at the storage layer). Remote leg caught+fixed a real seq-bump bug. **Backend LIVE in `attic-dev`** (`schema.sql`: `sync_items` + RLS + trigger) = the one project for sync + managed inference + MCP.
- ✅ **Spike #3 pipeline experiment: PASS — decisive** (`spikes/pipeline/RESULT.md`, 54 clean pairs, `gemini-2.5-flash-lite`). native-video vs keyframes+VTT: **jaccard 38%** → strongly complementary, not equivalent. Union 42% richer than native alone; keyframes ~8.4× cheaper; native has a reliability tail (one clip hung). **Decision:** confidence-routed cascade — keyframes+VTT default → native escalation → fuse for the golden set. No native-video vendor lock (open lane viable). Folded into SPEC §13/§15.

**Landed this session:** G1 ✅ **Commonplace** (domains available; founder buying) · Gemini key rotated+verified · Supabase authed, `attic-dev` restored + sync backend live · **Claude Design brief** (`docs/design/claude-design-brief.md`) · IG export ingested (gitignored) → both ZIP importers scoped for Block 3.

**Remaining unblocks:**
- 🟡 Claude Design diverge session (founder refining) → **G2 pick**.
- 🟡 Drop the **TikTok DYD ZIP** when ready · **Google Places** key (SKU-disciplined) · **CWS dev account** · **G3** price signature before Block 4.
- 🟢 **Block 0 is closed.** Next = **Block 1 — the artifact core:** wire `src/lib` into the MV3 shell end-to-end (capture→analyze→ground→library-data→export), resumable offscreen queue, both lane adapters (cascade per §13), Wikidata+Places resolvers, open schema v1 + export, promptfoo eval slice in CI, early minimal CWS dry-run. No founder gate blocks starting it.

**Repo:** `github.com/s0shaheen/attic` (private). Docs: product-specification.md (governing) · 2026-07-06-refounding-research.md + archive/superseded/fable-phase1-findings.md (evidence) · _ENGINE-groundup (engine method; stale corpus stats) · dossier 00–08 (reference) · archive/superseded/fable-brief-v4.md v4 + GATE0 docs (superseded).

**No background workflows running.**
