import { extractItems, mergeDedupe } from "./capture.js";

let items = [];

// Re-hydrate across service-worker restarts (MV3 kills the SW after ~30s idle).
chrome.storage.local.get("items").then((d) => {
  if (Array.isArray(d.items)) items = d.items;
});

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.kind === "item_list") {
    const incoming = extractItems(msg.json, msg.source);
    items = mergeDedupe(items, incoming);
    chrome.storage.local.set({ items, count: items.length });
    console.log(`[attic-spike] +${incoming.length} from ${msg.source || "?"}, total ${items.length}`);
  } else if (msg.kind === "scroll_done") {
    exportData("attic-favorites.json", items);
  } else if (msg.kind === "export_enriched") {
    exportData("attic-enriched.json", msg.results);
  } else if (msg.kind === "download_test") {
    downloadFirst(msg.n || 3);
  }
  return true;
});

// Path 1: chrome.downloads (browser network stack, no CORS) + DNR-injected Referer.
async function downloadFirst(n) {
  const { items = [] } = await chrome.storage.local.get("items");
  for (const item of items.slice(0, n)) {
    const url = item.playUrl;
    if (!url) continue;
    chrome.downloads.download(
      {
        url,
        filename: `attic-videos/${(item.author || "x").replace(/[^\w.-]/g, "_")}_${item.id}.mp4`,
        conflictAction: "uniquify",
      },
      (id) => {
        if (chrome.runtime.lastError) {
          console.log("[attic-spike] download FAIL", item.id, chrome.runtime.lastError.message);
        } else {
          console.log("[attic-spike] download started", item.id, "id=", id);
        }
      }
    );
    await new Promise((r) => setTimeout(r, 900));
  }
}

function exportData(filename, data) {
  // MV3 service workers lack FileReader / URL.createObjectURL, so build a base64 data: URL.
  const json = JSON.stringify(data, null, 2);
  const dataUrl = "data:application/json;base64," + btoa(unescape(encodeURIComponent(json)));
  chrome.downloads.download({ url: dataUrl, filename });
  console.log(`[attic-spike] exported ${Array.isArray(data) ? data.length : "?"} → ${filename}`);
}
