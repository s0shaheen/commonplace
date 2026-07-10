// The completion state machine — a PURE reducer, and THE §2.1 fix expressed as a unit test.
//
// The one invariant that matters: `done` is reachable ONLY from a page whose hasMore coerced to
// false. No tick, no stall count, no elapsed time ever returns `done`. A stall with more-maybe-left
// is backpressure: we back off and wait. After a bounded run of unanswered backoff cycles we return
// `giveup` — a DISTINCT, reason-carrying terminal that the glue must surface as a *reported
// incomplete*, never let masquerade as success.
//
// Injected I/O, mirroring queue.ts: `now()` (no Date.now here) stamps the state for the HUD, and an
// optional `backoffMs(stall)` lets Task 2's pacing.ts supply the real schedule. The backoff here is
// a minimal exponential PLACEHOLDER — the human-cadence constants land in Task 2 (`pacing.ts`).

export type ScrollStatus = "scrolling" | "waiting" | "done" | "giveup";

export interface ScrollState {
  /** Highest captured count observed so far (monotonic). */
  lastCount: number;
  /** Latest paging signal. Defaults to true (more-may-exist) until a page tells us otherwise. */
  hasMore: boolean;
  /** Consecutive no-growth cycles since the last new page. Reset to 0 on growth. */
  stall: number;
  status: ScrollStatus;
  /** Populated only on giveup — the human-readable incomplete reason. */
  reason: string | null;
  /** now() at the last transition; observability only (HUD), never a decision input. */
  updatedAt: number;
}

export type ScrollEvent =
  | { kind: "page_captured"; newCount: number; hasMore: boolean }
  | { kind: "tick" };

export type ScrollAction =
  | { kind: "scroll" }
  | { kind: "wait"; ms: number }
  | { kind: "done" }
  | { kind: "giveup"; reason: string };

export interface ScrollDeps {
  now(): number;
  /** Optional injected backoff (Task 2's pacing.ts). Falls back to the placeholder below. */
  backoffMs?: (stall: number) => number;
}

/** How many consecutive unanswered backoff cycles before we declare a (reported) incomplete. */
export const GIVEUP_STALL_CYCLES = 8;

const BASE_BACKOFF_MS = 1_000;
const MAX_BACKOFF_MS = 60_000;

/**
 * Placeholder exponential backoff: 1s, 2s, 4s … capped at 60s. Task 2 (`pacing.ts`) replaces this
 * with jittered, human-cadence constants; kept minimal here on purpose so pacing tuning lives in
 * exactly one place.
 */
function placeholderBackoffMs(stall: number): number {
  return Math.min(BASE_BACKOFF_MS * 2 ** (stall - 1), MAX_BACKOFF_MS);
}

export function initialScrollState(): ScrollState {
  return { lastCount: 0, hasMore: true, stall: 0, status: "scrolling", reason: null, updatedAt: 0 };
}

function stall(state: ScrollState, hasMore: boolean, now: number, backoff: (n: number) => number): { state: ScrollState; action: ScrollAction } {
  const nextStall = state.stall + 1;
  if (nextStall >= GIVEUP_STALL_CYCLES) {
    // A REPORTED incomplete — never a silent done. TikTok stopped answering while it still (as far
    // as we can tell) had more; we stop, but we say so loudly with a count so nothing is masked.
    const reason = `TikTok stopped responding after ${nextStall} backoff cycles; ${state.lastCount} captured, more may remain`;
    return {
      state: { ...state, hasMore, stall: nextStall, status: "giveup", reason, updatedAt: now },
      action: { kind: "giveup", reason },
    };
  }
  return {
    state: { ...state, hasMore, stall: nextStall, status: "waiting", reason: null, updatedAt: now },
    action: { kind: "wait", ms: backoff(nextStall) },
  };
}

/**
 * The reducer. `page_captured` with hasMore:false ⇒ done (only path). Growth ⇒ reset stall, scroll.
 * A tick, or a page with no growth while hasMore:true ⇒ stall→wait, and past the bound ⇒ giveup.
 */
export function step(state: ScrollState, event: ScrollEvent, deps: ScrollDeps): { state: ScrollState; action: ScrollAction } {
  const now = deps.now();
  const backoff = deps.backoffMs ?? placeholderBackoffMs;

  // Terminal states are absorbing — once we're done or gave up, nothing re-opens capture.
  if (state.status === "done") return { state, action: { kind: "done" } };
  if (state.status === "giveup") return { state, action: { kind: "giveup", reason: state.reason ?? "incomplete" } };

  if (event.kind === "page_captured") {
    // Completion — the ONLY `done`. hasMore:false wins even if this final page also brought items.
    if (event.hasMore === false) {
      const lastCount = Math.max(state.lastCount, event.newCount);
      return {
        state: { ...state, lastCount, hasMore: false, stall: 0, status: "done", reason: null, updatedAt: now },
        action: { kind: "done" },
      };
    }
    // New items → progress. Reset the stall counter and keep scrolling.
    if (event.newCount > state.lastCount) {
      return {
        state: { ...state, lastCount: event.newCount, hasMore: true, stall: 0, status: "scrolling", reason: null, updatedAt: now },
        action: { kind: "scroll" },
      };
    }
    // A captured page with no growth is indistinguishable from a stall → back off.
    return stall(state, true, now, backoff);
  }

  // tick: no page arrived this cycle → a stall. (state.hasMore is always true here: false is only
  // ever written together with status:"done", which the absorbing check above already returned.)
  return stall(state, state.hasMore, now, backoff);
}
