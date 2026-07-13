// Run deadline — an overall wall-clock cap per source-run (§4 "hung-loop with no heartbeat / no
// wall-clock deadline"). The liveness watchdog (watchdog.ts) re-nudges a run that STOPPED getting pages;
// the stall reducer (scrollWatch.ts) concedes ~STALL_MS after the last page. But a run that keeps
// FLAPPING — pause/resume/retrigger churn, a slow-but-alive loader, an overlay loop — could in principle
// grind for a very long time. This is the absolute ceiling: past the deadline, conclude honestly
// (giveup with a reason) so a wedged run can never hang overnight.
//
// PURE: the run-start time + an injected `now` in, a boolean/remaining out. The glue owns the clock and
// the "conclude + notify + release the lease" side effects, so "a run past its cap concedes" is a test.

/** Generous per-source-run wall-clock cap. A single source with >20 min of continuous NEW pages is
 *  enormous (thousands of items); anything hitting this is far more likely wedged/flapping than genuinely
 *  still productive — and it still concludes as an HONEST reported-incomplete, never a false done. */
export const RUN_DEADLINE_MS = 20 * 60_000;

/** The user-visible reason surfaced when a run hits its deadline — honest + actionable, never a fake done. */
export const RUN_DEADLINE_REASON =
  "capture hit its 20-minute time cap for this source and stopped so it can't hang. Click Sync again to continue.";

/** Has the run started at `startedMs` run past its deadline as of `nowMs`? */
export function isPastDeadline(startedMs: number, nowMs: number, deadlineMs: number = RUN_DEADLINE_MS): boolean {
  return nowMs - startedMs >= deadlineMs;
}

/** Milliseconds of budget left before the deadline (clamped at 0). Observability only. */
export function remainingMs(startedMs: number, nowMs: number, deadlineMs: number = RUN_DEADLINE_MS): number {
  return Math.max(0, deadlineMs - (nowMs - startedMs));
}
