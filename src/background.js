import { extractItems, mergeDedupe } from "./capture.js";

let items = [];

// Re-hydrate across service-worker restarts (MV3 kills the SW after ~30s idle).
chrome.storage.local.get("items").then((d) => {
  if (Array.isArray(d.items)) items = d.items;
});

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.kind === "item_list") {
    const incoming = extractItems(msg.json);
    items = mergeDedupe(items, incoming);
    chrome.storage.local.set({ items, count: items.length });
    console.log(`[attic-spike] +${incoming.length}, total ${items.length}`);
  } else if (msg.kind === "scroll_done") {
    exportData("attic-favorites.json", items);
  } else if (msg.kind === "export_enriched") {
    exportData("attic-enriched.json", msg.results);
  }
  return true;
});

function exportData(filename, data) {
  // MV3 service workers lack FileReader / URL.createObjectURL, so build a base64 data: URL.
  const json = JSON.stringify(data, null, 2);
  const dataUrl = "data:application/json;base64," + btoa(unescape(encodeURIComponent(json)));
  chrome.downloads.download({ url: dataUrl, filename });
  console.log(`[attic-spike] exported ${Array.isArray(data) ? data.length : "?"} → ${filename}`);
}
