// ISOLATED-world content script. Relays MAIN-world captures to the service worker,
// drives throttled auto-scroll (Alt+Shift+A), and triggers enrichment (Alt+Shift+E).

window.addEventListener("message", (e) => {
  if (e.source !== window || !e.data || e.data.__attic !== true) return;
  if (e.data.kind === "item_list") {
    chrome.runtime.sendMessage({ kind: "item_list", url: e.data.url, json: e.data.json });
  }
});

let scrolling = false;
async function autoScroll() {
  if (scrolling) return;
  scrolling = true;
  let lastHeight = 0;
  let stable = 0;
  while (stable < 5) {
    window.scrollTo(0, document.body.scrollHeight);
    await new Promise((r) => setTimeout(r, 1500 + Math.random() * 2000)); // human-like jitter
    const h = document.body.scrollHeight;
    if (h === lastHeight) stable++;
    else {
      stable = 0;
      lastHeight = h;
    }
  }
  scrolling = false;
  chrome.runtime.sendMessage({ kind: "scroll_done" });
  console.log("[attic-spike] auto-scroll complete");
}

async function runEnrichment() {
  // Content scripts can't be ES modules via the manifest, so load gemini.js dynamically.
  const { enrichItem } = await import(chrome.runtime.getURL("src/gemini.js"));
  const promptUrl = chrome.runtime.getURL("prompts/observe_video.md");
  const prompt = await (await fetch(promptUrl)).text();
  const { items = [] } = await chrome.storage.local.get("items");
  const subset = items.slice(0, 20);
  console.log(`[attic-spike] enriching ${subset.length} items…`);
  const results = [];
  for (const item of subset) {
    const out = await enrichItem(item, prompt);
    results.push(out);
    console.log(`[attic-spike] enriched ${out.id}`, out.error ? `ERROR ${out.error}` : "ok");
    await new Promise((r) => setTimeout(r, 1200)); // pacing
  }
  chrome.runtime.sendMessage({ kind: "export_enriched", results });
}

window.addEventListener("keydown", (e) => {
  if (!e.altKey || !e.shiftKey) return;
  if (e.code === "KeyA") autoScroll();
  if (e.code === "KeyE") runEnrichment();
});

console.log(
  "[attic-spike] content relay ready — Alt+Shift+A to capture Favorites, Alt+Shift+E to enrich"
);
