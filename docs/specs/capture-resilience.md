# Capture Resilience — Governing Spec

> **Status:** ACTIVE governing spec for the capture subsystem (2026-07-10). Produced by a 16-agent audit (capability decomposition · adversarial failure enumeration · GitHub/StackOverflow prior-art research · problem→solution synthesis). It **extends and supersedes §8 of** `docs/plans/2026-07-09-capture-hardening-and-autopilot.md` (Phase 2A): Phase 2A made scroll *timing* human and completion *honest at the reducer*, but never audited the full failure surface. This doc is the surface. Execution order lives in `docs/plans/2026-07-10-capture-resilience-plan.md`.
>
> **Why this exists:** capture is the moat's front door (SPEC §7). A live test on 2026-07-10 proved the crash fix works (1,437 items, flat heap/DOM, `hasMore` read) but exposed the core defect — and the audit then showed it is one of **28 ranked failure modes + 17 overlooked gaps + 18 missing capabilities**. The goal is a capture subsystem that *just works* unattended at corpus scale: resilient, self-verifying, honest about incompleteness, and account-safe.

---

## 1. The one-paragraph diagnosis

We hardened the wrong layer first. The scroll **motion** — `nudgeToBottom()`'s instant `scrollTop = scrollHeight` teleport — (a) fails to re-trigger TikTok's edge-triggered IntersectionObserver lazy-load, so no next page is fetched, and (b) is the #1 anti-bot behavioral tell. The (correct, well-tested) stall reducer then misreads "no new page" as a rate-limit and backs off to a false `giveup` — the "1,437 then stall" symptom. That single motion bug is rank #1. Behind it sit three more criticals (an unrecoverable partial/corrupt IndexedDB that bricks everything while still *looking* like a successful capture; an alarm-reset bug that can stop the resumability spine from ever firing under traffic; and `hasMore:false` trusted so absolutely that a throttled/logged-out early stop ships as a silent-truncation "success"), plus a long tail of drift, lifecycle, quota, concurrency, and completeness failures that only bite on the large unattended runs this product is *for*.

---

## 2. Capability decomposition & current maturity

24 capabilities; **13 solid · 6 partial · 4 fragile · 1 missing.** The fragile/partial/missing ones are where the work is.

| Maturity | Capability |
|---|---|
| 🔴 fragile | Scroll motion / pagination driving · Scroller element discovery · Canonical storage (IndexedDB) · Cross-source SPA sub-tab navigation |
| 🟡 partial | Paging-signal extraction (hasMore/cursor) · Resumability & crash-survival · Error handling & recovery · User controls (hotkeys/popup/options) · Export · DNR Referer injection |
| ⚪ missing | Cross-platform capture adapters (Instagram live + platform ZIP imports) |
| 🟢 solid (13) | MAIN-world interception · injection timing · completion/stall reducer · pacing · resume grace · source-tagged arrival gating · normalization · dedup/merge · count mirror · eager poster pass · DOM tile eviction · supervisor sequencing · observability HUD |

The solid core (interception, the reducer, pacing, eviction, the supervisor) is genuinely good and stays. Everything fragile/partial is **fed by** or **feeds** the four criticals; fixing those unblocks the rest.

---

## 3. Failure register (28 ranked, grouped by domain)

Ranked by severity × likelihood × blast-radius on an unattended large-corpus run. Full durable fixes live in the domain solutions (§6); this is the index. **Sev: C=critical, H=high, M=medium, L=low.**

**Scroll motion & pagination** — `→ §6.1`
- **#1 C · SCROLL-01** — teleport fails to re-trigger the IntersectionObserver → no page fetched → misdiagnosed as rate-limit → false giveup. *(the headline)*
- #10 H · SCROLL-03 — scroller/grid resolution is heuristic + open-loop (wrong container/rails/remount → nudge a non-paginating element).
- #21 M · COMPL-04 — fixed 8-cycle giveup ladder ignores evidence (truncates a slow source; wastes 400 scrolls on empty pages).
- #24 M · PACE-03 — anti-bot surface beyond the teleport (backoff clusters at 2^n, stationary dwell, unmasked `fetch.toString()`, console banner).

**Storage self-healing** — `→ §6.2`
- **#2 C · STORE-01** — a store-less/partial/corrupt v1 DB is unrecoverable (upgrade fires only on version change) and bricks capture+analysis+resume+export while still showing arrivals → silent total data loss.
- #7 H · S-SW-1 — write-path failures masquerade as scroll stalls / phantom completion (non-atomic `count` mirror lags IDB truth; QuotaExceeded swallowed by `void handleItemList`).
- #9 H · S-DD-1 — `upsertItems` blind-spreads the last arrival with no freshness guard → a stale straggler overwrites good signed URLs with expired ones on resume.
- #17 H · S-DB-8 — `allRecords()` (getAll the whole library) on every alarm + twice per poster batch → self-inflicted SW OOM at 10k+.
- #18 H · S-DB-2 — upgrade is non-idempotent + not oldVersion-aware; no versionchange/blocked handlers → the first-ever version bump bricks upgrading users / deadlocks on blocked.
- #20 M · S-DB-5 — `navigator.storage.persist()` never called → the whole archive sits in the evictable bucket and can vanish under disk pressure.
- #26 M · S-DB-3 — one mega read-write tx over 1,400+ items is one non-IDB await from `TransactionInactiveError` and all-or-nothing under QuotaExceeded.
- #25 M · S-SW-8 — the one-shot legacy migration clears its source only after a successful await → any throw re-attempts the failing import forever.

**SW lifecycle & resumability** — `→ §6.3`
- **#3 C · S-SW-4** — `cp_queue_revive` alarm created unconditionally at SW top-level → every sub-minute cold start resets its timer → under steady traffic the one resumability spine can effectively never fire.
- #14 H · S-RS-5 — a crash-looping media item is swept back to pending as a FREE retry (attempts never increments) → starves the analysis queue forever; a crash after the paid Gemini call re-spends.
- #19 M · S-RS-3 — after sleep, pre-sleep signed URLs have expired → every media fetch 403s and burns the permanent-failure budget → backlog lost.
- #22 M · S-OS-1 — resumability spine races (double `createDocument` TOCTOU, `queue_run` before the offscreen listener is ready is lost, no keep-alive during a long drain, one failing consumer starves the shared alarm, in-memory guards reset on restart).
- #28 L · ENV-01 — staleness/backoff computed from `Date.now()` deltas a sleep/NTP jump can invert; blanket `return true` on fire-and-forget onMessage leaks ports.

**Injection robustness & platform drift** — `→ §6.4`
- #5 H · DRIFT-02 — the interceptor is the whole moat but has no liveness self-check: a GraphQL/Worker/aliasing migration makes capture silently capture NOTHING, presented as generic "incomplete".
- #6 H · COMPL-02 — the on-wire `hasMore`/`cursor` field name is unverified; `coerceHasMore` reads only `hasMore` → if the real key differs, coerce→true forever and no source reaches honest "done".
- #8 H · EVICT-01 — DOM eviction silently disables under several conditions (non-tile front child aborts the pass; permalink-selector drift disables eviction + nudge) → the ~3k renderer OOM returns silently.
- #27 M · XPLAT-01 — Source is a closed TikTok enum; interception regex, sub-tab hints, normalizer, export tag all TikTok-hardcoded → the "lane-generic" claim has no adapter seam.

**Network, session & anti-block** — `→ §6.5`
- **#4 C · COMPL-01** — `hasMore:false` trusted absolutely → a throttled/errored/logged-out early stop (or an error envelope coerced to false) ships as a complete "success" under the success filename.
- #11 H · INJ-02 — the one layer that sees HTTP status throws it away (`res.clone().json()` with no `res.ok`/content-type) → 403/5xx/429/offline/captcha/truncated all collapse into one generic "rate-limit" stall.

**Orchestration, observability & honest-incompleteness UX** — `→ §6.6`
- #12 H · SUP-02 — autonomous mode opens the FYP (own handle never captured) → captures nothing, four giveups, no popup reason → the shipped unattended mode is a no-op.
- #13 H · SUP-05 — the cross-source walk keys on unverified `data-e2e`/English-text selectors + blind click + fixed 1500ms sleep → a rename/locale/slow-swap silently degrades a source to giveup.
- #15 H · COMPL-07 — nothing compares captured vs the profile's stated saved count, and per-source counts report the global cumulative total → truncation is structurally undetectable.
- #16 H · EXP-01 — after a 10k sweep the only user export is a SW base64 data:URL that exceeds download limits, spikes SW memory, and fails silently; the size-safe path is a dev hotkey.
- #23 M · CONC-01 — a second logged-in tab moves the shared count (masks a real stall); an extension auto-update orphans a still-scrolling zombie content script; an account switch merges two accounts' libraries by id.

---

## 4. Overlooked gaps & missing capabilities (what the register alone misses)

**17 gaps** the layer-by-layer audit under-weighted — most bite specifically on an *unattended overnight run*:

- **Background-tab throttling (the big one):** an unattended tab is backgrounded/occluded, so Chrome throttles `setTimeout`/`rAF` and pauses rendering — the incremental scroll never paints and the IntersectionObserver never fires. Capture silently stalls for reasons unrelated to TikTok. **Zero** `visibilityState`/`hidden`/`rAF`/`onLine` handling exists (grep-confirmed).
- **Tab discard under memory pressure** overnight kills the content script; the revive alarm finds a blank/discarded tab, stands down, and the run dies with `current` stuck.
- **macOS App Nap / on-battery throttling** slows the loop below the loader's expected cadence (distinct from full sleep).
- **Hung-loop with no heartbeat:** if the scroll loop wedges but still answers `isTabScrolling:true`, the supervisor waits indefinitely — no proof-of-progress watchdog, no wall-clock deadline.
- **Chrome browser auto-update / restart** closes every tab; nothing re-opens/re-injects/re-drives the persisted `current`.
- **Corpus mutation between runs:** resume is re-scroll-from-top with no cursor; new favorites land at the top and shift the pagination window → the moving live-window can skip never-captured items, undetected.
- **No tombstoning:** unfavorited/removed items are never reconciled → the archive silently diverges from source-of-truth.
- **Analysis backlog intractable at scale:** one-item-at-a-time (video fetch + Gemini) → a 10k backlog is *days* of serial work, not one overnight.
- **No spend/cost ceiling** on the paid analysis lane → unbounded Gemini cost; a poison item or crash-gap re-run loop → runaway billing.
- **LLM error classes beyond 429** (401/RESOURCE_EXHAUSTED/safety-block/oversized) degrade to generic per-item failures that burn the ceiling.
- **No global single-capture lock** → two driven runs (manual Sync + autonomous alarm, or two tabs) double the anti-bot footprint; only guard is an in-memory boolean.
- **Captive-portal / proxy 200-HTML** for an API request → swallowed `JSON.parse` failure reads as a benign stall.
- **No eviction/wipe detection:** after an origin eviction, the next run silently re-captures from zero (or reads phantom-done off the stale count) with no warning.
- **Detached-node / listener leak over 8 hours** — eviction was verified flat for ~1,437 items over minutes, not 10k over hours.
- **Export atomicity vs a live writer** — an export snapshot during capture/poster writes can serialize a torn view.
- **Locale-fragile saved-count parsing** — the completeness guard reads localized/abbreviated text ('1.5K', '1 463', non-Latin digits) → the guard can itself mis-read.
- **Account-ban blast radius has no kill-switch** — the ban-averse posture is *stated* but there is no conservative default cap, no ban-detection→halt, no circuit-breaker; a detection event escalates straight to a permanent ban of the founder's real account.

**Live addenda (2026-07-10 evening, founder session — three interruption modes with live evidence):**

- **SESS-01 · Flagged-session empty-200 (C).** While a session is flagged (pre/post-captcha), `*_list` API calls return **HTTP 200 with an EMPTY body** (captured on the wire: `post`/`collect`/`favorite` item_list all 200 + 0 bytes while `story`/`explore` still answered), and the SPA grid renders empty/stale under every sub-tab. **A manual page refresh fixes it** (observed 2–3× by the founder). Current code: an empty body is a swallowed `.json()` rejection → reads as a generic stall → giveup. Must classify as a distinct flagged-state signal with a **bounded auto-refresh recovery rung** (§6.5).
- **OVLY-01 · Input-swallowing overlays (H).** TikTok's screen-time reminder (~1 hr of watching: "Okay → enter passcode" / "Snooze" 10 min) killed two live runs — the scroll loop cannot tell "a modal is eating my input" from "TikTok stopped responding." Same class: captcha overlays, cookie/login nags. Needs overlay detection + per-overlay policy (§6.6): snooze/dismiss the benign ones automatically, route captcha to the challenge path, **never auto-enter a passcode** (that choice stays human), pause+notify on unknown overlays.
- **CHAL-UX · Captcha must be a user-visible, resumable pause (H).** "Pause+prompt" is not enough for a background/unattended run: the user must be told (chrome notification + popup reason), the tab must be reachable to solve the captcha in, and the run must **auto-resume** when healthy arrivals return — promoted from a §6.5 line item into Wave A scope (A4/A5).

**Wire-format pin (2026-07-10, live fixture):** a real `post/item_list` **pagination** envelope confirms top-level `hasMore` (boolean) · `cursor` (string; **`"-1"` on the final page**) · `statusCode` (0 = API-ok, alongside `status_code`/`status_msg`) · `itemList`. A genuine done-page (`hasMore:false`, `cursor:"-1"`) is committed at `fixtures/tiktok-post-item-list-envelope.json`. Caveats: the `story` variant uses PascalCase (`HasMoreAfter`/`MaxCursor`) — the multi-key defensive read stays; `collect`/`favorite` pagination envelopes still need a live pin at the Wave-A proof (first-page responses can be legitimately EMPTY per SESS-01, so a first-page read is not a pin).

**18 missing capabilities** (`→` become the intelligence/resilience the product needs): capture-liveness/interceptor self-check · adaptive closed-loop scroll · completeness accounting + honest-incompleteness surfacing · self-healing/self-verifying storage · typed transport-signal classification · drift detection & platform adaptivity · preflight self-test before an unattended run · bot-wall/auth-wall detection + hand-back · background-tab/visibility resilience · single-active-driver lease · content-script liveness watchdog + run deadline · corpus reconciliation (cursor-precise resume, tombstoning, mutation detection) · analysis-lane cost & throughput management · account/identity provenance & scoping · user-facing run controls & feedback · portable complete export at scale · monotonic/coalescing merge · telemetry that *feeds decisions* (not just displays).

---

## 5. Cross-cutting invariants (every capture change must preserve these)

1. **Pure core behind thin glue.** Every decision (motion, completion, pacing, sequencing, merge, storage-health) lives in a pure, unit-tested module with injected `now()`/`rng()` — no globals; browser glue only does DOM/IO. (The scroll fix adds `scrollMotion.ts` in exactly this idiom.)
2. **Network is truth; the DOM is disposable.** Capture is sourced from intercepted responses; tiles carry zero information and may be evicted freely. Eviction/pruning may never gate on or lose captured data.
3. **Completion is a *verified real signal* only.** `hasMore:false` counts as "done" only on a healthy 2xx non-challenge page that passes a captured-vs-expected sanity check. A stall, timeout, motion-failure, error, or auth-wall is **never** "done."
4. **Honest incompleteness — never a false success.** A truncated/errored/blocked run is a distinct, user-visible, persisted outcome (with a reason), never presented or exported as complete. A swallowed write must halt, not present as done.
5. **No bot-hammering.** Conservative-by-default cadence, adaptive slowdown on rising latency, and an account-safety kill-switch that halts on any ban/challenge signal. Human cadence is account-safety, not decoration.
6. **One driver, isolated per run.** A persisted single-capture lease; per-run/per-tab progress (own arrivals + own new-id delta), never a process-global scalar driving an irreversible decision.
7. **Self-verifying at every boundary.** Preflight before an unattended run (logged-in · own profile · DB healthy · interceptor live · storage headroom); runtime self-checks (interceptor silence, drift, storage pressure, liveness heartbeat) that are *loud*, not silent.

---

## 6. Domain solutions

Each: the failures it closes · root cause · durable solution (grounded) · design · acceptance. Best-practice sources are cited inline; full list in the audit artifact.

### 6.1 Scroll motion & pagination triggering — closes SCROLL-01, SCROLL-03, COMPL-04, PACE-03

**Root cause.** Lazy loaders are **edge-triggered on viewport transit**, not final position (MDN IntersectionObserver; Cypress #3848; testing-library/user-event #541). `scrollTop = scrollHeight` teleports past the sentinel without a leave→re-enter crossing, so it never re-fires; virtualization makes `scrollHeight` a moving lie; and instant teleport is the #1 anti-bot tell (Browserless). The reducer then can't tell "I failed to move the sentinel" from "server backpressure" from "done."

**Durable solution.** A new pure module **`src/lib/capture/scrollMotion.ts`** owns the physical-motion decision and a recovery ladder: **incremental jittered `scrollBy`/wheel down** (400–900px, variable — puppeteer-autoscroll-down uses 250px/100ms bidirectional) → on a no-arrival dwell, an **up-then-down re-trigger** (`retrigger`) that forces the sentinel to leave and re-enter → only after that also fails, a **confirmed `stall`** handed up to the *unchanged* `scrollState.ts` as a `tick`. The decisive discriminator (§A4): `main-world.js` bumps a monotonic `tiktokRequestsIssued` when an `item_list` request is *initiated*; if a dwell elapses with no new item AND no request was even issued → self-inflicted lazy-load stall → `retrigger`; if a request *was* issued but came back empty/429 → genuine backpressure → `backoff`. **`scrollState` only ever receives a `tick` when `scrollMotion` exhausts its ladder** — that one change makes the existing stall→backoff→giveup correct instead of trigger-happy.

**Design** (pure reducer `step(state, event, deps) → {state, command}`; `MotionPhase = stepping|retriggering|stalled`; commands `down|retrigger|stall|backoff`; up-nudge clamped to `maxUpPx` so it stays inside the live tile window — §6.4 eviction interaction). Glue: `wheelBy(container, dy)` dispatches real `WheelEvent` transit in 3–5 sub-steps then `scrollBy` to realize it; `maxSafeUpPx()` clamps above the topmost live tile; `waitForContent(before, ms)` replaces the blind timer. Delete `nudgeToBottom`'s three teleports. Also fold in **PACE-03**: full-jitter backoff (uniform 0..cap, AWS full-jitter), session-level dwell drift + occasional breaks, mask `Function.prototype.toString` for the wrapped fns, drop the console banner. And **COMPL-04**: make the giveup budget evidence-adaptive (extend while `hasMore:true` + cursor advancing; require non-empty items for resume grace). **SCROLL-03**: derive the scroller from the confirmed grid, validate a test scroll changes `scrollTop` (closed-loop), scope anchor queries to that grid, re-validate the cached handle on stall/mutation.

**Acceptance** (12 criteria in the audit's scroll spec): pure-core determinism + the four command transitions incl. the `requestIssued` discrimination in both directions; live — a >1,400-item corpus reaches `done`/count-justified-`giveup` with zero teleports in the path, a forced lazy-load stall recovers via `retrigger` **without** entering `scrollState.wait`, an injected 429 **does** back off, DOM stays flat, delta stddev > 50px with non-constant timing.

### 6.2 Storage resilience & self-healing — closes STORE-01, S-SW-1, S-DD-1, S-DB-8/2/5/3, S-SW-8

**Root cause.** `openStore` creates object stores only inside idb's `upgrade` callback (fires only on version change), so a v1 DB existing *without* stores is unrecoverable; the non-atomic `count` mirror is trusted over IDB truth; `upsertItems` blind-spreads with no freshness guard; unbounded `getAll` runs in a memory-constrained SW; `persist()` is never called.

**Durable solution.** Treat the on-disk DB as **adversarial**. After `openDB`, assert all four stores exist; if any is missing → close and reopen at `version+1` with a `contains()`-guarded idempotent upgrade, falling back once to `deleteDB`+rebuild; **never memoize a rejected open** (null `storePromise` on catch). An unrecoverable DB → HALT capture + surface to the popup (never let a swallowed write present as done). Make the upgrade an **idempotent, oldVersion-driven ladder** with `{blocked, blocking, terminated}` handlers (blocking→`db.close()`). Reconcile `count = await db.count()` on every SW/run start; require corroboration (flat count while `hasMore:true` is never done); catch QuotaExceeded distinctly → halt + "storage full", never toward failure ceilings. Call **`navigator.storage.persist()`** at startup (Dexie permissions-query-first pattern) + warn if not granted; isolate posters in a separate bucket later. Answer "work remains" via an **index/openCursor early-exit**, not `getAll`. Merge **field-by-field with a monotonic `capturedAt` tiebreaker** so absence never overwrites presence and a stale straggler never clobbers fresh signed URLs. Keep transactions synchronous+short (reads → in-memory merge → short write-only tx, chunked ~500). Fix the legacy migration to clear-in-`finally` + a `migratedLegacy` flag.

**Acceptance:** a store-less/corrupt DB self-heals (verified by planting one) or halts loudly with an export-then-reset path; a v1→v2 migration from a populated v1 DB is shipped+tested before any bump; `persist()` result logged; no `getAll` on the alarm path; a stale straggler cannot overwrite a fresher signed URL; QuotaExceeded halts with a distinct state.

### 6.3 SW lifecycle & resumability spine — closes S-SW-4, S-RS-5, S-RS-3, S-OS-1, ENV-01

**Root cause.** `chrome.alarms.create` called unconditionally at module top level resets the periodic timer on every cold start; in-memory `running` guards reset on restart; wake paths race; `Date.now()` deltas are sleep/NTP-fragile.

**Durable solution.** Register the alarm **idempotently** (`chrome.alarms.get` first, or only from `onInstalled`/`onStartup`) — the #3 critical fix. Serialize offscreen creation through a module-global in-flight promise using `chrome.runtime.getContexts` (treat "single document" as success); have the offscreen doc **self-kick** (reviveJobs+drain) on load; hold a keep-alive `Port` during drains; wrap each shared-alarm consumer in its own try/catch; back every "is X running" guard with a **persisted TTL lease** that survives termination. Add poison-pill detection: increment a `reviveCount` and quarantine to `failed` past a small ceiling; write job→done **in the same transaction** as `saveGroundings`; short-circuit `processItem` when already grounded. Store a **heartbeat timestamp**; on wake, if the gap exceeds the signed-URL TTL, re-capture fresh URLs before media fetch; classify 403/expired vs transient separately from a dead item. Use a **monotonic** elapsed measure for staleness/backoff (clamp negative deltas to 0). Return `true` from `onMessage` only on the branch that answers asynchronously.

**Acceptance:** the revive alarm fires reliably under steady capture traffic (not reset by cold starts); a crash-looping item is quarantined, not free-retried forever; a paid Gemini result is never re-spent after a crash; a sleep/wake gap re-captures fresh URLs; a clock jump can neither strand a `current` forever nor abandon a live run.

### 6.4 Injection robustness & platform-drift resilience — closes DRIFT-02, COMPL-02, EVICT-01, XPLAT-01

**Root cause.** The interceptor — the whole moat — has no self-check; the load-bearing `hasMore` field name is empirically unverified; eviction silently disables on selector drift; the pipeline is TikTok-hardcoded with no adapter seam.

**Durable solution.** **Interceptor self-check:** grid populated but zero network arrivals after N scrolls ⇒ emit a distinct "no `item_list` intercepted — endpoint may have drifted" diagnostic (not a giveup); broaden/centralize the matcher (item_list + likely GraphQL op names), harden the wrap (`Object.defineProperty` non-writable, dual fetch+XHR, investigate Worker scope). **Pin the completion signal:** read `hasMore` from all plausible keys (`hasMore`/`has_more`/nested) with the same defensive coercion, **capture a live `item_list` fixture to pin the real field**, and add a conservative secondary terminal (empty next-cursor + fully-deduped page). **Harden eviction:** scan past leading decorator/skeleton nodes to the oldest evictable tile instead of aborting; base eviction on live tile count; match multiple href + `data-e2e` patterns; add a generic "remove oldest N children of the tallest scroller" fallback + a DOM-node ceiling alarm. **Adapter seam (XPLAT-01):** introduce a platform-adapter interface (sources list · interception matcher · navigation strategy · normalizer · platform/saveKind mapping), make `Source` per-adapter, thread `platform` through the open schema — the seam the "lane-generic" claim needs before Instagram.

**Acceptance:** a simulated endpoint/field rename produces a loud drift diagnostic (not silent zero-capture); the real `hasMore`/`cursor` keys are pinned by a live fixture with a secondary terminal; eviction survives a decorator front-child and a selector rename via fallback; the TikTok pipeline sits behind an adapter interface with no hardcoded platform vocab in shared code.

### 6.5 Network, session & anti-block posture — closes COMPL-01, INJ-02, + gaps (captive-portal, kill-switch)

**Root cause.** The interceptor discards HTTP status (`res.clone().json()` with no `res.ok`/content-type), so every non-2xx, HTML interstitial, offline, or challenge collapses into one generic "rate-limit" stall the reducer can't branch on; and `hasMore:false` is trusted even on an error/challenge envelope.

**Durable solution.** In the interceptor, read `res.status` + content-type + parsed `statusCode` and forward a **typed transport signal** (`ok | http_error | challenge | api_error | offline`). Branch: challenge/captcha → **pause + prompt** (freeze the giveup counter, don't bot-hammer the wall) and auto-resume when `item_list` resumes; auth/redirect → a distinct **"session expired"** terminal; 429 → wait; 5xx → bounded retry; offline → pause; truncated final page → retry once before dropping; captive-portal HTML → a distinct "not TikTok JSON" state, not a stall. Accept `hasMore:false` as done **only** on a healthy page passing the completeness sanity check (§6.6). Add a **conservative default rate cap + ban-detection→immediate-halt circuit-breaker** (the account-safety kill-switch) — a detection event must produce a graceful stop, never escalate to a real-account ban.

**Flagged-session empty-200 (SESS-01, live-evidenced 2026-07-10).** A 200 with an EMPTY body on a `*_list` endpoint is never benign and never a parse-and-forget: forward it as a distinct `empty_ok` transport signal. N consecutive `empty_ok`s (N≈2–3) ⇒ flagged-state diagnosis → **recovery ladder:** (1) one bounded page reload (`location.reload()` via the supervisor's resume path — the founder's observed manual fix, automated), (2) re-verify with a fresh arrival, (3) still empty ⇒ escalate to the challenge path (pause + notify), never to giveup-as-stall. The reload rung is once per run per source — reload-looping a flagged session is bot-hammering.

**Captcha pause must be user-visible + auto-resuming (CHAL-UX).** On a challenge signal: freeze every giveup/stall counter, persist a `waiting_on_user` state, raise a chrome notification + popup reason ("solve the captcha in the TikTok tab — capture resumes automatically"), keep the tab open/reachable, and watch for the next healthy arrival (or overlay-gone) to auto-resume the run where it paused. An unattended run that hits a captcha ends the night paused-with-reason, never given-up or falsely done.

**Acceptance:** injected 403/redirect → "session expired" (not "done"); captcha DOM → pause+prompt without burning giveup; 200-HTML from a proxy → distinct non-JSON state; offline → pause with a frozen counter; any ban/challenge signal → immediate halt + surfaced reason; N consecutive empty-200s → one auto-refresh then challenge-path escalation (never giveup-as-stall); a paused-on-captcha run auto-resumes on the first healthy arrival after the user solves it.

### 6.6 Orchestration, observability & honest-incompleteness UX — closes SUP-02, SUP-05, COMPL-07, EXP-01, CONC-01, + gaps (background-tab, heartbeat, single-driver, preflight)

**Root cause.** Autonomous mode never resolves its own target; the cross-source walk is a blind click + fixed sleep on churny selectors; per-source counts report the global total so truncation is invisible; export is a SW data:URL; nothing isolates a run or keeps an unattended tab alive/awake.

**Durable solution.** **Autonomous target (SUP-02):** capture + persist the user's own handle/secUid from an intercepted `item_list`, navigate `/@handle` before driving, gate the toggle until a handle is known, return a structured outcome (`no_tab`/`logged_out`/`no_profile`) to the popup for **every** Sync. **Sub-tab nav (SUP-05):** key on locale-independent handles (role=tab + accessible name, route fragments, tab position); replace the fixed 1500ms sleep with **wait-for-the-target-source's-first-item_list-arrival**; prefer a profile-shaped tab; report a distinct "sub-tab nav failed." **Completeness accounting (COMPL-07):** track a per-run captured **delta** (new-id count for THIS run) as `scroll_done.captured`; read the source's declared saved count (with a robust localized-number parser) and surface captured/expected; refuse "done" (mark "suspicious") on a grossly low ratio without a healthy final page — with a **persisted post-run report** the user can read. **Export at scale (EXP-01):** route all exports through the offscreen Blob/`createObjectURL` path, check `chrome.runtime.lastError` on every download, add a first-class popup export button, bundle poster bytes or omit unresolved refs. **Isolation & liveness:** a **persisted single-capture lease** (navigator.locks/meta) so only one run drives; per-run/per-tab progress; **content-script heartbeat + wall-clock deadline** so a hung loop can't silently hang overnight; fail-stop on "Extension context invalidated" and re-inject on `onInstalled`; tag captures + checkpoints with the **owner account**. **Background-tab resilience (the big gap):** detect `document.hidden`/discarded/throttled tab and **pause+notify** rather than silently stall; keep the driven tab foregrounded or drive by a mechanism that survives occlusion; a **preflight self-test** (logged-in · own profile · DB healthy · interceptor live · storage headroom) before committing to an unattended run.

**Overlay & interruption handling (OVLY-01, live-evidenced 2026-07-10).** The driven tab must detect input-swallowing overlays — the failure that killed two live runs. Two detection legs: (a) **known-overlay classifiers** (the screen-time reminder: a dialog carrying "Snooze" + a passcode prompt; captcha frames/containers; login/cookie nags), and (b) **generic**: a test scroll that changes no `scrollTop` while a modal/dialog element sits over the grid (composes with §6.1's closed-loop motion validation — "my input isn't landing" routes here before it ever reads as a stall). Per-overlay policy: screen-time → **auto-click Snooze** (it recurs ~10-min; snooze again, count + log each), **never auto-enter the passcode** — that self-control choice stays human; captcha → the §6.5 challenge path (pause + notify + auto-resume); unknown overlay → pause + notify with a screenshotable reason. All overlay decisions live in a pure classifier module (DOM facts in, verdict out) so every policy is unit-tested.

**Acceptance:** autonomous Sync navigates to the own profile and either captures or returns a visible reason; a sub-tab rename/locale change degrades to a reported "nav failed," not a silent giveup; a grossly short source is marked "suspicious" with captured/expected surfaced; export of a 10k library succeeds via the Blob path with lastError checked; two concurrent Syncs are prevented by the lease; a backgrounded/hidden tab pauses+notifies instead of stalling; an overnight run that wedges hits its deadline and reports incomplete; a planted screen-time dialog is snoozed (run continues, snooze logged) and a planted captcha overlay pauses+notifies without burning giveup — with the passcode path provably never taken.

---

## 7. Exit criteria — "fully satisfied"

Capture is done when an **unattended full-library capture of a multi-thousand-item account** (the founder's real corpus):

1. completes to an honest `hasMore:false`-verified **done** per source, or a **count-justified, reason-labeled incomplete** — never a false "done";
2. holds **flat heap + DOM** across the whole run (verified at 10k over hours, not just 1,437 over minutes);
3. **survives** a service-worker kill, an offscreen crash, a laptop sleep/wake, a backgrounded/occluded tab, and a Chrome/extension update mid-run — resuming or pausing+notifying, never silently dying;
4. **self-heals or halts-loudly** on a partial/corrupt DB, storage pressure, or eviction — never silent data loss;
5. **degrades honestly** on TikTok DOM/field drift, a session expiry, or a captcha/soft-block — with a user-visible, actionable reason and an account-safety halt (no bot-hammering a wall);
6. surfaces **captured-vs-expected completeness** per source and a persisted post-run report;
7. runs **one driver at a time**, account-tagged, at a conservative account-safe cadence;
8. and every decision above is proven by a **pure unit test** plus one **live proof run** on the real corpus.

---

## 8. Provenance

Audit run 2026-07-10 (`capture-resilience-audit`, 16 agents, 1.5M tokens, 0 errors): capability decomposition · 3 adversarial failure sweeps → completeness critic (28 ranked, 17 gaps, 18 capability gaps) · GitHub/StackOverflow prior-art (MV3 lifecycle · IndexedDB robustness · infinite-scroll/interception/anti-bot) · 6 domain spec sections + the scroll deep spec. Grounding: puppeteer-autoscroll-down · Browserless/ScrapeOps human-scroll · MDN IntersectionObserver · Cypress #3848 · Dexie persist-pattern · AWS full-jitter backoff · patterns.dev virtualization. Raw artifact retained in the workflow transcript; this spec is the authored synthesis.
