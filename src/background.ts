// Service worker (MV3, type:module). Capture intake now writes THROUGH the IndexedDB library
// store (`commonplace`) — the canonical home for items, eager posters, jobs and the grounding
// cache. The legacy `chrome.storage.local` `items` array is retired; a one-shot startup migration
// imports any existing array into the store then deletes the key. Only the scalar `count` is still
// mirrored to chrome.storage.local — that is the content script's scroll-idle contract.
//
// Eager posters: TikTok cover URLs are signed and expire in hours, so on every capture batch we
// fetch each new item's cover bytes immediately (bounded to 3 concurrent, skipping items we
// already have, non-fatal on failure). Capturing the poster at save-time is the whole point.

import { extractItems } from "./capture.js";
import { openStore, type CpStore } from "./lib/store.js";
import type { CapturedItem } from "./lib/types.js";

const MAX_POSTER_CONCURRENCY = 3;

// Single lazily-opened store handle, reused across messages within this SW lifetime.
let storePromise: Promise<CpStore> | null = null;
function store(): Promise<CpStore> {
  return (storePromise ??= openStore());
}

// One-shot migration: fold any legacy `items` array into the store, then drop the key so this is
// idempotent across the frequent MV3 service-worker restarts.
async function migrateLegacyItems(): Promise<void> {
  const { items } = await chrome.storage.local.get("items");
  if (items === undefined) return; // already migrated (or never existed)
  if (Array.isArray(items) && items.length) {
    const s = await store();
    const { added, merged } = await s.upsertItems(items as CapturedItem[], new Date().toISOString());
    const count = await s.count();
    await chrome.storage.local.set({ count });
    console.log(`[commonplace] migrated legacy items → store: +${added} (merged ${merged}), total ${count}`);
  }
  await chrome.storage.local.remove("items");
}
migrateLegacyItems().catch((e) => console.log("[commonplace] legacy migration failed:", (e as Error).message));

interface ItemListMsg { kind: "item_list"; json: unknown; source?: string | null; url?: string }
interface ScrollDoneMsg { kind: "scroll_done" }
interface ExportEnrichedMsg { kind: "export_enriched"; results: unknown[] }
interface DownloadTestMsg { kind: "download_test"; n?: number }
interface QueueStartMsg { kind: "queue_start" }
interface QueueStatusMsg { kind: "queue_status" }
interface QueueProgressMsg { kind: "queue_progress"; done: number; total: number }
interface QueueBlockedMsg { kind: "queue_blocked"; reason: string }
type Msg =
  | ItemListMsg
  | ScrollDoneMsg
  | ExportEnrichedMsg
  | DownloadTestMsg
  | QueueStartMsg
  | QueueStatusMsg
  | QueueProgressMsg
  | QueueBlockedMsg;

chrome.runtime.onMessage.addListener((msg: Msg, _sender, _sendResponse) => {
  if (msg.kind === "item_list") {
    void handleItemList(msg);
  } else if (msg.kind === "scroll_done") {
    void handleScrollDone();
  } else if (msg.kind === "export_enriched") {
    exportData("attic-enriched.json", msg.results);
  } else if (msg.kind === "download_test") {
    void downloadFirst(msg.n || 3);
  } else if (msg.kind === "queue_start") {
    // The SW-side wake path: make sure the offscreen engine document exists, then tell it to drain.
    void startQueue();
  } else if (msg.kind === "queue_status") {
    void logQueueStatus();
  } else if (msg.kind === "queue_progress") {
    console.log(`[commonplace] queue progress: ${msg.done}/${msg.total}`);
  } else if (msg.kind === "queue_blocked") {
    console.log(`[commonplace] queue blocked: ${msg.reason} — set your Gemini key in the options page`);
  }
  return true;
});

// ── Offscreen engine lifecycle + the service-worker-death revival alarm ─────────────
//
// The engine runs in the offscreen document (DOM + credentialed fetch). Only the SW can create it,
// so every wake routes through here: content/alarm → queue_start → ensureOffscreen → queue_run.
// The `cp_queue_revive` alarm (every minute) is the resumability spine: if the SW is killed
// mid-drain, the alarm wakes it, and — as long as any job is unfinished — re-launches the engine,
// whose first act (reviveJobs) sweeps the killed run's in-flight jobs back to pending.

const OFFSCREEN_URL = "offscreen.html";

async function ensureOffscreen(): Promise<void> {
  if (await chrome.offscreen.hasDocument()) return; // createDocument throws if one already exists
  await chrome.offscreen.createDocument({
    url: OFFSCREEN_URL,
    reasons: [chrome.offscreen.Reason.DOM_SCRAPING, chrome.offscreen.Reason.BLOBS],
    justification: "video keyframe extraction + export blobs",
  });
}

async function startQueue(): Promise<void> {
  await ensureOffscreen();
  // Swallow a transient no-receiver rejection (the doc may still be registering its listener).
  void chrome.runtime.sendMessage({ kind: "queue_run" }).catch(() => {});
}

async function logQueueStatus(): Promise<void> {
  const jobs = await (await store()).getJobs();
  const by: Record<string, number> = {};
  for (const j of jobs) by[j.status] = (by[j.status] ?? 0) + 1;
  console.log(`[commonplace] queue status: ${jobs.length} jobs`, by);
}

chrome.alarms.create("cp_queue_revive", { periodInMinutes: 1 });
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "cp_queue_revive") void onReviveAlarm();
});

async function onReviveAlarm(): Promise<void> {
  const jobs = await (await store()).getJobs();
  // "Unfinished" = pending OR mid-flight (analyzing/grounding left behind by a killed run). If any
  // exist, wake the engine; runEngine's reviveJobs recovers the mid-flight ones before draining.
  const unfinished = jobs.some(
    (j) => j.status === "pending" || j.status === "analyzing" || j.status === "grounding",
  );
  if (unfinished) await startQueue();
}

// Capture intake: normalize → store → refresh `count` → eagerly grab posters.
async function handleItemList(msg: ItemListMsg): Promise<void> {
  // extractItems is the unchanged pure normalizer (loose SpikeItem shape); at the store boundary
  // it IS a CapturedItem (identical runtime shape, sources included).
  const incoming = extractItems(msg.json, msg.source ?? null) as CapturedItem[];
  const s = await store();
  const { added, merged } = await s.upsertItems(incoming, new Date().toISOString());
  const count = await s.count();
  await chrome.storage.local.set({ count }); // content.js scroll-idle contract
  console.log(`[commonplace] +${added} from ${msg.source || "?"} (merged ${merged}), total ${count}`);

  const stored = await storePosters(s, incoming);
  console.log(`[commonplace] posters stored: ${stored}`);
}

// Bounded eager poster fetch: at most MAX_POSTER_CONCURRENCY in flight, skip items we already have,
// non-fatal on any failure (signed cover URLs expire — a miss just means no cached poster).
async function storePosters(s: CpStore, items: CapturedItem[]): Promise<number> {
  const targets = items.filter((it) => it.cover);
  let stored = 0;
  let next = 0;
  async function worker(): Promise<void> {
    while (next < targets.length) {
      const it = targets[next++]!;
      try {
        if (await s.getPoster(it.id)) continue; // already captured
        const res = await fetch(it.cover!);
        if (!res.ok) {
          console.log(`[commonplace] poster fetch ${res.status} for ${it.id}`);
          continue;
        }
        await s.putPoster(it.id, await res.blob());
        stored++;
      } catch (e) {
        console.log(`[commonplace] poster fetch failed for ${it.id}:`, (e as Error).message);
      }
    }
  }
  const workers = Array.from({ length: Math.min(MAX_POSTER_CONCURRENCY, targets.length) }, () => worker());
  await Promise.all(workers);
  return stored;
}

async function handleScrollDone(): Promise<void> {
  const recs = await (await store()).allRecords();
  exportData("attic-favorites.json", recs.map((r) => r.item));
}

// Path 1: chrome.downloads (browser network stack, no CORS) + DNR-injected Referer.
async function downloadFirst(n: number): Promise<void> {
  const recs = await (await store()).allRecords();
  for (const { item } of recs.slice(0, n)) {
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
      },
    );
    await new Promise((r) => setTimeout(r, 900));
  }
}

function exportData(filename: string, data: unknown): void {
  // MV3 service workers lack FileReader / URL.createObjectURL, so build a base64 data: URL.
  const json = JSON.stringify(data, null, 2);
  const dataUrl = "data:application/json;base64," + btoa(unescape(encodeURIComponent(json)));
  chrome.downloads.download({ url: dataUrl, filename });
  console.log(`[commonplace] exported ${Array.isArray(data) ? data.length : "?"} → ${filename}`);
}
