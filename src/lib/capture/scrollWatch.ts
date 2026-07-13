// The motion + completion DECISION for the TRUSTED-WHEEL capture lane — a PURE, NETWORK-driven reducer.
// Replaces scrollDrive.ts's geometry reducer for the wheel lane (live-observed 2026-07-13).
//
// THE SHAPE OF THE FIX. scrollDrive decided motion from GEOMETRY (scrollY / scrollHeight /
// clientHeight → atFrontier / hold / retrigger). On TikTok's custom/virtualized profile grid that
// geometry is UNRELIABLE — it misread "at frontier / stuck", so the retrigger UP-jiggle fired when it
// shouldn't and dragged the scroll back up ("barely moves down then goes back up"). Direct evidence
// from the live session: driving CONTINUOUS trusted DOWN-wheels flew the real Liked grid 32→110 tiles
// in ~5s, smooth — a human just keeps scrolling down and TikTok paginates as you go.
//
// SO THE WHEEL LANE KEEPS WHEELING DOWN and decides completion + stall PURELY on NETWORK arrivals. But
// a GENUINE stall (the loader parked — no new page arriving) still needs the up-nudge that re-arms
// TikTok's edge-triggered lazy-loader — the LIVE symptom was "when it gets stuck it tries scrolling down
// 4-6 times before it realizes it needs to scroll up", i.e. it wheeled down uselessly until the 6s
// giveup. The fix (2026-07-13): re-add the up-nudge as a `retrigger` mode, but gated on the NETWORK
// stall (no healthy arrival), NOT on viewport geometry — so it NEVER fires during healthy scrolling and
// fires FAST (~1.8s) when truly stuck. This is NOT the old bug: the old up-jiggle fired on the flaky
// viewport-geometry "at frontier" read even mid-healthy-scroll; this fires ONLY on an arrival-stall, and a
// healthy arrival at any point resets it.
//
// The lanes, decided off healthy `item_list` arrivals + the terminal-transport gate:
//  - a verified terminal (isTerminalPage on a HEALTHY transport, hasMore:false) ⇒ `done`;
//  - healthy arrivals keep coming ⇒ keep wheeling (`advance`), reset the stall timer + retrigger budget;
//  - no healthy arrival for RETRIGGER_AFTER_MS ⇒ `retrigger` (an up-nudge), repeated ~every
//    RETRIGGER_COOLDOWN_MS up to MAX_RETRIGGERS times (each nudge gets time to work);
//  - the nudges spent AND still stalled past the overall STALL_MS ceiling ⇒ honest `giveup`.
//
// PURE: `nowMs` is injected (never read from a global clock), there is NO rng, and NO DOM access — the
// glue owns the frame loop, the wheel dispatch, the arrival tracking and the terminal-transport gate.
// Mirrors scrollDrive.ts / scrollState.ts / instrument.ts so this is a deterministic unit test.
//
// THE INVARIANT THAT MATTERS (unchanged): `done` is reachable ONLY from a verified terminal (`terminal`
// — a HEALTHY hasMore:false page per isTerminalPage). A stall with the loader dead is `giveup` — a
// DISTINCT, reported incomplete the glue surfaces with a reason, NEVER a silent stop and NEVER a false
// `done`.

export type WatchMode = "advance" | "retrigger" | "done" | "giveup";

export interface WatchState {
  /** The last decided mode — the glue maps this to a scroll_mode / scroll_stop message. `done` is absorbing. */
  mode: WatchMode;
  /** nowMs when we last saw a HEALTHY arrival (the stall-timer anchor). */
  lastArrivalMs: number;
  /** Up-nudges spent since the last healthy arrival (reset to 0 on every healthy arrival). */
  retriggers: number;
  /** nowMs of the last up-nudge — enforces RETRIGGER_COOLDOWN_MS between nudges. */
  lastRetriggerMs: number;
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

/** No healthy arrival for THIS long ⇒ a genuine stall: fire the first up-nudge (`retrigger`) to re-arm
 *  TikTok's edge-triggered lazy-loader. FAST (~1.8s) so a stuck run doesn't wheel down uselessly for 6s;
 *  wide enough that a slow-but-healthy next page (it re-anchors the timer on arrival) is never nudged. */
export const RETRIGGER_AFTER_MS = 1800;

/** Minimum gap between consecutive up-nudges — each nudge gets time to work before the next fires, so we
 *  don't machine-gun up-bursts (which would drag the scroll up, the old bug's failure mode). */
export const RETRIGGER_COOLDOWN_MS = 1200;

/** How many up-nudges to try on a genuine stall before conceding. ~4 nudges over ~5s, then giveup. */
export const MAX_RETRIGGERS = 4;

/** The overall giveup ceiling: once the up-nudges are spent AND no healthy arrival has come for this long,
 *  TikTok has stopped loading new pages — an honest `giveup` (reported incomplete). Wide enough that the
 *  last nudge had time to work; unchanged from the pre-retrigger ceiling so the run's max stall is the same. */
export const STALL_MS = 6000;

export function initialWatchState(nowMs: number): WatchState {
  return { mode: "advance", lastArrivalMs: nowMs, retriggers: 0, lastRetriggerMs: nowMs, updatedAt: nowMs };
}

/**
 * The reducer. Given the current watch state and this observe tick's network facts, decide the next
 * mode and state. Pure and deterministic for a fixed (state, inputs).
 *
 * Rules (ordered):
 *  1. `terminal` ⇒ `done` (absorbing) — the ONLY completion.
 *  2. `healthyArrivedSince` ⇒ TikTok is still paginating: re-anchor the stall timer at now, clear the
 *     retrigger budget, keep wheeling down (`advance`). A healthy arrival at ANY point rescues the run.
 *  3. else no arrival for ≥ RETRIGGER_AFTER_MS, with nudges left and the cooldown elapsed ⇒ `retrigger`
 *     (an up-nudge; the glue's SW pump does the actual UP-burst). Consumes one nudge.
 *  4. else the nudges are spent AND no arrival for ≥ STALL_MS ⇒ `giveup` — the loader is dead, report incomplete.
 *  5. else ⇒ keep wheeling down (`advance`) — waiting on a nudge to land / the next page to load.
 */
export function stepWatch(state: WatchState, inputs: WatchInputs): { state: WatchState; mode: WatchMode } {
  const { nowMs, healthyArrivedSince, terminal } = inputs;

  // `done` is absorbing — a verified terminal never re-opens capture.
  if (state.mode === "done") {
    return { state: { ...state, updatedAt: nowMs }, mode: "done" };
  }

  // 1. A verified terminal (healthy hasMore:false) is the ONLY `done`.
  if (terminal) {
    return { state: { ...state, mode: "done", updatedAt: nowMs }, mode: "done" };
  }

  // 2. A healthy page arrived ⇒ still paginating: re-anchor the stall timer + clear the nudge budget.
  //    (lastRetriggerMs is left as-is — a fresh stall waits RETRIGGER_AFTER_MS anyway, which exceeds the
  //    cooldown, so the first nudge after an arrival is never spuriously blocked.)
  if (healthyArrivedSince) {
    return {
      state: { mode: "advance", lastArrivalMs: nowMs, retriggers: 0, lastRetriggerMs: state.lastRetriggerMs, updatedAt: nowMs },
      mode: "advance",
    };
  }

  const dt = nowMs - state.lastArrivalMs;

  // 3. A genuine stall (no healthy arrival): fire an up-nudge if we still have budget AND the cooldown
  //    since the last nudge has elapsed. Preferred over giveup as long as nudges remain (exhaust them first).
  if (
    dt >= RETRIGGER_AFTER_MS &&
    state.retriggers < MAX_RETRIGGERS &&
    nowMs - state.lastRetriggerMs >= RETRIGGER_COOLDOWN_MS
  ) {
    return {
      state: {
        mode: "retrigger",
        lastArrivalMs: state.lastArrivalMs,
        retriggers: state.retriggers + 1,
        lastRetriggerMs: nowMs,
        updatedAt: nowMs,
      },
      mode: "retrigger",
    };
  }

  // 4. Nudges spent and still stalled past the overall ceiling ⇒ honest reported-incomplete.
  if (state.retriggers >= MAX_RETRIGGERS && dt >= STALL_MS) {
    return {
      state: { ...state, mode: "giveup", updatedAt: nowMs },
      mode: "giveup",
    };
  }

  // 5. Still waiting (inside the retrigger cooldown, or a nudge just fired) ⇒ keep wheeling down.
  return {
    state: { ...state, mode: "advance", updatedAt: nowMs },
    mode: "advance",
  };
}
