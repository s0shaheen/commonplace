// ISOLATED-world content script. Relays MAIN-world captures to the service worker,
// drives auto-scroll (Alt+Shift+A), open-schema export (Alt+Shift+S), starts the extraction queue
// (Alt+Shift+E), and logs queue status to the SW console (Alt+Shift+Q).

import { sampleMemory, formatHudLine, shouldLogSample } from "./lib/capture/instrument.js";
import { coerceHasMore, isTerminalPage } from "./lib/capture/interceptParse.js";
import { tilesToEvict, DEFAULT_LIVE_WINDOW } from "./lib/capture/pruneWindow.js";
import { arrivalDrivesRun } from "./lib/capture/supervisor.js";
import { classifyOverlay } from "./lib/capture/overlayClassifier.js";
import { assessPreflight } from "./lib/capture/preflight.js";
import { stepRecovery, initialRecoveryState } from "./lib/capture/sessionRecovery.js";
// The re-founded motion: the geometry-driven MODE + completion decision lives in scrollDrive.ts; the
// physical scroll WRITE lives in the SERVICE WORKER as trusted wheels (chrome.debugger) — TikTok's profile
// grid ignores ALL programmatic scrolling (window.scrollBy/scrollTop=/scrollIntoView/synthetic WheelEvent
// all move it ZERO px; only a real trusted wheel scrolls it). The discrete step-then-dwell machine
// (scrollMotion/pacing/scrollState in the hot path, plus the requestsIssued→backoff discriminator) is gone.
import { initialDriveState, stepDrive, MAX_STUCK_RETRIGGERS } from "./lib/capture/scrollDrive.js";

let lastSource = null;
let lastHasMore = null; // latest coerced paging signal from the message path (Task 1)
let lastCursor = null;
let lastTransport = null; // latest typed transport signal (§6.5) — feeds sessionRecovery + terminal gate
let lastItemsLen = 0; // FIX 5: item count of the latest driving arrival — feeds isTerminalPage's empty-page sentinel
let pageArrivals = 0; // monotonic count of item_list messages — autoScroll keys page_captured on ARRIVAL, not count growth
let healthyArrivals = 0; // monotonic count of transport:"ok" arrivals — the auto-resume signal for a paused run
let lastRequestsIssued = 0; // monotonic count of item_list requests INITIATED (from main-world) — scrollMotion's discriminator

// FIX 6 — nav-window arrival absorption. runCaptureForSource arms these BEFORE navigateToSource's
// ~1500ms sleep, so a first/only page that lands DURING the nav window is counted as THIS run's
// arrival instead of being wiped by autoScroll's per-run reset (which used to fire only AFTER the
// sleep). `runSignalsArmed` tells autoScroll the reset+baseline already happened; the baselines are
// the pageArrivals/healthyArrivals counts captured at arm time (before any nav-window arrival).
let runSignalsArmed = false;
let runArrivalsBaseline = 0;
let runHealthyBaseline = 0;
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
    lastItemsLen = Array.isArray(e.data.items) ? e.data.items.length : 0; // FIX 5: real page item count
    if (lastTransport === "ok") healthyArrivals++;
    pageArrivals++;
  }
});

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Find the tallest scrollable element — handles TikTok's inner/virtualized scroll container. Returns
// the validated inner scroller, or NULL to mean "drive the document/window" (a document-scrolled page,
// or a page whose inner-scroller heuristic missed). Callers must route motion through scrollTargetBy /
// effectiveScrollTop so a null result still produces real motion (FIX 1 / SCROLL-03).
let cachedScroller = null;

// Closed-loop validation (SCROLL-03): a candidate is only trusted as the effective scroller if a tiny
// test scrollBy actually MOVES its scrollTop — i.e. it genuinely paginates. A tall overflow:auto match
// that doesn't move (a sidebar, a decorative rail, a not-yet-populated container) is rejected so we
// don't drive a non-paginating element; we fall back to the window/documentElement belt instead. The
// probe is restored to its original position so it never perturbs the run. Tries down first, then up
// (so a scroller pinned at the bottom still validates).
function validateScroller(el) {
  try {
    const before = el.scrollTop;
    el.scrollBy(0, 6);
    if (Math.abs(el.scrollTop - before) >= 1) {
      el.scrollBy(0, before - el.scrollTop); // restore
      return true;
    }
    el.scrollBy(0, -6);
    if (Math.abs(el.scrollTop - before) >= 1) {
      el.scrollBy(0, before - el.scrollTop); // restore
      return true;
    }
    return false;
  } catch (_) {
    return false;
  }
}

function getScroller() {
  if (cachedScroller && cachedScroller.isConnected) return cachedScroller; // validated + still attached
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
  // Commit to the candidate ONLY if it passes the closed-loop test; otherwise cache null (document
  // belt). We intentionally do NOT persist the null decision — a page whose inner scroller only becomes
  // scrollable once its grid loads is re-resolved on a later call (the isConnected check above short-
  // circuits once a real scroller is found and validated).
  cachedScroller = best && validateScroller(best) ? best : null;
  return cachedScroller;
}

// The effective scrollTop of the run's scroll target: the inner scroller's if we have one, else the
// document/window position. Everything that reasons about position (topmostLiveTileTop, the retrigger's
// prior-max math) reads through this so it stays correct whether we're on an inner or document scroller.
function effectiveScrollTop(scroller) {
  if (scroller) return scroller.scrollTop;
  return window.scrollY || (document.scrollingElement ? document.scrollingElement.scrollTop : 0);
}

// The uniform scroll primitive (FIX 1 / §6.1). Move the resolved inner scroller (if any) AND ALSO nudge
// the window as a belt — BOTH, exactly like the old code's unconditional `window.scrollTo(...)`. A null
// or wrong inner scroller therefore still produces real motion (the document belt always fires), which
// is what kept capture working when the inner-scroller heuristic missed a document-scrolled page.
function scrollTargetBy(scroller, dy) {
  if (scroller) {
    try {
      scroller.scrollBy(0, dy);
    } catch (_) {}
  }
  try {
    window.scrollBy(0, dy);
  } catch (_) {}
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

// ── Physical motion glue (§6.1, re-founded again 2026-07-13: TRUSTED WHEELS via chrome.debugger) ────
// LIVE ROOT CAUSE (2026-07-13): TikTok's profile grid ignores ALL programmatic scrolling — window.scrollBy,
// document.scrollingElement.scrollTop=, element.scrollIntoView, and even a synthetic WheelEvent move it ZERO
// pixels. Only a REAL TRUSTED wheel scrolls it (a trusted wheel flew the grid 32→110 tiles in ~5s). Content
// scripts cannot send trusted events, so the physical scroll WRITE moved to the SERVICE WORKER, which
// dispatches trusted wheels via chrome.debugger + Input.dispatchMouseEvent. This module keeps only the
// GEOMETRY READS (window.scrollY / scrollHeight DO reflect trusted-wheel scrolling — reads work; only the
// WRITE needed a trusted event) and the thin messaging that tells the SW which way to wheel each observer
// tick; scrollDrive.ts still owns the MODE decision.

/** The observer cadence (ms): the slow intelligence loop (overlay guard, eviction, growth tracking,
 *  session recovery, the stepDrive verdict). The SW's trusted-wheel loop owns the fast, smooth motion —
 *  this is the brain, re-deciding the mode the SW should wheel in every OBSERVER_MS. */
const OBSERVER_MS = 250;

/** A REAL server rate/error signal (transport "http_error" = 429/5xx) gets a MODEST fixed slowdown —
 *  hold the wheel loop a few seconds then resume — NOT the old 2s→60s exponential. Persistent http_error
 *  past HTTP_ERROR_GIVEUP consecutive arrivals ends the run as an honest reported-incomplete. */
const HTTP_ERROR_SLOWDOWN_MIN_MS = 3000;
const HTTP_ERROR_SLOWDOWN_MAX_MS = 5000;
const HTTP_ERROR_GIVEUP = 6;
const HTTP_ERROR_REASON = "TikTok returned repeated server errors (429/5xx); more may remain";

// Resolve the DOM element to dispatch a PROBE WheelEvent at (used ONLY by the overlay input-swallow probe —
// the REAL scroll is trusted wheels from the SW): the inner scroller if we have one, else the document root.
function wheelTarget(scroller) {
  return scroller || document.scrollingElement || document.documentElement || document.body;
}

// The effective scroll target's geometry (inner scroller's if we have one, else the document/window).
// stepDrive + growth tracking read scrollTop/scrollHeight/clientHeight + the frontier through this so it
// stays correct whether we're on an inner or a document scroller (FIX 1). On TikTok getScroller() is null
// (its test-scroll is a no-op), so this reads the window/document — whose scrollY/scrollHeight correctly
// reflect the SW's trusted-wheel scrolling.
function scrollerMetrics(scroller) {
  if (scroller) {
    return { scrollTop: scroller.scrollTop, scrollHeight: scroller.scrollHeight, clientHeight: scroller.clientHeight };
  }
  const se = document.scrollingElement || document.documentElement;
  return {
    scrollTop: window.scrollY || (se ? se.scrollTop : 0),
    scrollHeight: se ? se.scrollHeight : document.body ? document.body.scrollHeight : 0,
    clientHeight: window.innerHeight || (se ? se.clientHeight : 0),
  };
}

// ── Trusted-wheel driver messaging (the moat) ──────────────────────────────────────────────────────
// The SW holds the chrome.debugger attach and runs a continuous trusted-wheel loop; content.js just tells
// it the aim point + the current mode. The observer maps scrollDrive's verdict → these messages each tick.

/** Set by the content message handler when the SW reports its debugger detached (banner Cancel / DevTools
 *  opened / attach failed). The observer ends the run honestly on its next tick — a reported incomplete,
 *  never a hang and never a false done. Reset at the start of each run. */
let scrollDriverDetached = false;
let scrollDriverDetachReason = null;

// The point to aim the trusted wheel at: horizontal center, biased low over the grid so the wheel lands on
// tiles (not a sticky header/toolbar). The document/window is the scroller on TikTok, so any on-content
// point scrolls it; the bias just keeps us clear of fixed chrome.
function wheelPoint() {
  const w = window.innerWidth || (document.documentElement ? document.documentElement.clientWidth : 0) || 800;
  const h = window.innerHeight || (document.documentElement ? document.documentElement.clientHeight : 0) || 600;
  return { x: Math.floor(w / 2), y: Math.floor(h * 0.6) };
}

// Ask the SW to attach its debugger to THIS tab and start the trusted-wheel loop. Returns {ok:true} on a
// clean attach, or {ok:false, reason} when DevTools/another debugger blocks the attach (the SW has already
// raised a capture_notice) — the caller then ends the run honestly instead of spinning on a dead scroll.
async function startScrollDriver() {
  try {
    const res = await chrome.runtime.sendMessage({ kind: "scroll_start" });
    if (res && res.ok === false) return { ok: false, reason: res.reason || "could not start the scroll driver" };
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: "scroll driver unavailable (" + ((e && e.message) || e) + ")" };
  }
}

// Tell the SW's wheel loop how to move THIS tick: advance→wheel down · hold→idle · retrigger→UP-burst then
// resume down. (x,y) re-aims the wheel each tick (cheap; keeps it over the grid if the layout shifts).
function sendScrollMode(mode) {
  const p = wheelPoint();
  try {
    chrome.runtime.sendMessage({ kind: "scroll_mode", mode, x: p.x, y: p.y });
  } catch (_) {}
}

// Stop the SW's wheel loop and detach the debugger. MUST be sent on EVERY run-exit path — a dangling attach
// leaves Chrome's "Commonplace started debugging this browser" banner up forever.
function sendScrollStop() {
  try {
    chrome.runtime.sendMessage({ kind: "scroll_stop" });
  } catch (_) {}
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

// "My input isn't landing." Record the effective scrollTop, attempt a small real scroll, re-read after
// a tick; if a blocking layer is present AND the position didn't move, input is being swallowed
// (composes with §6.1's closed-loop motion check — this routes to a pause BEFORE it ever reads as a
// stall). Works on a null/document scroller via effectiveScrollTop + scrollTargetBy (FIX 1).
async function probeInputSwallowed(scroller) {
  const before = effectiveScrollTop(scroller);
  const target = wheelTarget(scroller);
  try {
    target.dispatchEvent(new WheelEvent("wheel", { deltaY: 60, deltaMode: 0, bubbles: true, cancelable: true }));
    scrollTargetBy(scroller, 60);
  } catch (_) {}
  await sleep(60);
  return Math.abs(effectiveScrollTop(scroller) - before) < 2;
}

async function gatherOverlayFacts(scroller) {
  const el = findBlockingLayer();
  const hasBlockingLayer = !!el;
  const overlayText = el ? (el.textContent || "").trim().slice(0, 2000) : "";
  const buttonLabels = el ? collectButtonLabels(el) : [];
  const captchaContainerPresent = detectCaptchaContainer();
  let inputSwallowed = false;
  // Probe on ANY blocking layer — a null scroller no longer skips the probe (the document belt moves).
  if (hasBlockingLayer) inputSwallowed = await probeInputSwallowed(scroller);
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

// FIX 4a — cap on consecutive overlay ACTIONS taken against the same unresolved overlay before we
// stop acting and enter one sticky pause. Bounds two churn loops: a snooze/dismiss whose click never
// clears the layer (would loop forever at ~1s), and a persistent captcha-container false-positive that
// flaps enter/exit pause. Past the cap we hand it to the human and resume only on a healthy arrival.
const OVERLAY_CHURN_CAP = 5;
const OVERLAY_CHURN_REASON = "unresolved overlay — needs you (capture resumes when a page loads again)";

// Fixed pause reasons for the two paths the pure cores don't supply one for.
const CHALLENGE_REASON_OVERLAY = "a captcha is blocking capture — solve it in the TikTok tab; capture resumes automatically";
const FLAGGED_PAUSE_REASON =
  "TikTok returned empty pages after a refresh — the session looks flagged; try again shortly or solve any challenge in the tab";

// FIX 6 — clear the PREVIOUS source's straggler paging signals. Split out of autoScroll so
// runCaptureForSource can call it BEFORE navigateToSource (arming the run) instead of after the nav
// sleep, where it would wipe a first page that arrived during the nav window.
function resetRunSignals() {
  lastHasMore = null;
  lastCursor = null;
  lastTransport = null;
  lastItemsLen = 0;
}

// Arm a supervisor run's signals+baselines BEFORE navigating to the source. Clears the previous
// source's stragglers, then baselines the arrival counters to NOW — so any page that lands during the
// ~1500ms nav window counts as this run's arrival (it's above the baseline) rather than being reset
// away. autoScroll sees `runSignalsArmed` and skips its own reset so those fresh signals survive.
function armRunSignals() {
  resetRunSignals();
  runArrivalsBaseline = pageArrivals;
  runHealthyBaseline = healthyArrivals;
  runSignalsArmed = true;
}

// ── Preflight gate glue (C8, §7) ────────────────────────────────────────────────
// Every DOM read for the run-start check lives here; the VERDICT is the pure assessPreflight. Live
// evidence (2026-07-12): a run fired on a LOGGED-OUT TikTok tab (a "Log in" CTA, 0 personal tiles,
// nothing to scroll) and ground ~10s through hold→retrigger→exhausted before a generic "reached the
// bottom" giveup. We detect that IMMEDIATELY and report a clear, actionable reason instead.

const PREFLIGHT_SETTLE_MS = 1200; // brief wait+recheck so a slow-loading logged-in grid isn't misread as logged-out
const NOT_LOGGED_IN_NOTICE = "You're not logged into TikTok — log in and try again.";
const NOT_LOGGED_IN_REASON = "not logged into TikTok"; // the scroll_done giveup reason

// A prominent logged-OUT signal: a header "Log in" / "Sign up" CTA. data-e2e is TikTok's most stable
// handle; the text fallback matches a VISIBLE button/anchor whose trimmed text is exactly a login/
// signup CTA ("Log in" / "Log In" / "login" / "Sign up" / "signup", case-insensitive, either spacing).
// A visible match anywhere is acceptable — the conservative triple-guard in assessPreflight (CTA AND
// 0 tiles AND no arrival this run) is what prevents a false block, so precision here isn't load-bearing.
const LOGIN_CTA_TEXT = /^(log ?in|sign ?up)$/i;
function detectLoginCta() {
  const direct = document.querySelector('[data-e2e="top-login-button"]');
  if (direct && isVisible(direct)) return true;
  for (const el of document.querySelectorAll("button, a")) {
    const t = (el.textContent || "").trim();
    if (LOGIN_CTA_TEXT.test(t) && isVisible(el)) return true;
  }
  return false;
}

// Gather run-start facts for assessPreflight. sawItemListArrival is "since THIS run's arrival baseline"
// (runArrivalsBaseline is set at run arm/start) — the network is truth: a real session loading its grid
// produces item_list arrivals, a logged-out page produces none.
function gatherPreflightFacts() {
  return {
    onProfilePage: isProfilePage(),
    loginCtaPresent: detectLoginCta(),
    ownTileCount: document.querySelectorAll(TILE_ANCHOR_SEL).length,
    sawItemListArrival: pageArrivals > runArrivalsBaseline,
  };
}

let scrolling = false;
// autoScroll drives ONE source to completion via a continuous rAF scroll + a slow observer. `source`
// (Task 5) tags the run for carry-forward (2)'s arrival filter; `resuming` (carry-forward 1) marks a
// crash-resume re-scroll — it now only gates the reload guard (the geometry-driven driver needs no
// resume grace: it advances on loaded-content-ahead, so re-scrolling a captured prefix keeps advancing
// while pages arrive and never false-gives-up). Both default to the manual Alt+Shift+A dev path.
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
  //
  // FIX 6: a supervisor run already did this reset + baseline in runCaptureForSource BEFORE the nav
  // window (runSignalsArmed), so a first/only page that arrived during navigateToSource's sleep is
  // preserved (it sits above the pre-nav baseline). We must NOT re-wipe it here. A manual/un-armed run
  // resets + baselines now, as before. Either way the ORIGINAL intent holds — the previous source's
  // stale hasMore:false is cleared (armRunSignals/resetRunSignals) and the arrival filter
  // (arrivalDrivesRun) blocks any foreign straggler from injecting into this run.
  if (runSignalsArmed) {
    runSignalsArmed = false; // consume the pre-nav arm; signals + baselines are already set
  } else {
    resetRunSignals();
    runArrivalsBaseline = pageArrivals;
    runHealthyBaseline = healthyArrivals;
  }
  let arrivalsSeen = runArrivalsBaseline;
  let healthyArrivalsSeen = runHealthyBaseline; // FIX 3: mirror arrivalsSeen for the HEALTHY-only arrival gate
  // Baseline against the CURRENT persisted total: a pre-existing count is not growth.
  const { count: initialCount = 0 } = await chrome.storage.local.get("count");
  let prevCount = initialCount;

  // ── PREFLIGHT GATE (C8, §7) — refuse a run that can't succeed, BEFORE the frame driver starts.
  //    assessPreflight (pure) reads run-start facts and, on an UNAMBIGUOUS logged-out page (a login CTA
  //    AND 0 own tiles AND no item_list arrival this run), returns `not_logged_in` — so we report a
  //    clear, actionable reason IMMEDIATELY instead of grinding the hold→retrigger→exhausted ladder to
  //    a generic "reached the bottom" giveup (the 2026-07-12 live failure). CONSERVATIVE: to avoid
  //    misreading a still-loading logged-in grid as logged-out, we act only after a brief settle +
  //    re-check — a real session paints tiles / fires its first page within it, flipping the verdict to
  //    `ready`. We bail ONLY if it's STILL not_logged_in after the settle. `not_profile` is intentionally
  //    NOT handled here: the supervised non-profile run is already given up in runCaptureForSource, and a
  //    manual FYP run stays as-is — this gate adds only the not_logged_in guard the live evidence demands.
  let preflight = assessPreflight(gatherPreflightFacts());
  if (preflight === "not_logged_in") {
    await sleep(PREFLIGHT_SETTLE_MS); // let a slow logged-in grid paint / its first page arrive
    preflight = assessPreflight(gatherPreflightFacts());
  }
  if (preflight === "not_logged_in") {
    console.warn(`[commonplace] preflight — ${NOT_LOGGED_IN_NOTICE}`);
    try {
      chrome.runtime.sendMessage({ kind: "capture_notice", level: "login", reason: NOT_LOGGED_IN_NOTICE });
    } catch (_) {}
    updateHud(`capture blocked — ${NOT_LOGGED_IN_REASON}`);
    chrome.runtime.sendMessage({
      kind: "scroll_done",
      status: "giveup",
      reason: NOT_LOGGED_IN_REASON,
      captured: prevCount,
      cursor: lastCursor,
      source,
    });
    // Disarm exactly like teardown would — but before any frame driver/observer started, so there is
    // nothing to cancel and no HUD churn beyond the reason we just surfaced.
    activeRunSource = null;
    scrolling = false;
    console.warn(`[commonplace] capture ABORTED (preflight: not logged in, source ${source ?? "manual"}) — ${NOT_LOGGED_IN_REASON}`);
    return;
  }

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

  // ── START THE TRUSTED-WHEEL SCROLL DRIVER (the moat, live-confirmed 2026-07-13). TikTok's profile grid
  //    ignores ALL programmatic scrolling; only a TRUSTED wheel moves it. The SW attaches chrome.debugger to
  //    THIS tab and runs a continuous trusted-wheel loop this observer steers. On attach failure (DevTools
  //    open / another debugger) the SW has already raised a capture_notice — we END the run honestly here
  //    rather than grind a dead scroll. Geometry READS below still work (window.scrollY/scrollHeight reflect
  //    trusted-wheel scrolling); only the physical WRITE moved to the SW.
  scrollDriverDetached = false;
  scrollDriverDetachReason = null;
  const driverStart = await startScrollDriver();
  if (!driverStart.ok) {
    console.warn(`[commonplace] scroll driver could not start — ${driverStart.reason}`);
    updateHud(`capture blocked — ${driverStart.reason}`);
    chrome.runtime.sendMessage({
      kind: "scroll_done",
      status: "giveup",
      reason: driverStart.reason,
      captured: prevCount,
      cursor: lastCursor,
      source,
    });
    // Nothing was started yet (no observer, no successful attach) — nothing to cancel and no scroll_stop
    // needed (the SW never attached on a failed start). Disarm exactly like teardown would, then return.
    activeRunSource = null;
    scrolling = false;
    console.warn(`[commonplace] capture ABORTED (scroll driver: ${driverStart.reason}, source ${source ?? "manual"})`);
    return;
  }

  // MOTION IS NOW A SLOW OBSERVER (the brain) + the SW's TRUSTED-WHEEL LOOP (the smooth motion). The
  // motion/completion DECISION lives in the pure `scrollDrive` reducer (geometry + growth in → mode +
  // completion out); this observer maps that verdict to scroll_mode messages the SW's wheel loop obeys
  // (advance→wheel down · hold→idle · retrigger→UP-burst). Completion is a VERIFIED terminal only
  // (isTerminalPage on a healthy transport); reaching the bottom with the loader dead is `exhausted` — a
  // DISTINCT reported-incomplete, never a false `done`.
  let driveState = initialDriveState(Date.now());
  let driveMode = driveState.mode; // the mode the observer last decided — mapped to a scroll_mode message
  let running = true;
  let reloadingAway = false; // set when we location.reload() a flagged session — teardown then skips scroll_done
  let outcome = { status: "giveup", reason: "capture ended before a verified terminal" }; // finalized at each terminal
  let rec = initialRecoveryState(Date.now());
  let httpErrorStreak = 0; // consecutive http_error arrivals — a persistent 429/5xx ends the run honestly
  let lastSampleLogTs = 0; // console.log a CaptureSample roughly every ~5s while scrolling
  let snoozeCount = 0; // screen-time reminders auto-snoozed this run (logged, never a passcode)
  // Per-run eviction reset: start fresh so the HUD's "evicted N" is this run's tally and pruneGrid
  // re-resolves the grid from scratch (a new source/tab is a new grid element).
  evictGrid = null;
  evictedInGrid = 0;
  let evictedTotal = 0;
  // FIX 4a — overlay-action churn accounting (run-local). `overlayChurn` counts consecutive iterations
  // that ACT on the same unresolved overlay kind; reset to 0 on a healthy arrival OR when the overlay
  // genuinely clears. Past OVERLAY_CHURN_CAP → one sticky pause.
  let overlayChurn = 0;
  let lastOverlaySig = null;

  // The scroller is resolved by the observer each tick; the heavy getScroller() query runs at most every
  // OBSERVER_MS. Geometry is READ here (window/document on TikTok, since getScroller() is null); the
  // physical WRITE is the SW's trusted-wheel loop, steered by the scroll_mode messages this observer sends.
  let currentScroller = getScroller();
  let lastScrollHeight = scrollerMetrics(currentScroller).scrollHeight; // growth baseline (network is the robust signal)

  // Enter a user-visible, resumable PAUSE (CHAL-UX): freeze the giveup ladder (we stop feeding the
  // reducer while paused), notify the SW (chrome notification + popup reason), and watch for recovery.
  // A pause is NEVER converted into a giveup — a paused-on-captcha run stays paused with its reason
  // until it's solved (healthy arrivals return / the overlay clears / we're back online) or the tab
  // closes. Returns once resumed; the caller then `continue`s and the run picks up where it left off.
  async function enterPause(level, reason, opts = {}) {
    const overlayTriggered = !!opts.overlayTriggered;
    const resumeWhenOnline = !!opts.resumeWhenOnline;
    sendScrollMode("hold"); // stop the SW's trusted-wheel loop while paused — no motion until we resume
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
    // The caller `continue`s; the next observer tick's stepDrive re-issues the real scroll_mode (advance/
    // hold), so the SW's wheel loop resumes where it left off — no explicit resume message needed here.
    return true;
  }

  while (running) {
    // The SW's trusted-wheel driver lost its debugger (banner Cancel / DevTools opened / attach dropped) —
    // end the run honestly as a reported incomplete rather than spinning a dead scroll. scroll_stop in
    // teardown is then a harmless no-op (already detached), so the debugger never dangles.
    if (scrollDriverDetached) {
      outcome = { status: "giveup", reason: scrollDriverDetachReason || "the scroll driver was disconnected" };
      running = false;
      console.warn(`[commonplace] capture INCOMPLETE — ${outcome.reason}`);
      break;
    }
    currentScroller = getScroller(); // refresh each tick (heavy query at most every OBSERVER_MS)
    const scroller = currentScroller;

    // ── 1. OVERLAY GUARD FIRST — classify any blocking layer and respond like a person.
    const overlay = await gatherOverlayFacts(scroller);
    const verdict = classifyOverlay(overlay);
    const oa = verdict.action;
    if (oa.kind !== "none") {
      // FIX 4a — churn accounting. Acting on the SAME overlay kind again means our last action didn't
      // clear it; count that. A different kind (or the first sighting) resets the count to 1.
      if (verdict.overlay === lastOverlaySig) overlayChurn++;
      else {
        overlayChurn = 1;
        lastOverlaySig = verdict.overlay;
      }
      if (overlayChurn > OVERLAY_CHURN_CAP) {
        // Bounded out: our snooze/dismiss/challenge/pause action keeps not resolving this overlay (a
        // dead click target, or a captcha-container false-positive that flaps). Stop acting and enter
        // ONE sticky pause that resumes ONLY on a healthy arrival (no overlayTriggered — the flapping
        // overlay signal must not un-pause it).
        console.warn(`[commonplace] overlay churn cap hit (${verdict.overlay}, ${overlayChurn}×) — sticky pause until a page returns`);
        await enterPause("overlay", OVERLAY_CHURN_REASON);
        overlayChurn = 0;
        lastOverlaySig = null;
        continue;
      }
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
    } else {
      // No actionable overlay this cycle → the overlay genuinely cleared; reset churn accounting.
      overlayChurn = 0;
      lastOverlaySig = null;
    }

    // ── 2. EVICT the oldest tiles down to the live window (§2.3 memory fix). Network-sourced capture
    //    means this can never lose data.
    evictedTotal += pruneGrid();

    // ── 3. GROWTH TRACKING — grewSinceLast = scrollHeight grew OR healthy arrivals grew since the last
    //    tick. Healthy arrivals are the ROBUST signal (eviction can shrink scrollHeight even as new pages
    //    land). `arrived` (any arrival) feeds the recovery classifier; `healthyArrived` is real progress.
    const m = scrollerMetrics(scroller);
    const arrived = pageArrivals > arrivalsSeen;
    const healthyArrived = healthyArrivals > healthyArrivalsSeen;
    const grewSinceLast = m.scrollHeight > lastScrollHeight || healthyArrived;
    lastScrollHeight = m.scrollHeight;
    arrivalsSeen = pageArrivals;
    healthyArrivalsSeen = healthyArrivals;
    if (healthyArrived) {
      // FIX 4a: a healthy page proves whatever was blocking is gone — reset overlay churn AND any
      // server-error streak.
      overlayChurn = 0;
      lastOverlaySig = null;
      httpErrorStreak = 0;
    }

    // ── 4. SESSION RECOVERY — classify the transport and act. A pause here holds the SW's trusted-wheel
    //    loop (enterPause sends scroll_mode "hold") and takes precedence over the motion decision this tick
    //    (it `continue`s before stepDrive). Unchanged ladder (offline / empty_ok flagged-refresh /
    //    challenge); the modest http_error slowdown replaces the old exponential backoff for a real 429/5xx.
    let recSignal = null;
    if (navigator.onLine === false) recSignal = "offline";
    else if (healthyArrived) recSignal = "healthy_arrival"; // resets the recovery streak
    else if (arrived) {
      if (lastTransport === "empty_ok") recSignal = "empty_ok";
      else if (lastTransport === "challenge") recSignal = "challenge";
      else if (lastTransport === "offline") recSignal = "offline";
      // http_error / api_error → no recovery signal; the modest-slowdown branch below owns http_error.
    }
    if (recSignal) {
      const r = stepRecovery(rec, recSignal, { now: Date.now() });
      rec = r.state;
      const rc = r.command;
      if (rc.kind === "reload") {
        // FIX 7 — the auto-`reload` recovery rung is SUPERVISOR-ONLY. A manual (Alt+Shift+A, source:null)
        // run has no persisted `current` checkpoint to re-drive it after a location.reload(), so a bare
        // reload would make the run vanish silently and could reload-loop. Instead, report an HONEST
        // reported-incomplete and end the run.
        if (!source) {
          console.warn("[commonplace] flagged session on a MANUAL run — not reloading; reporting incomplete (reload + retry yourself)");
          outcome = { status: "giveup", reason: "flagged session — reload the page and retry" };
          running = false;
          break; // fall through to scroll_done with giveup + reason
        }
        if (reloadedThisRun) {
          // Already spent this Sync attempt's one reload → escalate to the challenge pause rather than
          // reload-loop a flagged session.
          await enterPause("flagged", FLAGGED_PAUSE_REASON);
          continue;
        }
        reloadedThisRun = true;
        reloadingAway = true;
        running = false; // stop the observer; the page is navigating away
        sendScrollStop(); // detach the SW debugger BEFORE reload — never leave it attached to a page that's navigating (a dangling attach + a wheel loop on a fresh page)
        await chrome.storage.local.set({ captureReloadedSource: source });
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
    } else if (arrived && lastTransport === "http_error") {
      // A REAL server rate/error signal (429/5xx). MODEST fixed slowdown (pause the driver a few seconds
      // then resume) — NOT the old 2s→60s exponential backoff. Persistent past HTTP_ERROR_GIVEUP
      // consecutive http_error arrivals ⇒ an honest reported-incomplete (never a false done).
      httpErrorStreak++;
      if (httpErrorStreak >= HTTP_ERROR_GIVEUP) {
        outcome = { status: "giveup", reason: HTTP_ERROR_REASON };
        driveState = { ...driveState, mode: "exhausted" };
        driveMode = "exhausted";
        running = false;
        console.warn(`[commonplace] capture INCOMPLETE — ${HTTP_ERROR_REASON}`);
        break;
      }
      const ms = HTTP_ERROR_SLOWDOWN_MIN_MS + Math.floor(Math.random() * (HTTP_ERROR_SLOWDOWN_MAX_MS - HTTP_ERROR_SLOWDOWN_MIN_MS));
      console.warn(`[commonplace] server error (429/5xx) — modest slowdown ${ms}ms (streak ${httpErrorStreak}/${HTTP_ERROR_GIVEUP})`);
      sendScrollMode("hold"); // hold the SW's wheel loop for the slowdown; the next tick re-issues the mode
      await sleep(ms);
      continue;
    }

    // ── 5. COMPLETION / MOTION — compute the VERIFIED terminal on a healthy arrival, then run the pure
    //    geometry driver. `done` comes ONLY from isTerminalPage on a healthy transport; `exhausted` is
    //    the stuck-at-bottom honest-incomplete. Every other mode just tells the rAF driver how to move.
    let terminal = false;
    if (healthyArrived) {
      // `done` fires ONLY on a genuine terminal per a HEALTHY transport (isTerminalPage). A hasMore:false
      // riding a challenge/empty transport is NOT done — the transport gate inside isTerminalPage rejects
      // it. FIX 5: pass the REAL page item count so the `cursor:"-1" && items.length===0` sentinel keeps
      // its "empty page only" requirement (an empty Array of length lastItemsLen), never vacuously done.
      terminal = isTerminalPage(
        { items: new Array(lastItemsLen), hasMore: lastHasMore ?? true, cursor: lastCursor },
        lastTransport ?? "ok",
      );
    }
    const { count = 0 } = await chrome.storage.local.get("count");
    prevCount = Math.max(prevCount, count);
    const drive = stepDrive(driveState, {
      nowMs: Date.now(),
      scrollTop: m.scrollTop,
      scrollHeight: m.scrollHeight,
      clientHeight: m.clientHeight,
      grewSinceLast,
      terminal,
    });
    driveState = drive.state;
    driveMode = drive.mode;
    // Steer the SW's trusted-wheel loop from the geometry verdict — the physical scroll WRITE lives in the
    // SW now (TikTok's grid ignores ALL programmatic scrolling; only trusted wheels move it). advance→wheel
    // down · hold→idle at the frontier while the next page loads · retrigger→a short UP-burst so the loader's
    // edge-triggered sentinel leaves→re-enters. done/exhausted→stop the loop + detach the debugger now.
    if (driveMode === "advance" || driveMode === "hold" || driveMode === "retrigger") {
      sendScrollMode(driveMode);
    } else {
      sendScrollStop(); // done / exhausted — teardown also stops, idempotently
    }
    if (driveMode === "done") {
      outcome = { status: "done", reason: null };
      running = false;
      console.log(`[commonplace] capture COMPLETE — TikTok reported a verified terminal (hasMore:false); ${prevCount} captured`);
    } else if (driveMode === "exhausted") {
      outcome = { status: "giveup", reason: "reached the bottom but TikTok stopped loading with more expected" };
      running = false;
      console.warn(`[commonplace] capture INCOMPLETE — ${outcome.reason}`);
    }

    // ── 6. TELEMETRY + HUD (real Date.now()/performance.memory/document reads happen ONLY here — glue).
    const domCount = document.querySelectorAll(TILE_ANCHOR_SEL).length;
    const sample = sampleMemory({
      now: Date.now(),
      capturedCount: count,
      domNodes: document.getElementsByTagName("*").length,
      heap: performance.memory,
    });
    const hudState =
      driveMode === "retrigger" ? `retrigger ${driveState.stuckRetriggers}/${MAX_STUCK_RETRIGGERS}` : driveMode;
    updateHud(formatHudLine(sample, { source: lastSource, hasMore: lastHasMore, state: hudState, evicted: evictedTotal }));
    if (shouldLogSample(lastSampleLogTs, sample.ts, 5000)) {
      lastSampleLogTs = sample.ts;
      console.log("[commonplace] capture sample", sample);
    }
    console.log(
      `[commonplace] ${driveMode}… captured ${count} (hasMore ${lastHasMore}, mode ${driveMode}, stuck ${driveState.stuckRetriggers}, DOM ${domCount})`,
    );

    if (!running) break; // done / exhausted / giveup — fall through to scroll_done

    // ── 7. OBSERVER CADENCE. The fast, smooth motion is the rAF driver; the brain re-evaluates every
    //    OBSERVER_MS. No dwell/backoff here — the frontier clamp IS the pacing (it naturally waits at the
    //    loaded bottom while the next page loads), so there is NO multi-second freeze except a real pause.
    await sleep(OBSERVER_MS);
  }

  // ── TEARDOWN — stop the SW's trusted-wheel driver (ALWAYS detach), report the outcome, disarm. ──
  scrolling = false;
  sendScrollStop(); // detach the SW debugger on EVERY exit path — a dangling attach = a stuck "debugging" banner
  if (reloadingAway) return; // page navigating away; the supervisor's checkpoint re-drives — no scroll_done
  removeHud();
  if (source) {
    // Terminal reached this attempt — clear the reload guard so a later fresh Sync of this source can
    // reload again if IT hits a flag. (The reload path `return`s earlier and never reaches here.)
    await chrome.storage.local.set({ captureReloadedSource: null });
  }
  chrome.runtime.sendMessage({
    kind: "scroll_done",
    status: outcome.status,
    reason: outcome.reason ?? null,
    captured: prevCount,
    cursor: lastCursor,
    source, // Task 5: which source this run drove — lets background.ts's supervisor advance the sequence
  });
  activeRunSource = null; // disarm the carry-forward-2 filter; the run is over
  console.log(
    `[commonplace] auto-scroll ended (${outcome.status}, source ${source ?? "manual"}) — ${prevCount} captured, ${snoozeCount} snooze(s)`,
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
    // FIX 6: reset the previous source's stragglers AND baseline the arrival counters NOW, before the
    // nav window — so a first/only page that lands during navigateToSource's sleep is preserved as this
    // run's arrival (autoScroll then skips its own reset via runSignalsArmed). The arrival filter
    // (arrivalDrivesRun, source-gated) still blocks a foreign straggler, so this can't read the
    // previous source's stale hasMore:false.
    armRunSignals();
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
      runSignalsArmed = false; // this run bailed before autoScroll — release the arm we set above
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
  } else if (msg && msg.kind === "scroll_detached") {
    // The SW's trusted-wheel driver lost its debugger (banner Cancel, DevTools opened on the tab, or the
    // attach dropped). Flag it; autoScroll's observer ends the run honestly on its next tick — a reported
    // incomplete, never a hang and never a false done.
    scrollDriverDetached = true;
    scrollDriverDetachReason = (msg && msg.reason) || "the scroll driver was disconnected";
    console.warn(`[commonplace] scroll driver detached — ${scrollDriverDetachReason}`);
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
