// popup-view.ts — the PURE decision layer behind the popup dashboard.
//
// It answers one question deterministically: given a `sync_status` reply from the service worker (or
// no reply yet), what should the popup show and which controls are live? Every branch the founder can
// see — the action-needed banner, the state label + tone, the per-source rows, the enabled/disabled
// buttons — is decided here, with no chrome.* and no DOM, so it is unit-tested rather than eyeballed.
// popup.ts is the thin glue: poll → computeViewModel → paint.
//
// It is deliberately DECOUPLED from src/lib/capture/* : it consumes only the documented `sync_status`
// message shape (below), never the supervisor's internal types. That is the whole contract boundary.

/** The `sync_status` reply, as documented in the message contract. Every field is optional here so a
 *  partial / older / mid-migration reply degrades gracefully instead of throwing in the popup. */
export interface SyncStatusRaw {
  count?: number;
  running?: boolean;
  paused?: { level?: string; reason?: string } | null;
  progress?: {
    order?: string[];
    done?: string[];
    current?: string | null;
    // Contract: Record<string, number>. We also tolerate the legacy {captured} object shape.
    counts?: Record<string, unknown>;
    /** Per-source declared saved-count from the profile UI (completeness accounting). null/absent = unknown. */
    expected?: Record<string, unknown>;
    /** Per-source terminal quality: "done" (clean) | "suspicious" (short) | "giveup" (incomplete). */
    statuses?: Record<string, string>;
  } | null;
  notice?: { level?: string; reason?: string; at?: string } | null;
  config?: unknown;
  halt?: unknown | null;
}

export type CaptureState = "connecting" | "idle" | "capturing" | "paused" | "halted" | "done";
export type StateTone = "neutral" | "idle" | "active" | "warn" | "error" | "done";
export type Connection = "live" | "reconnecting" | "connecting";

export type RowState = "done" | "current" | "pending";
/** Terminal quality of a finished source (completeness accounting). */
export type SourceQuality = "done" | "suspicious" | "giveup" | null;
export interface SourceRow {
  source: string;
  label: string;
  state: RowState;
  count: number;
  /** Declared saved-count from the profile UI, when readable (else null). */
  expected: number | null;
  /** How a finished source ended — surfaced so a short/incomplete list never reads as a clean done. */
  quality: SourceQuality;
  /** Short right-aligned detail: "N of ~M", "N · short", "N · incomplete", "capturing…", or "pending". */
  detail: string;
}

export interface Banner {
  kind: "paused" | "halt";
  title: string;
  reason: string;
}

export interface ControlState {
  visible: boolean;
  enabled: boolean;
  label: string;
}
export interface Controls {
  start: ControlState;
  stop: ControlState;
  pause: ControlState;
  resume: ControlState;
}

export interface PopupViewModel {
  connection: Connection;
  state: CaptureState;
  stateLabel: string;
  stateTone: StateTone;
  count: number;
  countLabel: string;
  banner: Banner | null;
  rows: SourceRow[];
  controls: Controls;
}

/** The frozen display order, used when the reply omits `progress.order`. */
export const DEFAULT_SOURCE_ORDER: readonly string[] = ["favorites", "likes", "posts", "reposts"];

const SOURCE_LABELS: Record<string, string> = {
  favorites: "Favorites",
  likes: "Likes",
  posts: "Posts",
  reposts: "Reposts",
};

function titleCase(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

export function sourceLabel(source: string): string {
  return SOURCE_LABELS[source] ?? titleCase(source);
}

/** Group a non-negative integer with thousands separators, deterministically (no locale dependency). */
export function formatInt(n: number): string {
  const v = Math.max(0, Math.floor(Number.isFinite(n) ? n : 0));
  const s = String(v);
  let out = "";
  for (let i = 0; i < s.length; i++) {
    if (i > 0 && (s.length - i) % 3 === 0) out += ",";
    out += s[i];
  }
  return out;
}

/** Contract says counts are numbers; tolerate the legacy `{captured}` object shape too. */
function coerceCount(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return Math.max(0, Math.floor(v));
  if (v && typeof v === "object" && "captured" in v) {
    const c = (v as { captured?: unknown }).captured;
    if (typeof c === "number" && Number.isFinite(c)) return Math.max(0, Math.floor(c));
  }
  return 0;
}

/** Contract says expected is a number; anything non-numeric/negative → null (unknown declared count). */
function coerceExpected(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v) && v >= 0) return Math.floor(v);
  return null;
}

/** Normalize a per-source terminal status string to the display quality (unknown → null). */
function normalizeQuality(v: unknown): SourceQuality {
  return v === "done" || v === "suspicious" || v === "giveup" ? v : null;
}

/** On a CLEAN terminal, a captured count within this fraction of the declared total is treated as a
 *  complete match — the profile's declared count drifts by a few items between when it renders and when
 *  the sweep finishes, so we don't nag about a handful. Below it, the shortfall is surfaced as
 *  "~K unavailable": on a verified terminal we DID reach the end, so the gap is deleted/private/removed
 *  items the founder simply cannot capture — a legitimate, EXPECTED shortfall, distinct from the
 *  "· short" (suspicious) case where we never reached a clean end and truncation is suspected. */
export const UNAVAILABLE_DISPLAY_RATIO = 0.9;

/** The right-aligned per-source detail. "N of ~M" when a declared count is known; flags short/incomplete
 *  honestly, and on a clean terminal surfaces a real declared-vs-captured gap as "~K unavailable". */
function rowDetail(state: RowState, quality: SourceQuality, count: number, expected: number | null): string {
  if (state === "current") return "capturing…";
  if (state === "pending") return "pending";
  // state === "done": show the count against the declared total when known, and never hide a short/incomplete result.
  const of = expected != null ? `${formatInt(count)} of ~${formatInt(expected)}` : formatInt(count);
  if (quality === "suspicious") return `${of} · short`;
  if (quality === "giveup") return `${of} · incomplete`;
  // A verified-terminal ("done") capture that came in meaningfully below the declared count: the gap is
  // unavailable (deleted/private) items, not truncation. Surface it distinctly, and only past the drift
  // tolerance so a near-exact match reads clean.
  if (quality === "done" && expected != null && expected > 0 && count < UNAVAILABLE_DISPLAY_RATIO * expected) {
    return `${of} · ~${formatInt(expected - count)} unavailable`;
  }
  return of;
}

/** Pull a human reason string out of the (typed-as-unknown) halt payload. */
function haltReason(halt: unknown): string {
  if (typeof halt === "string" && halt.trim()) return halt.trim();
  if (halt && typeof halt === "object" && "reason" in halt) {
    const r = (halt as { reason?: unknown }).reason;
    if (typeof r === "string" && r.trim()) return r.trim();
  }
  return "A storage or database problem stopped capture. Your captured items are safe; free up disk space, then reload the extension.";
}

function pausedTitle(level: string | undefined): string {
  switch (level) {
    case "challenge":
    case "captcha":
      return "CAPTCHA — action needed";
    case "passcode":
      return "Passcode — action needed";
    case "break":
      return "Break screen — action needed";
    case "offline":
      return "You’re offline";
    case "flagged":
      return "Session check — action needed";
    default:
      return "Action needed";
  }
}

const hidden: ControlState = { visible: false, enabled: false, label: "" };

function controlsFor(state: CaptureState): Controls {
  switch (state) {
    case "capturing":
      return {
        start: hidden,
        stop: { visible: true, enabled: true, label: "Stop" },
        pause: { visible: true, enabled: true, label: "Pause" },
        resume: hidden,
      };
    case "paused":
      return {
        start: hidden,
        stop: { visible: true, enabled: true, label: "Stop" },
        pause: hidden,
        resume: { visible: true, enabled: true, label: "Resume" },
      };
    case "halted":
      // Nothing to drive — the banner explains the fix. Show a disabled primary so the popup never
      // looks blank-and-broken.
      return {
        start: { visible: true, enabled: false, label: "Capture halted" },
        stop: hidden,
        pause: hidden,
        resume: hidden,
      };
    case "done":
      return {
        start: { visible: true, enabled: true, label: "Sync again" },
        stop: hidden,
        pause: hidden,
        resume: hidden,
      };
    case "connecting":
      return {
        start: { visible: true, enabled: false, label: "Start capture" },
        stop: hidden,
        pause: hidden,
        resume: hidden,
      };
    case "idle":
    default:
      return {
        start: { visible: true, enabled: true, label: "Start capture" },
        stop: hidden,
        pause: hidden,
        resume: hidden,
      };
  }
}

export function countLabel(count: number): string {
  if (count <= 0) return "No videos captured yet";
  if (count === 1) return "1 video in your library";
  return `${formatInt(count)} videos in your library`;
}

/**
 * The one entry point. `status` is the latest `sync_status` reply (or null before the first success);
 * `connected` is whether that reply is FRESH (a poll just succeeded). A failed poll after a prior
 * success passes the last-known status with connected:false → the UI stays painted but flags
 * "reconnecting" rather than blanking.
 */
export function computeViewModel(
  status: SyncStatusRaw | null | undefined,
  opts: { connected: boolean },
): PopupViewModel {
  // No status yet at all → we are still reaching the service worker.
  if (status == null) {
    return {
      connection: "connecting",
      state: "connecting",
      stateLabel: "Starting…",
      stateTone: "neutral",
      count: 0,
      countLabel: "Connecting to the extension…",
      banner: null,
      rows: [],
      controls: controlsFor("connecting"),
    };
  }

  const connection: Connection = opts.connected ? "live" : "reconnecting";
  const count = coerceCount(status.count);
  const progress = status.progress ?? {};
  const order = progress.order && progress.order.length > 0 ? progress.order : [...DEFAULT_SOURCE_ORDER];
  const done = progress.done ?? [];
  const current = progress.current ?? null;
  const rawCounts = progress.counts ?? {};
  const rawExpected = progress.expected ?? {};
  const rawStatuses = progress.statuses ?? {};

  const rows: SourceRow[] = order.map((source) => {
    const cnt = coerceCount(rawCounts[source]);
    const expected = coerceExpected(rawExpected[source]);
    let rowState: RowState;
    if (done.includes(source)) rowState = "done";
    else if (source === current) rowState = "current";
    else rowState = "pending";
    // Quality only meaningful once a source has finished (is in `done`).
    const quality: SourceQuality = rowState === "done" ? normalizeQuality(rawStatuses[source]) : null;
    const detail = rowDetail(rowState, quality, cnt, expected);
    return { source, label: sourceLabel(source), state: rowState, count: cnt, expected, quality, detail };
  });
  // Any finished source that ended short or incomplete — the "done" headline must reflect it, not lie "all caught up".
  const hasGaps = rows.some((r) => r.state === "done" && (r.quality === "suspicious" || r.quality === "giveup"));

  // State precedence, most urgent first: an unrecoverable halt, then a user-actionable pause, then a
  // live run, then an all-done sweep, else idle.
  const halted = status.halt != null;
  const paused = status.paused != null;
  const running = status.running === true;
  const allDone = order.length > 0 && order.every((s) => done.includes(s));

  let state: CaptureState;
  if (halted) state = "halted";
  else if (paused) state = "paused";
  else if (running) state = "capturing";
  else if (allDone) state = "done";
  else state = "idle";

  let stateLabel: string;
  let stateTone: StateTone;
  switch (state) {
    case "halted":
      stateLabel = "Halted";
      stateTone = "error";
      break;
    case "paused":
      stateLabel = "Paused — waiting on you";
      stateTone = "warn";
      break;
    case "capturing":
      stateLabel = current ? `Capturing ${sourceLabel(current)}…` : "Capturing…";
      stateTone = "active";
      break;
    case "done":
      // Never lie "all caught up" when a source came up short or incomplete.
      stateLabel = hasGaps ? "Captured — some lists came up short" : "All caught up";
      stateTone = hasGaps ? "warn" : "done";
      break;
    case "idle":
    default:
      stateLabel = "Idle";
      stateTone = "idle";
      break;
  }

  let banner: Banner | null = null;
  if (halted) {
    banner = { kind: "halt", title: "Capture halted", reason: haltReason(status.halt) };
  } else if (paused && status.paused) {
    banner = {
      kind: "paused",
      title: pausedTitle(status.paused.level),
      reason:
        (status.paused.reason && status.paused.reason.trim()) ||
        "Capture is paused, waiting for you to act in the TikTok tab. Do the step there, then click Resume.",
    };
  }

  return {
    connection,
    state,
    stateLabel,
    stateTone,
    count,
    countLabel: countLabel(count),
    banner,
    rows,
    controls: controlsFor(state),
  };
}
