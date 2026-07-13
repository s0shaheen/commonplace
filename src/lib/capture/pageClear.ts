// Mid-run page-CLEAR detector (live symptom 2026-07-13: "the page completely stopped/cleared (crashed?)
// at ~6k"). TikTok's flagged-empty "Something went wrong" state can hit MID-run (a manual refresh fixes
// it — the same fix the empty_ok reload ladder already automates), or the tab gets discarded under memory
// pressure and the grid is wiped. Either way a POPULATED grid suddenly collapses to ~0 tiles. Left
// unhandled, the wheel lane reads that as a stall and ends the run — a false stop, when a refresh would
// have kept it going.
//
// This PURE reducer owns the DECISION: "the grid was genuinely populated and then went empty (or a
// visible error/empty-state appeared) ⇒ this is a flagged clear, drive the reload recovery." The glue
// does the DOM reads (tile count, error-state scan) and, on `cleared`, feeds the EXISTING session-recovery
// ladder (the one empty_ok uses: one bounded location.reload() → re-verify → else pause+notify). The
// captured data is already safe in IndexedDB; this keeps the RUN alive.
//
// WHY A TRANSITION, not just "tiles == 0": at run start the grid IS empty (before the first page loads),
// and the observer evicts old tiles down to a bounded live set — so "few tiles" alone is normal. Only a
// grid that CLIMBED past POPULATED_MIN_TILES and then COLLAPSED to ~0 is a real clear. Eviction never
// drops below that bounded live set, so it can't forge this transition.
//
// PURE: no global clock, no rng, no DOM — the peak is carried in the state, the facts are passed in.

export interface PageClearState {
  /** The most tiles this run has ever seen — proof the grid was genuinely populated (monotonic). */
  peakTiles: number;
}

export interface PageClearInputs {
  /** Tiles visible in the grid RIGHT NOW (the glue counts them). */
  tiles: number;
  /** A visible error / empty-state ("Something went wrong" + a Refresh/Retry control) was detected. */
  errorState: boolean;
}

/** The grid is "populated" once it has held at least this many tiles — comfortably above the initial
 *  empty state and any first-page count, well below the bounded live set eviction holds. */
export const POPULATED_MIN_TILES = 12;

/** At/below this many tiles, AFTER being populated, the grid is considered cleared (essentially wiped).
 *  Eviction never trims below its bounded live set (≫ this), so only a genuine clear reaches here. */
export const CLEARED_MAX_TILES = 2;

export function initialPageClearState(): PageClearState {
  return { peakTiles: 0 };
}

/**
 * Decide whether a mid-run page clear just happened. `cleared` is true iff the grid was genuinely
 * populated AND now either shows a visible error/empty-state OR has collapsed to ~0 tiles. Deterministic
 * for fixed inputs; `peakTiles` only ever climbs.
 */
export function stepPageClear(
  state: PageClearState,
  inputs: PageClearInputs,
): { state: PageClearState; cleared: boolean } {
  const peakTiles = Math.max(state.peakTiles, inputs.tiles);
  const wasPopulated = peakTiles >= POPULATED_MIN_TILES;
  // A populated grid that now shows an error/empty-state OR has collapsed to ~0 tiles = a flagged clear.
  const cleared = wasPopulated && (inputs.errorState || inputs.tiles <= CLEARED_MAX_TILES);
  return { state: { peakTiles }, cleared };
}
