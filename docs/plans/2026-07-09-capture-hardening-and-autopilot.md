# Capture — Hardening + Autopilot (the front door has to just work)

> **Status:** Forks RESOLVED (2026-07-09, §6). Ready to execute pending founder go-ahead on the build. On completion this updates SPEC §7 + the roadmap + decision log.
>
> **Founder decisions (2026-07-09):** ① **Both self-driving modes** — ship semi-auto (default) AND fully-autonomous (opt-in), user-selectable. ② **Human-cadence** default pacing (ban-averse). ③ **Wait for the hardened tool** to produce the pilot corpus — so **Phase 2 (gold set) now depends on this phase's Task 6.**
>
> **Founder problem (verbatim, 2026-07-09):** *"i need you to be able to go into tiktok and do it yourself, or you need to find a way to do it yourself; i can't keep doing it myself each time. it also needs quite a bit of work and critical stability improvements — once you're 1k videos down it slows down very fast, i couldn't capture more than 3k from my likes because the browser crashed. it's also flaky, like it won't be done scrolling through all my favorites and end up saving/stopping. i just don't understand how it works and it has to be significantly better somehow."*

Two demands, one subsystem: **(A) self-driving** — the founder is out of the loop; **(B) rock-solid at scale** — no slowdown at 1k, no crash at 3k, no false "done." Capture is the moat's front door (SPEC §7); if it doesn't just work, nothing downstream matters.

---

## 1. How capture works today (plain-English, because "i don't understand how it works")

Four files, two browser "worlds," one service worker:

1. **`src/main-world.js`** runs *inside TikTok's own page context*. It quietly wraps the page's `fetch`/`XMLHttpRequest` so that whenever **TikTok itself** asks its server for a page of your saved videos (the `…/item_list` request), we get a copy of the response. **We never ask TikTok for anything** — we read the answers to the page's own questions. This is the robust part and it stays. (Confirmed: `recon/0.1-findings.md` — constructing the request ourselves returns 403/blocked because it's cryptographically signed per-scroll; only passive reading works.)

2. **`src/content.js`** runs in an *isolated* world beside the page. It does three jobs: (a) relays each captured response to the service worker; (b) **auto-scrolls** the page (`Alt+Shift+A`) to make TikTok fetch more pages; (c) tries to keep the page fast with "content-visibility pruning" (tells the browser to skip drawing off-screen tiles).

3. **`src/capture.js`** is a pure function: it turns TikTok's raw JSON into our clean record shape and drops the bulky bits.

4. **`src/background.ts`** (service worker) receives each batch, writes it to the IndexedDB library, and — **right there, during the scroll** — fetches every new item's cover image (3 at a time) and stores the bytes.

**How it decides it's "done":** the auto-scroller watches a `count` number. Each ~3.5 s it scrolls to the bottom and checks whether `count` grew. If `count` hasn't changed for **15 checks in a row (~45 s)**, it declares capture complete and stops. (`content.js:103-125`.)

That last sentence is the bug that produces "it won't finish and ends up stopping."

---

## 2. The audit — why it fails, with evidence and confidence level

### 2.1 False "done" — the flakiness (CONFIRMED: code + recon)
The scroller cannot tell **"TikTok has no more videos"** from **"TikTok stopped answering because it thinks I'm a bot."** Both look identical: `count` stops rising. After 45 s of a throttle-induced stall, it fires `scroll_done` and reports success — **having captured only part of your favorites.** That is exactly *"it won't be done scrolling through all my favorites and end up saving/stopping."*

The signal we need is sitting in every response and we throw it away: TikTok's `item_list` payload carries **`hasMore`** (and a `cursor`). `hasMore: false` is the *only* honest "done." `hasMore: true` + stalled = a throttle to wait out, **not** completion. Fix: the main-world interceptor forwards `hasMore`; the scroller trusts `hasMore`, never a timeout, to declare done.

### 2.2 The ~360-item soft throttle (CONFIRMED: recon, never addressed in production)
`recon/0.1-findings.md:13`, verbatim: *"automated fast scroll deterministically trips a ~360-item soft throttle (3 runs all stopped at 359); human-paced scrolling does not. Scraper must pace scrolling like a human and/or offer a manual-assist 'scroll yourself, we capture' mode."*

This was a **known Phase-0 caveat that shipped unfixed.** The current scroller nudges to the bottom every ~2–3.5 s — fast enough to trip the throttle, after which §2.1's false-done fires. Human-paced, jittered, throttle-aware scrolling is a hard requirement, not a nicety.

### 2.3 Slowdown at ~1k, renderer crash at ~3k (STRONG HYPOTHESIS: structural, not yet profiled)
I have not profiled a live 3k run, so I flag this as a hypothesis — but three structural memory sinks in the current design all grow with corpus size and compound, and SPEC §7 already records *"the 4,661-item capture crashing the renderer"* as a lived event:

- **Unbounded DOM.** TikTok appends grid tiles as you scroll and its own virtualization is unreliable at depth; thousands of tiles (nodes + React fibers + decoded thumbnails) accumulate in the tab's memory. **`content-visibility` does not fix this** — it skips *paint/layout* for off-screen tiles but **evicts nothing**; the nodes and their memory stay. This is the timid half-measure where the real fix is node eviction. (Confidence: high — this is the dominant renderer-OOM mechanism for deep infinite scroll.)
- **Every raw payload is deep-cloned twice on the page thread.** `main-world.js` `postMessage`s the *entire* raw response (including heavy `video`/`raw` objects) to `content.js` (structured clone #1), which forwards the whole thing to the service worker (serialize #2). We only slim it down *afterward*, in the SW. So the page thread pays full-payload copies every page, forever. (Confidence: high — visible in the code path; `capture.js` slimming happens post-transfer.)
- **Inline poster fetch competes with the live page.** `background.ts:155` fetches and holds a cover-image Blob for **every** new item **during** the scroll. At 3k items that's 3k image fetches + Blob decodes contending for the same renderer/network budget as the scrolling page. (Confidence: medium-high — clear contention, exact contribution unprofiled.)

The rebuild's first task **instruments** this (heap + DOM-node counters surfaced in the HUD and logged) so we *measure* the crash curve before/after instead of guessing — per the standing "instrument before experiment" rule.

### 2.4 It only runs when the founder babysits it (CONFIRMED: by design)
Capture today is a **keyboard shortcut** (`Alt+Shift+A`) the founder presses on a TikTok tab and watches. There is no "sync" action, no unattended run, no resume-after-crash for the *scroll* (the offscreen queue's resumability, SPEC §7's "the answer," covers **analysis**, not the scroll enumeration). So every corpus refresh is manual labor. That is the *"i can't keep doing it myself each time."*

### 2.5 What is actually good and stays
Passive network interception (no request forging → no doc_id-rotation tax, structurally immune to the failure that kills instaloader/instagrapi); source-tagging + union dedupe; the idempotent normalizer; IndexedDB as canonical store; the resumable *analysis* queue. **The interception is right. The DOM-coupled, un-paced, false-finishing, babysat *driver* around it is what we replace.**

---

## 3. Prior art — who solved "harvest thousands from an infinite-scroll SPA, reliably"

- **Decouple capture from the DOM; treat the DOM as pure liability.** Serious scroll-harvesters keep the network capture and **evict already-seen nodes** to hold memory flat regardless of corpus size. We already capture from the network, so the tiles carry *zero* information for us — they exist only to make TikTok paginate. Once a page's `item_list` is captured, its tiles are garbage. **Prune them.** (This is the robust version of what `content-visibility` gestured at.)
- **Trust the platform's own paging signal, never a timeout.** Every reliable paginator ends on the API's `hasMore: false`/null-cursor, and treats a stall-with-more-available as backpressure to absorb. (§2.1.)
- **Pace like a human, with jitter and backoff.** Anti-bot throttles key on inhuman cadence/regularity. Human-cadence scroll with randomized dwell + exponential backoff on stalls is the standard evasion — and here it doubles as account-safety. (§2.2, recon.)
- **Move heavy work off the foreground thread.** The tab should do exactly two things: scroll and hand off raw responses immediately. Parsing, dedup, storage writes, and media fetches belong off the page thread (service worker / offscreen doc) so the renderer stays light. (§2.3.)
- **Orchestrate + checkpoint for unattended, resumable runs.** A supervisor owns "which source, how far, retry on tab death," persisting progress so a crash resumes instead of restarting-from-zero — and because capture is idempotent (dedup by id), a worst-case restart is *safe*, just wasteful. (§2.4.)

---

## 4. Recommended architecture (my POV — assumes the §6 recommended answers)

**One line:** the tab becomes a dumb, light **scroll+intercept surface**; a **capture supervisor** drives it human-paced to TikTok's own `hasMore:false`, prunes the DOM as it goes, hands raw pages straight off-thread, and runs unattended + resumable across all sources — with media fetched in a **separate** pass, not inline.

### 4.1 The light tab (rewrite `content.js` + extend `main-world.js`)
- `main-world.js` also reads `hasMore` + `cursor` from each `item_list` response and forwards them with the payload. **The page transfers the raw response and frees it immediately** (hand off the parsed `itemList` slice, not the whole envelope; slim on the way out, not two clones later).
- New **scroll engine**: human-cadence scroll (jittered dwell, randomized velocity), driven by a state machine — `scrolling → stalled? → (hasMore? backoff+resume : done)`. Completion is **`hasMore:false` only.** Throttle stall → exponential backoff (cap ~60 s), resume; surface "waiting out a TikTok rate-limit…" in the HUD so a stall reads as *working*, not *frozen*.
- **DOM pruning that evicts**: after a page is captured, remove the already-seen tiles (keep a small live window near the viewport so TikTok's scroll math and its own loader keep working). This is the memory fix. Guardrails from today's code stay (only act on a confirmed repeating grid; capture is network-based so pruning can **never** lose corpus data).
- A real **Capture HUD**: `X captured · source · hasMore? · live heap/DOM-node counters · stall/backoff state` (SPEC §8 already lists a Capture HUD screen — this is its functional core).

### 4.2 The supervisor (new; in the service worker + offscreen)
- A **"Sync" action** (popup button and/or auto-trigger on a TikTok tab): given the founder is logged into TikTok, it enumerates **all four sources** (favorites → likes → posts → reposts) in sequence, driving each to true completion, then stops.
- **Resumable + crash-surviving**: persist `{source, phase, lastKnownCount, done[]}` to IndexedDB. Tab crash / SW death → resume the unfinished source. Because dedup is idempotent, a mid-source restart re-captures already-seen items harmlessly (we can't set TikTok's private cursor, so "resume" = re-scroll the source; DOM pruning + the light tab make a full re-run cheap and non-crashing — the crash is *designed out*, so resume is the safety net, not the happy path).
- **Two self-driving modes, user-selectable (Fork 1 resolved: build both).** **Semi-auto (default):** you're logged in on your TikTok saved page, click Sync, we drive the scroll from your foreground tab. **Fully-autonomous (opt-in, off by default):** the supervisor opens/focuses a TikTok tab and runs all sources with no presence — behind an explicit settings toggle with an account-risk note, since it puts the largest automated-scroll footprint on the real account. Both share the same scroll engine + supervisor; they differ only in *who opens the tab and whether a human is present*. Semi-auto is the safe default; autonomous is there for the "click once a week and forget" workflow.

### 4.3 Media, decoupled (fix §2.3's inline fetch)
- Capture is **metadata-only and fast.** Posters and video bytes move to a **separate, resumable, throttled media pass** that runs *after* a source is enumerated (or in the offscreen doc, off the page thread) — never inline with the scroll.
- Signed cover URLs expire in hours, but a full enumeration is minutes, so a poster pass kicked off **immediately after** each source finishes still beats expiry. Video bytes stay **on-demand** (fetched in offscreen only for items the engine actually analyzes) — most items never need the full video, so eagerly pulling 3k videos is wasted storage. (Default; called out in Fork 4 note.)

### 4.4 What this explicitly fixes
| Symptom | Root cause (§2) | Fix (§4) |
|---|---|---|
| "won't finish, saves/stops" | false-done on timeout | `hasMore:false`-only completion |
| stops early (~360) | fast scroll trips throttle | human-cadence + backoff-and-resume |
| slows at 1k / crashes at 3k | unbounded DOM + double-clone + inline posters | DOM eviction + immediate handoff + decoupled media (+ instrumented) |
| "i can't keep doing it myself" | capture is a babysat hotkey | Sync supervisor, unattended + resumable |

---

## 5. Task plan (SDD; each task = committed, tested, reviewable)

**Task 0 — Instrument + reproduce (measure before rebuilding).** Add heap + DOM-node + captured-count telemetry to the HUD/console. Capture the current crash curve on a real large source (founder session or a synthetic long grid) so §2.3 stops being a hypothesis and every later task has a before/after number. *Done-when:* a documented memory-vs-count curve for today's code.

**Task 1 — Honest completion signal.** `main-world.js` forwards `hasMore`+`cursor`; scroll logic ends only on `hasMore:false`; stall-with-more → backoff-and-resume. *Done-when:* a fixtured state-machine test proves stall≠done and `hasMore:false`=done; live run finishes a full source with no false stop.

**Task 2 — Human-cadence, throttle-aware scroll engine.** Jittered dwell/velocity; exponential backoff on stall; HUD shows backoff state. *Done-when:* a large source captures to completion without tripping the throttle (or recovers from it), paced indistinguishably from human scroll.

**Task 3 — DOM eviction + immediate off-thread handoff.** Evict captured tiles (live-window kept); page transfers slim payloads once and frees them. *Done-when:* instrumented heap/DOM stays ~flat across a full large capture (the §2.3 fix, measured against Task 0's curve).

**Task 4 — Decouple media into a resumable pass.** Remove inline poster fetch from the capture path; posters fetched in a throttled post-enumeration pass; video bytes on-demand in offscreen. *Done-when:* capture path holds no media Blobs; posters still land (expiry-safe); tested.

**Task 5 — Capture supervisor + Sync action (self-driving).** Enumerate all four sources unattended; persist progress; resume on tab/SW death. Degree per Fork 1. *Done-when:* one "Sync" drives favorites→likes→posts→reposts to completion untouched; a mid-run tab crash resumes and finishes; final counts match a manual baseline.

**Task 6 — Whole-subsystem review + SPEC §7 update + a real large-corpus proof run.** End-to-end on the founder's real library (or the §6 stopgap capture); update SPEC §7 to the new capture contract; roadmap status log. *Done-when:* the founder's full TikTok library captures in one unattended run, no crash, counts verified complete.

*(Instagram live + both DYD ZIP lanes are separate capture lanes on the same spine — SPEC §7 / roadmap Phase 9 — and inherit this hardening; out of scope here, noted so the supervisor is built lane-generic.)*

---

## 6. Forks — RESOLVED (2026-07-09)

**Fork 1 — How self-driving? → BOTH.** Build semi-auto (default) **and** fully-autonomous (opt-in toggle) as user-selectable modes on one shared scroll engine + supervisor (§4.2). Semi-auto is the safe default; autonomous is the click-once-and-forget option behind an explicit account-risk note.

**Fork 2 — Pilot corpus now? → WAIT.** No browser-driven capture this session; the hardened tool (Task 6) produces the corpus in one clean unattended pass. **Consequence: Phase 2 (gold set) is now gated on this phase's Task 6** — sequenced in §7.

**Fork 3 — Cadence → HUMAN-CADENCE (default).** Genuinely human speed + jitter; lowest ban risk. Fast mode is not built (can be a later toggle if wall-clock ever matters).

**Fork 4 (defaulted) — Media timing.** Posters fetched eagerly in a decoupled post-enumeration pass (expiry-safe); full video bytes **on-demand** only for items the engine analyzes. Not overridden.

---

## 7. Sequencing + spec impact
- This slots as a **capture-hardening phase ahead of Phase 2** (the pilot depends on a real corpus this produces) and runs parallel to Phase 4. It does **not** touch the frozen schema, the engine, or the analysis queue — only the capture driver + a new supervisor.
- On resolution of §6, this plan updates **SPEC §7** (the capture contract: `hasMore`-completion, human-cadence, DOM-eviction, decoupled media, the Sync supervisor) and appends the roadmap status log + a decision-log entry.
- Governing process unchanged: superpowers SDD loop (DEC-027); plans in `docs/plans/`; decisions in `docs/decisions/decision-log.md`.
