// Physical-motion decision + lazy-load recovery ladder — the §6.1 SCROLL-01 fix, as a pure module.
//
// Root cause it fixes (spec §1, §6.1): the old `scrollTop = scrollHeight` teleport never makes
// TikTok's sentinel leave→re-enter the viewport, so its edge-triggered IntersectionObserver never
// re-fires and no next page is fetched. The (correct) stall reducer in `scrollState.ts` then
// misreads "no new page" as server backpressure and false-gives-up ("1,437 then stall"). This
// module sits IN FRONT of `scrollState`: it distinguishes three causes of "nothing arrived" and
// only ever hands `scrollState` a `tick` (via a `stall`/`backoff` command) once its own recovery
// ladder is exhausted.
//
//   - arrived           → progress: incremental jittered wheel-DOWN transit (never a teleport).
//   - no arrival, a request WAS issued since the last arrival (empty page / 429 / throttle)
//                       → genuine server backpressure: `backoff` (retriggering can't fix a server).
//   - no arrival, NO request was even issued (our motion didn't re-arm the sentinel)
//                       → self-inflicted lazy-load stall: up-then-down `retrigger` to force the
//                         sentinel to leave and re-enter; only after MAX_RETRIGGERS also fail, a
//                         confirmed `stall` handed up to the unchanged `scrollState` as a `tick`.
//
// The decisive discriminator (spec §6.1 §A4): main-world.js bumps a monotonic `requestsIssued`
// when an `item_list` request is *initiated*. `lastRequestCount` snapshots that count at the last
// ARRIVAL; a later no-arrival step with `requestsIssued > lastRequestCount` means a request went
// out and came back empty (backpressure), while `requestsIssued === lastRequestCount` means no
// request even fired (self-inflicted — retrigger can fix it).
//
// PURE: `rng` is injected (never drawn from a global RNG), `now` is passed in (never read from a
// global clock), and there is NO DOM access — the glue owns wheel dispatch, up-distance clamping,
// and the wait. Mirrors instrument.ts / pacing.ts / scrollState.ts so this is a deterministic unit
// test, not a vibe.

/** Incremental wheel-down transit band (px). puppeteer-autoscroll-down uses ~250px; TikTok tiles
 *  are large, so 400–900 is the researched band. Jittered every step — a constant delta is the #1
 *  anti-bot tell alongside the teleport (PACE-03). */
export const DOWN_PX_MIN = 400;
export const DOWN_PX_MAX = 900;

/** Up-then-down re-trigger band (px) — the DESIRED up distance. The glue CLAMPS the actual up
 *  distance to `maxSafeUpPx` (it must stay above the topmost live tile, or eviction throws the live
 *  tile range away — §6.4). This module never returns an upPx larger than UP_PX_MAX. */
export const UP_PX_MIN = 300;
export const UP_PX_MAX = 600;

/** Self-inflicted-stall retriggers to attempt per no-arrival episode before conceding a `stall`. */
export const MAX_RETRIGGERS = 3;

export type MotionPhase = "stepping" | "retriggering" | "stalled";

export interface MotionState {
  phase: MotionPhase;
  /** Consecutive step() calls with no new arrival. Reset to 0 on arrival. */
  noArrivalStreak: number;
  /** Retriggers tried in the CURRENT no-arrival episode. Reset to 0 on arrival. */
  retriggerAttempts: number;
  /** `requestsIssued` snapshot at the last ARRIVAL — the discriminator baseline (see file header). */
  lastRequestCount: number;
  /** now() at the last transition; observability only (HUD), never a decision input. */
  updatedAt: number;
}

export interface MotionInputs {
  /** Injected clock reading (observability only). */
  now: number;
  /** A new `item_list` message arrived since the last step. */
  arrivedSinceLast: boolean;
  /** Monotonic count of `item_list` requests INITIATED (from main-world). */
  requestsIssued: number;
  /** ms the glue waited-for-content since the last `down` before calling step. The glue OWNS the
   *  wait — every call to step() is treated as post-wait — so this is carried for observability and
   *  future evidence-adaptive tuning (COMPL-04), not branched on here. */
  dwellElapsedMs: number;
}

export type MotionCommand =
  | { kind: "down"; px: number }        // incremental jittered wheel-down transit (normal progress)
  | { kind: "retrigger"; upPx: number } // scroll UP upPx then back down past prior max → re-fire the IO
  | { kind: "stall" }                   // confirmed self-inflicted stall → glue feeds scrollState a `tick`
  | { kind: "backoff" };                // real backpressure (request issued, no arrival) → glue feeds
                                        // scrollState a `tick` too, but this is the "server said wait" branch

export interface MotionDeps {
  rng: () => number;
}

/** A jittered, integer, band-clamped pixel delta. Full-range rng-driven (PACE-03) — never a fixed
 *  step. Clamped so an out-of-range rng can never breach the band (e.g. upPx > UP_PX_MAX). */
function jitterPx(r: number, min: number, max: number): number {
  const px = Math.round(min + r * (max - min));
  return Math.min(Math.max(px, min), max);
}

export function initialMotionState(now: number): MotionState {
  return {
    phase: "stepping",
    noArrivalStreak: 0,
    retriggerAttempts: 0,
    lastRequestCount: 0,
    updatedAt: now,
  };
}

/**
 * The physical-motion reducer. Given the current motion state and this step's inputs, decide the
 * next physical command and the next state. Pure and deterministic for a fixed (state, inputs, rng).
 */
export function stepMotion(
  state: MotionState,
  inputs: MotionInputs,
  deps: MotionDeps,
): { state: MotionState; command: MotionCommand } {
  const { now, arrivedSinceLast, requestsIssued } = inputs;

  // 1. Arrival → progress. Reset the episode (streak + retriggers), keep stepping DOWN, and snapshot
  //    the request baseline so the next no-arrival step can tell "a request fired" from "none did".
  if (arrivedSinceLast) {
    return {
      state: {
        phase: "stepping",
        noArrivalStreak: 0,
        retriggerAttempts: 0,
        lastRequestCount: requestsIssued,
        updatedAt: now,
      },
      command: { kind: "down", px: jitterPx(deps.rng(), DOWN_PX_MIN, DOWN_PX_MAX) },
    };
  }

  // No arrival on this step. The episode's streak grows regardless of which branch we take.
  const noArrivalStreak = state.noArrivalStreak + 1;

  // 2. A request WAS initiated since the last arrival but nothing came back → genuine server
  //    backpressure (empty page / 429 / throttle). Retriggering can't fix a server, so `backoff`.
  //    `lastRequestCount` is deliberately NOT advanced here: the outstanding request stays
  //    unanswered, so subsequent steps keep reading as backpressure (never flip to retrigger).
  if (requestsIssued > state.lastRequestCount) {
    return {
      state: { ...state, phase: "stalled", noArrivalStreak, updatedAt: now },
      command: { kind: "backoff" },
    };
  }

  // 3. No arrival AND no request even fired (requestsIssued === lastRequestCount) → self-inflicted
  //    lazy-load stall: our motion didn't re-arm the sentinel. Try an up-then-down retrigger until
  //    the budget is spent, then concede a confirmed `stall` for `scrollState` to bound as a tick.
  if (state.retriggerAttempts < MAX_RETRIGGERS) {
    return {
      state: {
        ...state,
        phase: "retriggering",
        noArrivalStreak,
        retriggerAttempts: state.retriggerAttempts + 1,
        updatedAt: now,
      },
      command: { kind: "retrigger", upPx: jitterPx(deps.rng(), UP_PX_MIN, UP_PX_MAX) },
    };
  }

  return {
    state: { ...state, phase: "stalled", noArrivalStreak, updatedAt: now },
    command: { kind: "stall" },
  };
}
