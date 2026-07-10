// The motion + completion DECISION for the continuous-scroll capture driver — a PURE, geometry-driven
// reducer (Wave A capture-resilience §6.1, the re-founded motion). Replaces the old discrete
// step-then-dwell machine (scrollMotion.ts + pacing.ts + scrollState's giveup ladder in the hot path).
//
// THE SHAPE OF THE FIX. The old capture "stuttered along the scrollbar" and "backed off for no reason":
// it scrolled ONE 400–900px nudge, then sat for a jittered 900–2200ms human-cadence dwell, then decided
// again (~600px/~1.5s ≈ a crawl), and an in-flight-request "backpressure" heuristic escalated to a
// 2s→60s exponential backoff. All of that existed to dodge a "~360-item soft throttle" the founder has
// since DISPROVEN (he scrolls his 10k+ list by hand, fast, no blocker). So the motion is re-founded as
// ONE CONTINUOUS, SELF-PACING scroll: the glue's rAF driver advances a small fixed step every frame but
// NEVER past the loaded bottom (the frontier clamp IS the pacing — fast while content is ahead, naturally
// waiting at the frontier until scrollHeight grows). This module owns only the geometry DECISION the
// driver reads and the completion/exhaustion verdict.
//
// PURE: `nowMs` is injected (never read from a global clock), there is NO rng, and NO DOM access — the
// glue owns the frame loop, the DOM reads (scrollTop/scrollHeight/clientHeight, growth, the terminal
// transport gate) and the physical motion. Mirrors scrollState.ts / scrollMotion.ts / instrument.ts so
// this is a deterministic unit test, not a vibe (invariant §5.1: every decision in a pure module behind
// thin glue).
//
// THE INVARIANT THAT MATTERS (unchanged from scrollState.ts): `done` is reachable ONLY from a verified
// terminal (`terminal` — a HEALTHY hasMore:false page per isTerminalPage). Reaching the bottom with the
// loader dead is `exhausted` — a DISTINCT, reported incomplete the glue surfaces with a reason, NEVER a
// silent stop and NEVER a false `done`.

export type DriveMode = "advance" | "hold" | "retrigger" | "done" | "exhausted";

export interface DriveState {
  /** The last decided mode — the glue's rAF driver reads this. `done` is absorbing. */
  mode: DriveMode;
  /** nowMs when we last saw content grow (scrollHeight OR healthy arrivals). The stuck-timer anchor. */
  lastGrowthMs: number;
  /** Retrigger jiggles spent in the CURRENT stuck episode. Reset to 0 on any growth. */
  stuckRetriggers: number;
  /** nowMs at the last transition; observability only (HUD), never a decision input. */
  updatedAt: number;
}

export interface DriveInputs {
  /** Injected clock reading (the glue passes the current time in). */
  nowMs: number;
  /** The effective scroll target's current scrollTop. */
  scrollTop: number;
  /** The effective scroll target's scrollHeight (post-eviction — a moving value, which is fine). */
  scrollHeight: number;
  /** The effective scroll target's clientHeight (viewport height of the scroller). */
  clientHeight: number;
  /** scrollHeight grew OR healthy arrivals grew since the last observe tick (network growth is the
   *  robust signal — eviction can shrink scrollHeight even as new pages land). */
  grewSinceLast: boolean;
  /** A HEALTHY hasMore:false page was seen (isTerminalPage true) — the ONLY thing that yields `done`. */
  terminal: boolean;
}

/** "At the frontier" if scrollTop is within FRONTIER_GAP_FRAC·clientHeight of the loaded bottom. A
 *  fraction (not a fixed px) so it scales with the viewport; 0.75 keeps us close enough that the
 *  loader's sentinel stays in view without demanding a pixel-perfect bottom. */
export const FRONTIER_GAP_FRAC = 0.75;

/** At the frontier this long with NO growth ⇒ the lazy-loader isn't firing on its own — jiggle it. Kept
 *  short so a genuinely-loading next page (a brief natural wait) doesn't get jiggled, but a truly stuck
 *  loader is nudged within a couple of seconds rather than the old multi-second freezes. */
export const STUCK_MS = 2500;

/** Retrigger jiggles at the frontier before conceding `exhausted` (an honest reported-incomplete).
 *  Each jiggle gets a fresh STUCK_MS interval to work, so this is ~MAX_STUCK_RETRIGGERS·STUCK_MS of
 *  bounded effort (~10s) before we report the bottom as unreachable. */
export const MAX_STUCK_RETRIGGERS = 4;

export function initialDriveState(nowMs: number): DriveState {
  return { mode: "advance", lastGrowthMs: nowMs, stuckRetriggers: 0, updatedAt: nowMs };
}

/**
 * The reducer. Given the current drive state and this observe tick's geometry/growth facts, decide the
 * next mode and state. Pure and deterministic for a fixed (state, inputs).
 *
 * Rules (kept deliberately simple — a few clear cases, not an elaborate state machine):
 *  1. `terminal` ⇒ `done` (absorbing) — the ONLY completion.
 *  2. `grewSinceLast` ⇒ the loader is working: anchor the stuck timer at now, clear the jiggle count.
 *  3. `!atFrontier` ⇒ `advance` — loaded content is ahead; the driver scrolls fast toward it.
 *  4. `atFrontier` & grew within STUCK_MS ⇒ `hold` — the next page is loading; sit at the frontier so
 *     the loader keeps firing.
 *  5. `atFrontier` & stuck ≥ STUCK_MS & jiggles remain ⇒ `retrigger` (spend one, and RESET the stuck
 *     timer so the jiggle gets a fresh STUCK_MS to produce a page).
 *  6. `atFrontier` & stuck & jiggles exhausted ⇒ `exhausted` — reported incomplete, never a false done.
 */
export function stepDrive(state: DriveState, inputs: DriveInputs): { state: DriveState; mode: DriveMode } {
  const { nowMs, scrollTop, scrollHeight, clientHeight, grewSinceLast, terminal } = inputs;

  // `done` is absorbing — a verified terminal never re-opens capture.
  if (state.mode === "done") {
    return { state: { ...state, updatedAt: nowMs }, mode: "done" };
  }

  // 1. A verified terminal (healthy hasMore:false) wins over all geometry — the ONLY `done`.
  if (terminal) {
    return {
      state: { mode: "done", lastGrowthMs: state.lastGrowthMs, stuckRetriggers: state.stuckRetriggers, updatedAt: nowMs },
      mode: "done",
    };
  }

  // 2. Content grew ⇒ the loader is working; anchor the stuck timer at now and clear the jiggle count.
  let lastGrowthMs = state.lastGrowthMs;
  let stuckRetriggers = state.stuckRetriggers;
  if (grewSinceLast) {
    lastGrowthMs = nowMs;
    stuckRetriggers = 0;
  }

  // 3. Frontier geometry.
  const maxScroll = scrollHeight - clientHeight;
  const atFrontier = scrollTop >= maxScroll - FRONTIER_GAP_FRAC * clientHeight;

  // 4. Loaded content still ahead ⇒ advance fast toward it (content ahead beats any stuck timer).
  if (!atFrontier) {
    return {
      state: { mode: "advance", lastGrowthMs, stuckRetriggers, updatedAt: nowMs },
      mode: "advance",
    };
  }

  // 5. At the frontier, still within the growth interval ⇒ hold at the frontier so the loader keeps firing.
  if (nowMs - lastGrowthMs < STUCK_MS) {
    return {
      state: { mode: "hold", lastGrowthMs, stuckRetriggers, updatedAt: nowMs },
      mode: "hold",
    };
  }

  // 6. At the frontier, no growth for STUCK_MS ⇒ the loader isn't firing. Jiggle it, giving the jiggle a
  //    FRESH STUCK_MS interval (reset lastGrowthMs = nowMs) — until the jiggle budget is spent.
  if (stuckRetriggers < MAX_STUCK_RETRIGGERS) {
    return {
      state: { mode: "retrigger", lastGrowthMs: nowMs, stuckRetriggers: stuckRetriggers + 1, updatedAt: nowMs },
      mode: "retrigger",
    };
  }

  // 7. Jiggles exhausted and still nothing new, yet no verified terminal ⇒ an honest reported-incomplete.
  return {
    state: { mode: "exhausted", lastGrowthMs, stuckRetriggers, updatedAt: nowMs },
    mode: "exhausted",
  };
}
