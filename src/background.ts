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

import { openStore, StorageUnrecoverableError, type CpStore } from "./lib/store.js";
import { isQuotaExceeded, shouldCreateAlarm } from "./lib/capture/storageHealth.js";
import { createRateLimiter } from "./lib/rateLimiter.js";
import { runPosterPass, selectPosterWork, type PosterFailures } from "./lib/capture/posterPass.js";
import {
  SOURCES,
  SUPERVISOR_META_KEY,
  initialProgress,
  nextAction,
  type Source,
  type SupervisorEvent,
  type SupervisorProgress,
} from "./lib/capture/supervisor.js";
import { loadConfig, type CpConfig, type StorageLike } from "./lib/config.js";
import type { CapturedItem } from "./lib/types.js";

// DEV-ONLY hot-reload. `__DEV_RELOAD__` is an esbuild `define`: "true" under `npm run dev`, "false"
// for `npm run build`. In prod the whole block (and the dynamic import) is dead-code-eliminated, so
// the reload client never reaches dist/ — enforced by scripts/audit-dist.mjs. See src/devReload.ts.
declare const __DEV_RELOAD__: boolean;
if (__DEV_RELOAD__) {
  import("./devReload.js").catch(() => {});
}

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
  if (storePromise) return storePromise;
  // NEVER memoize a REJECTED open (S-SW-1). openStore may throw transiently, or throw a
  // StorageUnrecoverableError the caller must be able to re-surface — a stuck rejected promise would
  // brick every later call for this SW lifetime. Null the memo on failure so the next call retries;
  // the returned promise still rejects to THIS caller (the side-channel .catch never swallows it).
  const p = openStore();
  storePromise = p;
  p.catch(() => {
    if (storePromise === p) storePromise = null;
  });
  return p;
}

// Capture halt (S-SW-1 / invariant 4): a storage-full write or an unrecoverable DB must STOP capture
// and surface a reason — never let a swallowed write present as done. Set by haltCapture; read by the
// popup via syncStatus. SW-lifetime state; the underlying condition (full disk / broken DB) re-halts
// on the next write attempt after a restart.
type CaptureHalt = { reason: "storage_full" | "storage_unrecoverable"; at: string; detail?: string };
let captureHalt: CaptureHalt | null = null;

// Classify a caught storage error and, when it's a halt-class failure, latch `captureHalt` LOUDLY. A
// QuotaExceeded is DISTINCT — a "storage full" halt, never counted toward any failure ceiling and
// never presented as done. An unrecoverable-DB throw is the STORE-01 last rung. Anything else is
// logged but not latched (a transient write error shouldn't wedge the whole subsystem).
function haltCapture(e: unknown): void {
  if (isQuotaExceeded(e)) {
    captureHalt = { reason: "storage_full", at: new Date().toISOString() };
    console.error("[commonplace] STORAGE FULL — capture HALTED; last write NOT counted. Free space or export, then retry.", e);
  } else if (e instanceof StorageUnrecoverableError) {
    captureHalt = { reason: "storage_unrecoverable", at: new Date().toISOString(), detail: e.message };
    console.error("[commonplace] STORAGE UNRECOVERABLE — capture HALTED; DB could not self-heal.", e);
  } else {
    console.error("[commonplace] storage write failed:", (e as Error).message);
  }
}

// One-shot migration: fold any legacy `items` array into the store, then drop the key so this is
// idempotent across the frequent MV3 service-worker restarts.
//
// CRASH-SAFE (S-SW-8): the old version cleared `items` only AFTER a successful upsert, so ANY throw
// (QuotaExceeded, a store heal in flight) left the source in place and re-ran the failing import on
// every SW cold start — forever. Now a `migratedLegacy` flag gates re-entry and the source is cleared
// + the flag stamped in a `finally`, so a mid-migration throw can run the import AT MOST once.
const MIGRATED_FLAG = "migratedLegacy";
async function migrateLegacyItems(): Promise<void> {
  const stored = await chrome.storage.local.get(["items", MIGRATED_FLAG]);
  const items = stored["items"];
  const alreadyMigrated = stored[MIGRATED_FLAG] === true;
  if (alreadyMigrated || items === undefined) {
    // Already handled once (success OR a terminal attempt), or nothing legacy was ever present. Stamp
    // the flag so we never probe again, and drop any residual source key.
    if (!alreadyMigrated) await chrome.storage.local.set({ [MIGRATED_FLAG]: true });
    if (items !== undefined) await chrome.storage.local.remove("items");
    return;
  }
  try {
    if (Array.isArray(items) && items.length) {
      const s = await store();
      const { added, merged } = await s.upsertItems(items as CapturedItem[], new Date().toISOString());
      const count = await s.count();
      await chrome.storage.local.set({ count });
      console.log(`[commonplace] migrated legacy items → store: +${added} (merged ${merged}), total ${count}`);
    }
  } finally {
    // Stamp + clear REGARDLESS of outcome: a throw here still propagates (so a QuotaExceeded halts
    // capture), but the failing import will never re-run on the next SW start.
    await chrome.storage.local.set({ [MIGRATED_FLAG]: true });
    await chrome.storage.local.remove("items");
  }
}

// S-SW-1 / invariants 3+4: IndexedDB is the source of truth for the library count; the mirrored
// chrome.storage.local.count can drift (a crash between the IDB write and the mirror write, or an
// origin eviction). Re-derive it from IDB truth on the FIRST store open each SW lifetime so the
// content script's scroll-idle contract and the popup read a real number, never a phantom.
async function reconcileCountFromTruth(): Promise<void> {
  const s = await store();
  const count = await s.count();
  await chrome.storage.local.set({ count });
}

// Storage startup: migrate legacy items (crash-safe), then reconcile the count mirror against IDB.
// A StorageUnrecoverableError or QuotaExceeded surfacing from the first open halts capture LOUDLY
// rather than silently proceeding as if storage were healthy.
async function storageStartup(): Promise<void> {
  await migrateLegacyItems();
  await reconcileCountFromTruth();
}
storageStartup().catch((e) => haltCapture(e));

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
  source?: string | null; // Task 5: the source this run drove (null = manual Alt+Shift+A) — advances the supervisor
}
interface SyncStartMsg { kind: "sync_start" } // popup Sync button → begin/continue the source sequence
interface SyncStatusMsg { kind: "sync_status" } // popup poll → responds with live supervisor + capture status
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
  | ExportOpenSchemaMsg
  | SyncStartMsg
  | SyncStatusMsg;

chrome.runtime.onMessage.addListener((msg: Msg, _sender, sendResponse) => {
  if (msg.kind === "item_list") {
    void handleItemList(msg);
  } else if (msg.kind === "scroll_done") {
    void handleScrollDone(msg);
  } else if (msg.kind === "sync_start") {
    void handleSyncClick();
  } else if (msg.kind === "sync_status") {
    // Popup poll — respond async (channel kept open by the `return true` below).
    void syncStatus().then(sendResponse);
    return true;
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

// IDEMPOTENT registration (S-SW-4): the OLD unconditional top-level `chrome.alarms.create` reset the
// periodic timer on EVERY sub-minute SW cold start, so under steady capture traffic the one
// resumability spine could effectively never fire. Fix: never create at top level — register only from
// onInstalled/onStartup, and even there guard with `chrome.alarms.get` (create iff absent) so a
// persisted alarm's schedule is left untouched. The onAlarm listener stays at top level (correct).
const REVIVE_ALARM = "cp_queue_revive";
async function ensureReviveAlarm(): Promise<void> {
  const existing = await chrome.alarms.get(REVIVE_ALARM);
  if (shouldCreateAlarm(existing)) chrome.alarms.create(REVIVE_ALARM, { periodInMinutes: 1 });
}
chrome.runtime.onInstalled.addListener(() => void ensureReviveAlarm());
chrome.runtime.onStartup.addListener(() => void ensureReviveAlarm());
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === REVIVE_ALARM) void onReviveAlarm();
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

  // Task 5: resume an interrupted Sync run. If persisted progress shows a source still `current` (a
  // capture was in flight when the worker died) and nothing is running now, feed `restarted` — the
  // reducer returns that source with resuming:true (carry-forward 1).
  //
  // Guards before re-driving, because `supervisorRunning` is SW-lifetime state — a long backoff idles
  // the SW out and resets it while content.js is still mid-run, so the flag alone can't stop the
  // 1-min alarm from re-driving. In order:
  //   0. STALENESS (fix round 2, #5): a `current` older than STALE_CURRENT_MS is abandoned — it means
  //      a run was interrupted and never resumed for a day. Don't chase it; wait for a fresh Sync.
  //   1. PROFILE-ONLY (fix round 2, #1): resume only onto a reachable PROFILE tab. A stale `current`
  //      must never let the alarm cadence-scroll an arbitrary tab (FYP, a video) the founder is
  //      browsing — unattended control of the wrong tab in the DEFAULT mode. `findProfileTab` is
  //      query-only (no create/focus-steal, fix round 1).
  //   2. LIVE-RUN (fix round 1): `isTabScrolling` asks the tab itself; a live run ⇒ re-arm the belt
  //      and stand down rather than re-drive.
  if (!supervisorRunning) {
    const progress = await loadSupervisorProgress(s);
    const startedAt = progress.currentStartedAt ?? null;
    const stale = startedAt != null && Date.now() - startedAt > STALE_CURRENT_MS;
    if (progress.current != null && !stale) {
      const tabId = await findProfileTab();
      if (tabId != null) {
        if (await isTabScrolling(tabId)) {
          supervisorRunning = true; // the run never died — re-arm the belt, don't re-drive
        } else {
          void runSupervisorEvent({ kind: "restarted" });
        }
      }
      // No reachable PROFILE tab: stand down silently until the founder is on their profile and
      // clicks Sync (or, autonomous, a Sync-click DRIVE opens one — a mere probe never does).
    } else if (stale) {
      console.log("[commonplace] alarm-resume skipped — stale in-flight source; click Sync to resume");
    }
  }
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
  if (captureHalt) return; // storage halted (full / unrecoverable) — do NOT accept writes as captured
  const raw = msg.items ?? [];
  const incoming = raw.filter((i) => i && typeof i.id === "string" && i.id.length > 0);
  if (incoming.length < raw.length) {
    console.warn(`[commonplace] dropped ${raw.length - incoming.length} malformed item(s) from ${msg.source || "?"}`);
  }
  try {
    const s = await store();
    const { added, merged } = await s.upsertItems(incoming, new Date().toISOString());
    const count = await s.count();
    await chrome.storage.local.set({ count }); // content.js scroll-idle contract
    console.log(`[commonplace] +${added} from ${msg.source || "?"} (merged ${merged}), total ${count}`);
  } catch (e) {
    // A swallowed write must halt, not present as done (invariant 4). QuotaExceeded → "storage full";
    // an unrecoverable-DB open → its own halt; both are latched + surfaced, never counted as captured.
    haltCapture(e);
  }
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

// ── Capture supervisor (Task 5) ────────────────────────────────────────────────────────────────
// The thin glue around the pure `supervisor.ts` reducer: it PERSISTS progress, resolves/opens the tab
// (semi-auto = the founder's foreground tab; autonomous = a tab we open via chrome.tabs), tells
// content.js which source to capture, and — when scroll_done comes back — advances the sequence. The
// resumability spine is the SAME `cp_queue_revive` alarm: a Sync run interrupted by SW death resumes
// its unfinished source (persisted `current`) on the next wake.
//
// FRAGILE SEAM — Task-6-validation-pending: the CROSS-SOURCE walk (favorites→likes→posts→reposts)
// depends on content.js's best-effort SPA sub-tab navigation, unverified against the live site (Fork
// 2). What IS robust here: the pure sequencing/resume/persistence, semi-auto driving of the current
// source, and autonomous tab-open. A nav miss can't corrupt state (carry-forward 2 filters foreign
// arrivals); it degrades to a reported giveup the supervisor records and sequences past.

let supervisorRunning = false; // one live capture run at a time per SW lifetime (belt; supervisor's idle is suspenders)

// Fix round 2 (#5): the alarm abandons an in-flight `current` older than this — a run interrupted and
// never resumed for a day requires a fresh Sync click, closing the stale-`current` class that #1
// exploits (an old `current` steering the alarm onto whatever tab happens to be open).
const STALE_CURRENT_MS = 24 * 60 * 60 * 1000;

// chrome.storage.local satisfies StorageLike (same shape options.ts uses).
const configStorage: StorageLike = {
  get: (k) => chrome.storage.local.get(k),
  set: (o) => chrome.storage.local.set(o),
};

async function loadSupervisorProgress(s: CpStore): Promise<SupervisorProgress> {
  return (await s.getMeta<SupervisorProgress>(SUPERVISOR_META_KEY)) ?? initialProgress();
}

function isSource(v: unknown): v is Source {
  return typeof v === "string" && (SOURCES as readonly string[]).includes(v);
}

// PROBE — find an existing TikTok tab WITHOUT side-effects (fix round 1, minor): no create, no
// focus-steal. Used by the revival alarm's reachability check, which runs every minute — a probe
// that opened a focused tab each tick was the bug. Prefers the active tab so semi-auto drives the
// tab the founder is looking at.
async function findCaptureTab(): Promise<number | null> {
  const active = (await chrome.tabs.query({ active: true, lastFocusedWindow: true }))[0];
  if (active?.id != null && (active.url ?? "").includes("tiktok.com")) return active.id;
  const anyTikTok = (await chrome.tabs.query({ url: "*://*.tiktok.com/*" }))[0];
  return anyTikTok?.id ?? null;
}

// Is this a TikTok PROFILE page — the saved/profile surface where the favorites/likes/posts/reposts
// sub-tabs live (path `/@handle…`)? A single video/photo page (`/@user/video/…`) is NOT — nor is the
// FYP (`/foryou`, `/`). Fix round 2 (#1): the alarm-resume must only ever drive a profile-shaped tab,
// or a stale `current` from an interrupted run would let it bot-scroll an arbitrary tab the founder is
// browsing. Same shape as content.js's isProfilePage (kept in sync).
function isProfileUrl(url: string | undefined | null): boolean {
  if (!url) return false;
  let path: string;
  try {
    path = new URL(url).pathname;
  } catch {
    return false;
  }
  if (!/^\/@[^/]+/.test(path)) return false; // must be a @handle page
  return !/\/(video|photo)\//.test(path); // …but not a single video/photo permalink
}

// PROBE for a reachable PROFILE tab (no side-effects). Returns its id or null. Used ONLY by the
// alarm-resume gate (#1): an interrupted run whose tab is now the FYP / a video must NOT be resumed
// onto that tab.
async function findProfileTab(): Promise<number | null> {
  const active = (await chrome.tabs.query({ active: true, lastFocusedWindow: true }))[0];
  if (active?.id != null && isProfileUrl(active.url)) return active.id;
  const profiles = await chrome.tabs.query({ url: "*://*.tiktok.com/@*" });
  const hit = profiles.find((t) => isProfileUrl(t.url));
  return hit?.id ?? null;
}

// Resolve the tab to DRIVE (an actual capture is starting — side-effects are intended here, and only
// here). Autonomous: focus an existing TikTok tab or open one. Semi-auto: the founder's active TikTok
// tab (fall back to any open TikTok tab). Returns null when there is nothing to drive (semi-auto with
// no TikTok tab present) — the caller then stands down until the next Sync.
async function resolveCaptureTab(config: CpConfig): Promise<number | null> {
  const existing = await findCaptureTab();
  if (config.autonomousCapture) {
    if (existing != null) {
      await chrome.tabs.update(existing, { active: true });
      return existing;
    }
    // No TikTok tab open — start one. NOTE (Task-6-pending): to drive the founder's OWN saved sources
    // this must land on their profile; we don't capture the handle, so autonomous MULTI-source is not
    // yet complete (the tab opens + focuses + drives, but reaching favorites/likes needs the profile).
    const created = await chrome.tabs.create({ url: "https://www.tiktok.com/", active: true });
    return created.id ?? null;
  }
  return existing;
}

// Ask the content script whether a capture run is live in that tab RIGHT NOW (fix round 1,
// important). `supervisorRunning` is SW-lifetime state: during a long backoff the SW idles out and
// resets it while content.js is still mid-run, so the flag alone can't stop the 1-min alarm from
// re-driving a live tab. The tab itself is the ground truth. Unreachable/no-reply ⇒ not scrolling
// (a content script that isn't there can't be mid-run).
async function isTabScrolling(tabId: number): Promise<boolean> {
  try {
    const res = (await chrome.tabs.sendMessage(tabId, { kind: "capture_ping" })) as
      | { scrolling?: boolean }
      | undefined;
    return res?.scrolling === true;
  } catch {
    return false;
  }
}

// ── Supervisor event serialization (fix round 1, important) ──
// load→reduce→persist has awaits between; a concurrent scroll_done + alarm `restarted` could
// interleave so the alarm's persist resurrects an already-finished source as `current` (self-healing
// but minutes wasted + a double-drive). A promise-chain mutex serializes every event: each runs
// against the state its predecessor persisted.
let supervisorChain: Promise<void> = Promise.resolve();

function runSupervisorEvent(event: SupervisorEvent): Promise<void> {
  const run = supervisorChain.then(() => runSupervisorEventUnlocked(event));
  // The chain must survive a rejected event (a failed sendMessage etc.) or every later event would
  // inherit the rejection and the supervisor would wedge until the SW restarts.
  supervisorChain = run.catch((e) => console.warn("[commonplace] supervisor event failed:", (e as Error).message));
  return run;
}

// A founder Sync click. `start` idle-guards a genuinely LIVE run (its "don't stomp" contract). But an
// interrupted run leaves `current` set with no live scroll — and once the alarm-resume declines it
// (#1 non-profile tab, or #5 stale), the ONLY recovery is this click. So: if `current` is set and no
// run is actually live (belt says idle AND the tab isn't scrolling), an explicit click means "resume
// it" → feed `restarted` (returns capture_source for the in-flight source, resuming:true — the
// carry-forward-1 grace re-walks its captured prefix). Otherwise `start` (begin / continue / idle).
async function handleSyncClick(): Promise<void> {
  const progress = await loadSupervisorProgress(await store());
  if (progress.current != null && !supervisorRunning) {
    const tabId = await findCaptureTab();
    const live = tabId != null && (await isTabScrolling(tabId));
    if (!live) {
      await runSupervisorEvent({ kind: "restarted" });
      return;
    }
  }
  await runSupervisorEvent({ kind: "start" });
}

// Feed one event to the pure reducer, persist the new progress, then act on the returned action.
// NEVER call directly — go through runSupervisorEvent (the mutex).
async function runSupervisorEventUnlocked(event: SupervisorEvent): Promise<void> {
  const s = await store();
  const progress = await loadSupervisorProgress(s);
  const { progress: next, action } = nextAction(progress, event);
  // Staleness belt (fix round 2, #5): stamp when `current` is (re-)set to a source we're about to
  // drive, so the alarm can abandon a `current` left untouched for a day. Clear it when nothing is in
  // flight. The reducer stays pure (no clock); the timestamp is a glue concern.
  next.currentStartedAt = action.kind === "capture_source" ? Date.now() : next.current == null ? undefined : next.currentStartedAt;
  await s.setMeta(SUPERVISOR_META_KEY, next); // CHECKPOINT before driving — the crash-resume anchor

  if (action.kind === "idle") return; // a run is already in flight; do not double-drive
  if (action.kind === "all_done") {
    supervisorRunning = false;
    console.log("[commonplace] Sync complete — all sources enumerated", summarizeProgress(next));
    return;
  }

  // capture_source: resolve/open the tab and tell content.js to drive that source.
  const config = await loadConfig(configStorage);
  const tabId = await resolveCaptureTab(config);
  if (tabId == null) {
    supervisorRunning = false; // nothing to drive right now; a later Sync (or the alarm) retries
    console.warn(
      `[commonplace] Sync: no TikTok tab to drive ${action.source} — ` +
        (config.autonomousCapture ? "could not open one." : "open your TikTok saved page, then click Sync."),
    );
    return;
  }
  supervisorRunning = true;
  try {
    await chrome.tabs.sendMessage(tabId, { kind: "capture_source", source: action.source, resuming: action.resuming });
    console.log(`[commonplace] Sync → driving ${action.source}${action.resuming ? " (resuming)" : ""} on tab ${tabId}`);
  } catch (e) {
    // The content script may not be injected yet (fresh autonomous tab still loading). Stand down;
    // the run is checkpointed as `current`, so the revival alarm resumes it once the tab is ready.
    supervisorRunning = false;
    console.warn(`[commonplace] Sync: could not reach content script on tab ${tabId} yet:`, (e as Error).message);
  }
}

function summarizeProgress(p: SupervisorProgress): Record<string, unknown> {
  return { done: p.done, current: p.current, counts: p.counts };
}

// Popup status poll: the live picture — supervisor progress, whether a run/poster-pass is active,
// and the canonical library count.
async function syncStatus(): Promise<{
  progress: SupervisorProgress;
  running: boolean;
  posterRunning: boolean;
  count: number;
  halt: CaptureHalt | null;
}> {
  const s = await store();
  const [progress, count] = await Promise.all([loadSupervisorProgress(s), s.count()]);
  // `halt` surfaces a storage-full / unrecoverable-DB stop to the popup (invariant 4: honest, never a
  // false success). A halt during the open itself would reject this call — the popup treats a failed
  // poll as "not healthy" too.
  return { progress, running: supervisorRunning, posterRunning: posterPassRunning, count, halt: captureHalt };
}

async function handleScrollDone(msg: ScrollDoneMsg): Promise<void> {
  // A source finished enumerating (done OR giveup — partial capture still deserves posters). Kick the
  // decoupled poster pass NOW, before cover URLs expire. Fire-and-forget; never fails the export.
  void runPosterPassNow();

  // Task 5: if this run was supervisor-driven (a tagged source), advance the sequence to the next
  // source. A manual Alt+Shift+A run carries source:null and is left untouched (dev path preserved).
  if (isSource(msg.source)) {
    const status = msg.status === "done" ? "done" : "giveup";
    void runSupervisorEvent({ kind: "source_finished", source: msg.source, captured: msg.captured ?? 0, status });
    // Fix round 2 (#3): supervisor SWEEPS do NOT auto-download. A 4-source sweep would otherwise fire
    // 4+ full-library exports, each a base64 data:URL built in the SW — the size-fragile path P3
    // moved schema export OFF. The data is canonical in IndexedDB; explicit export stays a separate,
    // deliberate action (and a manual export at scale should route through the offscreen blob path,
    // not this SW data:URL builder).
    return;
  }

  // Manual (Alt+Shift+A) run only: keep the dev auto-export.
  const recs = await (await store()).allRecords();
  // Fix round 2 (#4): a giveup must never export under the success filename — align to "not done"
  // (the supervisor treats any non-"done" as giveup; this branch must too, so an unexpected status
  // can't slip through as a clean "attic-favorites.json").
  if (msg.status !== "done") {
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
