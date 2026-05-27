// ISOLATED-world content script. Relays MAIN-world captures to the service worker,
// drives throttled auto-scroll (Alt+Shift+A), and triggers text-only enrichment (Alt+Shift+E).

window.addEventListener("message", (e) => {
  if (e.source !== window || !e.data || e.data.__attic !== true) return;
  if (e.data.kind === "item_list") {
    chrome.runtime.sendMessage({ kind: "item_list", url: e.data.url, json: e.data.json });
  }
});

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let scrolling = false;
async function autoScroll() {
  if (scrolling) return;
  scrolling = true;
  let stable = 0;
  let prev = -1;
  // Stop only after ~8 polls with no NEW deduped items (robust vs. momentary scrollHeight stalls).
  while (stable < 8) {
    window.scrollTo(0, document.body.scrollHeight);
    await sleep(2500 + Math.random() * 1500);
    const { count = 0 } = await chrome.storage.local.get("count");
    if (count === prev) stable++;
    else {
      stable = 0;
      prev = count;
    }
    console.log(`[attic-spike] scrolling… captured ${count}`);
  }
  scrolling = false;
  chrome.runtime.sendMessage({ kind: "scroll_done" });
  console.log(`[attic-spike] auto-scroll complete — ${prev} items`);
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

window.addEventListener("keydown", (e) => {
  if (!e.altKey || !e.shiftKey) return;
  if (e.code === "KeyA") autoScroll();
  if (e.code === "KeyE") runEnrichment();
});

console.log("[attic-spike] content relay ready — Alt+Shift+A to capture, Alt+Shift+E to enrich");
