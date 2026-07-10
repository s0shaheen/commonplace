// ISOLATED-world content script. Relays MAIN-world captures to the service worker,
// drives auto-scroll (Alt+Shift+A), open-schema export (Alt+Shift+S), starts the extraction queue
// (Alt+Shift+E), and logs queue status to the SW console (Alt+Shift+Q).

import { sampleMemory, formatHudLine } from "./lib/capture/instrument.js";

let lastSource = null;
let lastHasMore = null;

window.addEventListener("message", (e) => {
  if (e.source !== window || !e.data || e.data.__attic !== true) return;
  if (e.data.kind === "item_list") {
    lastSource = e.data.source ?? lastSource;
    // hasMore isn't forwarded by main-world.js yet (Task 1) — stays null until then.
    chrome.runtime.sendMessage({ kind: "item_list", url: e.data.url, source: e.data.source, json: e.data.json });
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

// ── content-visibility pruning ────────────────────────────────────────────────
// Keeps the page fast on huge lists (thousands of likes) by letting the browser SKIP
// layout/paint for off-screen tiles. It mutates ZERO tiles (just a <style> + one attr),
// so it's transparent to TikTok's React; capture is network-based (main-world intercepts
// item_list), so this can NEVER lose corpus data. Kill anytime with Alt+Shift+K.
const CV_STYLE_ID = "attic-cv";
let cvGrid = null;

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

function enableCV() {
  if (document.getElementById(CV_STYLE_ID)) return true;
  const g = resolveGrid();
  if (!g) return false;
  cvGrid = g;
  const sample = g.querySelector(":scope > *");
  const h = (sample && Math.round(sample.getBoundingClientRect().height)) || 300;
  g.setAttribute("data-attic-grid", "1");
  const s = document.createElement("style");
  s.id = CV_STYLE_ID;
  s.textContent = `[data-attic-grid] > * { content-visibility: auto; contain-intrinsic-size: auto ${h}px; }`;
  document.documentElement.appendChild(s); // outside TikTok's #app → React never reconciles it
  console.log("[attic-spike] content-visibility pruning ON (grid: %d tiles)", g.childElementCount);
  return true;
}

function killCV() {
  document.getElementById(CV_STYLE_ID)?.remove();
  cvGrid?.removeAttribute("data-attic-grid");
  cvGrid = null;
  console.log("[attic-spike] content-visibility pruning OFF");
}

// Keep the rule live across TikTok re-renders / SPA tab switches (Likes <-> Favorites).
function ensureCV() {
  if (!document.getElementById(CV_STYLE_ID)) return enableCV();
  if (!cvGrid || !cvGrid.isConnected) {
    killCV();
    return enableCV(); // grid element replaced → re-resolve
  }
  if (!cvGrid.hasAttribute("data-attic-grid")) cvGrid.setAttribute("data-attic-grid", "1"); // attr stripped → re-assert
  return true;
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
  const links = document.querySelectorAll('a[href*="/video/"], a[href*="/photo/"]');
  if (links.length) links[links.length - 1].scrollIntoView({ block: "end" });
  const sc = getScroller();
  if (sc) sc.scrollTop = sc.scrollHeight;
  window.scrollTo(0, document.documentElement.scrollHeight);
  return links.length;
}

let scrolling = false;
async function autoScroll() {
  if (scrolling) return;
  scrolling = true;
  cachedScroller = null;
  let stable = 0;
  let prev = -1;
  const MAX = 15; // ~15 idle polls (~45s of no new items) before giving up — patient
  let lastSampleLogTs = 0; // console.log a CaptureSample roughly every ~5s while scrolling
  while (stable < MAX) {
    ensureCV();
    const domCount = nudgeToBottom();
    await sleep(2000 + Math.random() * 1500);
    const { count = 0 } = await chrome.storage.local.get("count");
    if (count !== prev) {
      stable = 0;
      prev = count;
    } else stable++;

    // Telemetry: real Date.now()/performance.memory/document reads happen ONLY here (glue) —
    // the pure sampleMemory/formatHudLine in lib/capture/instrument.js take everything injected.
    const sample = sampleMemory({
      now: Date.now(),
      capturedCount: count,
      domNodes: document.getElementsByTagName("*").length,
      heap: performance.memory,
    });
    const state = stable > 0 ? `idle ${stable}/${MAX}` : "scrolling";
    updateHud(formatHudLine(sample, { source: lastSource, hasMore: lastHasMore, state }));
    if (sample.ts - lastSampleLogTs >= 5000) {
      lastSampleLogTs = sample.ts;
      console.log("[commonplace] capture sample", sample);
    }

    console.log(`[attic-spike] scrolling… captured ${count} (idle ${stable}/${MAX}, DOM ${domCount})`);
  }
  scrolling = false;
  killCV(); // restore the page to its natural state now capture is done
  removeHud();
  chrome.runtime.sendMessage({ kind: "scroll_done" });
  console.log(`[attic-spike] auto-scroll complete — ${prev} captured`);
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
  if (e.code === "KeyK") killCV(); // manual kill-switch for content-visibility pruning
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
  "[commonplace] ready — A:auto-scroll · S:open-schema-export · E:queue-start · Q:queue-status · K:kill-pruning · D:download(chrome.downloads) · F:download(fetch)"
);
