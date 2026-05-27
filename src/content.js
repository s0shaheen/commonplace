// ISOLATED-world content script. Relays MAIN-world captures to the service worker,
// drives auto-scroll (Alt+Shift+A), manual export (Alt+Shift+S), text-only enrichment (Alt+Shift+E).

window.addEventListener("message", (e) => {
  if (e.source !== window || !e.data || e.data.__attic !== true) return;
  if (e.data.kind === "item_list") {
    chrome.runtime.sendMessage({ kind: "item_list", url: e.data.url, json: e.data.json });
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
  while (stable < MAX) {
    const domCount = nudgeToBottom();
    await sleep(2000 + Math.random() * 1500);
    const { count = 0 } = await chrome.storage.local.get("count");
    if (count !== prev) {
      stable = 0;
      prev = count;
    } else stable++;
    console.log(`[attic-spike] scrolling… captured ${count} (idle ${stable}/${MAX}, DOM ${domCount})`);
  }
  scrolling = false;
  chrome.runtime.sendMessage({ kind: "scroll_done" });
  console.log(`[attic-spike] auto-scroll complete — ${prev} captured`);
}

async function runEnrichment() {
  const { enrichItem } = await import(chrome.runtime.getURL("src/gemini.js"));
  const { items = [] } = await chrome.storage.local.get("items");
  const subset = items.slice(0, 20);
  console.log(`[attic-spike] enriching ${subset.length} items (text-only)…`);
  const results = [];
  for (const item of subset) {
    const out = await enrichItem(item);
    results.push(out);
    console.log(
      `[attic-spike] enriched ${out.id}`,
      out.error ? `ERROR ${out.error}` : `ok (subs:${out.subtitleStatus})`
    );
    await sleep(1000);
  }
  chrome.runtime.sendMessage({ kind: "export_enriched", results });
  console.log("[attic-spike] enrichment done → attic-enriched.json");
}

// Path 2: content-script fetch → blob → anchor download. Needs DNR to set Referer (fix 403)
// AND Access-Control-Allow-Origin (so JS can read the cross-origin bytes). If this works, we can
// also read video bytes for local Gemini visual enrichment.
async function downloadViaFetch(n) {
  const { items = [] } = await chrome.storage.local.get("items");
  for (const item of items.slice(0, n)) {
    if (!item.playUrl) continue;
    try {
      // credentials:"omit" → no cookies sent → wildcard ACAO (from our DNR rule) is legal,
      // so JS can read the cross-origin bytes. Signed URL params authorize; cookies aren't needed.
      const res = await fetch(item.playUrl, { credentials: "omit" });
      if (!res.ok) {
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
    chrome.runtime.sendMessage({ kind: "scroll_done" });
    console.log("[attic-spike] manual export triggered → attic-favorites.json");
  }
  if (e.code === "KeyE") runEnrichment();
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
  "[attic-spike] ready — A:auto-scroll · S:export · E:enrich · D:download(chrome.downloads) · F:download(fetch)"
);
