// The capture supervisor — a PURE source-sequencing + resume state machine, mirroring queue.ts.
//
// It answers ONE question deterministically: given where we are (`progress`, persisted to the store's
// `meta` under SUPERVISOR_META_KEY) and what just happened (`event`), what should the glue do next
// (`action`)? All I/O — the store, the tab, the scroll engine — lives in background.ts's thin glue;
// this module has no globals, no Date.now, no chrome.*. That is the whole point: "a mid-source
// service-worker death resumes the RIGHT source" is a unit test, not a hope.
//
// The durability contract (same spine as queue.ts):
//   1. The glue PERSISTS `progress` the instant it emits `capture_source` (current = that source),
//      BEFORE driving the tab. If the worker dies mid-source, persisted `current` is that source.
//   2. On the next wake, the revival alarm feeds a `restarted` event; with `current` still set we
//      return `capture_source {current, resuming:true}` — re-scroll the source from the top. Capture
//      is idempotent (dedup by id), so re-scrolling the already-captured prefix loses nothing; the
//      `resuming:true` flag is the carry-forward-1 signal so that re-scroll doesn't prematurely
//      `giveup` on the all-duplicate prefix (see scrollState.ts).
//   3. `source_finished` records the source's terminal (done OR giveup — a partial source is recorded
//      and sequenced past, never silently retried forever) and advances to the next undone source.

export type Source = "favorites" | "likes" | "posts" | "reposts";

/** The frozen capture order. Favorites first (the wedge), then likes, posts, reposts. */
export const SOURCES: readonly Source[] = ["favorites", "likes", "posts", "reposts"] as const;

/** Store `meta` key holding the persisted SupervisorProgress blob (the resume checkpoint). */
export const SUPERVISOR_META_KEY = "capture_supervisor";

export type SourceStatus = "done" | "giveup";

export interface SourceProgress {
  /** Records reported captured by the source's scroll_done (the run's `captured`). */
  captured: number;
  /** How the source ended: `done` = TikTok's own hasMore:false; `giveup` = a reported incomplete. */
  status: SourceStatus;
}

export interface SupervisorProgress {
  /** The source currently being driven (persisted BEFORE driving → the crash-resume anchor). Null = none in flight. */
  current: Source | null;
  /** Sources that have reached a terminal (done or giveup) — i.e. enumerated THIS sweep; skipped on the next pick. */
  done: Source[];
  /** Per-source captured count + terminal status, for the HUD/popup and the completeness audit. */
  counts: Partial<Record<Source, SourceProgress>>;
  /**
   * THIS sweep's capture order (fix round 1). A fresh sweep started after a terminal sweep puts the
   * previously-partial ("giveup") sources first — their uncaptured tails are the most urgent work.
   * Absent (first-ever sweep, or persisted blobs from before this fix) ⇒ SOURCES order.
   */
  order?: Source[];
  /**
   * Sources this sweep must drive with resuming:true (fix round 1): the previously-partial sources —
   * their prefix is already captured, so only the resume grace (carry-forward 1) lets the re-scroll
   * get past the all-duplicate prefix to the uncaptured tail. Absent ⇒ none.
   */
  retry?: Source[];
  /**
   * Wall-clock (ms) when `current` was last (re-)set to a source about to be driven. Fix round 2
   * (#5) — the GLUE stamps/clears this (the reducer stays pure, no clock); the alarm abandons a
   * `current` older than a day so a stale in-flight source can't steer an unattended re-drive. Absent
   * on a fresh/idle progress and on pre-fix persisted blobs (treated as not-stale for one resume).
   */
  currentStartedAt?: number;
}

export type SupervisorEvent =
  | { kind: "start" } // a fresh Sync click: begin / continue the sequence (never stomps a live run)
  | { kind: "restarted" } // process came back after a crash: resume the in-flight source if any
  | { kind: "source_finished"; source: Source; captured: number; status: SourceStatus };

export type SupervisorAction =
  | { kind: "capture_source"; source: Source; resuming: boolean }
  | { kind: "all_done" }
  | { kind: "idle" };

export function initialProgress(): SupervisorProgress {
  return { current: null, done: [], counts: {} };
}

/** First source, in the sweep's order (default SOURCES), not yet in `done`. Null ⇒ sweep complete. */
function firstUndone(progress: SupervisorProgress): Source | null {
  for (const s of progress.order ?? SOURCES) if (!progress.done.includes(s)) return s;
  return null;
}

/**
 * Advance to the next undone source — or all_done. `resuming` is true for this sweep's `retry`
 * sources (previously-partial: captured prefix, uncaptured tail — see SupervisorProgress.retry).
 * Refuses to pick a new source while one is still marked current (returns idle): the glue's
 * `supervisorRunning` guard is the belt, this is the suspenders against ever double-driving a live tab.
 */
function advance(progress: SupervisorProgress): { progress: SupervisorProgress; action: SupervisorAction } {
  if (progress.current != null) return { progress, action: { kind: "idle" } };
  const next = firstUndone(progress);
  if (next == null) return { progress: { ...progress, current: null }, action: { kind: "all_done" } };
  const resuming = progress.retry?.includes(next) ?? false;
  return { progress: { ...progress, current: next }, action: { kind: "capture_source", source: next, resuming } };
}

/** Every source terminal this sweep, nothing in flight ⇒ the sweep is over. */
function sweepComplete(progress: SupervisorProgress): boolean {
  return progress.current == null && SOURCES.every((s) => progress.done.includes(s));
}

/**
 * Fix round 1 (CRITICAL): a terminal sweep must never brick Sync. Start a FRESH sweep: reset
 * done/counts, order the previously-partial ("giveup") sources FIRST, and mark them `retry` so they
 * are driven with resuming:true — the resume grace (carry-forward 1) is what lets the re-scroll get
 * past their captured prefix to the uncaptured tail a mid-sweep giveup left behind. Previously-done
 * sources re-sweep fresh (resuming:false): idempotent dedup makes that cheap, and any NEW saves sit
 * at the top of the list where a fresh scroll captures them immediately.
 */
function freshSweep(prev: SupervisorProgress): { progress: SupervisorProgress; action: SupervisorAction } {
  const partials = SOURCES.filter((s) => prev.counts[s]?.status === "giveup");
  const order = [...partials, ...SOURCES.filter((s) => !partials.includes(s))];
  return advance({ current: null, done: [], counts: {}, order, retry: partials });
}

/**
 * The reducer. Pure: `(progress, event) → { progress, action }`. The glue persists the returned
 * progress, then dispatches the action (open/focus tab, tell content.js to capture the source, etc.).
 */
export function nextAction(
  progress: SupervisorProgress,
  event: SupervisorEvent,
): { progress: SupervisorProgress; action: SupervisorAction } {
  switch (event.kind) {
    case "start":
      // A live run must never be stomped by a second Sync click — advance() returns idle if current
      // is set. A COMPLETE sweep (every source terminal) starts over as a fresh sweep (fix round 1:
      // giveup is not terminal-forever, and new saves must always be able to sync). Otherwise, pick
      // the first undone source of the current sweep.
      if (sweepComplete(progress)) return freshSweep(progress);
      return advance(progress);

    case "restarted":
      // Crash recovery: an in-flight source (persisted current) is re-driven with resuming:true. With
      // nothing in flight this is a plain advance (the alarm woke us but no source was mid-run).
      if (progress.current != null) {
        return { progress, action: { kind: "capture_source", source: progress.current, resuming: true } };
      }
      return advance(progress);

    case "source_finished": {
      // Record the terminal, drop the finished source from `current`, then advance. `done` is a set
      // (no duplicate on a late/repeated scroll_done). A giveup is recorded and sequenced PAST — the
      // supervisor never silently retries; a partial source is an honest, visible partial.
      const counts = { ...progress.counts, [event.source]: { captured: event.captured, status: event.status } };
      const done = progress.done.includes(event.source) ? progress.done : [...progress.done, event.source];
      const current = progress.current === event.source ? null : progress.current;
      // Spread keeps this sweep's order/retry — the partials-first walk survives every advance.
      return advance({ ...progress, current, done, counts });
    }
  }
}

/**
 * Carry-forward (2), Task 5 — the source-tagged-arrival gate. After the supervisor switches sources,
 * an in-flight item_list straggler from the PREVIOUS source can still be delivered; if it drove the
 * new run's scroll signals it would inject the old source's `hasMore` (a false `done` or a phantom
 * page). The content-script glue applies this gate: only an arrival whose source matches the active
 * run's expected source may drive that run's completion signals. A null expected source is the manual
 * Alt+Shift+A dev path (no supervisor tag) → accept everything, preserving today's behavior.
 *
 * NOTE: this gates the run's SCROLL signals only — items themselves are still stored regardless (the
 * store's upsert is idempotent and unions sources), so a straggler is never lost, just never allowed
 * to end the wrong run.
 */
export function arrivalDrivesRun(expectedSource: Source | null, arrivalSource: string | null | undefined): boolean {
  if (expectedSource == null) return true;
  return arrivalSource === expectedSource;
}
