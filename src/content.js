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
// The re-founded motion (trusted-wheel lane, live-observed 2026-07-13): the decision is NETWORK-driven
// now, not geometry. The physical scroll WRITE lives in the SERVICE WORKER as continuous trusted DOWN-
// wheels (chrome.debugger) — TikTok's profile grid ignores ALL programmatic scrolling (window.scrollBy/
// scrollTop=/scrollIntoView/synthetic WheelEvent all move it ZERO px; only a real trusted wheel scrolls
// it), and its custom/virtualized geometry is UNRELIABLE — so scrollDrive's frontier/hold/retrigger
// (geometry) misread "stuck" and fired UP-jiggles that dragged the scroll back up. The wheel lane just
// keeps wheeling DOWN and decides done/giveup on NETWORK arrivals: the pure `scrollWatch` reducer.
// (scrollDrive.ts is retired from this lane but kept; the discrete step-then-dwell machine — scrollMotion/
// pacing/scrollState in the hot path, plus the requestsIssued→backoff discriminator — is gone.)
import { initialWatchState, stepWatch } from "./lib/capture/scrollWatch.js";
// Wave A resilience (2026-07-13): own-identity capture (autonomous nav), the liveness watchdog (no
// silent hangs), and the account-safety kill-switch (don't hammer a wall) — all PURE, glued thinly here.
import {
  handleFromPath,
  parseSecUidFromUrl,
  isOwnProfile,
  chooseOwnHandle,
} from "./lib/capture/ownIdentity.js";
import { initialWatchdog, stepWatchdog, MAX_WEDGE_RETRIES } from "./lib/capture/watchdog.js";
import { shouldHaltForBlock, BAN_HALT_REASON } from "./lib/capture/banGuard.js";
// Wave-B/C resilience (2026-07-13): the run deadline (a wedged run can't hang forever), background-tab
// throttling (a hidden tab stops paginating), and the localized declared-count parser (COMPL-07 trust).
import { isPastDeadline, RUN_DEADLINE_REASON } from "./lib/capture/deadline.js";
import { assessVisibility, HIDDEN_PAUSE_REASON } from "./lib/capture/backgroundTab.js";
import { parseLocalizedCount } from "./lib/capture/declaredCount.js";
// FIX 3 (mid-run page-clear resilience, 2026-07-13): TikTok's flagged "Something went wrong" empty-state
// (or a discard) can wipe a POPULATED grid mid-run; the pure detector spots the populated→empty transition
// so the glue can drive the SAME bounded reload recovery empty_ok uses — never a false stop / false done.
import { stepPageClear, initialPageClearState, POPULATED_MIN_TILES } from "./lib/capture/pageClear.js";

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

// COMPL-07 (item 2): DISTINCT item ids captured for THIS source THIS run — the per-run new-id delta that
// scroll_done reports as `captured` (fixing #15: per-source counts used to report the GLOBAL cumulative
// total, so truncation was structurally invisible). Only arrivals that DRIVE the run (source-matched via
// arrivalDrivesRun) contribute, so this is a clean per-source measure. Reset at each run start.
let runCapturedIds = new Set();

// SUP-02: the freshest intercepted item_list URL (carries the profile owner's secUid). Threaded to
// own-identity capture; never used to drive the run.
let lastItemListUrl = null;

// User capture controls (CHAL-UX): the popup drives these via the SW. They are module-level so the SW's
// sync_stop/sync_pause/sync_resume messages set them while a run's observer loop reads them each tick.
// `userResumeRequested` breaks ANY pause (incl. a still-unsolved challenge) when the founder clicks
// Resume; `userPauseRequested` makes the observer enter a resumable user pause; `userStopRequested`
// ends the run cleanly (no supervisor-advancing scroll_done — the SW owns stop cleanup).
let userStopRequested = false;
let userPauseRequested = false;
let userResumeRequested = false;
// FIX 2 — set when the SW reports its debugger detached EXTERNALLY (the founder closed the "Commonplace
// is debugging" banner, or opened DevTools). The observer enters a RESUMABLE pause held until the founder
// clicks Resume (which re-attaches the debugger in the SW). The run is NOT ended — capture continues after
// Resume. Reset at the start of each run.
let debuggerPauseRequested = false;

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
    lastItemListUrl = e.data.url ?? lastItemListUrl; // SUP-02: the freshest item_list URL carries secUid
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
    // COMPL-07 (item 2): accumulate DISTINCT captured ids for THIS run (only driving arrivals reach here,
    // so this is the per-source new-id delta). An empty/challenge transport carries items:[] → no-op.
    if (Array.isArray(e.data.items)) {
      for (const it of e.data.items) {
        if (it && typeof it.id === "string" && it.id) runCapturedIds.add(it.id);
      }
    }
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
// thin messaging that tells the SW to keep wheeling DOWN each observer tick, and the NETWORK-arrival
// tracking that decides done/giveup; the pure `scrollWatch` reducer owns the MODE decision. (Geometry
// reads DO reflect trusted-wheel scrolling, but TikTok's virtualized geometry is unreliable for the
// motion decision — so the wheel lane ignores it and drives off healthy item_list arrivals instead.)

/** The observer cadence (ms): the slow intelligence loop (overlay guard, eviction, arrival tracking,
 *  session recovery, the scrollWatch verdict). The SW's trusted-wheel loop owns the fast, smooth motion —
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

// ── Trusted-wheel driver messaging (the moat) ──────────────────────────────────────────────────────
// The SW holds the chrome.debugger attach and runs a continuous trusted-wheel loop; content.js just tells
// it the aim point + the current mode. The observer maps scrollWatch's verdict → these messages each tick.
// (No geometry read feeds the motion decision anymore — the wheel lane drives off healthy network arrivals;
// the geometry helper that used to feed the geometry reducer was removed with that reducer's role.)

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

// Tell the SW's wheel loop how to move THIS tick. The wheel lane sends only two modes: advance→wheel DOWN
// continuously (the normal path), and hold→idle (ONLY during a legitimate pause — enterPause / the
// http_error slowdown). retrigger (an UP-burst) is NEVER sent from the normal path anymore — it was the
// geometry era's frontier machinery, wrong for a real continuous down-wheel (the SW still understands it,
// but nothing here emits it). (x,y) re-aims the wheel each tick (cheap; keeps it over the grid if the
// layout shifts).
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

// FIX 3 — TikTok's flagged/empty ERROR state: a "Something went wrong" message and/or a Refresh/Retry
// control where the grid used to be. This is only ever consulted by the page-clear detector when the
// grid already looks depleted (a cheap tile-count gate), so it stays off the hot path on a healthy page.
// Best-effort + conservative: a visible retry/refresh control, OR a SHORT visible node literally saying
// the surface failed to load — combined (in the pure detector) with "the grid was populated then went
// empty", the false-positive surface is tiny. Live-verify the exact TikTok error markup.
const PAGE_ERROR_TEXT = /something went wrong|an error occurred|couldn'?t load|failed to load|no internet/i;
const PAGE_RETRY_TEXT = /^(refresh|retry|try again|reload)$/i;
function detectPageErrorState() {
  for (const el of document.querySelectorAll("button, a, [role='button']")) {
    const t = (el.textContent || "").trim();
    if (t.length <= 24 && PAGE_RETRY_TEXT.test(t) && isVisible(el)) return true;
  }
  for (const el of document.querySelectorAll("p, h1, h2, h3, span")) {
    const t = (el.textContent || "").trim();
    if (t.length <= 80 && PAGE_ERROR_TEXT.test(t) && isVisible(el)) return true;
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
// A founder-initiated pause (popup Pause button) — held until they click Resume.
const USER_PAUSE_REASON = "paused — click Resume to continue capturing";
// FIX 2 — the debugger detached externally (banner closed / DevTools opened). A resumable pause HELD until
// Resume (no healthy arrival can auto-break it — the wheel loop is detached, so no motion/pages will come).
const DEBUGGER_BANNER_PAUSE_REASON =
  "capture paused — the “Commonplace is debugging” banner was closed; click Resume to reconnect and keep capturing";
// A wedged run being re-nudged before we concede (liveness watchdog) — surfaced so a hang self-reports.
const WEDGE_RETRY_REASON = "capture stalled — re-nudging the loader to keep going";

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
  runCapturedIds = new Set(); // COMPL-07: fresh per-run captured set (nav-window arrivals accrue into it)
  runSignalsArmed = true;
}

// COMPL-07 (item 2): read the source's DECLARED saved count from the profile UI (best-effort, CONSERVATIVE
// — only the source tab's OWN subtree, so an unrelated number elsewhere can't fabricate a count). The pure
// parseLocalizedCount handles "1,463" / "1.5K" / "1 463" / non-Latin digits → a number, or null if the
// count isn't visibly rendered there. A null just means the completeness guard can't flag "suspicious".
//
// FIX 4 — the founder confirmed: the FAVORITES tab surfaces the total favorites count; the LIKES tab does
// NOT (Likes has no visible total). So Likes stays OPEN-ENDED (null) — it can never fabricate a wrong count
// off some stray number — and Favorites (plus best-effort Posts/Reposts) reads its tab total resiliently.
// LIVE-VERIFY: the exact element TikTok renders the count on/near varies by locale + layout.
function readDeclaredCount(source) {
  if (!source) return null;
  if (source === "likes") return null; // Likes shows no total → open-ended by design
  const tab = findSourceTab(source);
  if (!tab) return null;
  // The tab's own text usually carries the count ("Favorites 1,463" / "1.5K"); parseLocalizedCount grabs
  // the first numeric run. If the label alone has no number, fall back to a count BADGE within the tab.
  const direct = parseLocalizedCount(tab.textContent || "");
  if (direct != null) return direct;
  return scanTabForCount(tab);
}

// Scan ONLY within the tab element for a child node that is itself just a count token (a badge/superscript).
// Conservative — never reaches outside the tab, since a wrong count is worse than none (the completeness
// guard then simply defaults to the honest scroll outcome). Latin-digit pre-filter; non-Latin locales are
// covered by the `direct` tab-text read above.
function scanTabForCount(tab) {
  for (const el of tab.querySelectorAll("span, strong, sup, b, i, div")) {
    const t = (el.textContent || "").trim();
    if (t && t.length <= 12 && /^[\d.,\s ]+\s*[kmb]?$/i.test(t)) {
      const n = parseLocalizedCount(t);
      if (n != null) return n;
    }
  }
  return null;
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

// ── Own-identity capture (SUP-02) ────────────────────────────────────────────────
// Learn the founder's OWN handle so the SW can navigate ANY tab to their profile before capturing.
// CONFIDENT capture happens only on the user's OWN profile (an owner-only control — Edit-profile or the
// private Favorites tab — is present); a nav-link read is the cold-start fallback. The keep/overwrite
// decision is the pure `chooseOwnHandle` (never clobbers a known handle with junk). secUid rides along
// from the last item_list URL, trusted only on the own profile (else it's some viewed creator's).

function detectEditProfile() {
  if (document.querySelector('[data-e2e="edit-profile-entrance"], [data-e2e="edit-profile"]')) return true;
  for (const el of document.querySelectorAll("button, a")) {
    const t = (el.textContent || "").trim();
    if (/^edit profile$/i.test(t) && isVisible(el)) return true;
  }
  return false;
}

function detectFavoritesTabPresent() {
  // Favorites is private — its sub-tab renders only on the account owner's own profile.
  return !!document.querySelector('[data-e2e="favorites-tab"]');
}

function gatherOwnProfileFacts() {
  return { editProfilePresent: detectEditProfile(), favoritesTabPresent: detectFavoritesTabPresent() };
}

// The logged-in user's profile link in the left nav / header — the from-ANY-page discovery path when we
// don't yet know the handle. Best-effort across TikTok's data-e2e variants; a miss is a graceful null.
function detectOwnHandleFromNav() {
  const sels = ['a[data-e2e="nav-profile"]', 'a[data-e2e="profile-icon"]', '[data-e2e="nav-profile"]'];
  for (const sel of sels) {
    const el = document.querySelector(sel);
    const href = el && (el.getAttribute("href") || el.closest?.("a")?.getAttribute("href"));
    if (href) {
      try {
        const h = handleFromPath(new URL(href, location.origin).pathname);
        if (h) return h;
      } catch (_) {}
    }
  }
  return null;
}

// Persist a discovered handle (+ secUid when confident) through the pure keep/overwrite policy.
async function persistOwnIdentity(observed, confident) {
  try {
    const { cp_own_handle: stored } = await chrome.storage.local.get("cp_own_handle");
    const next = chooseOwnHandle(stored, observed, confident);
    const patch = {};
    if (next && next !== stored) patch.cp_own_handle = next;
    if (confident) {
      const secUid = parseSecUidFromUrl(lastItemListUrl); // trust secUid only on the own profile
      if (secUid) patch.cp_own_secuid = secUid;
    }
    if (Object.keys(patch).length) await chrome.storage.local.set(patch);
  } catch (_) {}
}

// Opportunistic capture: if we're on the founder's OWN profile right now, persist the handle confidently.
function maybeCaptureOwnIdentity() {
  if (isProfilePage() && isOwnProfile(gatherOwnProfileFacts())) {
    const h = handleFromPath(location.pathname);
    if (h) void persistOwnIdentity(h, true);
  }
}

// Synchronous best-effort own-handle for the SW's discover_handle probe (persists as a side effect).
function discoverOwnHandle() {
  if (isProfilePage() && isOwnProfile(gatherOwnProfileFacts())) {
    const h = handleFromPath(location.pathname);
    if (h) {
      void persistOwnIdentity(h, true);
      return h;
    }
  }
  const nav = detectOwnHandleFromNav();
  if (nav) {
    void persistOwnIdentity(nav, false);
    return nav;
  }
  return null;
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
  // Fresh run → clear any stale user-control requests from a previous run (CHAL-UX).
  userStopRequested = false;
  userPauseRequested = false;
  userResumeRequested = false;
  debuggerPauseRequested = false; // FIX 2 — clear any stale external-detach flag from a prior run
  let stoppedByUser = false;
  // Opportunistic own-handle capture: if we're already on the founder's own profile, learn it now so a
  // later Sync from ANY page can navigate here autonomously (SUP-02).
  maybeCaptureOwnIdentity();

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
    runCapturedIds = new Set(); // COMPL-07: fresh per-run captured set for a manual/un-armed run
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
      captured: runCapturedIds.size,
      cursor: lastCursor,
      source,
      declared: null, // aborted before capture — no honest declared read
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
      captured: runCapturedIds.size,
      cursor: lastCursor,
      source,
      declared: null, // aborted before capture — no honest declared read
    });
    // Nothing was started yet (no observer, no successful attach) — nothing to cancel and no scroll_stop
    // needed (the SW never attached on a failed start). Disarm exactly like teardown would, then return.
    activeRunSource = null;
    scrolling = false;
    console.warn(`[commonplace] capture ABORTED (scroll driver: ${driverStart.reason}, source ${source ?? "manual"})`);
    return;
  }

  // MOTION IS NOW A SLOW OBSERVER (the brain) + the SW's TRUSTED-WHEEL LOOP (the smooth continuous DOWN
  // motion). The motion/completion DECISION lives in the pure `scrollWatch` reducer (NETWORK arrivals in →
  // advance/done/giveup out — NO geometry); this observer maps that verdict to scroll_mode messages the
  // SW's wheel loop obeys (advance→keep wheeling down · done/giveup→stop+detach). There is NO hold and NO
  // retrigger from this normal path (they were the geometry era's frontier machinery, WRONG for a real
  // continuous down-wheel). Completion is a VERIFIED terminal only (isTerminalPage on a healthy transport);
  // a stall — no healthy arrival for STALL_MS with no terminal — is `giveup`, a DISTINCT reported-
  // incomplete, never a false `done`.
  let watchState = initialWatchState(Date.now());
  let watchMode = watchState.mode; // the mode the observer last decided — mapped to a scroll_mode message
  let running = true;
  let reloadingAway = false; // set when we location.reload() a flagged session — teardown then skips scroll_done
  let outcome = { status: "giveup", reason: "capture ended before a verified terminal" }; // finalized at each terminal
  let rec = initialRecoveryState(Date.now());
  let pageClearState = initialPageClearState(); // FIX 3 — tracks the populated→empty transition of a mid-run clear
  let httpErrorStreak = 0; // consecutive http_error arrivals — a persistent 429/5xx ends the run honestly
  let challengeCycles = 0; // transport-challenge pause cycles this run — feeds the account-safety kill-switch (banGuard)
  let watchdog = initialWatchdog(); // liveness watchdog — bounded re-nudges before conceding a wedged run
  let lastSampleLogTs = 0; // console.log a CaptureSample roughly every ~5s while scrolling
  let snoozeCount = 0; // screen-time reminders auto-snoozed this run (logged, never a passcode)
  // Item 4 — run deadline: an absolute per-source-run wall-clock cap so a flapping/wedged run can't hang
  // forever (composes with the liveness watchdog, which bounds a SHORT stall; this bounds the WHOLE run).
  const runStartedMs = Date.now();
  // COMPL-07 (item 2) — the source's declared saved count, read from the profile UI (best-effort). Re-read
  // once after the first healthy page if it wasn't rendered yet at run start.
  let declaredCount = source ? readDeclaredCount(source) : null;
  // Wave C (item 5) — background-tab throttling. `lastHealthyMs` anchors the hidden-stall timer; a hidden
  // tab that stops paginating pauses (or, opt-in, is foregrounded). Read the founder's foreground choice.
  let lastHealthyMs = Date.now();
  let keepForeground = false;
  // Background CAPTURE (config.captureBackground, default ON): the SW applies focus emulation on the
  // debugger attach so a hidden tab keeps running — so we must NOT pause merely because the tab is hidden.
  // `!== false` mirrors the DEFAULT_CONFIG default of true (an absent key ⇒ on) and the deep-merge backfill.
  let backgroundMode = true;
  try {
    const { cp_config } = await chrome.storage.local.get("cp_config");
    keepForeground = cp_config?.captureKeepForeground === true;
    backgroundMode = cp_config?.captureBackground !== false;
  } catch (_) {}
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

  // The scroller is resolved by the observer each tick (getScroller() is used by the overlay input-swallow
  // probe; the heavy query runs at most every OBSERVER_MS). The physical scroll is the SW's continuous
  // trusted DOWN-wheel loop, steered by the scroll_mode messages this observer sends — NO geometry read
  // feeds the motion decision anymore (the wheel lane drives off healthy network arrivals).
  let currentScroller = getScroller();

  // Enter a user-visible, resumable PAUSE (CHAL-UX): freeze the giveup ladder (we stop feeding the
  // reducer while paused), notify the SW (chrome notification + popup reason), and watch for recovery.
  // A pause is NEVER converted into a giveup — a paused-on-captcha run stays paused with its reason
  // until it's solved (healthy arrivals return / the overlay clears / we're back online) or the tab
  // closes. Returns once resumed; the caller then `continue`s and the run picks up where it left off.
  async function enterPause(level, reason, opts = {}) {
    const overlayTriggered = !!opts.overlayTriggered;
    const resumeWhenOnline = !!opts.resumeWhenOnline;
    // Wave C (item 5): a HIDDEN-tab pause auto-resumes when the tab is brought forward — while hidden +
    // held the wheel is stopped, so NO healthy arrival can come to break the pause; visibility is the
    // right resume signal instead.
    const resumeWhenVisible = !!opts.resumeWhenVisible;
    // FIX 2: a debugger-detach pause is HELD until the founder acts (Resume, which re-attaches in the SW —
    // or Stop). The wheel loop is detached, so NO healthy arrival can come to auto-break it; letting a
    // stray late page un-pause it would resume into a dead (unattached) scroll. Only user action resumes it.
    const heldUntilUser = !!opts.heldUntilUser;
    sendScrollMode("hold"); // stop the SW's trusted-wheel loop while paused — no motion until we resume
    // Raise the CRASH-SAFE, popup-readable `paused` state (the SW persists it to storage). This is the
    // single source of truth the UI surfaces as "action needed" — the founder's #1 ask: never a silent
    // stop. The SW also raises a chrome notification (he may be away from the tab).
    try {
      chrome.runtime.sendMessage({ kind: "capture_paused", level, reason });
    } catch (_) {}
    console.warn(`[commonplace] capture PAUSED (${level}) — ${reason}`);
    const pauseStartHealthy = healthyArrivals;
    const PAUSE_POLL_MS = 1500;
    userResumeRequested = false; // consume any stale resume from before this pause began
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
      if (userStopRequested) break; // founder pressed Stop → exit the pause; the observer loop ends the run
      if (userResumeRequested) {
        // Founder pressed Resume → continue regardless of whether the obstruction visibly cleared.
        userResumeRequested = false;
        userPauseRequested = false;
        break;
      }
      if (!heldUntilUser && healthyArrivals > pauseStartHealthy) break; // a fresh healthy page returned → auto-resume
      if (resumeWhenOnline && navigator.onLine !== false) break; // back online → resume (regenerate arrivals)
      if (resumeWhenVisible && !document.hidden) break; // Wave C: tab brought forward → resume the run
      if (overlayTriggered) {
        const f = await gatherOverlayFacts(getScroller());
        if (!f.hasBlockingLayer && !f.inputSwallowed) break; // the overlay cleared → auto-resume
      }
    }
    // Clear the persisted `paused` state so the UI drops the action-needed prompt. (On a user Stop the SW
    // also clears it — this is idempotent.)
    try {
      chrome.runtime.sendMessage({ kind: "capture_resumed" });
    } catch (_) {}
    console.log(`[commonplace] capture RESUMED (was paused: ${level})`);
    // The caller `continue`s; the next observer tick's scrollWatch re-issues the real scroll_mode (advance),
    // so the SW's wheel loop resumes wheeling down where it left off.
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

    // ── RUN DEADLINE (item 4) — the absolute wall-clock cap. Past it, conclude HONESTLY (a reported
    //    incomplete with a clear reason) + notify, rather than letting a flapping run grind indefinitely.
    //    The SW releases the single-driver lease when the resulting giveup ends the sweep / on the next
    //    drive re-acquiring; teardown always detaches the debugger.
    if (isPastDeadline(runStartedMs, Date.now())) {
      outcome = { status: "giveup", reason: RUN_DEADLINE_REASON };
      running = false;
      try { chrome.runtime.sendMessage({ kind: "capture_notice", level: "deadline", reason: RUN_DEADLINE_REASON }); } catch (_) {}
      sendScrollStop();
      console.warn(`[commonplace] capture INCOMPLETE — hit the 20-minute run deadline for ${source ?? "manual"}`);
      break;
    }

    // ── USER CONTROLS (CHAL-UX). Stop ends the run cleanly (the SW owns the stop cleanup, so we send NO
    //    supervisor-advancing scroll_done). Pause enters a resumable user pause held until Resume.
    if (userStopRequested) {
      stoppedByUser = true;
      running = false;
      console.warn("[commonplace] capture STOPPED by the founder");
      break;
    }
    if (userPauseRequested) {
      await enterPause("user", USER_PAUSE_REASON);
      if (userStopRequested) {
        stoppedByUser = true;
        running = false;
        console.warn("[commonplace] capture STOPPED by the founder (during a pause)");
        break;
      }
      continue; // resumed → re-decide motion next tick
    }
    // FIX 2 — the SW's debugger detached externally (banner closed / DevTools opened). Enter a RESUMABLE
    // pause held until the founder clicks Resume (the SW re-attaches the debugger + restarts the wheel loop
    // BEFORE relaying sync_resume). The run stays ALIVE — never ended on an external detach. `heldUntilUser`
    // so a stray late page can't auto-break it into a dead, unattached scroll.
    if (debuggerPauseRequested) {
      debuggerPauseRequested = false;
      await enterPause("debugger", DEBUGGER_BANNER_PAUSE_REASON, { heldUntilUser: true });
      if (userStopRequested) {
        stoppedByUser = true;
        running = false;
        console.warn("[commonplace] capture STOPPED by the founder (during a debugger pause)");
        break;
      }
      continue; // resumed (re-attached) → re-decide motion next tick, wheeling down where it left off
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

    // ── 3. ARRIVAL TRACKING — the wheel lane decides motion purely on NETWORK arrivals (geometry on
    //    TikTok's virtualized grid is unreliable). `arrived` (any arrival) feeds the recovery classifier;
    //    `healthyArrived` (a transport:"ok" page) is real progress — it drives scrollWatch and re-anchors
    //    its stall timer.
    const arrived = pageArrivals > arrivalsSeen;
    const healthyArrived = healthyArrivals > healthyArrivalsSeen;
    arrivalsSeen = pageArrivals;
    healthyArrivalsSeen = healthyArrivals;
    if (healthyArrived) {
      // FIX 4a: a healthy page proves whatever was blocking is gone — reset overlay churn AND any
      // server-error streak. Also reset the account-safety counters (a real page means we're not walled)
      // and the liveness watchdog (fresh progress → fresh re-nudge budget for a future wedge).
      overlayChurn = 0;
      lastOverlaySig = null;
      httpErrorStreak = 0;
      challengeCycles = 0;
      watchdog = initialWatchdog();
      lastHealthyMs = Date.now(); // Wave C: a healthy page → re-anchor the hidden-stall timer
      // COMPL-07: the declared count may render only once the grid is active — re-read it if still unknown.
      if (declaredCount == null && source) declaredCount = readDeclaredCount(source);
    }

    // ── BACKGROUND-TAB RESILIENCE (Wave C, item 5). The SW-driven trusted-wheel WRITE survives the tab
    //    being hidden, but TikTok's OWN rendering + IntersectionObserver lazy-load are throttled/paused
    //    for a hidden tab — so the grid stops paginating and the run would silently stall for a reason
    //    unrelated to TikTok. Act ONLY when hidden AND stalled (assessVisibility): keepForeground →
    //    ask the SW to bring the tab forward; else → a resumable pause that auto-resumes the moment the
    //    tab is shown again (bringing it forward re-paints + re-triggers the loader).
    if (document.hidden) {
      // With backgroundMode ON (the default), focus emulation keeps the hidden tab live, so assessVisibility
      // returns "ok" and this whole block no-ops — the run keeps wheeling. Only the normal scrollWatch
      // arrival-stall path can conclude the run. When OFF, the pause/foreground fallback below applies.
      const vis = assessVisibility({ hidden: true, msSinceHealthy: Date.now() - lastHealthyMs, backgroundMode });
      if (vis === "hidden_stalled") {
        if (keepForeground) {
          try { chrome.runtime.sendMessage({ kind: "focus_capture_tab" }); } catch (_) {}
          console.warn("[commonplace] hidden tab stalled — asking the SW to foreground it (captureKeepForeground)");
          await sleep(1500); // let it come forward + resume painting before the next motion decision
          lastHealthyMs = Date.now(); // give it a fresh window to produce a page before re-triggering
          continue;
        }
        await enterPause("hidden", HIDDEN_PAUSE_REASON, { resumeWhenVisible: true });
        lastHealthyMs = Date.now(); // reset the stall clock after resuming (tab is now visible)
        continue;
      }
    }

    // ── 4. SESSION RECOVERY — classify the transport and act. A pause here holds the SW's trusted-wheel
    //    loop (enterPause sends scroll_mode "hold") and takes precedence over the motion decision this tick
    //    (it `continue`s before scrollWatch). Unchanged ladder (offline / empty_ok flagged-refresh /
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
    // ── FIX 3: MID-RUN PAGE CLEAR. TikTok's flagged "Something went wrong" empty-state (a refresh fixes
    //    it) or a discard can wipe a POPULATED grid mid-run (the live "~6k stopped/cleared" symptom). The
    //    pure detector spots the populated→empty transition — eviction never trims below its live window,
    //    so it can't forge one — and we drive the SAME bounded reload recovery empty_ok uses (one reload →
    //    re-verify → else pause+notify). Never let a mid-run clear read as a stall/giveup or a false done.
    //    The error-state DOM scan is gated behind a depleted tile count, so it stays off a healthy hot path.
    const tileCount = document.querySelectorAll(TILE_ANCHOR_SEL).length;
    const pageErrored = tileCount <= POPULATED_MIN_TILES ? detectPageErrorState() : false;
    const pc = stepPageClear(pageClearState, { tiles: tileCount, errorState: pageErrored });
    pageClearState = pc.state;
    if (pc.cleared && recSignal == null) {
      console.warn(
        `[commonplace] mid-run page CLEAR detected (tiles ${tileCount}, peak ${pageClearState.peakTiles}` +
          `${pageErrored ? ", error-state" : ""}) — driving the bounded reload recovery`,
      );
      recSignal = "empty_ok"; // feed the SAME flagged-refresh ladder (2 consecutive → one reload → else pause)
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
        if (recSignal === "challenge") {
          // A transport-level wall (403 / login redirect / captcha HTML). Count the cycle; if it keeps
          // re-blocking after each auto-resume past the ceiling, HALT to protect the account (C7) rather
          // than keep re-entering a pause against a wall that never clears.
          challengeCycles++;
          if (shouldHaltForBlock({ httpErrorStreak, challengeCycles })) {
            outcome = { status: "giveup", reason: BAN_HALT_REASON };
            try { chrome.runtime.sendMessage({ kind: "capture_notice", level: "blocked", reason: BAN_HALT_REASON }); } catch (_) {}
            running = false;
            console.warn(`[commonplace] capture HALTED (account safety) — repeated challenge — ${BAN_HALT_REASON}`);
            break;
          }
        }
        await enterPause(level, rc.reason, { resumeWhenOnline: recSignal === "offline" });
        continue;
      }
      // rc.kind === "continue": nothing to do.
    } else if (arrived && lastTransport === "http_error") {
      // A REAL server rate/error signal (429/5xx). MODEST fixed slowdown (pause the driver a few seconds
      // then resume) — NOT the old 2s→60s exponential backoff. But a SUSTAINED run of server errors is a
      // wall: the account-safety kill-switch (banGuard) HALTS the run — stop wheeling, detach (teardown),
      // raise a user-visible "blocked" notice — never keep hammering (never a false done).
      httpErrorStreak++;
      if (shouldHaltForBlock({ httpErrorStreak, challengeCycles })) {
        outcome = { status: "giveup", reason: BAN_HALT_REASON };
        try { chrome.runtime.sendMessage({ kind: "capture_notice", level: "blocked", reason: BAN_HALT_REASON }); } catch (_) {}
        running = false;
        console.warn(`[commonplace] capture HALTED (account safety) — repeated server errors — ${BAN_HALT_REASON}`);
        break;
      }
      const ms = HTTP_ERROR_SLOWDOWN_MIN_MS + Math.floor(Math.random() * (HTTP_ERROR_SLOWDOWN_MAX_MS - HTTP_ERROR_SLOWDOWN_MIN_MS));
      console.warn(`[commonplace] server error (429/5xx) — modest slowdown ${ms}ms (streak ${httpErrorStreak})`);
      sendScrollMode("hold"); // hold the SW's wheel loop for the slowdown; the next tick re-issues the mode
      await sleep(ms);
      continue;
    }

    // ── 5. COMPLETION / MOTION — the wheel lane is NETWORK-driven (geometry is gone). Compute the VERIFIED
    //    terminal on a healthy arrival, then run the pure `scrollWatch` reducer off healthy arrivals + the
    //    terminal. `done` comes ONLY from isTerminalPage on a healthy transport; a stall (no healthy arrival
    //    for STALL_MS with no terminal) is `giveup`, the honest reported-incomplete. Otherwise: keep wheeling
    //    down. NO frontier/hold/retrigger — with a real continuous down-wheel you can't overshoot and the
    //    loader re-fires from continuous transit, so up-jiggles and holds are never needed.
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
    const watch = stepWatch(watchState, {
      nowMs: Date.now(),
      healthyArrivedSince: healthyArrived,
      terminal,
    });
    watchState = watch.state;
    watchMode = watch.mode;
    // Steer the SW's trusted-wheel loop from the NETWORK verdict — the physical scroll WRITE lives in the
    // SW now (TikTok's grid ignores ALL programmatic scrolling; only trusted wheels move it). advance→keep
    // wheeling DOWN continuously · done→stop the loop + detach. A `giveup` (stall) is FIRST offered to the
    // LIVENESS WATCHDOG: a wedged run gets a bounded re-nudge (a retrigger up-burst re-arms the loader) +
    // a surfaced notice before we concede, so a merely-wedged run self-reports and recovers instead of
    // silently ending; only a truly dead loader concedes. A pause still sends its own legitimate hold via
    // enterPause / the http_error slowdown.
    if (watchMode === "done") {
      sendScrollStop(); // stop the loop + detach the debugger; teardown also stops, idempotently
      outcome = { status: "done", reason: null };
      running = false;
      console.log(`[commonplace] capture COMPLETE — TikTok reported a verified terminal (hasMore:false); ${prevCount} captured`);
    } else if (watchMode === "retrigger") {
      // FIX 1 — a GENUINE arrival-stall (no healthy page for ~1.8s). scrollWatch fires the up-nudge FAST
      // and gated on the NETWORK (never on geometry, so it can't drag a healthy scroll back up). Map it to
      // the SW's trusted-wheel pump, which does the actual UP-burst then resumes wheeling down. We do NOT
      // reset watchState — the reducer's own retrigger budget/cooldown paces the nudges and, once spent,
      // concedes at the STALL_MS ceiling.
      sendScrollMode("retrigger");
    } else if (watchMode === "giveup") {
      const wd = stepWatchdog(watchdog);
      watchdog = wd.state;
      if (wd.action === "retry") {
        console.warn(`[commonplace] run wedged (no new pages) — re-nudging the loader (retry ${watchdog.retries}/${MAX_WEDGE_RETRIES})`);
        try { chrome.runtime.sendMessage({ kind: "capture_notice", level: "stalled", reason: WEDGE_RETRY_REASON }); } catch (_) {}
        sendScrollMode("retrigger"); // jolt the lazy-loader: a brief up-burst, then resume advancing
        watchState = initialWatchState(Date.now()); // fresh stall window so the re-nudge has time to work
        watchMode = "advance";
      } else {
        sendScrollStop(); // budget spent — concede honestly + detach
        outcome = { status: "giveup", reason: "TikTok stopped loading new pages" };
        running = false;
        console.warn(`[commonplace] capture INCOMPLETE — ${outcome.reason}`);
      }
    } else {
      sendScrollMode("advance"); // keep wheeling DOWN continuously
    }

    // ── 6. TELEMETRY + HUD (real Date.now()/performance.memory/document reads happen ONLY here — glue).
    const domCount = tileCount; // reuse the count read for the page-clear detector this same tick
    const sample = sampleMemory({
      now: Date.now(),
      capturedCount: count,
      domNodes: document.getElementsByTagName("*").length,
      heap: performance.memory,
    });
    updateHud(formatHudLine(sample, { source: lastSource, hasMore: lastHasMore, state: watchMode, evicted: evictedTotal }));
    if (shouldLogSample(lastSampleLogTs, sample.ts, 5000)) {
      lastSampleLogTs = sample.ts;
      console.log("[commonplace] capture sample", sample);
    }
    console.log(
      `[commonplace] ${watchMode}… captured ${count} (hasMore ${lastHasMore}, mode ${watchMode}, DOM ${domCount})`,
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
  if (stoppedByUser) {
    // The founder pressed Stop. The SW already ran the stop cleanup (detached, cleared the supervisor's
    // `current` so nothing auto-resumes, cleared `paused`). We must NOT send a scroll_done — a
    // source_finished would advance the supervisor and re-drive the next source. Just disarm and exit.
    activeRunSource = null;
    console.log(`[commonplace] auto-scroll stopped by the founder (source ${source ?? "manual"}) — ${prevCount} captured`);
    return;
  }
  if (source) {
    // Terminal reached this attempt — clear the reload guard so a later fresh Sync of this source can
    // reload again if IT hits a flag. (The reload path `return`s earlier and never reaches here.)
    await chrome.storage.local.set({ captureReloadedSource: null });
  }
  chrome.runtime.sendMessage({
    kind: "scroll_done",
    status: outcome.status,
    reason: outcome.reason ?? null,
    captured: runCapturedIds.size, // COMPL-07: DISTINCT items captured for THIS source THIS run (per #15)
    cursor: lastCursor,
    source, // Task 5: which source this run drove — lets background.ts's supervisor advance the sequence
    declared: declaredCount, // COMPL-07: the source's declared saved count (null if unread) → completeness
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
// data-e2e FIRST (TikTok's most stable handle). Live-confirmed working 2026-07-13 on the founder's DOM:
// `favorites-tab`, `liked-tab`. Extra variants cover markup drift; the text fallbacks are last resort.
const SOURCE_TAB_HINTS = {
  favorites: { e2e: ["favorites-tab", "user-favorite", "favorite-tab"], text: [/^favorites$/i, /^favorite$/i] },
  likes: { e2e: ["liked-tab", "user-liked", "likes-tab"], text: [/^liked$/i, /^likes$/i] },
  posts: { e2e: ["user-post", "posts-tab", "post-tab"], text: [/^videos$/i, /^posts$/i] },
  reposts: { e2e: ["user-repost", "repost-tab", "reposts-tab"], text: [/^reposts$/i, /^repost$/i] },
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

// Wait for the ACTIVE source's first page to actually arrive (SUP-05) rather than sleeping a fixed
// interval. `pageArrivals` only counts arrivals matching `activeRunSource` (the item_list handler gates
// on arrivalDrivesRun before bumping it), so a bump here means the clicked sub-tab's grid began
// paginating. Returns true on arrival, false on timeout. A small floor sleep on timeout lets a slow
// grid settle before we start wheeling.
async function waitForSourceArrival(timeoutMs) {
  const start = pageArrivals;
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    await sleep(200);
    if (pageArrivals > start) return true;
  }
  return false;
}

async function navigateToSource(source) {
  if (!source) return false;
  const tab = findSourceTab(source);
  if (!tab) {
    console.warn(
      `[commonplace] navigateToSource(${source}): no sub-tab found — capture will run against whatever ` +
        `is showing; a non-matching source is filtered out (carry-forward 2) and the run reports giveup.`,
    );
    return false;
  }
  tab.click();
  console.log(`[commonplace] navigateToSource(${source}) → clicked sub-tab; waiting for its first page`);
  // SUP-05: wait for the source's first item_list to arrive (up to 5s) instead of a blind fixed sleep —
  // robust to a fast OR a slow grid swap. On timeout, a short floor still lets the grid settle.
  const arrived = await waitForSourceArrival(5000);
  if (!arrived) {
    console.log(`[commonplace] navigateToSource(${source}) → no first page within 5s; proceeding (the run's stall/watchdog will handle a truly dead grid)`);
    await sleep(500);
  }
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
    // SUP-02: opportunistically learn our own handle from this tab (if it's the founder's own profile)
    // BEFORE we hop into a sub-tab, so a later Sync from ANY page can navigate here autonomously.
    maybeCaptureOwnIdentity();
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
        declared: null, // never reached the source's grid — no declared read
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
  } else if (msg && msg.kind === "scroll_paused_detach") {
    // FIX 2 — the SW's debugger detached EXTERNALLY (the founder closed the "Commonplace is debugging"
    // banner, or opened DevTools). Do NOT end the run — HOLD it: the observer enters a resumable pause on
    // its next tick and continues (re-attached) when the founder clicks Resume. Captured data is already
    // safe in IndexedDB; this keeps the RUN alive.
    debuggerPauseRequested = true;
    console.warn(`[commonplace] debugger detached externally — holding the run (resumable pause): ${(msg && msg.reason) || ""}`);
  } else if (msg && msg.kind === "scroll_detached") {
    // Defensive belt (no longer emitted for an EXTERNAL detach — that is now a resumable pause, above).
    // Kept so any future hard-detach signal still ends the run honestly rather than hanging.
    scrollDriverDetached = true;
    scrollDriverDetachReason = (msg && msg.reason) || "the scroll driver was disconnected";
    console.warn(`[commonplace] scroll driver detached (hard) — ${scrollDriverDetachReason}`);
  } else if (msg && msg.kind === "sync_stop") {
    // Founder pressed Stop in the popup (relayed by the SW). End the run cleanly on the next observer
    // tick; the SW owns the rest of the stop cleanup (detach + clear supervisor current + clear paused).
    userStopRequested = true;
    console.warn("[commonplace] sync_stop received — will stop the run");
  } else if (msg && msg.kind === "sync_pause") {
    // Founder pressed Pause — the observer enters a resumable user pause on its next tick.
    userPauseRequested = true;
    console.log("[commonplace] sync_pause received");
  } else if (msg && msg.kind === "sync_resume") {
    // Founder pressed Resume — break any active pause (even an unsolved challenge) and continue the run.
    userResumeRequested = true;
    userPauseRequested = false;
    console.log("[commonplace] sync_resume received");
  } else if (msg && msg.kind === "discover_handle") {
    // The SW is trying to navigate to the founder's profile from an unknown-handle start. Hand back the
    // best own-handle this tab can see (own profile via location, else the nav profile link).
    sendResponse({ handle: discoverOwnHandle() });
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
