// ISOLATED-world content script. Relays MAIN-world captures to the service worker,
// drives auto-scroll (Alt+Shift+A), open-schema export (Alt+Shift+S), starts the extraction queue
// (Alt+Shift+E), and logs queue status to the SW console (Alt+Shift+Q).

import { sampleMemory, formatHudLine, shouldLogSample } from "./lib/capture/instrument.js";
import { coerceHasMore } from "./lib/capture/interceptParse.js";
import { initialScrollState, step as scrollStep, GIVEUP_STALL_CYCLES } from "./lib/capture/scrollState.js";
import { nextDwellMs, backoffMs } from "./lib/capture/pacing.js";
import { tilesToEvict, DEFAULT_LIVE_WINDOW } from "./lib/capture/pruneWindow.js";
import { arrivalDrivesRun } from "./lib/capture/supervisor.js";

let lastSource = null;
let lastHasMore = null; // latest coerced paging signal from the message path (Task 1)
let lastCursor = null;
let pageArrivals = 0; // monotonic count of item_list messages — autoScroll keys page_captured on ARRIVAL, not count growth
// Carry-forward (2), Task 5: the source the supervisor asked THIS run to capture. Set at the start of
// a capture run, cleared at its end. While set, only arrivals whose source matches may drive the run's
// scroll signals — a straggler from the previous source must not inject its hasMore into this run.
// Null = the manual Alt+Shift+A dev path (no supervisor tag) → arrivalDrivesRun accepts everything.
let activeRunSource = null;

window.addEventListener("message", (e) => {
  if (e.source !== window || !e.data || e.data.__attic !== true) return;
  if (e.data.kind === "item_list") {
    // ALWAYS relay the SLIM, already-normalized+source-tagged items the main world parsed (Task 3) —
    // the heavy raw envelope no longer crosses any structured-clone boundary. Even a straggler from
    // the previous source is valid data: the SW upserts by id (idempotent, unions sources), so we
    // never drop a real capture. coerceHasMore below is idempotent on the already-coerced value.
    chrome.runtime.sendMessage({ kind: "item_list", url: e.data.url, source: e.data.source, items: e.data.items });
    // Carry-forward (2): but only let an arrival whose source matches the ACTIVE run drive that run's
    // completion signals (pageArrivals / lastHasMore / lastCursor). A late favorites page delivered
    // during the likes run must not bump likes' arrival count or, worse, inject favorites' hasMore:false.
    if (!arrivalDrivesRun(activeRunSource, e.data.source)) return;
    lastSource = e.data.source ?? lastSource;
    // main-world forwards RAW hasMore; coerce it through the tested pure module (missing/unknown →
    // more-may-exist, NEVER false). We coerce the tiny forwarded field rather than re-normalizing
    // the whole envelope on the page thread (§2.3: keep heavy work off the renderer).
    lastHasMore = coerceHasMore(e.data.hasMore);
    lastCursor = e.data.cursor ?? null;
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

function nudgeToBottom() {
  // Drive the last loaded item into view — scrolls all ancestor containers as needed (virtualization-safe).
  // EVICTION-SAFE: pruneGrid only ever removes the OLDEST tiles and always keeps the newest
  // DEFAULT_LIVE_WINDOW at the end of the grid, so `links[links.length-1]` is still the newest tile
  // after a prune — this nudge keeps targeting the real bottom and TikTok's loader keeps firing.
  const links = document.querySelectorAll('a[href*="/video/"], a[href*="/photo/"]');
  if (links.length) links[links.length - 1].scrollIntoView({ block: "end" });
  const sc = getScroller();
  if (sc) sc.scrollTop = sc.scrollHeight;
  window.scrollTo(0, document.documentElement.scrollHeight);
  return links.length;
}

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

  // The termination decision is NOT here — it lives in the pure, tested `scrollState` reducer.
  // This loop is dumb glue: observe (did a page ARRIVE? what's the latest hasMore? did `count`
  // grow?), feed the reducer an event, and act on the action it returns. Completion is hasMore:false
  // ONLY; a stall becomes backoff+wait; an unanswered run becomes a REPORTED giveup — never a
  // silent "done".
  let st = initialScrollState();
  // Task 2: the real human-cadence backoff replaces scrollState's placeholder. Math.random and
  // Date.now live ONLY here (glue) — pacing.ts/scrollState.ts stay pure. Giveup semantics are
  // untouched: the reducer still bounds the run at GIVEUP_STALL_CYCLES; only the wait LENGTHS change.
  // `resuming` threads the carry-forward-1 signal into the reducer (see scrollState.ts).
  const deps = { now: () => Date.now(), backoffMs: (stall) => backoffMs(stall, Math.random), resuming };
  let lastSampleLogTs = 0; // console.log a CaptureSample roughly every ~5s while scrolling
  let running = true;

  // PER-RUN RESET (review fix, critical). These module-level signals belong to the PREVIOUS run /
  // source — a completed Favorites run leaves lastHasMore=false, and the store's `count` is a
  // cumulative total that persists across runs. Without both resets, re-triggering on a second
  // source (the exact path Task 5's supervisor drives) would read stale hasMore:false + a
  // pre-existing count as an instant `done` at zero pages — the very false-completion this task
  // exists to kill.
  lastHasMore = null;
  lastCursor = null;
  let arrivalsSeen = pageArrivals;
  // Baseline against the CURRENT persisted total: a pre-existing count is not growth.
  const { count: initialCount = 0 } = await chrome.storage.local.get("count");
  let prevCount = initialCount;
  // Per-run eviction reset: start fresh so the HUD's "evicted N" is this run's tally and pruneGrid
  // re-resolves the grid from scratch (a new source/tab is a new grid element).
  evictGrid = null;
  evictedInGrid = 0;
  let evictedTotal = 0;

  while (running) {
    // Evict the oldest tiles down to the live window BEFORE nudging (the §2.3 memory fix). Keeps the
    // DOM bounded regardless of corpus size; can never lose captured data (capture is network-sourced).
    evictedTotal += pruneGrid();
    const domCount = nudgeToBottom();
    // Human-cadence dwell (pacing.ts, §2.2): jittered 900–2200ms base + an occasional longer
    // "look" pause — never the metronome that tripped the ~360-item throttle.
    await sleep(nextDwellMs(Math.random));
    const { count = 0 } = await chrome.storage.local.get("count");

    // A cycle is a `page_captured` when an item_list message ARRIVED since the last poll (review
    // fix, important) — count growth alone can't be the key, because an all-duplicates page
    // (crash-resume re-scroll, or a fully-deduped final page) grows nothing yet its hasMore:false
    // is the completion signal; keying on growth would drop it and misreport a clean finish as
    // giveup. Growth-without-arrival is also treated as a page: the SW's `count` write can lag one
    // poll behind the message, and progress must reset the stall counter, not read as a stall.
    // The reducer already handles a no-growth page correctly (hasMore:false ⇒ done; true ⇒ stall).
    const arrived = pageArrivals > arrivalsSeen;
    arrivalsSeen = pageArrivals;
    const event =
      arrived || count > prevCount
        ? { kind: "page_captured", newCount: count, hasMore: lastHasMore ?? true }
        : { kind: "tick" };
    prevCount = Math.max(prevCount, count);
    const stepped = scrollStep(st, event, deps);
    st = stepped.state;
    const action = stepped.action;

    // Telemetry: real Date.now()/performance.memory/document reads happen ONLY here (glue) —
    // the pure sampleMemory/formatHudLine in lib/capture/instrument.js take everything injected.
    const sample = sampleMemory({
      now: Date.now(),
      capturedCount: count,
      domNodes: document.getElementsByTagName("*").length,
      heap: performance.memory,
    });
    // During backoff the HUD must read as WORKING, not frozen: show the rate-limit wait and its
    // length in seconds. Normal dwell keeps the plain status label ("scrolling").
    const hudState =
      action.kind === "wait"
        ? `waiting out a rate-limit… ${Math.ceil(action.ms / 1000)}s (${st.stall}/${GIVEUP_STALL_CYCLES})`
        : st.stall > 0
          ? `${st.status} ${st.stall}/${GIVEUP_STALL_CYCLES}`
          : st.status;
    updateHud(formatHudLine(sample, { source: lastSource, hasMore: st.hasMore, state: hudState, evicted: evictedTotal }));
    if (shouldLogSample(lastSampleLogTs, sample.ts, 5000)) {
      lastSampleLogTs = sample.ts;
      console.log("[commonplace] capture sample", sample);
    }
    console.log(
      `[commonplace] ${st.status}… captured ${count} (hasMore ${st.hasMore}, stall ${st.stall}, DOM ${domCount})`
    );

    if (action.kind === "wait") {
      // A stall with more-maybe-left is backpressure, not completion — wait it out and say so, so a
      // pause reads as "working," not "frozen."
      console.log(`[commonplace] waiting out a TikTok rate-limit… ${action.ms}ms (stall ${st.stall})`);
      await sleep(action.ms);
    } else if (action.kind === "done") {
      running = false;
      console.log(`[commonplace] capture COMPLETE — TikTok reported hasMore:false; ${prevCount} captured`);
    } else if (action.kind === "giveup") {
      running = false;
      // An incomplete NEVER masquerades as success.
      console.warn(`[commonplace] capture INCOMPLETE — ${action.reason}`);
    }
    // action.kind === "scroll": nothing extra; the loop nudges again at the top.
  }

  scrolling = false;
  removeHud();
  chrome.runtime.sendMessage({
    kind: "scroll_done",
    status: st.status,
    reason: st.reason ?? null,
    captured: prevCount,
    cursor: lastCursor,
    source, // Task 5: which source this run drove — lets background.ts's supervisor advance the sequence
  });
  activeRunSource = null; // disarm the carry-forward-2 filter; the run is over
  console.log(`[commonplace] auto-scroll ended (${st.status}, source ${source ?? "manual"}) — ${prevCount} captured`);
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

async function runCaptureForSource(source, resuming) {
  activeRunSource = source ?? null; // arm the filter BEFORE nav so the first arrival is already gated
  await navigateToSource(source);
  await autoScroll({ source, resuming });
}

chrome.runtime.onMessage.addListener((msg) => {
  if (msg && msg.kind === "capture_source") {
    console.log(`[commonplace] supervisor → capture ${msg.source}${msg.resuming ? " (resuming)" : ""}`);
    void runCaptureForSource(msg.source ?? null, !!msg.resuming);
  }
  // Not returning true: this listener is fire-and-forget (no async sendResponse).
});

window.addEventListener("keydown", (e) => {
  if (!e.altKey || !e.shiftKey) return;
  if (e.code === "KeyA") autoScroll();
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
