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

## ▶▶▶▶▶▶ CURRENT (2026-07-13, late): LIVE STRESS RUN DONE — fake-done at 5,191/5,989 likes PROVEN (silent truncation) — next = founder ratifies the first-principles CONTROL-PLANE REDESIGN

**One line:** the live full-run test happened (triaged via the diagnostics stream — the workflow works); capture is healthy at speed, BUT TikTok killed the session at ~5.2k likes with a well-formed "no more items" lie + a black screen, and the extension accepted it as done (~800 likes short — PROVEN against the founder's data export). Founder directive: stop patching enumerated edge cases; redesign the capture control plane from first principles. The argued design is below, awaiting ratification — **resume there**.

**RUN RESULTS (stream: `.dev-diag/run-1783972867670.jsonl`, ~15:26–16:05):**
- PROVEN GOOD: autonomous nav (Favorites→Likes→Posts→Reposts auto-advance) · continuous trusted scroll ~550 items/30s · heap GC-sawtooth healthy (300MB–1.1GB peaks, no leak) · DOM bounded ~2k nodes (eviction working) · attach `background:true` · banner-close → `detach(external, canceled_by_user)` → resumable pause (heldUntilUser) → founder resumed → run continued. 5,614 items total captured.
- THE KILL (t=1783976050233): at 5,191 likes, FULL velocity (+24 items/s, `hasMore:true` one beat prior) → screen went BLACK + one well-formed 2xx envelope with POSITIVE `hasMore:false` → scrollWatch `done`. Code-verified: `isTerminalPage` (interceptParse.ts) yields done ONLY on explicit `hasMore:false` over healthy transport (missing hasMore defaults TRUE) — so the server affirmatively sent a terminal-shaped response. NO page-world error fired (the error hook was live; only our own sendMessage-rejection noise). SPA session-dead afterward: posts/reposts rendered ~790 DOM nodes, 0 items, preflight still "ready" → wedge-retry theater → honest giveups. Founder canceled.
- PROOF OF FAKE-DONE: founder's TikTok export (`~/Downloads/user_data_tiktok.json` — PII, count-only access) shows **5,989 likes**; captured 5,191 → ≥798 short. Prior run died in the same zone ("5000+").
- MECHANISM (argued, one unknown left): **server-side SILENT TRUNCATION** at a volume/velocity threshold — TikTok returns valid-shaped terminal responses instead of errors (shadow-ban pattern: Instagram/Google/Cloudflare all prefer lying to revealing detection); the same poisoned responses starved TikTok's own SPA → the black screen. Client-crash RULED OUT (no error event + a crashed client can't emit a final well-formed envelope). Not yet excluded: a hard depth cap ~5.2k. **DISCRIMINATOR = resume-after-flag:** reload + resume from cursor at 5,191 — proceeds after a cooldown ⇒ session flag (recovery spine handles it); re-walls at the same cursor ⇒ hard cap (tail is scroll-unreachable → DYD lane covers it, shortfall reported honestly). Either way the same architecture responds; the system tells us which world we're in.

**▶ THE FOUNDER DIRECTIVE + THE ARGUED REDESIGN (awaiting ratification → then into `docs/specs/capture-resilience.md` → SDD build):**
Directive: theorize the WHY with a mechanism, and do NOT fix by adding per-case guards — "we will never reach a complete state like this." First-principles, vetted.
- **Ground truths:** progress (unique items flowing — countable) · vitality (page renders content — countable) · challenge (human being asked — observable) · external ground truth exists (declared counts, DYD export) · **the platform's completion claim is evidence, never truth** (a well-formed "done" is exactly what silent mitigation returns — indistinguishable by design).
- **Control loop:** existing detectors (pageClear, banGuard, overlayClassifier, watchdog, transport signal…) are DEMOTED to sensors → classify OBSERVED STATE {PROGRESSING · STALLED-VITAL · NOT-VITAL · CHALLENGED · CLAIMED-DONE} → small fixed response repertoire {continue · bounded nudge · **the ONE recovery spine** (checkpoint→reload→resume-from-cursor; idempotent, budgeted, backoff) · pause-for-human · verdict}.
- **DONE = a computed VERDICT, never an accepted event:** terminal claim + corroboration (declared-count proximity OR tail verified vs ground truth OR terminal reproduces at the same cursor in a FRESH session) + page vital at claim time. Short ⇒ "incomplete, resumable" — honest by construction.
- **Pacing = adaptive AIMD** (back off on resistance evidence — recoveries, thinning pages; creep up while clean). No hardcoded depth constants.
- **Convergence argument:** any novel failure manifests as non-progress or non-vitality (no third option) → lands in a known state → gets the spine. Completeness over RESPONSES (closed set), not CAUSES (open set).
- **Prior art:** crash-only software / Recovery-Oriented Computing (Candea & Fox) · Erlang/OTP supervision · TCP AIMD congestion control · Kubernetes reconciliation · the end-to-end argument (Saltzer/Reed/Clark).

**Tactical fixes queued (survive the redesign, re-derived):** ① envelope diag log in `handleItemList` (path/status/items/hasMore/cursor — the missing discriminator; a sensor). ② shot-loop failure log-once — **0 screenshots landed all run**; `Page.captureScreenshot` fails silently every 4s (likely backgrounded-tab frame starvation). ③ `background.ts` onMessage ends with an unconditional `return true` → every fire-and-forget sendMessage (scroll_mode, item_list…) rejects "channel closed" → hundreds of unhandled rejections/min drowning the diag stream — delete it (the three async branches already `return true` inline). ④ state records carry a stale `source` label during later sources (`lastSource` fallback; `perSource` is correct). ⑤ empty-source fast-exhaust (posts/reposts burned ~90s each in wedge theater) — folds into the state machine, don't special-case it.

**Triage workflow (proven this session):** persistent Monitor tailing `.dev-diag/run-*.jsonl` through a dedupe/heartbeat filter (events verbatim · identical errors collapsed to `ERROR xN` per 120s · state 1/30s + immediately on mode/pause change) — the first naive watcher was auto-killed by the rejection flood; **dedupe is required**. NEVER edit `src/` mid-run (rebuild → hot-reload → kills the live run). Screenshots via claude-in-chrome remain safe; its JS/network tools remain FORBIDDEN during a run.

**LIVE ENV at handoff:** dev server pid 10789 detached, :9012/:9013 up, diag sink appending to `run-1783972867670.jsonl` (per-process file — a dev-server restart mints a new one). Extension was reloaded at session end ("Extension context invalidated" errors in-stream) — founder must ↻ the extension AND refresh the TikTok tab before the next run. Ground truth for verification: `~/Downloads/user_data_tiktok.json` (likes=5,989 at export time; PII — count-only).

**▶ RESUME:** ① founder ratifies/amends the control-plane redesign → write it into `capture-resilience.md` (superseding the enumerated-failure framing) → SDD build (Opus implementers / Fable reviewers per [[subagent-model-policy]]), landing tactical ①–③ with it. ② Next live run: the envelope log captures the flag response bytes; run the resume-after-flag discriminator. ③ Collections lane (task #17) stays queued behind capture.

---

## (superseded same-day) 2026-07-13 mid: CAPTURE MOAT WORKS + FULLY HARDENED + PRODUCTIZED — next = live triage of a full run via the NEW diagnostics stream

**One line:** the trusted-scroll capture is LIVE-PROVEN and now self-sufficient, interruption-proof, background-capable, trustworthy, with a real UI — AND we just built a dev-only diagnostics stream so a session can triage live runs by reading a file (no more claude-in-chrome, which fights the extension's debugger). Immediate next step is a live full-run test watched via that stream.

**SHIPPED THIS SESSION (all committed, ~36c671a..2671504, 519 vitest green, tsc/build/audit clean):**
- **Moat (140f4c7):** trusted wheel via `chrome.debugger` Input.dispatchMouseEvent — the fix for "programmatic scroll is a NO-OP on TikTok" (window.scrollBy/scrollTop/scrollIntoView/synthetic-wheel all 0px; only trusted input scrolls). LIVE-PROVEN: captured 5000+ of the founder's real library.
- **Scroll motion (b005765):** `scrollWatch.ts` network-driven continuous-down (killed the geometry up-jiggle); **(335633b)** fast network-gated up-nudge on genuine stall (~1.8s), banner-close→resumable-pause, mid-run page-clear→reload recovery, favorites "N of ~M · ~K unavailable".
- **Autonomous + resilient (f6d9059 Wave1, 86d245e Wave2):** ownIdentity nav-to-profile-from-anywhere; notify-and-resume (cp_paused, crash-safe); anti-block (wheelJitter + banGuard halt); watchdog; source-selection; completeness accounting; single-driver lease; run deadline; storage persist; real popup dashboard + settings.
- **Background capture (6c87cdc):** `Emulation.setFocusEmulationEnabled` + `Page.setWebLifecycleState` on the already-held debugger → runs backgrounded/minimized (what Playwright does). config.captureBackground default true; hidden-pause is now a fallback. Tab must stay OPEN.
- **DYD import lane (570e40f):** parse TikTok data-export JSON → library (2nd lane; options-page file picker).
- **Dev diagnostics stream (2671504):** THE triage tool — see below.

**▶▶ RESUME WORKFLOW — HOW TO TRIAGE (critical, new):** Do NOT use claude-in-chrome to observe a live capture — its JS/network tools attach chrome.debugger to the tab and BREAK the extension's own debugger-driven scroll (verified). Instead: the dev-only diagnostics stream (gated `__DEV_DIAG__`, stripped from prod, audit-enforced) posts state/logs/events/errors/screenshots to `http://localhost:9013/diag` → **read `.dev-diag/run-*.jsonl` + `.dev-diag/shots/` directly with Bash/Read.** Screenshots (safe, no conflict) via claude-in-chrome are OK; JS/network/scroll via claude-in-chrome are NOT.

**LIVE ENV at handoff:** dev server running DETACHED (nohup, pid ~10789, `node scripts/dev.mjs`) → `:9012` hot-reload + `:9013` diag sink, writing `.dev-diag/run-1783972867670.jsonl`. **May have been reaped** — if `nc -z localhost 9013` is down, restart it (best in the founder's OWN terminal: `npm run dev`; background Bash jobs get killed here). dist = current dev build (focus-emulation + diag). Founder's MAIN Chrome has the extension loaded + logged into TikTok @bhaihours; needs a `chrome://extensions` ↻ reload to pick up the latest dev dist.

**▶ IMMEDIATE NEXT STEP:** founder reloads the extension (↻) + clicks Sync → a fresh session reads `.dev-diag/run-*.jsonl` live to confirm: autonomous nav (Videos→Favorites already seen working), continuous scroll + fast retrigger, background capture (background/minimize the tab → count keeps climbing = the focus-emulation win), notify/resume on the break-popup+passcode, and **the ~6k page-clear cause** (unknown: flagged-empty vs rate-limit vs memory — catch it in the stream). Then: build the **collections import lane** (task #17 — favorites splits into "Posts 1564" flat + "Collections 44" separate; the flat collect/item_list has NO collection field per recon; need to enumerate collection endpoints live — discover during the run).

**Founder feedback captured:** favorites tab shows "Posts 1564" (the declared count for progress/duds) + "Collections 44" (separate). Wants collections imported. Background-tab "must stay on the tab" was unacceptable → solved via focus emulation. Triage via claude-in-chrome too slow + breaks capture → solved via the diagnostics stream.

---

## ▶▶▶▶ (superseded) 2026-07-13: TRUE ROOT CAUSE FOUND + FIXED — trusted-scroll is the moat; needs live verify

**The real bug, live-confirmed on the founder's logged-in TikTok (via claude-in-chrome):** TikTok's profile grid ignores ALL programmatic scrolling — `window.scrollBy`, `scrollTop=`, `scrollIntoView`, AND synthetic `WheelEvent` all move it **0px**. Only a REAL TRUSTED wheel scrolls it (a trusted wheel flew the grid 32→110 tiles in ~5s, smooth). This is why capture always "had to be pushed along by hand" — the extension physically could not move TikTok. All the pacing + continuous-scroll work was polishing a scroll that never landed. (Full story: memory `scroll-must-be-continuous-fast.md`.)

**THE FIX — BUILT + COMMITTED (140f4c7), founder-ratified as THE MOAT:** trusted wheel events via `chrome.debugger`. The SW attaches the debugger to the capture tab and runs a trusted-wheel pump (`Input.dispatchMouseEvent` mouseWheel, 30ms cadence), steered by the content-script observer's `scroll_mode` messages. All the brains stayed (scrollDrive/overlay/session-recovery/completion/preflight). Cost the founder accepted: the "Commonplace started debugging this browser" banner (`debugger` permission). Detach-safety on every exit path is load-bearing. 365 vitest green, tsc/build/audit clean.

**FOUNDER RULING (2026-07-13):** trusted-scroll = the moat, pick away at it, do NOT give up, do NOT fall back to DYD. **DYD ZIP import = a 2nd lane alongside** (task queued; needs the actual TikTok export format).

**MOAT LIVE-PROVEN (2026-07-13):** founder loaded the extension in main Chrome, hit Sync — it captured his real library end-to-end (Favorites ~1367 → auto-advanced to Likes → 5000+), continuous smooth down-scroll, no jiggle, heap GC-healthy (~300-800MB sawtooth, no leak), DOM bounded by eviction. The "barely down then up" was the geometry up-jiggle (fixed b005765: scrollWatch = network-driven continuous-down, geometry gone).

**THEN Waves 1+2 shipped (commits f6d9059, 86d245e; 499 vitest green) — "make it just work + real UI + trustworthy":**
- WAVE 1: autonomous nav (ownIdentity.ts — capture handle, nav to profile from anywhere, wait-for-arrival sub-tab hops) · notify-and-resume (cp_paused persisted + tray notification + auto/user resume, crash-safe — the break popup snoozes, passcode/captcha pause+notify+resume, NEVER silent stop) · anti-block (wheelJitter.ts jittered cadence + banGuard.ts halt-on-block + captureSpeed) · liveness watchdog · real popup dashboard (popup-view.ts) + settings page.
- WAVE 2: source-selection wired (captureSources) · completeness accounting (declaredCount.ts + completeness.ts → per-source captured-vs-declared; popup shows "N of ~M · short/incomplete", never false "all caught up") · single-driver lease (lease.ts) · run deadline (deadline.ts) · background-tab resilience (backgroundTab.ts — SW-wheel survives backgrounding, but TikTok lazy-load may not → resume-on-visible pause) · storage persist.
- Message contract: syncStatus{count,running,paused,progress{order,done,current,counts,expected,statuses},notice,config,halt,storagePersisted} + sync_start/stop/pause/resume.

**▶ NEXT = LIVE STRESS TEST (founder-gated).** Everything is unit-tested (499) but the new live-glue (autonomous nav on real DOM, notify/resume timing, declared-count DOM read per locale, hidden-tab behavior) needs ONE real run. NOTE the debugger conflict: the extension's chrome.debugger and any remote-control debugger fight over the tab, so I can't fully drive it remotely — the founder clicks Sync while I observe OUT-OF-BAND (screenshots of the HUD/popup, the stored count, console). Reload the extension (chrome://extensions ↻) first. Stress items to throw at it: start from a non-profile page (autonomous nav), let the break popup + passcode fire (notify+resume), disable a source (skip), a long full-library run (deadline/lease/completeness), background the tab. WATCH: declared-count element per locale; does hidden-tab stall; lease/deadline/grace tunings. Then Wave D (correctness tail: monotonic clock, tombstoning, analysis cost ceiling, adapter seam) is optional cleanup.

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
