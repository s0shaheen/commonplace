// devDiag.ts — DEV-ONLY diagnostics client. NEVER SHIPS.
//
// Imported by background.ts AND content.js ONLY at call sites guarded by `if (__DEV_DIAG__) …`. In a
// production build esbuild defines `__DEV_DIAG__ = false`, dead-code-eliminates every guarded call,
// leaves `diag`/`startShotLoop` unreferenced, and TREE-SHAKES this whole module out of dist/ — verified
// by scripts/audit-dist.mjs, which fails the build if "devDiag" / "localhost:9013" / "captureScreenshot"
// / "__DEV_DIAG__" ever appears in a production dist/. Mirrors the devReload.ts dev-artifact pattern.
//
// Contract: `diag(record)` is FIRE-AND-FORGET and best-effort — it NEVER throws into (or blocks) the
// capture path. Records are buffered and flushed on a short debounce so a burst can't flood; a hard cap
// drops the oldest if the sink is down. The POST is a CORS-"simple" request (text/plain body, no custom
// headers ⇒ no preflight) so the same call works from the service worker AND a tiktok.com content script.
//
// THIS FILE MUST STAY SIDE-EFFECT-FREE AT MODULE TOP LEVEL (only declarations) so esbuild can drop it
// entirely from a prod build. The flush timer is armed lazily inside `diag()`, never at import time.

export interface DiagRecord {
  kind: "state" | "log" | "event" | "error" | "shot";
  t: number;
  [k: string]: unknown;
}

const DIAG_URL = "http://localhost:9013/diag";
const FLUSH_MS = 250; // debounce: coalesce a burst into one POST
const MAX_BUFFER = 500; // hard cap so a down sink can't grow memory unbounded — drop oldest beyond

let buffer: string[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;

function flush(): void {
  flushTimer = null;
  if (buffer.length === 0) return;
  const body = buffer.join("\n");
  buffer = [];
  try {
    // keepalive lets a fire-and-forget POST survive a page/worker teardown. All failures swallowed —
    // a dead sink must never surface into the capture path.
    void fetch(DIAG_URL, { method: "POST", body, keepalive: true }).catch(() => {});
  } catch {
    /* swallow — diagnostics are strictly best-effort */
  }
}

/** Fire-and-forget a diagnostic record to the dev sink. Best-effort; never throws, never blocks. */
export function diag(record: DiagRecord): void {
  try {
    buffer.push(JSON.stringify(record));
    if (buffer.length > MAX_BUFFER) buffer.splice(0, buffer.length - MAX_BUFFER);
    if (flushTimer == null) flushTimer = setTimeout(flush, FLUSH_MS);
  } catch {
    /* a record that won't serialize is simply dropped */
  }
}

/**
 * Start a periodic screenshot loop (SW-only; background.ts passes a live-tab-id getter). Every
 * `intervalMs` it captures the ALREADY-ATTACHED debugger's screen (no new attach) and `diag`s it as a
 * base64 `shot`. Runs OFF the wheel pump (its own timer) and skips when `getTabId()` is null (no live
 * run) — so it can NEVER delay or contend with trusted-wheel scrolling. Every failure is swallowed.
 * Returns a stop function. Idempotent per handle.
 */
export function startShotLoop(getTabId: () => number | null, intervalMs = 4000): () => void {
  let timer: ReturnType<typeof setInterval> | null = setInterval(() => {
    const tabId = getTabId();
    if (tabId == null) return; // no live run — skip (cheap; never touches the debugger)
    try {
      void chrome.debugger
        .sendCommand({ tabId }, "Page.captureScreenshot", { format: "jpeg", quality: 60 })
        .then((res) => {
          const data = (res as { data?: string } | undefined)?.data;
          if (data) diag({ kind: "shot", t: Date.now(), data, fmt: "jpg" });
        })
        .catch(() => {});
    } catch {
      /* swallow — a screenshot failure must never affect the run */
    }
  }, intervalMs);
  return () => {
    if (timer != null) {
      clearInterval(timer);
      timer = null;
    }
  };
}
