// The motion + completion DECISION for the TRUSTED-WHEEL capture lane — a PURE, NETWORK-driven reducer.
// Replaces scrollDrive.ts's geometry reducer for the wheel lane (live-observed 2026-07-13).
//
// THE SHAPE OF THE FIX. scrollDrive decided motion from GEOMETRY (scrollY / scrollHeight /
// clientHeight → atFrontier / hold / retrigger). On TikTok's custom/virtualized profile grid that
// geometry is UNRELIABLE — it misread "at frontier / stuck", so the retrigger UP-jiggle fired when it
// shouldn't and dragged the scroll back up ("barely moves down then goes back up"). Direct evidence
// from the live session: driving CONTINUOUS trusted DOWN-wheels (no up-jiggle, no hold) flew the real
// Liked grid 32→110 tiles in ~5s, smooth — a human just keeps scrolling down and TikTok paginates as
// you go; at the bottom, continued down-wheeling loads more. With a REAL wheel you cannot overshoot
// (TikTok clamps at the loaded bottom) and the IntersectionObserver re-fires naturally from continuous
// transit — so up-jiggles and holds are never needed. The whole frontier/hold/retrigger machinery was
// built for the (now-dead) programmatic-scroll world and is WRONG for trusted wheels.
//
// So the wheel lane keeps wheeling DOWN continuously while the run is active, and decides completion +
// stall PURELY on NETWORK arrivals (robust; geometry is not):
//  - a verified terminal (isTerminalPage on a HEALTHY transport, i.e. hasMore:false) ⇒ `done`;
//  - healthy `item_list` arrivals keep coming ⇒ keep wheeling (`advance`);
//  - NO new healthy arrival for STALL_MS AND not terminal ⇒ `giveup` (honest reported-incomplete).
// NO retrigger, NO up-jiggle, NO geometry.
//
// PURE: `nowMs` is injected (never read from a global clock), there is NO rng, and NO DOM access — the
// glue owns the frame loop, the wheel dispatch, the arrival tracking and the terminal-transport gate.
// Mirrors scrollDrive.ts / scrollState.ts / instrument.ts so this is a deterministic unit test.
//
// THE INVARIANT THAT MATTERS (unchanged): `done` is reachable ONLY from a verified terminal (`terminal`
// — a HEALTHY hasMore:false page per isTerminalPage). A stall with the loader dead is `giveup` — a
// DISTINCT, reported incomplete the glue surfaces with a reason, NEVER a silent stop and NEVER a false
// `done`.

export type WatchMode = "advance" | "done" | "giveup";

export interface WatchState {
  /** The last decided mode — the glue maps this to a scroll_mode / scroll_stop message. `done` is absorbing. */
  mode: WatchMode;
  /** nowMs when we last saw a HEALTHY arrival (the stall-timer anchor). */
  lastArrivalMs: number;
  /** nowMs at the last transition; observability only (HUD), never a decision input. */
  updatedAt: number;
}

export interface WatchInputs {
  /** Injected clock reading (the glue passes the current time in). */
  nowMs: number;
  /** A HEALTHY (transport:"ok") item_list arrived since the last observe tick — the "still paginating" proof. */
  healthyArrivedSince: boolean;
  /** A HEALTHY hasMore:false page was seen (isTerminalPage true) — the ONLY thing that yields `done`. */
  terminal: boolean;
}

/** No new healthy arrival for this long (and not terminal) ⇒ TikTok has stopped loading new pages: an
 *  honest `giveup`. Wide enough that a slow-loading next page (natural network wait between pages) is
 *  never mistaken for the end, but short enough that a truly dead loader is conceded within seconds. */
export const STALL_MS = 6000;

export function initialWatchState(nowMs: number): WatchState {
  return { mode: "advance", lastArrivalMs: nowMs, updatedAt: nowMs };
}

/**
 * The reducer. Given the current watch state and this observe tick's network facts, decide the next
 * mode and state. Pure and deterministic for a fixed (state, inputs).
 *
 * Rules (deliberately simple — geometry is gone):
 *  1. `terminal` ⇒ `done` (absorbing) — the ONLY completion.
 *  2. `healthyArrivedSince` ⇒ TikTok is still paginating: anchor the stall timer at now, keep wheeling
 *     down (`advance`).
 *  3. else, no healthy arrival for ≥ STALL_MS ⇒ `giveup` — the loader is dead, report incomplete.
 *  4. else (still inside the stall interval) ⇒ keep wheeling down (`advance`); the next page may be loading.
 */
export function stepWatch(state: WatchState, inputs: WatchInputs): { state: WatchState; mode: WatchMode } {
  const { nowMs, healthyArrivedSince, terminal } = inputs;

  // `done` is absorbing — a verified terminal never re-opens capture.
  if (state.mode === "done") {
    return { state: { ...state, updatedAt: nowMs }, mode: "done" };
  }

  // 1. A verified terminal (healthy hasMore:false) is the ONLY `done`.
  if (terminal) {
    return {
      state: { mode: "done", lastArrivalMs: state.lastArrivalMs, updatedAt: nowMs },
      mode: "done",
    };
  }

  // 2. A healthy page arrived ⇒ still paginating: re-anchor the stall timer at now, keep wheeling down.
  if (healthyArrivedSince) {
    return {
      state: { mode: "advance", lastArrivalMs: nowMs, updatedAt: nowMs },
      mode: "advance",
    };
  }

  // 3. No new healthy arrival for STALL_MS and no verified terminal ⇒ an honest reported-incomplete.
  if (nowMs - state.lastArrivalMs >= STALL_MS) {
    return {
      state: { mode: "giveup", lastArrivalMs: state.lastArrivalMs, updatedAt: nowMs },
      mode: "giveup",
    };
  }

  // 4. Still inside the stall interval ⇒ keep wheeling down; the next page may still be loading.
  return {
    state: { mode: "advance", lastArrivalMs: state.lastArrivalMs, updatedAt: nowMs },
    mode: "advance",
  };
}
