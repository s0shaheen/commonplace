// ISOLATED-world content script. Relays MAIN-world captures to the service worker,
// drives auto-scroll (Alt+Shift+A), open-schema export (Alt+Shift+S), starts the extraction queue
// (Alt+Shift+E), and logs queue status to the SW console (Alt+Shift+Q).

import { sampleMemory, formatHudLine, shouldLogSample } from "./lib/capture/instrument.js";
import { coerceHasMore, isTerminalPage } from "./lib/capture/interceptParse.js";
import { initialScrollState, step as scrollStep, GIVEUP_STALL_CYCLES } from "./lib/capture/scrollState.js";
import { nextDwellMs, backoffMs } from "./lib/capture/pacing.js";
import { tilesToEvict, DEFAULT_LIVE_WINDOW } from "./lib/capture/pruneWindow.js";
import { arrivalDrivesRun } from "./lib/capture/supervisor.js";
import { stepMotion, initialMotionState, MAX_RETRIGGERS } from "./lib/capture/scrollMotion.js";
import { classifyOverlay } from "./lib/capture/overlayClassifier.js";
import { stepRecovery, initialRecoveryState } from "./lib/capture/sessionRecovery.js";
import { clampUpPx } from "./lib/capture/scrollGeom.js";

let lastSource = null;
let lastHasMore = null; // latest coerced paging signal from the message path (Task 1)
let lastCursor = null;
let lastTransport = null; // latest typed transport signal (§6.5) — feeds sessionRecovery + terminal gate
let pageArrivals = 0; // monotonic count of item_list messages — autoScroll keys page_captured on ARRIVAL, not count growth
let healthyArrivals = 0; // monotonic count of transport:"ok" arrivals — the auto-resume signal for a paused run
let lastRequestsIssued = 0; // monotonic count of item_list requests INITIATED (from main-world) — scrollMotion's discriminator
// Carry-forward (2), Task 5: the source the supervisor asked THIS run to capture. Set at the start of
// a capture run, cleared at its end. While set, only arrivals whose source matches may drive the run's
// scroll signals — a straggler from the previous source must not inject its hasMore into this run.
// Null = the manual Alt+Shift+A dev path (no supervisor tag) → arrivalDrivesRun accepts everything.
let activeRunSource = null;

window.addEventListener("message", (e) => {
  if (e.source !== window || !e.data || e.data.__attic !== true) return;
  if (e.data.kind === "request_issued") {
    // scrollMotion's decisive discriminator (§6.1 §A4): main-world bumps this the instant an item_list
    // request is INITIATED. A dwell that elapses with no arrival AND no new request ⇒ self-inflicted
    // lazy-load stall (retrigger); a request that fired but returned nothing ⇒ backpressure (backoff).
    lastRequestsIssued = e.data.count | 0;
    return;
  }
  if (e.data.kind === "item_list") {
    // ALWAYS relay the SLIM, already-normalized+source-tagged items the main world parsed (Task 3) —
    // the heavy raw envelope no longer crosses any structured-clone boundary. Even a straggler from
    // the previous source is valid data: the SW upserts by id (idempotent, unions sources), so we
    // never drop a real capture. An empty/challenge transport relays items:[] (nothing to store) —
    // fine; the SIGNAL is what the run needs. coerceHasMore below is idempotent on the coerced value.
    chrome.runtime.sendMessage({ kind: "item_list", url: e.data.url, source: e.data.source, items: e.data.items });
    // Carry-forward (2): but only let an arrival whose source matches the ACTIVE run drive that run's
    // completion signals (pageArrivals / lastHasMore / lastCursor / lastTransport). A late favorites
    // page delivered during the likes run must not bump likes' arrival count or inject favorites' state.
    if (!arrivalDrivesRun(activeRunSource, e.data.source)) return;
    lastSource = e.data.source ?? lastSource;
    // main-world forwards RAW hasMore; coerce it through the tested pure module (missing/unknown →
    // more-may-exist, NEVER false). We coerce the tiny forwarded field rather than re-normalizing
    // the whole envelope on the page thread (§2.3: keep heavy work off the renderer).
    lastHasMore = coerceHasMore(e.data.hasMore);
    lastCursor = e.data.cursor ?? null;
    lastTransport = e.data.transport ?? "ok";
    if (lastTransport === "ok") healthyArrivals++;
    pageArrivals++;
  }
});

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Find the tallest scrollable element — handles TikTok's inner/virtualized scroll container.
let cachedScroller = null;
function getScroller() {
  if (cachedScroller && cachedScroller.isConnected) return cachedScroller;
  let best = null;
  let bestH = 0;
  for (const el of document.querySelectorAll("div, main, section, ul")) {
    const oy = getComputedStyle(el).overflowY;
    if ((oy === "auto" || oy === "scroll") && el.scrollHeight > el.clientHeight + 200 && el.clientHeight > 300) {
      if (el.scrollHeight > bestH) {
        best = el;
        bestH = el.scrollHeight;
      }
    }
  }
  cachedScroller = best;
  return best;
}

// ── DOM tile eviction ─────────────────────────────────────────────────────────
// The §2.3 memory fix (the "slows at 1k, crashes at 3k" vector). The old code used
// content-visibility, which only skipped PAINT for off-screen tiles and evicted NOTHING — the nodes,
// React fibers and decoded thumbnails all stayed resident until the renderer OOMed. This actually
// REMOVES the oldest tiles, holding the DOM at a bounded live window (DEFAULT_LIVE_WINDOW) no matter
// how large the corpus grows. The which-to-remove decision is the pure, tested `tilesToEvict`; the
// grid GUARDRAILS from the old code are ported wholesale below (resolveGrid: a confirmed, repeating,
// anchor-derived grid only — refuse to act otherwise).

function resolveGrid() {
  const anchors = document.querySelectorAll('a[href*="/video/"], a[href*="/photo/"]');
  if (anchors.length < 12) return null; // grid not populated yet
  const a = anchors[anchors.length >> 1]; // middle anchor — resilient to class churn
  let best = null;
  let bestCount = 0;
  for (let n = a; n && n !== document.body; n = n.parentElement) {
    const p = n.parentElement;
    if (p && p.childElementCount > bestCount) {
      bestCount = p.childElementCount;
      best = n;
    }
  }
  if (!best || bestCount < 6) return null; // no repeating grid → refuse to act
  return best.parentElement;
}

// Per-grid eviction bookkeeping. `evictGrid` is the grid element we're currently pruning; when
// TikTok re-renders (SPA tab switch Likes<->Favorites) the element is replaced, so we reset the
// per-grid counter for the fresh node. `evictedInGrid` is `alreadyEvicted` for the pure function.
let evictGrid = null;
let evictedInGrid = 0;

// A "tile" is a grid child that is (or contains) a video/photo anchor — the same anchors
// resolveGrid keys on. Spinners, ads, skeleton placeholders and loader sentinels are NOT tiles.
const TILE_ANCHOR_SEL = 'a[href*="/video/"], a[href*="/photo/"]';
function isTile(el) {
  return !!el && (el.matches?.(TILE_ANCHOR_SEL) || !!el.querySelector?.(TILE_ANCHOR_SEL));
}

// Trim the confirmed grid to the live window by removing the OLDEST (front) tiles. Returns the
// number evicted this cycle (for the HUD's running total). Guardrails: does nothing without a
// confirmed repeating grid, and never removes a child that isn't a tile.
//
// SAFETY — eviction can NEVER lose corpus data: capture is network-sourced (main-world intercepts
// TikTok's own item_list responses and forwards the normalized items). A grid tile carries ZERO
// information for us once its page is captured; it exists only to make TikTok paginate. Removing it
// frees renderer memory and loses nothing. Idempotent dedup by id means even a re-scroll is safe.
function pruneGrid() {
  const g = resolveGrid();
  if (!g) return 0; // no confirmed repeating grid → refuse to act (ported guardrail)
  if (g !== evictGrid) {
    evictGrid = g; // new / re-rendered grid element → reset per-grid bookkeeping
    evictedInGrid = 0;
  }
  // Count TILE children only — a trailing skeleton/spinner row must not inflate `present` and
  // cause over-eviction of real tiles (the pure function's live-window math assumes tiles).
  let present = 0;
  for (const child of g.children) if (isTile(child)) present++;
  const total = evictedInGrid + present; // logical tiles this grid element has ever held
  const evict = tilesToEvict(total, DEFAULT_LIVE_WINDOW, evictedInGrid);
  // `evict` is always the contiguous oldest prefix, so removing that many front TILES removes
  // exactly those (= max(0, present − liveWindow) — drift-proof even if TikTok virtualized some
  // itself; see pruneWindow.ts). We keep the newest DEFAULT_LIVE_WINDOW tiles at the end.
  // RUNTIME TILE-CHECK (review fix): the pure module's guarantee assumes an append-at-end grid of
  // tiles. Verify per removal — a non-tile front child (spinner/ad/skeleton) or a prepending/
  // reordered grid means our positional model is wrong, so ABORT the pass rather than risk eating
  // the newest tiles; we retry next poll cycle against fresh state.
  let removed = 0;
  for (let k = 0; k < evict.length; k++) {
    const front = g.firstElementChild;
    if (!isTile(front)) {
      console.warn("[commonplace] eviction aborted — non-tile front child (grid reordered or decorated)");
      break;
    }
    front.remove();
    removed++;
  }
  evictedInGrid += removed; // advance by ACTUAL removals only, so an aborted pass never desyncs
  return removed;
}

// ── Capture HUD ────────────────────────────────────────────────────────────────
// A tiny, unobtrusive on-page readout of the pure `instrument.ts` telemetry — bottom-right,
// click-through (pointer-events:none), its own id so it's trivial to find/remove. Task 0 only
// surfaces numbers here; it does NOT change scroll/capture decision logic.
const HUD_ID = "attic-capture-hud";

function ensureHud() {
  let el = document.getElementById(HUD_ID);
  if (el) return el;
  el = document.createElement("div");
  el.id = HUD_ID;
  el.style.cssText = [
    "position:fixed",
    "right:8px",
    "bottom:8px",
    "z-index:2147483647",
    "pointer-events:none",
    "background:rgba(0,0,0,0.72)",
    "color:#7CFC90",
    "font:11px/1.4 ui-monospace,monospace",
    "padding:4px 8px",
    "border-radius:4px",
    "white-space:pre",
  ].join(";");
  document.documentElement.appendChild(el); // outside TikTok's #app → React never reconciles it
  return el;
}

function updateHud(line) {
  ensureHud().textContent = line;
}

function removeHud() {
  document.getElementById(HUD_ID)?.remove();
}

// ── Physical motion glue (§6.1) ──────────────────────────────────────────────────
// scrollMotion.ts decides WHICH physical command to issue; these realize it against the DOM. NEVER a
// teleport (`scrollTop = scrollHeight`) — that never makes TikTok's edge-triggered IntersectionObserver
// sentinel leave→re-enter, and is the #1 anti-bot tell. Every motion is an incremental, jittered wheel
// transit followed by a `scrollBy` to realize it (virtualization-safe).

// Incremental wheel-DOWN transit: dispatch a real WheelEvent in 3–5 sub-steps (so any wheel listeners /
// IO polyfills see the motion) then `scrollBy` to realize it. `px` is the jittered band from the core.
function wheelBy(scroller, px) {
  if (!scroller || px <= 0) return;
  const steps = 3 + Math.floor(Math.random() * 3); // 3..5 sub-steps
  const per = px / steps;
  for (let i = 0; i < steps; i++) {
    try {
      scroller.dispatchEvent(new WheelEvent("wheel", { deltaY: per, deltaMode: 0, bubbles: true, cancelable: true }));
    } catch (_) {}
  }
  scroller.scrollBy(0, px);
}

// The topmost LIVE tile's top offset in the scroller's content coordinate space. Eviction removes the
// oldest tiles, so the region above this is gone — the retrigger up-nudge must not scroll into it.
// (0 = no tile to measure → the top of the scroller is the bound; see scrollGeom.clampUpPx.)
function topmostLiveTileTop(scroller) {
  const tiles = document.querySelectorAll(TILE_ANCHOR_SEL);
  if (!tiles.length || !scroller) return 0;
  const tr = tiles[0].getBoundingClientRect();
  const sr = scroller.getBoundingClientRect();
  return scroller.scrollTop + (tr.top - sr.top);
}

// maxSafeUpPx: clamp the core's desired up-distance so the retrigger stays above the topmost live tile
// (never into evicted space — §6.4). The clamp arithmetic is the pure, tested scrollGeom.clampUpPx.
function maxSafeUpPx(scroller, desiredUp) {
  return clampUpPx(desiredUp, scroller ? scroller.scrollTop : 0, topmostLiveTileTop(scroller));
}

// Up-then-down re-trigger: scroll UP the clamped distance (real wheel), a brief human pause, then wheel
// DOWN past the prior max so the sentinel leaves→re-enters and TikTok's IntersectionObserver re-fires.
async function doRetrigger(scroller, upPx) {
  if (!scroller) return;
  const priorTop = scroller.scrollTop;
  if (upPx > 0) {
    try {
      scroller.dispatchEvent(new WheelEvent("wheel", { deltaY: -upPx, deltaMode: 0, bubbles: true, cancelable: true }));
    } catch (_) {}
    scroller.scrollBy(0, -upPx);
  }
  await sleep(120 + Math.random() * 180); // brief pause between the up and the down (human cadence)
  const overshoot = 200 + Math.random() * 220; // land PAST the prior max so the sentinel re-enters
  try {
    scroller.dispatchEvent(new WheelEvent("wheel", { deltaY: upPx + overshoot, deltaMode: 0, bubbles: true, cancelable: true }));
  } catch (_) {}
  scroller.scrollBy(0, priorTop + overshoot - scroller.scrollTop);
}

// Wait up to `maxMs` for a new arrival (poll storage.count / pageArrivals), returning EARLY the moment
// content lands. Replaces the old blind timer: the dwell is a human-cadence budget, not a fixed sleep,
// and the ACTUAL elapsed wait is fed back to stepMotion next cycle as `dwellElapsedMs`.
async function waitForContent(beforeCount, beforeArrivals, maxMs) {
  const start = Date.now();
  const POLL_MS = 150;
  while (true) {
    const elapsed = Date.now() - start;
    if (elapsed >= maxMs) break;
    await sleep(Math.min(POLL_MS, maxMs - elapsed));
    if (pageArrivals > beforeArrivals) break; // a page arrived → stop waiting, act on it
    try {
      const { count = 0 } = await chrome.storage.local.get("count");
      if (count > beforeCount) break;
    } catch (_) {}
  }
  return Date.now() - start;
}

// ── Overlay detection glue (OVLY-01, §6.6) ─────────────────────────────────────
// Every DOM read for an overlay lives here; the VERDICT is the pure classifyOverlay. We find the
// topmost blocking layer, extract its text + button labels, probe whether input is being swallowed,
// and check for a captcha-shaped container — then hand plain facts to the classifier.

function isVisible(el) {
  if (!el) return false;
  const s = getComputedStyle(el);
  if (s.display === "none" || s.visibility === "hidden" || parseFloat(s.opacity || "1") === 0) return false;
  const r = el.getBoundingClientRect();
  return r.width > 4 && r.height > 4;
}

// A fixed/absolute, high-z element covering the viewport CENTER (a modal scrim). Excludes our own HUD
// and pointer-events:none decorations. Walks up from the center element to the covering ancestor.
function findCoveringLayer() {
  const cx = Math.floor(window.innerWidth / 2);
  const cy = Math.floor(window.innerHeight / 2);
  let el = document.elementFromPoint(cx, cy);
  for (let hops = 0; el && el !== document.body && el !== document.documentElement && hops < 20; hops++) {
    if (el.id === HUD_ID) return null; // our own click-through HUD sits at center-ish z — never a modal
    const s = getComputedStyle(el);
    if ((s.position === "fixed" || s.position === "absolute") && s.pointerEvents !== "none") {
      const z = parseInt(s.zIndex, 10);
      const r = el.getBoundingClientRect();
      const coversMost = r.width >= window.innerWidth * 0.6 && r.height >= window.innerHeight * 0.5;
      if (Number.isFinite(z) && z >= 100 && coversMost) return el;
    }
    el = el.parentElement;
  }
  return null;
}

function findBlockingLayer() {
  const dialogs = document.querySelectorAll('[role="dialog"], [aria-modal="true"]');
  for (const d of dialogs) if (isVisible(d)) return d;
  return findCoveringLayer();
}

function collectButtonLabels(el) {
  const out = [];
  for (const b of el.querySelectorAll('button, [role="button"], a[role="button"]')) {
    const t = (b.textContent || "").trim();
    if (t) out.push(t);
  }
  return out;
}

// A captcha-shaped container is a strong standalone signal (classifyOverlay honors it even absent a
// blocking-layer flag) — so require it to be VISIBLE, not just present in the DOM.
function detectCaptchaContainer() {
  const sels = [
    'iframe[src*="captcha" i]',
    '[class*="captcha" i]',
    '[id*="captcha" i]',
    '#captcha-verify-container',
    '[class*="captcha_verify" i]',
  ];
  for (const sel of sels) {
    for (const el of document.querySelectorAll(sel)) {
      if (isVisible(el)) return true;
    }
  }
  return false;
}

// "My input isn't landing." Record scrollTop, attempt a small real scroll, re-read after a tick; if a
// blocking layer is present AND scrollTop didn't move, input is being swallowed (composes with §6.1's
// closed-loop motion check — this routes to a pause BEFORE it ever reads as a stall).
async function probeInputSwallowed(scroller) {
  const before = scroller.scrollTop;
  try {
    scroller.dispatchEvent(new WheelEvent("wheel", { deltaY: 60, deltaMode: 0, bubbles: true, cancelable: true }));
    scroller.scrollBy(0, 60);
  } catch (_) {}
  await sleep(60);
  return Math.abs(scroller.scrollTop - before) < 2;
}

async function gatherOverlayFacts(scroller) {
  const el = findBlockingLayer();
  const hasBlockingLayer = !!el;
  const overlayText = el ? (el.textContent || "").trim().slice(0, 2000) : "";
  const buttonLabels = el ? collectButtonLabels(el) : [];
  const captchaContainerPresent = detectCaptchaContainer();
  let inputSwallowed = false;
  if (hasBlockingLayer && scroller) inputSwallowed = await probeInputSwallowed(scroller);
  return { hasBlockingLayer, overlayText, buttonLabels, captchaContainerPresent, inputSwallowed, el };
}

// Click the button in `container` whose visible text matches `label` (case-insensitive, contains-ok).
function clickByLabel(container, label) {
  if (!container || !label) return false;
  const want = String(label).trim().toLowerCase();
  for (const b of container.querySelectorAll('button, [role="button"], a[role="button"]')) {
    const t = (b.textContent || "").trim().toLowerCase();
    if (t && (t === want || t.includes(want) || want.includes(t))) {
      try {
        b.click();
        return true;
      } catch (_) {
        return false;
      }
    }
  }
  return false;
}

// Fixed pause reasons for the two paths the pure cores don't supply one for.
const CHALLENGE_REASON_OVERLAY = "a captcha is blocking capture — solve it in the TikTok tab; capture resumes automatically";
const FLAGGED_PAUSE_REASON =
  "TikTok returned empty pages after a refresh — the session looks flagged; try again shortly or solve any challenge in the tab";

let scrolling = false;
// autoScroll drives ONE source to completion. `source` (Task 5) tags the run for carry-forward (2)'s
// arrival filter; `resuming` (carry-forward 1) tells the reducer this is a crash-resume re-scroll, so
// zero-new arrivals over the already-captured prefix count as progress, not stalls. Both default to
// the manual Alt+Shift+A dev path (no tag, forward scroll).
async function autoScroll({ source = null, resuming = false } = {}) {
  if (scrolling) return;
  scrolling = true;
  cachedScroller = null;
  activeRunSource = source; // arm the carry-forward-2 filter BEFORE any arrival can land

  // PER-RUN RESET (review fix, critical). These module-level signals belong to the PREVIOUS run /
  // source — a completed Favorites run leaves lastHasMore=false, and the store's `count` is a
  // cumulative total that persists across runs. Without both resets, re-triggering on a second
  // source (the exact path Task 5's supervisor drives) would read stale hasMore:false + a
  // pre-existing count as an instant `done` at zero pages — the very false-completion this task
  // exists to kill.
  lastHasMore = null;
  lastCursor = null;
  lastTransport = null;
  let arrivalsSeen = pageArrivals;
  const startHealthy = healthyArrivals; // baseline for the paused-run auto-resume watch
  // Baseline against the CURRENT persisted total: a pre-existing count is not growth.
  const { count: initialCount = 0 } = await chrome.storage.local.get("count");
  let prevCount = initialCount;

  // Reload guard (§6.5 SESS-01): at most ONE auto-refresh per Sync attempt per source. Persisted so a
  // reload-resume (a fresh content script after location.reload) knows it already spent its reload and
  // escalates to the challenge pause instead of reload-looping a flagged session (bot-hammering). A
  // fresh (non-resuming) run clears it; a resuming run keeps it.
  let reloadedThisRun = false;
  if (source) {
    const { captureReloadedSource } = await chrome.storage.local.get("captureReloadedSource");
    if (resuming && captureReloadedSource === source) {
      reloadedThisRun = true;
    } else if (captureReloadedSource != null) {
      await chrome.storage.local.set({ captureReloadedSource: null });
    }
  }

  // The termination decision is NOT here — it lives in the pure, tested `scrollState` reducer, now
  // sitting BEHIND `scrollMotion` (physical motion + lazy-load recovery) and `sessionRecovery`
  // (flagged-session ladder). This loop is dumb glue: gather DOM facts, feed the pure cores, and act
  // on the commands they return. Completion is a VERIFIED terminal only (isTerminalPage on a healthy
  // transport); a stall/challenge/empty-page is NEVER `done`.
  //
  // The reducer starts from the SAME persisted baseline (fix round 1): during a resume, the prefix's
  // zero-new pages must read as zero-new (grace-eligible), not as a first-page "growth" from 0.
  let st = initialScrollState(initialCount);
  // Seed the motion discriminator's baseline to the requests ALREADY issued at run start (COLD-START
  // fix). A freshly-loaded profile fired its own item_list requests during page load, so
  // lastRequestsIssued is already > 0. Left at initialMotionState's 0, the first idle cycle (no arrival
  // yet — the grid is static until we scroll) would read requestsIssued > lastRequestCount ⇒ `backoff`,
  // which does NO physical scrolling; since `down` needs an arrival and only `retrigger` scrolls from a
  // cold idle, the run would back off to `giveup` WITHOUT EVER SCROLLING. Baselining to the current
  // count makes the first idle cycle read "no NEW request since start" ⇒ `retrigger` (scrolls, triggers
  // the next page). Steady-state semantics are unchanged (an arrival re-snapshots the baseline).
  let motionState = { ...initialMotionState(Date.now()), lastRequestCount: lastRequestsIssued };
  let rec = initialRecoveryState(Date.now());
  // Task 2: the real human-cadence backoff replaces scrollState's placeholder. Math.random and
  // Date.now live ONLY here (glue). `resuming` threads the carry-forward-1 signal into the reducer.
  const deps = { now: () => Date.now(), backoffMs: (stall) => backoffMs(stall, Math.random), resuming };
  let lastSampleLogTs = 0; // console.log a CaptureSample roughly every ~5s while scrolling
  let running = true;
  let dwellElapsedMs = 0; // actual wait since the last motion — fed to stepMotion (observability)
  let snoozeCount = 0; // screen-time reminders auto-snoozed this run (logged, never a passcode)
  // Per-run eviction reset: start fresh so the HUD's "evicted N" is this run's tally and pruneGrid
  // re-resolves the grid from scratch (a new source/tab is a new grid element).
  evictGrid = null;
  evictedInGrid = 0;
  let evictedTotal = 0;

  // Enter a user-visible, resumable PAUSE (CHAL-UX): freeze the giveup ladder (we stop feeding the
  // reducer while paused), notify the SW (chrome notification + popup reason), and watch for recovery.
  // A pause is NEVER converted into a giveup — a paused-on-captcha run stays paused with its reason
  // until it's solved (healthy arrivals return / the overlay clears / we're back online) or the tab
  // closes. Returns once resumed; the caller then `continue`s and the run picks up where it left off.
  async function enterPause(level, reason, opts = {}) {
    const overlayTriggered = !!opts.overlayTriggered;
    const resumeWhenOnline = !!opts.resumeWhenOnline;
    try {
      chrome.runtime.sendMessage({ kind: "capture_notice", level, reason });
    } catch (_) {}
    console.warn(`[commonplace] capture PAUSED (${level}) — ${reason}`);
    const pauseStartHealthy = healthyArrivals;
    const PAUSE_POLL_MS = 1500;
    while (true) {
      try {
        const sample = sampleMemory({
          now: Date.now(),
          capturedCount: prevCount,
          domNodes: document.getElementsByTagName("*").length,
          heap: performance.memory,
        });
        updateHud(formatHudLine(sample, { source: lastSource, hasMore: "?", state: `paused (${level})`, evicted: evictedTotal }));
      } catch (_) {}
      await sleep(PAUSE_POLL_MS);
      if (healthyArrivals > pauseStartHealthy) break; // a fresh healthy page returned → auto-resume
      if (resumeWhenOnline && navigator.onLine !== false) break; // back online → resume (regenerate arrivals)
      if (overlayTriggered) {
        const f = await gatherOverlayFacts(getScroller());
        if (!f.hasBlockingLayer && !f.inputSwallowed) break; // the overlay cleared → resume
      }
    }
    console.log(`[commonplace] capture RESUMED (was paused: ${level})`);
    return true;
  }

  while (running) {
    const scroller = getScroller();

    // ── 1. OVERLAY GUARD FIRST — classify any blocking layer and respond like a person.
    const overlay = await gatherOverlayFacts(scroller);
    const verdict = classifyOverlay(overlay);
    const oa = verdict.action;
    if (oa.kind === "snooze") {
      const clicked = clickByLabel(overlay.el, oa.buttonLabel);
      snoozeCount++;
      console.log(`[commonplace] screen-time reminder — snoozed via "${oa.buttonLabel}" (${clicked ? "clicked" : "no button found"}); snooze #${snoozeCount}`);
      await sleep(1000); // let the modal dismiss; never rapid-click
      continue;
    }
    if (oa.kind === "dismiss") {
      const clicked = clickByLabel(overlay.el, oa.buttonLabel);
      console.log(`[commonplace] benign overlay (${verdict.overlay}) — dismissed via "${oa.buttonLabel}" (${clicked ? "clicked" : "no button found"})`);
      await sleep(1000);
      continue;
    }
    if (oa.kind === "challenge") {
      await enterPause("challenge", CHALLENGE_REASON_OVERLAY, { overlayTriggered: true });
      continue;
    }
    if (oa.kind === "pause_notify") {
      await enterPause("overlay", oa.reason, { overlayTriggered: true });
      continue;
    }

    // ── 2. EVICT the oldest tiles down to the live window (§2.3 memory fix). Network-sourced capture
    //    means this can never lose data.
    evictedTotal += pruneGrid();

    // ── 3. MOTION DECISION — the pure scrollMotion reducer picks the physical command.
    const arrived = pageArrivals > arrivalsSeen;
    arrivalsSeen = pageArrivals;
    const mStep = stepMotion(
      motionState,
      { now: Date.now(), arrivedSinceLast: arrived, requestsIssued: lastRequestsIssued, dwellElapsedMs },
      { rng: Math.random },
    );
    motionState = mStep.state;
    const command = mStep.command;

    // ── 4. FEED scrollState (the completion reducer) — only on ARRIVAL or a CONFIRMED stall/backoff.
    const { count = 0 } = await chrome.storage.local.get("count");
    let action = null;
    if (arrived) {
      // `done` fires ONLY on a genuine terminal per a HEALTHY transport (isTerminalPage). A hasMore:false
      // riding a challenge/empty transport is NOT done — the transport gate inside isTerminalPage rejects it.
      const terminal = isTerminalPage({ items: [], hasMore: lastHasMore ?? true, cursor: lastCursor }, lastTransport ?? "ok");
      const stepped = scrollStep(st, { kind: "page_captured", newCount: count, hasMore: terminal ? false : true, cursor: lastCursor }, deps);
      st = stepped.state;
      action = stepped.action;
    } else if (command.kind === "stall" || command.kind === "backoff") {
      // scrollMotion exhausted its lazy-load ladder (confirmed stall) or diagnosed server backpressure
      // (a request fired, nothing came back) → NOW hand scrollState a `tick`. A `down`/`retrigger` with
      // no arrival does NOT step scrollState — motion is still trying, no stall accrues (the SCROLL-01 fix).
      const stepped = scrollStep(st, { kind: "tick" }, deps);
      st = stepped.state;
      action = stepped.action;
    }
    prevCount = Math.max(prevCount, count);

    // ── 5. SESSION-RECOVERY on the transport signal (independent of scrollState). A pause here freezes
    //    the giveup ladder and takes precedence over any scrollState wait/giveup this cycle.
    let recSignal = null;
    if (navigator.onLine === false) recSignal = "offline";
    else if (arrived) {
      if (lastTransport === "ok") recSignal = "healthy_arrival";
      else if (lastTransport === "empty_ok") recSignal = "empty_ok";
      else if (lastTransport === "challenge") recSignal = "challenge";
      else if (lastTransport === "offline") recSignal = "offline";
      // http_error / api_error carry no recovery signal — scrollState's backoff→giveup owns them.
    }
    if (recSignal) {
      const r = stepRecovery(rec, recSignal, { now: Date.now() });
      rec = r.state;
      const rc = r.command;
      if (rc.kind === "reload") {
        if (reloadedThisRun) {
          // Already spent this Sync attempt's one reload (across a prior page-load) and it's still
          // empty → escalate to the challenge pause rather than reload-loop a flagged session.
          await enterPause("flagged", FLAGGED_PAUSE_REASON);
          continue;
        }
        reloadedThisRun = true;
        if (source) await chrome.storage.local.set({ captureReloadedSource: source });
        console.warn("[commonplace] flagged session (empty pages after a refresh) — reloading ONCE to recover (the founder's manual fix, automated)");
        location.reload(); // page navigates away; the supervisor's `current` checkpoint re-drives this run after reload
        return;
      }
      if (rc.kind === "pause_notify") {
        const level = recSignal === "offline" ? "offline" : recSignal === "challenge" ? "challenge" : "flagged";
        await enterPause(level, rc.reason, { resumeWhenOnline: recSignal === "offline" });
        continue;
      }
      // rc.kind === "continue": nothing to do.
    }

    // ── 6. ACT on the scrollState completion action (after recovery — a pause already `continue`d).
    if (action) {
      if (action.kind === "done") {
        running = false;
        console.log(`[commonplace] capture COMPLETE — TikTok reported a verified terminal (hasMore:false); ${prevCount} captured`);
      } else if (action.kind === "giveup") {
        running = false;
        console.warn(`[commonplace] capture INCOMPLETE — ${action.reason}`);
      }
      // action.kind === "wait": the backoff sleep happens in the dwell below; "scroll": nothing extra.
    }

    // Telemetry + HUD (real Date.now()/performance.memory/document reads happen ONLY here — glue).
    const domCount = document.querySelectorAll(TILE_ANCHOR_SEL).length;
    const sample = sampleMemory({
      now: Date.now(),
      capturedCount: count,
      domNodes: document.getElementsByTagName("*").length,
      heap: performance.memory,
    });
    const waiting = action && action.kind === "wait";
    const hudState = waiting
      ? `backing off… ${Math.ceil(action.ms / 1000)}s (${st.stall}/${GIVEUP_STALL_CYCLES})`
      : command.kind === "retrigger"
        ? `re-triggering lazy-load (${motionState.retriggerAttempts}/${MAX_RETRIGGERS})`
        : st.stall > 0
          ? `${st.status} ${st.stall}/${GIVEUP_STALL_CYCLES}`
          : st.status;
    updateHud(formatHudLine(sample, { source: lastSource, hasMore: st.hasMore, state: hudState, evicted: evictedTotal }));
    if (shouldLogSample(lastSampleLogTs, sample.ts, 5000)) {
      lastSampleLogTs = sample.ts;
      console.log("[commonplace] capture sample", sample);
    }
    console.log(
      `[commonplace] ${st.status}… captured ${count} (hasMore ${st.hasMore}, stall ${st.stall}, motion ${command.kind}, DOM ${domCount})`,
    );

    if (!running) break; // done / giveup — skip motion + dwell, fall through to scroll_done

    // ── 7. REALIZE the physical motion (nothing on a conceded stall / backoff — the wait paces it).
    if (command.kind === "down") {
      wheelBy(scroller, command.px);
    } else if (command.kind === "retrigger") {
      await doRetrigger(scroller, maxSafeUpPx(scroller, command.upPx));
    }

    // ── 8. DWELL / WAIT. On a scrollState `wait` (backoff) sleep exactly that; otherwise wait up to the
    //    human dwell for a new arrival, returning early once content lands. The ACTUAL elapsed is fed
    //    to stepMotion next cycle as dwellElapsedMs.
    if (waiting) {
      console.log(`[commonplace] backing off (backpressure)… ${action.ms}ms (stall ${st.stall})`);
      await sleep(action.ms);
      dwellElapsedMs = action.ms;
    } else {
      const beforeArrivals = pageArrivals;
      dwellElapsedMs = await waitForContent(count, beforeArrivals, nextDwellMs(Math.random));
    }
  }

  scrolling = false;
  removeHud();
  if (source) {
    // Terminal reached this attempt — clear the reload guard so a later fresh Sync of this source can
    // reload again if IT hits a flag. (The reload path `return`s earlier and never reaches here.)
    await chrome.storage.local.set({ captureReloadedSource: null });
  }
  chrome.runtime.sendMessage({
    kind: "scroll_done",
    status: st.status,
    reason: st.reason ?? null,
    captured: prevCount,
    cursor: lastCursor,
    source, // Task 5: which source this run drove — lets background.ts's supervisor advance the sequence
  });
  activeRunSource = null; // disarm the carry-forward-2 filter; the run is over
  console.log(
    `[commonplace] auto-scroll ended (${st.status}, source ${source ?? "manual"}) — ${prevCount} captured, ${snoozeCount} snooze(s)`,
  );
}

// Path 2: content-script fetch → blob → anchor download. Needs DNR to set Referer (fix 403)
// AND Access-Control-Allow-Origin (so JS can read the cross-origin bytes). If this works, we can
// also read video bytes for local Gemini visual enrichment.
async function downloadViaFetch(n) {
  // NOTE: reads the retired legacy `items` key (removed in Phase 3 Task 3); dead dev-only path, kept for reference — see store.ts migration.
  const { items = [] } = await chrome.storage.local.get("items");
  for (const item of items.slice(0, n)) {
    if (!item.playUrl) continue;
    try {
      // Mirror the page's own working video request: credentialed CORS + a byte-range header.
      // The CDN returns proper ACAO (echoing www.tiktok.com) + Allow-Credentials for this origin,
      // so JS can read the bytes. `bytes=0-` asks for the whole file. DNR sets the Referer.
      const res = await fetch(item.playUrl, {
        credentials: "include",
        headers: { Range: "bytes=0-" },
      });
      if (!res.ok && res.status !== 206) {
        console.log("[attic-spike] fetch-download FAIL", item.id, `HTTP ${res.status}`);
        continue;
      }
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `${(item.author || "x").replace(/[^\w.-]/g, "_")}_${item.id}.mp4`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      console.log("[attic-spike] fetch-download ok", item.id, `${blob.size} bytes`);
    } catch (e) {
      console.log("[attic-spike] fetch-download FAIL", item.id, String(e));
    }
    await new Promise((r) => setTimeout(r, 900));
  }
}

// ── Supervisor-driven capture (Task 5) ──────────────────────────────────────────────────────────
// background.ts's supervisor tells THIS tab which source to capture. We (best-effort) navigate to the
// source's SPA sub-tab, then drive autoScroll for it. The scroll_done we emit carries `source`, which
// lets the supervisor advance to the next source. Semi-auto: this tab is the founder's foreground tab.
// Autonomous: background opened/focused this tab first.
//
// FRAGILE SEAM — Task-6-validation-pending. TikTok's favorites/likes/posts/reposts are SPA sub-tabs of
// the profile, NOT distinct URLs; switching between them is real DOM automation against churny markup.
// The selectors below (data-e2e first — the most stable handle TikTok exposes — then aria/text) are a
// best-effort HYPOTHESIS not yet verified against a live logged-in session (Fork 2 deferred the live
// run). If nav fails, no matching-source page arrives, the carry-forward-2 filter keeps this run clean,
// and the run bounds out to a REPORTED giveup — an honest incomplete the supervisor records and
// sequences past, never a fake "done." Task 6 must confirm/repair these selectors on the real site.
const SOURCE_TAB_HINTS = {
  favorites: { e2e: ["favorites-tab", "user-favorite"], text: [/^favorites$/i] },
  likes: { e2e: ["liked-tab", "user-liked"], text: [/^liked$/i, /^likes$/i] },
  posts: { e2e: ["user-post", "posts-tab"], text: [/^videos$/i, /^posts$/i] },
  reposts: { e2e: ["user-repost", "repost-tab"], text: [/^reposts$/i] },
};

function findSourceTab(source) {
  const hints = SOURCE_TAB_HINTS[source];
  if (!hints) return null;
  for (const e2e of hints.e2e) {
    const el = document.querySelector(`[data-e2e="${e2e}"]`);
    if (el) return el.closest('[role="tab"], a, button, p, div[tabindex]') || el;
  }
  // Fallback: a tab-ish element whose visible text matches the source label.
  const candidates = document.querySelectorAll('[role="tab"], a[href], button, p[data-e2e]');
  for (const el of candidates) {
    const t = (el.textContent || "").trim();
    if (t && hints.text.some((re) => re.test(t))) return el;
  }
  return null;
}

// Is this a TikTok PROFILE page — the saved/profile surface where the favorites/likes/posts/reposts
// sub-tabs live (path `/@handle…`)? A single video/photo permalink (`/@user/video/…`) is NOT, nor is
// the FYP. Fix round 2 (#1, leg a): a supervisor-driven run must never bot-cadence-scroll a non-profile
// tab (the founder's live browsing). Kept in sync with background.ts's isProfileUrl.
function isProfilePage() {
  const p = location.pathname || "";
  if (!/^\/@[^/]+/.test(p)) return false; // must be a @handle page
  return !/\/(video|photo)\//.test(p); // …but not a single video/photo permalink
}

async function navigateToSource(source) {
  if (!source) return false;
  const tab = findSourceTab(source);
  if (!tab) {
    console.warn(
      `[commonplace] navigateToSource(${source}): no sub-tab found — capture will run against whatever ` +
        `is showing; a non-matching source is filtered out (carry-forward 2) and the run reports giveup. ` +
        `(FRAGILE SEAM — Task 6 must verify the SPA sub-tab selectors on the live site.)`,
    );
    return false;
  }
  tab.click();
  console.log(`[commonplace] navigateToSource(${source}) → clicked sub-tab; waiting for it to load`);
  await sleep(1500); // let TikTok swap the grid + fire the first source item_list before we scroll
  return true;
}

// Covers the nav window BEFORE autoScroll flips `scrolling` (navigateToSource awaits ~1.5s): between
// the guard below and autoScroll starting, a second capture_source must not slip in. Together,
// `scrolling || captureRunActive` is "a run is live in this tab" — also what capture_ping reports.
let captureRunActive = false;

async function runCaptureForSource(source, resuming) {
  // GUARD FIRST (fix round 1, important). The 1-minute revive alarm can re-send capture_source while
  // this tab is legitimately mid-run (the SW idles out during a long backoff and forgets a run is
  // live). The old order did nav side-effects (sub-tab re-click → grid churn → a real backoff turned
  // into a giveup) and re-armed activeRunSource (hijacking a manual Alt+Shift+A run's filter) BEFORE
  // autoScroll's `scrolling` guard could reject. Now a live run rejects the message before ANY
  // side-effect — no nav, no filter change.
  if (scrolling || captureRunActive) {
    console.log(`[commonplace] capture_source(${source}) ignored — a run is already live in this tab`);
    return;
  }
  captureRunActive = true;
  try {
    activeRunSource = source ?? null; // arm the filter BEFORE nav so the first arrival is already gated
    const navigated = await navigateToSource(source);
    // Fix round 2 (#1, leg a): if a supervisor-driven run can't reach the source's sub-tab AND we're
    // not even on a profile page (e.g. an alarm resumed onto the FYP or a video the founder is
    // watching), report giveup IMMEDIATELY — never cadence-scroll a wrong tab through the full
    // backoff ladder. On a profile page we still try (the sub-tab may already be active, or the
    // selectors just didn't match — carry-forward 2 keeps a mismatched source from driving the run).
    if (source && !navigated && !isProfilePage()) {
      console.warn(
        `[commonplace] capture ${source}: not on a TikTok profile page and no sub-tab found — ` +
          `reporting giveup instead of scrolling this tab.`,
      );
      chrome.runtime.sendMessage({
        kind: "scroll_done",
        status: "giveup",
        reason: "not on a TikTok profile page (no saved-sources tabs to capture)",
        captured: 0,
        cursor: null,
        source,
      });
      activeRunSource = null;
      return;
    }
    await autoScroll({ source, resuming });
  } finally {
    captureRunActive = false;
  }
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg && msg.kind === "capture_source") {
    console.log(`[commonplace] supervisor → capture ${msg.source}${msg.resuming ? " (resuming)" : ""}`);
    void runCaptureForSource(msg.source ?? null, !!msg.resuming);
  } else if (msg && msg.kind === "capture_ping") {
    // Fix round 1: the SW's revive alarm asks the tab itself whether a run is live before re-driving
    // (its own `supervisorRunning` flag dies with every SW idle-out; this tab is the ground truth).
    sendResponse({ scrolling: scrolling || captureRunActive });
  }
  // Synchronous sendResponse above; no async channel kept open.
});

window.addEventListener("keydown", (e) => {
  if (!e.altKey || !e.shiftKey) return;
  // Manual dev run — refuse while a supervisor run is live (incl. its pre-scroll nav window), or the
  // manual run's source:null would clear the live run's carry-forward-2 filter arm.
  if (e.code === "KeyA" && !captureRunActive) autoScroll();
  if (e.code === "KeyS") {
    chrome.runtime.sendMessage({ kind: "export_open_schema" });
    console.log("[commonplace] open-schema export triggered → commonplace-export.json");
  }
  if (e.code === "KeyE") {
    chrome.runtime.sendMessage({ kind: "queue_start" });
    console.log("[commonplace] queue_start sent → offscreen engine (capture → analyze → ground)");
  }
  if (e.code === "KeyQ") {
    chrome.runtime.sendMessage({ kind: "queue_status" });
    console.log("[commonplace] queue_status requested → see service-worker console");
  }
  if (e.code === "KeyD") {
    chrome.runtime.sendMessage({ kind: "download_test", n: 3 });
    console.log("[attic-spike] Path 1: chrome.downloads test (3 videos)");
  }
  if (e.code === "KeyF") {
    console.log("[attic-spike] Path 2: fetch→blob download test (3 videos)");
    downloadViaFetch(3);
  }
});

console.log(
  "[commonplace] ready — A:auto-scroll · S:open-schema-export · E:queue-start · Q:queue-status · D:download(chrome.downloads) · F:download(fetch)"
);
