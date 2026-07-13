// Liveness watchdog (no silent hangs). scrollWatch already concedes a stalled run at STALL_MS (6s) — an
// honest `giveup`. But a WEDGED run (the tab backgrounded and its loader parked, an IntersectionObserver
// that never re-fired) deserves a nudge before we concede: re-trigger the lazy-loader and give it another
// interval. This PURE reducer owns exactly that bounded-retry decision so "a hung run self-reports and is
// re-nudged a bounded number of times, then honestly concedes" is a unit test, not a hope.
//
// The glue calls stepWatchdog ONLY when scrollWatch yields a STALL giveup (not a terminal, not a detach,
// not an http_error halt). On `retry` the glue: raises a "stalled — retrying" notice, sends a retrigger
// nudge (an up-burst that re-arms the loader), and re-anchors the stall interval. On `concede` the run
// ends as the honest reported-incomplete it already was. Resets to zero retries on any healthy arrival.

/** Re-nudge attempts on a wedged run before conceding. Small — a truly dead loader shouldn't be chased. */
export const MAX_WEDGE_RETRIES = 2;

export interface WatchdogState {
  /** Nudges spent on the current wedge (reset to 0 by the glue on any healthy arrival). */
  retries: number;
}

export type WatchdogAction = "retry" | "concede";

export function initialWatchdog(): WatchdogState {
  return { retries: 0 };
}

/**
 * Decide whether to re-nudge a stalled run or concede. Pure: same state ⇒ same result. `retry` consumes
 * one of the bounded budget (state advances); `concede` once the budget is spent.
 */
export function stepWatchdog(state: WatchdogState): { state: WatchdogState; action: WatchdogAction } {
  if (state.retries < MAX_WEDGE_RETRIES) {
    return { state: { retries: state.retries + 1 }, action: "retry" };
  }
  return { state, action: "concede" };
}
