// Service worker (MV3, type:module). TEMPORARY BRIDGE: a direct TS port of the Phase-0 spike
// background.js so the build succeeds and the extension loads before the real engine lands.
// Still talks to chrome.storage.local `items`; Task 3 replaces these internals with the
// offscreen extraction queue. Handlers are kept identical to the spike, plus a no-op log for the
// new `queue_start` message the updated content script now sends (Alt+Shift+E).

import { extractItems, mergeDedupe, type SpikeItem } from "./capture.js";

let items: SpikeItem[] = [];

// Re-hydrate across service-worker restarts (MV3 kills the SW after ~30s idle).
chrome.storage.local.get("items").then((d) => {
  if (Array.isArray(d.items)) items = d.items as SpikeItem[];
});

interface ItemListMsg { kind: "item_list"; json: unknown; source?: string | null; url?: string }
interface ScrollDoneMsg { kind: "scroll_done" }
interface ExportEnrichedMsg { kind: "export_enriched"; results: unknown[] }
interface DownloadTestMsg { kind: "download_test"; n?: number }
interface QueueStartMsg { kind: "queue_start" }
type Msg = ItemListMsg | ScrollDoneMsg | ExportEnrichedMsg | DownloadTestMsg | QueueStartMsg;

chrome.runtime.onMessage.addListener((msg: Msg, _sender, _sendResponse) => {
  if (msg.kind === "item_list") {
    const incoming = extractItems(msg.json, msg.source ?? null);
    items = mergeDedupe(items, incoming);
    chrome.storage.local.set({ items, count: items.length });
    console.log(`[commonplace] +${incoming.length} from ${msg.source || "?"}, total ${items.length}`);
  } else if (msg.kind === "scroll_done") {
    exportData("attic-favorites.json", items);
  } else if (msg.kind === "export_enriched") {
    exportData("attic-enriched.json", msg.results);
  } else if (msg.kind === "download_test") {
    downloadFirst(msg.n || 3);
  } else if (msg.kind === "queue_start") {
    // BRIDGE: the extraction queue (offscreen document + alarms) lands in Task 3.
    console.log("[commonplace] queue_start received — extraction queue lands in Task 3");
  }
  return true;
});

// Path 1: chrome.downloads (browser network stack, no CORS) + DNR-injected Referer.
async function downloadFirst(n: number) {
  const { items = [] } = await chrome.storage.local.get("items");
  for (const item of (items as SpikeItem[]).slice(0, n)) {
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
          console.log("[commonplace] download FAIL", item.id, chrome.runtime.lastError.message);
        } else {
          console.log("[commonplace] download started", item.id, "id=", id);
        }
      }
    );
    await new Promise((r) => setTimeout(r, 900));
  }
}

function exportData(filename: string, data: unknown) {
  // MV3 service workers lack FileReader / URL.createObjectURL, so build a base64 data: URL.
  const json = JSON.stringify(data, null, 2);
  const dataUrl = "data:application/json;base64," + btoa(unescape(encodeURIComponent(json)));
  chrome.downloads.download({ url: dataUrl, filename });
  console.log(`[commonplace] exported ${Array.isArray(data) ? data.length : "?"} → ${filename}`);
}
