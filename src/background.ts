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
import { loadConfig, type CpConfig, type CaptureSources, type StorageLike } from "./lib/config.js";
import { nextWheel, resolveSpeed, type CaptureSpeed } from "./lib/capture/wheelJitter.js";
import { handleFromPath, profileUrl } from "./lib/capture/ownIdentity.js";
import { assessCompleteness } from "./lib/capture/completeness.js";
import {
  acquireLease,
  renewLease,
  canAcquire,
  leaseIsActive,
  type CaptureLease,
} from "./lib/capture/lease.js";
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

// Capture notice (CHAL-UX / OVLY-01, spec §6.5–6.6): a resumable PAUSE the content script raised — a
// captcha/challenge, an input-swallowing overlay, a flagged empty-session, or offline. Unlike a halt
// it is NOT terminal: the run stays paused and auto-resumes when healthy arrivals return. We raise a
// chrome notification (the founder may be away from the tab) AND persist the latest notice so the
// popup can surface a human-readable reason via syncStatus. SW-lifetime state; the freshest wins.
type CaptureNotice = { level: string; reason: string; at: string };
let captureNotice: CaptureNotice | null = null;

// CHAL-UX (the KEY ask): the CRASH-SAFE `paused` state — the single source of truth the popup surfaces
// as an "action needed" prompt so a pause is NEVER a silent stop. Persisted to chrome.storage.local
// (`cp_paused`) so a service-worker restart still knows a run is paused-awaiting-user. content.js raises
// it on entering a pause (capture_paused) and clears it on leaving (capture_resumed); syncStatus reads
// storage so it survives the SW dying. `null`/absent = not paused.
type CapturePaused = { level: string; reason: string; at: string };
const PAUSED_KEY = "cp_paused";

async function setPaused(level: string, reason: string): Promise<void> {
  const paused: CapturePaused = { level, reason, at: new Date().toISOString() };
  await chrome.storage.local.set({ [PAUSED_KEY]: paused });
  if (level === "user") {
    // A founder-initiated Pause needs no tray notification (he just clicked it) — but still surface the
    // popup-readable reason so the dashboard shows the paused state.
    captureNotice = { level, reason, at: paused.at };
  } else {
    notifyCapture(level, reason); // raise the tray notification (he may be away) + freshen the notice
  }
}

async function clearPaused(): Promise<void> {
  await chrome.storage.local.set({ [PAUSED_KEY]: null });
}

async function loadPaused(): Promise<CapturePaused | null> {
  const got = await chrome.storage.local.get(PAUSED_KEY);
  return (got[PAUSED_KEY] as CapturePaused | undefined) ?? null;
}

// FIX 4b — chrome-notification dedupe. content.js can re-raise the SAME pause level repeatedly while a
// run flaps in and out of a pause (a captcha that momentarily clears then re-blocks). We still UPDATE
// the popup-readable `captureNotice` each time (freshest reason wins), but we raise a NEW tray
// notification only when the ACTIVE level changes — otherwise the tray gets spammed with duplicates.
// The marker is cleared when a run resumes/completes (next sync_start or scroll_done), so the next
// genuinely-new pause notifies again.
let activeNoticeLevel: string | null = null;

// A tiny self-contained icon (1×1 transparent PNG data URL) — chrome.notifications requires an
// iconUrl and the extension ships no image asset, so we inline one rather than add a file.
const NOTICE_ICON =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

function noticeTitle(level: string): string {
  switch (level) {
    case "challenge":
      return "Commonplace — solve the captcha to resume";
    case "overlay":
      return "Commonplace — a popup is blocking capture";
    case "flagged":
      return "Commonplace — session looks flagged";
    case "offline":
      return "Commonplace — paused (offline)";
    case "debugger":
      return "Commonplace — close DevTools to let capture scroll";
    case "blocked":
      return "Commonplace — capture stopped (TikTok is blocking)";
    case "stalled":
      return "Commonplace — capture stalled, retrying";
    case "concurrent":
      return "Commonplace — capture already running in another tab";
    case "incomplete":
      return "Commonplace — a source looks incomplete";
    case "hidden":
      return "Commonplace — bring the TikTok tab forward";
    case "deadline":
      return "Commonplace — capture hit its time cap";
    default:
      return "Commonplace — capture paused";
  }
}

// Raise the notification + persist the notice. Best-effort: a failed notification (e.g. no permission)
// still leaves the popup-readable notice latched, so the pause is never silent.
function notifyCapture(level: string, reason: string): void {
  // Always refresh the persisted, popup-readable notice (freshest reason wins).
  captureNotice = { level, reason, at: new Date().toISOString() };
  // Dedupe the tray notification: same level still active ⇒ update-only, no second chrome notification.
  if (activeNoticeLevel === level) return;
  activeNoticeLevel = level;
  try {
    chrome.notifications.create(
      { type: "basic", iconUrl: NOTICE_ICON, title: noticeTitle(level), message: reason },
      () => void chrome.runtime.lastError, // read lastError so a failed create doesn't warn in the console
    );
  } catch (e) {
    console.warn("[commonplace] notification failed:", (e as Error).message);
  }
}

// Clear the dedupe marker when a run resumes (a fresh Sync) or ends (scroll_done): the next genuinely
// new pause then raises a tray notification again rather than being suppressed as a duplicate.
function clearActiveNotice(): void {
  activeNoticeLevel = null;
}

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

// S-DB-5 (item 6): whether the archive's IndexedDB bucket is PERSISTENT (best-effort-exempt from
// eviction) vs the default evictable bucket. The actual persist() REQUEST is Window-only (the offscreen
// document makes it — offscreen.ts), so the SW can only READ the state via navigator.storage.persisted()
// (which IS available in workers) and surface it. The result is mirrored here for the popup/options.
const STORAGE_PERSISTED_KEY = "cp_storage_persisted";
async function surfaceStoragePersistence(): Promise<void> {
  try {
    // persisted() is available in service workers; persist() is not. Note: the manifest's
    // `unlimitedStorage` permission already largely exempts the extension origin from eviction — this is
    // the explicit belt + surfacing so an un-persisted state is never silently the case.
    const persisted = (await navigator.storage?.persisted?.()) ?? null;
    await chrome.storage.local.set({ [STORAGE_PERSISTED_KEY]: persisted });
    if (persisted === false) {
      console.warn(
        "[commonplace] storage bucket is NOT persistent yet — the offscreen doc requests persist() on its next run; unlimitedStorage also mitigates eviction.",
      );
    } else if (persisted === true) {
      console.log("[commonplace] storage bucket is persistent ✓");
    }
  } catch (e) {
    console.warn("[commonplace] storage.persisted() check failed:", (e as Error).message);
  }
}

// Storage startup: migrate legacy items (crash-safe), reconcile the count mirror against IDB, then
// surface storage-persistence state. A StorageUnrecoverableError or QuotaExceeded surfacing from the
// first open halts capture LOUDLY rather than silently proceeding as if storage were healthy.
async function storageStartup(): Promise<void> {
  await migrateLegacyItems();
  await reconcileCountFromTruth();
  await surfaceStoragePersistence();
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
  captured?: number; // COMPL-07: DISTINCT items captured for THIS source THIS run (per-run new-id delta)
  cursor?: string | null;
  source?: string | null; // Task 5: the source this run drove (null = manual Alt+Shift+A) — advances the supervisor
  declared?: number | null; // COMPL-07: the source's declared saved count read from the profile UI (null = unread)
}
// DYD import lane (SECOND capture lane, additive): the options page parsed a TikTok "Download your
// data" export off the SW thread (via parseTikTokDyd) and sends the already-normalized, source-tagged
// CapturedItems here. Mirrors ItemListMsg — the SW just upserts + refreshes count, no scraping.
interface ImportDydMsg { kind: "import_dyd"; items: CapturedItem[] }
type ImportDydResult =
  | { ok: true; added: number; merged: number; total: number }
  | { ok: false; error: string };
interface SyncStartMsg { kind: "sync_start" } // popup Sync button → begin/continue the source sequence
interface SyncStatusMsg { kind: "sync_status" } // popup poll → responds with live supervisor + capture status
// CHAL-UX / OVLY-01: content.js raised a resumable pause (captcha/overlay/flagged/offline). Notify the
// founder (chrome notification) and persist a popup-readable reason. `level` is the notice class.
interface CaptureNoticeMsg { kind: "capture_notice"; level: string; reason: string }
// Wave A (the moat, 2026-07-13): TikTok's profile grid ignores ALL programmatic scrolling — only a
// TRUSTED wheel moves it, which a content script cannot send. The content script asks the SW to drive
// scrolling via chrome.debugger + Input.dispatchMouseEvent (trusted wheels): scroll_start attaches the
// debugger + starts the continuous wheel loop, scroll_mode steers it each 250ms observer tick, scroll_stop
// stops the loop + detaches. `_sender.tab.id` is the target tab.
interface ScrollStartMsg { kind: "scroll_start" }
interface ScrollModeMsg { kind: "scroll_mode"; mode: string; x: number; y: number }
interface ScrollStopMsg { kind: "scroll_stop" }
// Wave C (item 5): content.js detected its tab is HIDDEN + stalled and the founder opted into keeping it
// foregrounded — the SW brings the sender's tab (and its window) forward so TikTok resumes paginating.
interface FocusCaptureTabMsg { kind: "focus_capture_tab" }
// CHAL-UX (the KEY ask): content.js entered / left a RESUMABLE pause (break-reminder passcode, captcha,
// login, offline, unknown modal, or a founder-initiated pause). The SW persists a crash-safe `paused`
// state (storage) that syncStatus surfaces as "action needed", and raises a chrome notification.
interface CapturePausedMsg { kind: "capture_paused"; level: string; reason: string }
interface CaptureResumedMsg { kind: "capture_resumed" }
// Popup capture controls (the UI package calls these; shapes are the documented contract).
interface SyncStopMsg { kind: "sync_stop" } // stop the run cleanly, detach, clear supervisor current
interface SyncPauseMsg { kind: "sync_pause" } // hold the run (the content script pauses)
interface SyncResumeMsg { kind: "sync_resume" } // clear a user-actionable pause and resume where it left off
interface ExportEnrichedMsg { kind: "export_enriched"; results: unknown[] }
interface DownloadTestMsg { kind: "download_test"; n?: number }
interface QueueStartMsg { kind: "queue_start" }
interface QueueStatusMsg { kind: "queue_status" }
interface QueueProgressMsg { kind: "queue_progress"; done: number; total: number }
interface QueueBlockedMsg { kind: "queue_blocked"; reason: string }
interface ExportOpenSchemaMsg { kind: "export_open_schema" }
type Msg =
  | ItemListMsg
  | ImportDydMsg
  | ScrollDoneMsg
  | ExportEnrichedMsg
  | DownloadTestMsg
  | QueueStartMsg
  | QueueStatusMsg
  | QueueProgressMsg
  | QueueBlockedMsg
  | ExportOpenSchemaMsg
  | SyncStartMsg
  | SyncStatusMsg
  | CaptureNoticeMsg
  | CapturePausedMsg
  | CaptureResumedMsg
  | SyncStopMsg
  | SyncPauseMsg
  | SyncResumeMsg
  | ScrollStartMsg
  | ScrollModeMsg
  | ScrollStopMsg
  | FocusCaptureTabMsg;

// ── Trusted-wheel scroll driver (the moat, live-confirmed 2026-07-13) ───────────────────────────────
//
// TikTok's profile grid ignores ALL programmatic scrolling: window.scrollBy, scrollingElement.scrollTop=,
// scrollIntoView, and even a synthetic WheelEvent move it ZERO pixels — only a REAL TRUSTED wheel scrolls
// it (a trusted wheel flew the grid 32→110 tiles in ~5s in testing). Content scripts cannot send trusted
// events, but the extension CAN via chrome.debugger + Input.dispatchMouseEvent. So the physical scroll
// WRITE lives here in the SW; the content script keeps ALL the intelligence (the scrollDrive reducer,
// overlay/session recovery, honest completion) and just tells this loop which way to wheel each tick.
//
// Lifecycle safety (invariant: the debugger MUST always detach). Every path converges on a clean detach:
// scroll_stop detaches, mode:stop detaches, a tab close detaches (chrome.tabs.onRemoved), scroll_done
// defensively detaches, and an EXTERNAL detach (banner "Cancel", DevTools opened, tab discarded —
// chrome.debugger.onDetach) stops the loop AND tells the content script to end its run honestly. A dangling
// attach would leave Chrome's "Commonplace started debugging this browser" banner up forever — unacceptable.

const WHEEL = {
  /** Dispatch cadence (ms) for the continuous loop — small enough to read as smooth continuous motion. */
  intervalMs: 30,
  /** Downward wheel delta per tick while advancing (~one mouse "notch"). */
  advanceDeltaY: 120,
  /** Upward wheel delta per event during a retrigger burst (applied negative). */
  retriggerDeltaY: 120,
  /** Events in a retrigger UP-burst — a short hop up so the loader's edge-triggered sentinel re-fires. */
  retriggerBurst: 3,
} as const;

// The capture_notice reason raised when the debugger cannot attach (DevTools open / another debugger
// already attached to the tab). Surfaced to the founder; the run is then ended honestly, never a silent fail.
const DEBUGGER_ATTACH_REASON = "close DevTools on the TikTok tab so capture can scroll";

// FIX 2 — the RESUMABLE-pause reason when the debugger detaches EXTERNALLY mid-run (the founder clicked X
// on the "Commonplace is debugging" banner, opened DevTools, or the tab was discarded). The run is NOT
// ended — it pauses; Resume re-attaches the debugger + restarts the wheel loop and continues where it left off.
const DEBUGGER_DETACH_PAUSE_REASON =
  "Capture paused — the “Commonplace is debugging” banner was closed (or DevTools opened). Click Resume to reconnect and keep capturing.";
// The reason re-surfaced when Resume can't re-attach (DevTools still open) — stay paused, ask for the fix.
const DEBUGGER_REATTACH_FAILED_REASON =
  "Couldn’t reconnect — is DevTools open on the TikTok tab? Close it, then click Resume.";

interface WheelDriver {
  tabId: number;
  mode: "advance" | "hold";
  x: number;
  y: number;
  /** When > 0 the loop dispatches UP wheels (a retrigger burst) before resuming the advance. */
  upBurstRemaining: number;
  timer: ReturnType<typeof setTimeout> | null;
  /** Set once the loop is torn down so an in-flight pump tick stops rescheduling. */
  stopped: boolean;
  /** WE initiated the detach (scroll_stop / tab close / capture end) — onDetach must NOT push scroll_detached. */
  detaching: boolean;
  /** The anti-block cadence profile (config cp_config.captureSpeed) — governs the jittered delta/interval. */
  speed: CaptureSpeed;
}

// Only ONE debugged capture tab at a time (invariant). Null = nothing attached.
let wheelDriver: WheelDriver | null = null;

type AttachResult = { ok: true } | { ok: false; reason: string };

// Attach the debugger to `tabId`. A reject means DevTools is open or another debugger is already attached —
// return a TYPED failure so the caller can notify honestly and abort, never silently fail.
async function attachScrollDebugger(tabId: number): Promise<AttachResult> {
  try {
    await chrome.debugger.attach({ tabId }, "1.3");
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: (e as Error)?.message ?? String(e) };
  }
}

// One trusted wheel event at (x,y). Rejects if the debugger has detached mid-flight (the pump swallows it).
function dispatchWheel(tabId: number, x: number, y: number, deltaY: number): Promise<unknown> {
  return chrome.debugger.sendCommand({ tabId }, "Input.dispatchMouseEvent", {
    type: "mouseWheel",
    x,
    y,
    deltaX: 0,
    deltaY,
    pointerType: "mouse",
  });
}

// Background-tab capture (research-confirmed, 2026-07-13). The trusted-wheel scroll already holds
// chrome.debugger attached to the capture tab — so, gated on config.captureBackground, we also tell Chrome
// to treat that tab as FOCUSED/VISIBLE even when it is backgrounded or minimized:
//   • Emulation.setFocusEmulationEnabled({enabled:true}) — document.visibilityState stays "visible",
//     `visibilitychange` never fires, and TikTok's rendering + IntersectionObserver lazy-load are NOT
//     throttled, so the profile grid keeps paginating unattended. This is EXACTLY what Playwright applies
//     to every page by default (why Playwright pages "just work" backgrounded) — a standard technique.
//   • Page.setWebLifecycleState({state:"active"}) — a belt against Chrome freezing/discarding the tab.
// BOTH are best-effort: a failure (unsupported command / old Chrome) is swallowed exactly like dispatchWheel,
// so it can never break the run. The emulation drops naturally when the debugger detaches, so it is RE-APPLIED
// on every fresh attach (initial scroll_start + resume re-attach). The tab must still EXIST — backgrounded/
// minimized is fine; a CLOSED tab is the separate DYD lane, not this.
async function enableBackgroundEmulation(tabId: number): Promise<void> {
  try {
    await chrome.debugger.sendCommand({ tabId }, "Emulation.setFocusEmulationEnabled", { enabled: true });
    console.log(`[commonplace] background emulation ON — tab ${tabId} treated as focused/visible while backgrounded (capture survives hidden)`);
  } catch (e) {
    console.warn(`[commonplace] Emulation.setFocusEmulationEnabled failed on tab ${tabId} (non-fatal):`, (e as Error)?.message ?? e);
  }
  try {
    await chrome.debugger.sendCommand({ tabId }, "Page.setWebLifecycleState", { state: "active" });
  } catch (e) {
    console.warn(`[commonplace] Page.setWebLifecycleState failed on tab ${tabId} (non-fatal):`, (e as Error)?.message ?? e);
  }
}

// The continuous wheel loop: a self-rescheduling async pump (awaits each dispatch, then schedules the next
// after WHEEL.intervalMs — so dispatches never pile up). It reads the LATEST mode/coords the content script
// sent, decoupling smooth motion from the observer's 250ms decision cadence. advance → wheel down · hold →
// idle · a pending retrigger burst → wheel UP a few times, then resume advancing. Starts in `hold`; the
// content script's first scroll_mode(advance) sets it moving (avoids wheeling at the (0,0) default).
function startWheelPump(tabId: number, speed: CaptureSpeed): void {
  const st: WheelDriver = { tabId, mode: "hold", x: 0, y: 0, upBurstRemaining: 0, timer: null, stopped: false, detaching: false, speed };
  wheelDriver = st;
  const pump = async (): Promise<void> => {
    if (st.stopped || wheelDriver !== st) return;
    // Anti-block (C7 + PACE): the ADVANCE delta + the gap to the next tick are JITTERED per tick via the
    // pure wheelJitter module (occasional micro-pause included) so the stream reads like a human flicking
    // a trackpad, not a metronome. Retrigger up-bursts and the hold idle keep fixed, short cadences.
    let nextDelayMs: number = WHEEL.intervalMs;
    try {
      if (st.upBurstRemaining > 0) {
        st.upBurstRemaining--;
        await dispatchWheel(st.tabId, st.x, st.y, -WHEEL.retriggerDeltaY);
        nextDelayMs = WHEEL.intervalMs;
      } else if (st.mode === "advance") {
        const tick = nextWheel(Math.random, st.speed);
        await dispatchWheel(st.tabId, st.x, st.y, tick.deltaY);
        nextDelayMs = tick.intervalMs;
      } else {
        // hold → no dispatch (the loop idles); poll again soon to notice a mode change.
        nextDelayMs = 60;
      }
    } catch {
      // Dispatch failed — the debugger detached mid-flight; onDetach handles cleanup. Stop pumping.
      return;
    }
    if (!st.stopped && wheelDriver === st) {
      st.timer = setTimeout(() => void pump(), nextDelayMs);
    }
  };
  st.timer = setTimeout(() => void pump(), WHEEL.intervalMs);
}

// Attach + start the loop for a run. Enforces one-debugged-tab-at-a-time; on attach failure raises a
// capture_notice AND returns the failure so the content script ends the run honestly (never a silent hang).
async function handleScrollStart(tabId: number | undefined, sendResponse: (r: AttachResult) => void): Promise<void> {
  if (tabId == null) {
    sendResponse({ ok: false, reason: "no tab to attach the scroll driver to" });
    return;
  }
  if (wheelDriver) await stopScrollDriver(); // tear down any prior run's attach first (one tab at a time)
  const res = await attachScrollDebugger(tabId);
  if (!res.ok) {
    console.warn(`[commonplace] scroll debugger attach failed on tab ${tabId}: ${res.reason}`);
    notifyCapture("debugger", DEBUGGER_ATTACH_REASON);
    sendResponse({ ok: false, reason: DEBUGGER_ATTACH_REASON });
    return;
  }
  // Anti-block cadence: read the founder's configured pace (default "normal") and drive the pump's jitter.
  const config = await loadConfig(configStorage);
  const speed = resolveSpeed(config.captureSpeed);
  // Background-tab capture (default ON): with the debugger now attached, make Chrome treat this tab as
  // focused/visible so TikTok keeps paginating while the tab is backgrounded/minimized. Best-effort.
  if (config.captureBackground) await enableBackgroundEmulation(tabId);
  startWheelPump(tabId, speed);
  console.log(`[commonplace] scroll driver attached + trusted-wheel loop started on tab ${tabId} (${speed} cadence)`);
  sendResponse({ ok: true });
}

// Steer the loop from the content script's observer: update the aim point + the mode. `retrigger` is
// EDGE-triggered — it queues an UP-burst then resumes advancing (the loop reads mode level-triggered, the
// burst once). `stop` detaches. Ignores messages from a tab that isn't the attached one.
function onScrollMode(tabId: number | undefined, mode: string, x: number, y: number): void {
  const st = wheelDriver;
  if (!st || tabId == null || tabId !== st.tabId) return;
  if (Number.isFinite(x)) st.x = x;
  if (Number.isFinite(y)) st.y = y;
  if (mode === "retrigger") {
    st.upBurstRemaining = WHEEL.retriggerBurst;
    st.mode = "advance";
  } else if (mode === "advance") {
    st.mode = "advance";
  } else if (mode === "hold") {
    st.mode = "hold";
  } else if (mode === "stop") {
    void stopScrollDriver();
  }
}

// Stop the loop and detach — the INTENTIONAL teardown path (scroll_stop / mode:stop / capture end / tab
// close). Marks `detaching` so onDetach treats the resulting detach as expected (no scroll_detached push),
// and clears `wheelDriver` BEFORE the await so a re-entrant start sees no driver. Idempotent.
async function stopScrollDriver(): Promise<void> {
  const st = wheelDriver;
  if (!st) return;
  st.stopped = true;
  st.detaching = true;
  if (st.timer != null) {
    clearTimeout(st.timer);
    st.timer = null;
  }
  if (wheelDriver === st) wheelDriver = null;
  try {
    await chrome.debugger.detach({ tabId: st.tabId });
  } catch {
    // Already detached / tab gone — fine.
  }
}

// EXTERNAL detach: the user clicked the banner's "Cancel"/X, opened DevTools on the tab, or the tab was
// discarded. FIX 2 — this NO LONGER ends the run. It enters a RESUMABLE pause: persist the crash-safe
// `paused` state (level "debugger") + notify, and tell the content script to HOLD (keep the run alive,
// stop feeding motion). The wheel loop is gone (detached) — that's fine; Resume re-attaches it
// (handleSyncResume). OUR intentional detaches (scroll_stop / tab close / capture end) set `detaching`
// and end cleanly as before — only the EXTERNAL detach becomes a pause.
chrome.debugger.onDetach.addListener((source, reason) => {
  const st = wheelDriver;
  if (!st || source.tabId !== st.tabId) return;
  const intentional = st.detaching;
  st.stopped = true;
  if (st.timer != null) {
    clearTimeout(st.timer);
    st.timer = null;
  }
  const tabId = st.tabId;
  wheelDriver = null;
  if (!intentional) {
    console.warn(`[commonplace] scroll debugger detached externally (${reason}) — PAUSING the run on tab ${tabId} (resumable; Resume re-attaches)`);
    void setPaused("debugger", DEBUGGER_DETACH_PAUSE_REASON);
    // Tell the content script to HOLD (its observer enters a resumable pause held until Resume). Best-effort
    // — a discarded/closed tab just no-ops (the persisted `paused` state still surfaces in the popup).
    void chrome.tabs.sendMessage(tabId, { kind: "scroll_paused_detach", reason: DEBUGGER_DETACH_PAUSE_REASON }).catch(() => {});
  }
});

// A closed tab must never leave a dangling attach.
chrome.tabs.onRemoved.addListener((tabId) => {
  if (wheelDriver && wheelDriver.tabId === tabId) void stopScrollDriver();
});

chrome.runtime.onMessage.addListener((msg: Msg, sender, sendResponse) => {
  if (msg.kind === "item_list") {
    void handleItemList(msg);
  } else if (msg.kind === "import_dyd") {
    // DYD import — respond async (channel kept open by `return true` below) so the options page can
    // show a result line. Mirrors the sync_status response pattern.
    void handleImportDyd(msg).then(sendResponse);
    return true;
  } else if (msg.kind === "scroll_done") {
    void handleScrollDone(msg);
  } else if (msg.kind === "sync_start") {
    void handleSyncClick();
  } else if (msg.kind === "sync_status") {
    // Popup poll — respond async (channel kept open by the `return true` below).
    void syncStatus().then(sendResponse);
    return true;
  } else if (msg.kind === "capture_notice") {
    // A one-shot / transient notice (preflight, wedge re-nudge, ban halt) — notify + persist the reason.
    notifyCapture(msg.level, msg.reason);
  } else if (msg.kind === "capture_paused") {
    // A RESUMABLE pause — persist the crash-safe `paused` state + notify. syncStatus surfaces it.
    void setPaused(msg.level, msg.reason);
  } else if (msg.kind === "capture_resumed") {
    // The run left its pause (auto-resumed or the founder clicked Resume) — drop the action-needed state.
    void clearPaused();
  } else if (msg.kind === "sync_stop") {
    void handleSyncStop();
  } else if (msg.kind === "sync_pause") {
    void handleSyncPause();
  } else if (msg.kind === "sync_resume") {
    void handleSyncResume();
  } else if (msg.kind === "scroll_start") {
    // Attach the debugger to the sender's tab + start the trusted-wheel loop. Async attach → sendResponse
    // via the `return true` below so the content script learns ok/attach-failed and can abort honestly.
    void handleScrollStart(sender.tab?.id, sendResponse);
    return true;
  } else if (msg.kind === "scroll_mode") {
    onScrollMode(sender.tab?.id, msg.mode, msg.x, msg.y);
  } else if (msg.kind === "scroll_stop") {
    void stopScrollDriver();
  } else if (msg.kind === "focus_capture_tab") {
    // Wave C (item 5): bring the driven tab forward so a hidden/occluded TikTok tab resumes paginating.
    void focusCaptureTab(sender.tab?.id);
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

  // Items 3 + 5: renew the single-driver lease while the run is live (so a long pause never lets it
  // lapse), GC a dead one, and — if the driven tab was DISCARDED under memory pressure — recover it.
  await maintainLeaseAndDiscardedTab();

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

// Items 3 + 5 alarm maintenance (best-effort; never throws into the alarm). Renew the lease while a run
// is genuinely live; GC an expired one so a new Sync isn't blocked; recover a discarded driven tab.
async function maintainLeaseAndDiscardedTab(): Promise<void> {
  const lease = await loadLease();
  if (lease == null) return;
  const now = Date.now();
  // Live run (belt says running, or the leased tab itself reports scrolling) → renew, done.
  if (supervisorRunning || (await isTabScrolling(lease.tabId))) {
    await saveLease(renewLease(lease, now));
    return;
  }
  // Not live and already stale → GC it (a dead lease must never block a fresh Sync).
  if (!leaseIsActive(lease, now)) {
    await saveLease(null);
    return;
  }
  // Live-within-TTL but not scrolling: the tab may have been DISCARDED (Wave C — memory pressure kills
  // the content script). In autonomous mode we OWN the tab, so reload it → content.js re-injects and the
  // resume path below re-drives the persisted `current`. In semi-auto we leave it: reactivating the tab
  // reloads + re-injects it, and the resume path picks it up (documented).
  try {
    const tab = await chrome.tabs.get(lease.tabId);
    if (tab.discarded && (await loadConfig(configStorage)).autonomousCapture) {
      console.warn(`[commonplace] driven tab ${lease.tabId} was DISCARDED — reloading to re-inject + resume the run`);
      await chrome.tabs.reload(lease.tabId);
    }
  } catch {
    // Tab gone entirely — a fresh Sync (or the resume block) handles it; nothing to reload.
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

// DYD import intake (SECOND capture lane): the options page already parsed the "Download your data"
// export into normalized, source-tagged CapturedItems (via the pure parseTikTokDyd) and sends them
// here. Identical landing to handleItemList — upsert (id-keyed, sources UNION-merged) + refresh the
// count mirror — so imported items flow through the SAME analysis/grounding pipeline as scraped ones.
// No poster pass: DYD items carry no cover URL. Returns a typed result so options can surface it.
async function handleImportDyd(msg: ImportDydMsg): Promise<ImportDydResult> {
  // Honor the storage-halt invariant (invariant 4): a full / unrecoverable DB must never let an
  // import present as done. Surface it to the options page instead of silently swallowing the write.
  if (captureHalt) return { ok: false, error: `storage ${captureHalt.reason}` };
  const raw = msg.items ?? [];
  // SHAPE GATE (mirrors handleItemList): items cross the runtime message boundary pre-built, so
  // re-assert the non-empty string id an id-less item would throw inside upsertItems.
  const incoming = raw.filter((i) => i && typeof i.id === "string" && i.id.length > 0);
  if (incoming.length < raw.length) {
    console.warn(`[commonplace] DYD import: dropped ${raw.length - incoming.length} malformed item(s)`);
  }
  try {
    const s = await store();
    const { added, merged } = await s.upsertItems(incoming, new Date().toISOString());
    const count = await s.count();
    await chrome.storage.local.set({ count }); // keep the content.js scroll-idle contract in sync
    console.log(`[commonplace] DYD import: +${added} (merged ${merged}), total ${count}`);
    return { ok: true, added, merged, total: count };
  } catch (e) {
    // A swallowed write must halt, not present as done (invariant 4). Latch + surface the reason.
    haltCapture(e);
    return { ok: false, error: (e as Error).message };
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

// Item 1 (source selection): the ENABLED capture lanes the sweep may drive, from config.captureSources.
// Defensive: if the founder somehow unchecked EVERY lane, fall back to all four rather than a confusing
// "all caught up" no-op sweep. Preserves the frozen SOURCES order.
function enabledSources(cs: CaptureSources): Source[] {
  const on = SOURCES.filter((s) => cs[s]);
  return on.length > 0 ? on : [...SOURCES];
}

// ── Single-active-driver lease (CONC-01, item 3) ────────────────────────────────────────────────────
// A PERSISTED TTL lease (chrome.storage.local, survives SW death) so only ONE tab drives capture at a
// time — beyond the SW-lifetime `supervisorRunning` boolean, which resets on every idle-out. The
// decision (acquire/renew/expiry) is the pure lease.ts module; this is the storage glue.
const LEASE_KEY = "cp_capture_lease";
async function loadLease(): Promise<CaptureLease | null> {
  const got = await chrome.storage.local.get(LEASE_KEY);
  return (got[LEASE_KEY] as CaptureLease | undefined) ?? null;
}
async function saveLease(lease: CaptureLease | null): Promise<void> {
  await chrome.storage.local.set({ [LEASE_KEY]: lease });
}
// The capture_notice reason when a second Sync/tab is refused because another tab already holds the lease.
const CONCURRENT_DRIVER_REASON =
  "capture is already running in another TikTok tab — only one runs at a time to keep your account safe.";

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

// Wave C (item 5): bring a driven tab forward (activate it + focus its window). Used when the founder
// opted into `captureKeepForeground` and content.js reported the tab is hidden + stalled — a hidden tab
// pauses TikTok's own rendering/IntersectionObserver, so foregrounding it lets pagination resume.
// Best-effort: a vanished tab/window just no-ops.
async function focusCaptureTab(tabId: number | undefined): Promise<void> {
  if (tabId == null) return;
  try {
    const tab = await chrome.tabs.update(tabId, { active: true });
    if (tab?.windowId != null) await chrome.windows.update(tab.windowId, { focused: true });
    console.log(`[commonplace] foregrounded capture tab ${tabId} (hidden-stall recovery)`);
  } catch (e) {
    console.warn("[commonplace] focus_capture_tab failed:", (e as Error).message);
  }
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
  // A fresh Sync means the founder is (re)starting a run — clear the notification dedupe marker so the
  // new run's first pause notifies fresh (FIX 4b), and drop any stale `paused` state from a prior run.
  clearActiveNotice();
  await clearPaused();
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

// ── Popup capture controls (the documented contract) ────────────────────────────────────────────────

// STOP: end the live run cleanly. Tell the content script to stop, detach the debugger, and CLEAR the
// supervisor's `current` so neither the alarm nor a stray scroll_done re-drives — a stop is final for
// this sweep. Clears the paused state + the notice. `running` flips false.
async function handleSyncStop(): Promise<void> {
  const tabId = await findCaptureTab();
  if (tabId != null) {
    try {
      await chrome.tabs.sendMessage(tabId, { kind: "sync_stop" });
    } catch {
      // Content script gone (tab closed / not injected) — the debugger detach + state clear below still run.
    }
  }
  await stopScrollDriver(); // ALWAYS detach — never leave a dangling attach
  await clearPaused();
  clearActiveNotice();
  await saveLease(null); // release the single-driver lease — a stop is final for this sweep (CONC-01)
  const s = await store();
  const progress = await loadSupervisorProgress(s);
  if (progress.current != null) {
    // Clear the crash-resume anchor so the revival alarm won't resume a stopped run.
    await s.setMeta(SUPERVISOR_META_KEY, { ...progress, current: null, currentStartedAt: undefined });
  }
  supervisorRunning = false;
  console.log("[commonplace] Sync STOPPED by the founder — run halted, supervisor `current` cleared");
}

// PAUSE: hold the live run (the content script enters a resumable user pause, which raises capture_paused
// → the crash-safe `paused` state). Best-effort relay to the driven tab.
async function handleSyncPause(): Promise<void> {
  const tabId = await findCaptureTab();
  if (tabId != null) {
    try {
      await chrome.tabs.sendMessage(tabId, { kind: "sync_pause" });
    } catch {
      // No live content script to pause — nothing to do.
    }
  }
}

// RESUME: clear the user-actionable `paused` state and continue where the run left off. If the content
// script is still alive and paused, unblock it in place (progress intact — the captured prefix is kept).
// If the SW/content died while paused, re-drive the in-flight source from its persisted checkpoint.
//
// FIX 2 — a DEBUGGER-level pause (external detach: banner closed / DevTools opened) tore down the wheel
// loop, so before we can resume a live run we must RE-ATTACH the debugger + restart the pump. We do that
// FIRST and only clear the pause on success; if re-attach fails (DevTools still open) we STAY paused and
// re-surface an actionable reason so Resume genuinely reconnects rather than resuming into a dead scroll.
async function handleSyncResume(): Promise<void> {
  const tabId = await findCaptureTab();
  const live = tabId != null && (await isTabScrolling(tabId));

  // Re-attach when a live content run has NO attached wheel driver (the debugger detached out from under
  // it — the debugger-pause case, or any time the attach is gone but the run should be live).
  const needsReattach = live && tabId != null && wheelDriver == null;
  if (needsReattach && tabId != null) {
    const res = await attachScrollDebugger(tabId);
    if (!res.ok) {
      // Couldn't reconnect (DevTools open / another debugger). Keep the run PAUSED and re-surface the fix —
      // do NOT clear the pause, do NOT resume into a dead scroll.
      console.warn(`[commonplace] resume re-attach failed on tab ${tabId}: ${res.reason} — staying paused`);
      await setPaused("debugger", DEBUGGER_REATTACH_FAILED_REASON);
      return;
    }
    const config = await loadConfig(configStorage);
    const speed = resolveSpeed(config.captureSpeed);
    // Re-apply background emulation on this fresh attach (it dropped when the debugger detached), so a
    // reload/re-attach keeps the tab running while backgrounded. Best-effort; gated on captureBackground.
    if (config.captureBackground) await enableBackgroundEmulation(tabId);
    startWheelPump(tabId, speed);
    console.log(`[commonplace] resume — re-attached scroll driver + restarted the trusted-wheel loop on tab ${tabId} (${speed} cadence)`);
  }

  await clearPaused();
  clearActiveNotice();
  if (live && tabId != null) {
    try {
      await chrome.tabs.sendMessage(tabId, { kind: "sync_resume" });
      return;
    } catch {
      // Fall through to a checkpoint re-drive.
    }
  }
  // No live run (SW/content died while paused) — resume the in-flight source from its checkpoint. If a
  // debugger pause left an attach dangling from a now-dead run, drop it first (one-debugged-tab invariant);
  // the checkpoint re-drive re-attaches cleanly via autoScroll → startScrollDriver.
  if (wheelDriver) await stopScrollDriver();
  await runSupervisorEvent({ kind: "restarted" });
}

// Feed one event to the pure reducer, persist the new progress, then act on the returned action.
// NEVER call directly — go through runSupervisorEvent (the mutex).
async function runSupervisorEventUnlocked(event: SupervisorEvent): Promise<void> {
  const s = await store();
  const progress = await loadSupervisorProgress(s);
  const config = await loadConfig(configStorage);
  // Item 1: the founder's chosen lanes drive the sweep (default all four → nothing regresses).
  const enabled = enabledSources(config.captureSources);
  const { progress: next, action } = nextAction(progress, event, enabled);
  // Staleness belt (fix round 2, #5): stamp when `current` is (re-)set to a source we're about to
  // drive, so the alarm can abandon a `current` left untouched for a day. Clear it when nothing is in
  // flight. The reducer stays pure (no clock); the timestamp is a glue concern.
  next.currentStartedAt = action.kind === "capture_source" ? Date.now() : next.current == null ? undefined : next.currentStartedAt;
  await s.setMeta(SUPERVISOR_META_KEY, next); // CHECKPOINT before driving — the crash-resume anchor

  if (action.kind === "idle") return; // a run is already in flight; do not double-drive
  if (action.kind === "all_done") {
    supervisorRunning = false;
    await saveLease(null); // sweep over — release the single-driver lease so a later Sync re-acquires cleanly
    console.log("[commonplace] Sync complete — all sources enumerated", summarizeProgress(next));
    return;
  }

  // capture_source: resolve/open the tab and tell content.js to drive that source.
  const tabId = await resolveCaptureTab(config);
  if (tabId == null) {
    supervisorRunning = false; // nothing to drive right now; a later Sync (or the alarm) retries
    console.warn(
      `[commonplace] Sync: no TikTok tab to drive ${action.source} — ` +
        (config.autonomousCapture ? "could not open one." : "open your TikTok saved page, then click Sync."),
    );
    return;
  }
  // CONC-01 (item 3): acquire the single-driver lease BEFORE driving. A lease held by ANOTHER tab that is
  // GENUINELY still driving blocks (never double-drive — two runs double the anti-bot footprint on the
  // real account). No lease, a stale lease, or this tab's own lease is acquirable. The holder-liveness
  // check (isTabScrolling) is the belt against a false refusal: a within-TTL lease from a tab whose run
  // already ended (e.g. the founder switched profile tabs mid-sweep) must NOT block a legit continuation —
  // that is sequential, not concurrent. Refusal is surfaced + stood down honestly.
  const nowMs = Date.now();
  const currentLease = await loadLease();
  if (!canAcquire(currentLease, tabId, nowMs) && currentLease != null) {
    const holderLive = await isTabScrolling(currentLease.tabId);
    if (holderLive) {
      supervisorRunning = false;
      notifyCapture("concurrent", CONCURRENT_DRIVER_REASON);
      console.warn(
        `[commonplace] Sync refused — capture is live in tab ${currentLease.tabId} (this tab ${tabId}); not double-driving ${action.source}`,
      );
      return;
    }
    console.log(`[commonplace] reclaiming lease from tab ${currentLease.tabId} (its run ended) for tab ${tabId}`);
  }
  await saveLease(acquireLease(tabId, nowMs));
  // AUTONOMOUS NAVIGATION (SUP-02): before driving, make sure the tab is on the founder's OWN profile —
  // the surface that hosts the favorites/likes/posts/reposts sub-tabs. From ANY page this navigates to
  // `/@handle` first (using the learned handle, discovering it if unknown), so a Sync from the FYP / a
  // video / someone else's profile still reaches the right place. A no-op when we're already there.
  await ensureOnOwnProfile(tabId);
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

// ── Autonomous profile navigation (SUP-02) ──────────────────────────────────────────────────────────
// Reach the founder's own profile from ANY starting page. The handle is learned by content.js (persisted
// to cp_own_handle when it sees the own profile) — most runs already have it after the first Sync. If it
// is unknown we discover it from the live tab's nav link (landing on tiktok.com first if needed). If we
// STILL can't determine it, we leave the tab as-is: content.js's preflight surfaces an honest, actionable
// result (e.g. "not on a TikTok profile page") rather than bot-scrolling the wrong page.

async function getOwnHandle(): Promise<string | null> {
  const { cp_own_handle } = await chrome.storage.local.get("cp_own_handle");
  return typeof cp_own_handle === "string" && cp_own_handle.length > 0 ? cp_own_handle : null;
}

/** The @handle segment of a URL's path (owner of whatever page), or null. */
function urlHandle(url: string | undefined | null): string | null {
  if (!url) return null;
  try {
    return handleFromPath(new URL(url).pathname);
  } catch {
    return null;
  }
}

async function ensureOnOwnProfile(tabId: number): Promise<void> {
  let tab: chrome.tabs.Tab;
  try {
    tab = await chrome.tabs.get(tabId);
  } catch {
    return; // tab vanished — nothing to navigate
  }
  const url = tab.url ?? "";
  let handle = await getOwnHandle();
  // Already on our own profile (known handle matches, or handle unknown but it's some profile we assume
  // is ours — content.js will confirm/capture it). Nothing to do.
  if (isProfileUrl(url)) {
    if (!handle || urlHandle(url) === handle) return;
    // On a DIFFERENT @handle than ours (viewing someone else) → fall through and navigate home.
  }
  if (!handle) handle = await discoverOwnHandle(tabId, url);
  if (!handle) return; // unknown — let content.js preflight report an honest result
  if (isProfileUrl(url) && urlHandle(url) === handle) return; // already there
  console.log(`[commonplace] autonomous nav → founder's profile @${handle} (was: ${url || "?"})`);
  await navigateTab(tabId, profileUrl(handle));
}

// Ask the live content script for the own-handle (it reads the nav link / its own profile). If the tab
// isn't even on TikTok, land on the home page first so the nav link exists, then ask again.
async function discoverOwnHandle(tabId: number, url: string): Promise<string | null> {
  const ask = async (): Promise<string | null> => {
    try {
      const res = (await chrome.tabs.sendMessage(tabId, { kind: "discover_handle" })) as { handle?: string } | undefined;
      return res?.handle && typeof res.handle === "string" ? res.handle : null;
    } catch {
      return null;
    }
  };
  let h = await ask();
  if (!h && !url.includes("tiktok.com")) {
    await navigateTab(tabId, "https://www.tiktok.com/");
    h = await ask();
  }
  if (h) await chrome.storage.local.set({ cp_own_handle: h });
  return h;
}

// Navigate a tab and wait for it to finish loading (so the fresh content script is ready before we drive).
async function navigateTab(tabId: number, url: string): Promise<void> {
  await chrome.tabs.update(tabId, { url });
  await waitForTabComplete(tabId, 15000);
  await new Promise((r) => setTimeout(r, 600)); // small settle so the content script registers its listener
}

// Resolve when the tab reaches status "complete", or after a timeout (never hang).
function waitForTabComplete(tabId: number, timeoutMs: number): Promise<void> {
  return new Promise((resolve) => {
    let done = false;
    const finish = (): void => {
      if (done) return;
      done = true;
      chrome.tabs.onUpdated.removeListener(listener);
      clearTimeout(timer);
      resolve();
    };
    const listener = (id: number, info: { status?: string }): void => {
      if (id === tabId && info.status === "complete") finish();
    };
    chrome.tabs.onUpdated.addListener(listener);
    const timer = setTimeout(finish, timeoutMs);
    // Guard against a tab that is already "complete" before the listener attached.
    void chrome.tabs
      .get(tabId)
      .then((t) => {
        if (t.status === "complete") finish();
      })
      .catch(() => {});
  });
}

function summarizeProgress(p: SupervisorProgress): Record<string, unknown> {
  return { done: p.done, current: p.current, counts: p.counts };
}

// Popup status poll — the documented message contract the UI package reads (popup-view.ts). Returns
// EXACTLY: the library count, whether a run is live, the crash-safe `paused` state (the action-needed
// prompt), per-source progress (order/done/current/counts), the freshest transient `notice`, the current
// config (so the UI shows settings), and any storage `halt`. `paused` is read from storage so it survives
// a SW restart; `counts` maps the supervisor's per-source SourceProgress → a captured NUMBER per source.
async function syncStatus(): Promise<{
  count: number;
  running: boolean;
  paused: { level: string; reason: string } | null;
  progress: {
    order: string[];
    done: string[];
    current: string | null;
    counts: Record<string, number>;
    // COMPL-07 (item 2) — ADDITIVE: per-source declared count + honest status so the popup can show
    // "captured N of ~M" and flag a suspicious source. The popup view-model tolerates their absence.
    expected: Record<string, number>;
    statuses: Record<string, string>;
  };
  notice: { level: string; reason: string; at: string } | null;
  config: unknown;
  halt: unknown | null;
  // S-DB-5 (item 6) — ADDITIVE: whether the archive's storage bucket is persistent (null = unknown).
  storagePersisted: boolean | null;
}> {
  const s = await store();
  const [progress, count, config, paused, persistState] = await Promise.all([
    loadSupervisorProgress(s),
    s.count(),
    loadConfig(configStorage),
    loadPaused(),
    chrome.storage.local.get(STORAGE_PERSISTED_KEY),
  ]);
  const counts: Record<string, number> = {};
  const expected: Record<string, number> = {};
  const statuses: Record<string, string> = {};
  for (const [source, sp] of Object.entries(progress.counts)) {
    if (!sp) continue;
    counts[source] = sp.captured; // the existing per-source captured contract (unchanged)
    if (typeof sp.expected === "number") expected[source] = sp.expected;
    statuses[source] = sp.status;
  }
  const persisted = persistState[STORAGE_PERSISTED_KEY];
  return {
    count,
    running: supervisorRunning,
    paused: paused ? { level: paused.level, reason: paused.reason } : null,
    progress: {
      order: [...(progress.order ?? SOURCES)],
      done: [...progress.done],
      current: progress.current,
      counts,
      expected,
      statuses,
    },
    notice: captureNotice,
    config,
    halt: captureHalt,
    storagePersisted: typeof persisted === "boolean" ? persisted : null,
  };
}

async function handleScrollDone(msg: ScrollDoneMsg): Promise<void> {
  // The run ended (done or giveup) — clear the notification dedupe marker so a later run's first pause
  // notifies fresh rather than being suppressed as a duplicate of this run's last pause (FIX 4b), and
  // drop any lingering `paused` state (a finished run is not awaiting the founder).
  clearActiveNotice();
  void clearPaused();
  // Belt (invariant: always detach): the content script sends scroll_stop before scroll_done, but a
  // crashed/killed content script may not — so defensively stop the trusted-wheel loop + detach here too.
  void stopScrollDriver();
  // A source finished enumerating (done OR giveup — partial capture still deserves posters). Kick the
  // decoupled poster pass NOW, before cover URLs expire. Fire-and-forget; never fails the export.
  void runPosterPassNow();

  // Task 5: if this run was supervisor-driven (a tagged source), advance the sequence to the next
  // source. A manual Alt+Shift+A run carries source:null and is left untouched (dev path preserved).
  if (isSource(msg.source)) {
    // COMPL-07 (the TRUST feature): refine the honest terminal. content.js reports `done` (a VERIFIED
    // hasMore:false terminal) or `giveup`; here we compare captured-this-source vs the profile's declared
    // count and, if we ended WITHOUT a clean terminal AND fell grossly short, downgrade to `suspicious`
    // — never present a grossly-short capture as complete. A verified terminal stays `done` (a declared
    // count can be stale/hidden/wrong). `expected` (declared) is persisted per source (supervisor
    // counts, in the store `meta`) as the durable per-run completeness report.
    const terminalDone = msg.status === "done";
    const declared =
      typeof msg.declared === "number" && Number.isFinite(msg.declared) ? msg.declared : null;
    const captured = msg.captured ?? 0;
    const status = assessCompleteness({ terminalDone, captured, declared });
    if (status === "suspicious") {
      notifyCapture(
        "incomplete",
        `captured ${captured} of ~${declared} ${msg.source} — that looks short. Sync again to try for the rest.`,
      );
      console.warn(`[commonplace] ${msg.source} SUSPICIOUS — captured ${captured} of declared ~${declared} (no clean terminal)`);
    }
    void runSupervisorEvent({
      kind: "source_finished",
      source: msg.source,
      captured,
      status,
      expected: declared ?? undefined,
    });
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
