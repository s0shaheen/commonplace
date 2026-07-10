// Service worker (MV3, type:module). Capture intake now writes THROUGH the IndexedDB library
// store (`commonplace`) — the canonical home for items, posters, jobs and the grounding cache. The
// legacy `chrome.storage.local` `items` array is retired; a one-shot startup migration imports any
// existing array into the store then deletes the key. Only the scalar `count` is still mirrored to
// chrome.storage.local — that is the content script's scroll-idle contract.
//
// Posters, DECOUPLED (Task 4): capture intake is metadata-only and fast — it holds ZERO media Blobs.
// TikTok cover URLs are signed and expire in hours, so posters are fetched in a throttled, resumable
// pass kicked the instant a source finishes enumerating (scroll_done) and resumed on the revival
// alarm — never inline with the live scroll (that contention was a §2.3 renderer-crash vector).

import { openStore, type CpStore } from "./lib/store.js";
import { createRateLimiter } from "./lib/rateLimiter.js";
import { runPosterPass, selectPosterWork, type PosterFailures } from "./lib/capture/posterPass.js";
import type { CapturedItem } from "./lib/types.js";

// Decoupled poster pass (Task 4): posters are NO LONGER fetched inline during capture — that inline
// fetch was a §2.3 crash vector (3k image fetches + Blob decodes contending with the live scroll).
// They land in a throttled, resumable post-enumeration pass instead — HONESTLY SERIAL: one fetch at
// a time via the shared rate limiter (createRateLimiter chains each call on the previous call's
// completion), starts spaced ≥200ms. Throughput ≈ 1/max(200ms, fetch latency) — a 3k backlog clears
// in ~12–15 min, well inside the hours-scale cover-URL expiry — and serial is politer to the CDN.
const POSTER_INTERVAL_MS = 200;
const POSTER_BATCH = 200;
const POSTER_FAILURES_KEY = "posterPassFailures";

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

// Task 3: the message now carries ALREADY-normalized, source-tagged items (the main world parsed
// them via parseItemListEnvelope) — the heavy raw `json` envelope no longer crosses the wire. The
// SW upserts these directly; extractItems is no longer re-run here (it stays capture.js's export,
// used by the main-world parser + capture.test.js). `source` still rides along for the log line.
interface ItemListMsg { kind: "item_list"; items: CapturedItem[]; source?: string | null; url?: string }
// Task 1: content.js reports HOW the scroll ended. status "done" = TikTok's own hasMore:false;
// "giveup" = bounded backoff exhausted with more possibly remaining — an INCOMPLETE capture that
// must never be exported as if it were a success.
interface ScrollDoneMsg {
  kind: "scroll_done";
  status?: "done" | "giveup" | string;
  reason?: string | null;
  captured?: number;
  cursor?: string | null;
}
interface ExportEnrichedMsg { kind: "export_enriched"; results: unknown[] }
interface DownloadTestMsg { kind: "download_test"; n?: number }
interface QueueStartMsg { kind: "queue_start" }
interface QueueStatusMsg { kind: "queue_status" }
interface QueueProgressMsg { kind: "queue_progress"; done: number; total: number }
interface QueueBlockedMsg { kind: "queue_blocked"; reason: string }
interface ExportOpenSchemaMsg { kind: "export_open_schema" }
type Msg =
  | ItemListMsg
  | ScrollDoneMsg
  | ExportEnrichedMsg
  | DownloadTestMsg
  | QueueStartMsg
  | QueueStatusMsg
  | QueueProgressMsg
  | QueueBlockedMsg
  | ExportOpenSchemaMsg;

chrome.runtime.onMessage.addListener((msg: Msg, _sender, _sendResponse) => {
  if (msg.kind === "item_list") {
    void handleItemList(msg);
  } else if (msg.kind === "scroll_done") {
    void handleScrollDone(msg);
  } else if (msg.kind === "export_enriched") {
    exportData("attic-enriched.json", msg.results);
  } else if (msg.kind === "download_test") {
    void downloadFirst(msg.n || 3);
  } else if (msg.kind === "queue_start") {
    // The SW-side wake path: make sure the offscreen engine document exists, then tell it to drain.
    void startQueue();
  } else if (msg.kind === "export_open_schema") {
    // Same wake path as the engine: only the SW can create the offscreen doc, and the export needs
    // its Blob/URL.createObjectURL context — so ensure it exists, then tell it to build the file.
    void startOpenSchemaExport();
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

async function startOpenSchemaExport(): Promise<void> {
  await ensureOffscreen();
  // Swallow a transient no-receiver rejection (the doc may still be registering its listener).
  void chrome.runtime.sendMessage({ kind: "export_open_schema_run" }).catch(() => {});
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
  const s = await store();
  const jobs = await s.getJobs();
  // "Unfinished" = pending OR mid-flight (analyzing/grounding left behind by a killed run). If any
  // exist, wake the engine; runEngine's reviveJobs recovers the mid-flight ones before draining.
  const unfinished = jobs.some(
    (j) => j.status === "pending" || j.status === "analyzing" || j.status === "grounding",
  );
  if (unfinished) await startQueue();

  // Same spine resumes an interrupted poster pass: if a SW death left posters un-fetched, restart it.
  // Reusing this alarm (rather than a parallel timer) keeps ONE revival mechanism; the pass is
  // idempotent (stored posters short-circuit) so a redundant wake is cheap.
  if (await posterWorkRemains(s)) void runPosterPassNow();
}

// Capture intake: METADATA-ONLY and fast. Store already-normalized items → refresh `count`. NO media
// fetches, NO Blobs — posters are decoupled into the post-enumeration pass (kicked on scroll_done).
async function handleItemList(msg: ItemListMsg): Promise<void> {
  // Items arrive pre-normalized AND source-tagged (sources:[source]) from the main world's
  // parseItemListEnvelope → extractItems(json, source) — identical shape/tags to the old SW-side
  // normalization, just done once, off the page thread, without cloning the raw envelope twice.
  // SHAPE GATE (review fix): the old SW-side extractItems implicitly guaranteed a non-empty string
  // id (its `.filter((x) => x.id)`); now that items cross the wire pre-built, re-assert it here —
  // an id-less item would throw inside upsertItems. Drop malformed entries, loudly.
  const raw = msg.items ?? [];
  const incoming = raw.filter((i) => i && typeof i.id === "string" && i.id.length > 0);
  if (incoming.length < raw.length) {
    console.warn(`[commonplace] dropped ${raw.length - incoming.length} malformed item(s) from ${msg.source || "?"}`);
  }
  const s = await store();
  const { added, merged } = await s.upsertItems(incoming, new Date().toISOString());
  const count = await s.count();
  await chrome.storage.local.set({ count }); // content.js scroll-idle contract
  console.log(`[commonplace] +${added} from ${msg.source || "?"} (merged ${merged}), total ${count}`);
}

// ── Decoupled poster pass ────────────────────────────────────────────────────────────
// Runs in the SW (not offscreen): a pure fetch→Blob→putPoster needs no DOM — the offscreen doc's
// reason to exist (DOM keyframes + long-lived credentialed fetch) doesn't apply here. Running it in
// the SW keeps the scroll_done trigger zero-hop (starts immediately, beating cover-URL expiry) and
// reuses the SW's existing `cp_queue_revive` alarm as the one resumability spine. The work-selection
// + bounded-retry state machine is the tested pure module (posterPass.ts); this is thin glue.

let posterPassRunning = false; // one pass at a time per SW lifetime (mirrors offscreen's `running`)

// Fetch + store ONE poster. ok:false is a non-fatal failed attempt — signed cover URLs expire, so a
// miss is just a miss (log and move on). Idempotent: an already-stored poster short-circuits.
async function storeOnePoster(s: CpStore, id: string, coverUrl: string): Promise<{ ok: boolean }> {
  try {
    if (await s.getPoster(id)) return { ok: true }; // already captured
    const res = await fetch(coverUrl);
    if (!res.ok) {
      console.log(`[commonplace] poster fetch ${res.status} for ${id}`);
      return { ok: false };
    }
    await s.putPoster(id, await res.blob());
    return { ok: true };
  } catch (e) {
    console.log(`[commonplace] poster fetch failed for ${id}:`, (e as Error).message);
    return { ok: false };
  }
}

// Drive the resumable pass, wiring the store + a fresh rate limiter into the pure orchestrator. Guarded
// so a scroll_done and a revival alarm can't double-drive within one SW lifetime.
async function runPosterPassNow(): Promise<void> {
  if (posterPassRunning) return;
  posterPassRunning = true;
  try {
    const s = await store();
    const limit = createRateLimiter(POSTER_INTERVAL_MS);
    const res = await runPosterPass({
      listCandidates: async () =>
        (await s.allRecords()).map((r) => ({ id: r.id, cover: r.item.cover, hasPoster: !!r.posterRef })),
      getFailures: async () => (await s.getMeta<PosterFailures>(POSTER_FAILURES_KEY)) ?? {},
      setFailures: (f) => s.setMeta(POSTER_FAILURES_KEY, f),
      storePoster: (id, cover) => storeOnePoster(s, id, cover),
      schedule: limit,
      log: (m) => console.log(`[commonplace] ${m}`),
      batchSize: POSTER_BATCH,
    });
    if (res.stored || res.failed) {
      // Per-pass counts (this pass's news); the all-time permanent-failure total rides along.
      console.log(
        `[commonplace] poster pass finished — stored ${res.stored}, newly failed ${res.failed}` +
          (res.failedTotal ? ` (${res.failedTotal} failed all-time)` : ""),
      );
    }
  } catch (e) {
    console.log("[commonplace] poster pass error:", (e as Error).message);
  } finally {
    posterPassRunning = false;
  }
}

// Any item with a cover URL and no poster yet (and not permanently failed) = unfinished poster work.
async function posterWorkRemains(s: CpStore): Promise<boolean> {
  const [recs, failures] = await Promise.all([
    s.allRecords(),
    s.getMeta<PosterFailures>(POSTER_FAILURES_KEY),
  ]);
  const candidates = recs.map((r) => ({ id: r.id, cover: r.item.cover, hasPoster: !!r.posterRef }));
  return selectPosterWork(candidates, failures ?? {}, 1).length > 0;
}

async function handleScrollDone(msg: ScrollDoneMsg): Promise<void> {
  // A source finished enumerating (done OR giveup — partial capture still deserves posters). Kick the
  // decoupled poster pass NOW, before cover URLs expire. Fire-and-forget; never fails the export.
  void runPosterPassNow();

  const recs = await (await store()).allRecords();
  if (msg.status === "giveup") {
    // Review fix: a giveup must not masquerade as success at this layer either. We STILL export —
    // it's the user's data — but under a name that says incomplete, with the reason logged loudly.
    console.warn(
      `[commonplace] capture INCOMPLETE — ${msg.reason ?? "gave up after backoff"} ` +
        `(reported ${msg.captured ?? "?"} captured; exporting ${recs.length} records)`,
    );
    exportData("attic-favorites.INCOMPLETE.json", recs.map((r) => r.item));
    return;
  }
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
