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

// `claimed` (capture-control-plane): the platform reported hasMore:false but the claim is UNcorroborated
// (it arrived at full velocity and was not reconciled) — a NON-terminal state the glue routes to the
// recovery spine, NEVER a `done`. Distinct from `done`/`giveup`, which stay absorbing terminals.
export type ScrollStatus = "scrolling" | "waiting" | "done" | "giveup" | "claimed";

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
  /**
   * True once any count growth has been observed this run. Fix round 1(a): growth proves the resume
   * re-scroll has passed the already-captured prefix, so the resume grace DROPS — from there a
   * zero-new arrival is a stall again and the normal giveup bound applies. Never read outside resume.
   */
  grew: boolean;
  /**
   * The cursor of the last ARRIVED page (null until one carries a cursor). Fix round 1(b): a repeated
   * identical non-null cursor is non-progress even under the resume grace — a throttle serving the
   * same stale page repeats its cursor, while real forward pagination advances it.
   */
  lastPageCursor: string | null;
  /**
   * Fix round 2: count of grace-granted scrolls this run (a resume's zero-growth arrival treated as
   * progress). The residual hole after round 1 was a null-cursor + always-arriving + zero-growth
   * resume: cursor-repeat can't fire on null cursors and silence never comes, so grace had NO bound.
   * This is the ABSOLUTE cap's counter — past MAX_GRACE_SCROLLS grace stops and normal stall/giveup
   * bounding takes over, so even that pathological resume always terminates. Only grace increments it.
   */
  graceScrolls: number;
}

export type ScrollEvent =
  | {
      kind: "page_captured";
      newCount: number;
      hasMore: boolean;
      cursor?: string | null;
      /**
       * capture-control-plane: the stream was at FULL VELOCITY going into this page (the immediately
       * prior page had hasMore:true while the count was still climbing) — the fake-done fingerprint.
       * OPTIONAL: omitted/false ⇒ NOT at velocity ⇒ a hasMore:false completes exactly as before, so
       * every existing caller and test is unchanged. Only an explicit `true` (with no reconciliation)
       * turns a hasMore:false into a non-terminal `claimed` routed to the spine.
       */
      atFullVelocity?: boolean;
      /** capture-control-plane: the captured count reconciles with declared/ZIP ground truth. A reconciled
       *  terminal is trusted even at full velocity. OPTIONAL; defaults to not-reconciled. */
      reconciled?: boolean;
    }
  | { kind: "tick" };

export type ScrollAction =
  | { kind: "scroll" }
  | { kind: "wait"; ms: number }
  | { kind: "done" }
  | { kind: "giveup"; reason: string }
  | { kind: "claimed" };

export interface ScrollDeps {
  now(): number;
  /** Optional injected backoff (Task 2's pacing.ts). Falls back to the placeholder below. */
  backoffMs?: (stall: number) => number;
  /**
   * Carry-forward (1), Task 5 — RESUME-RUN flag. A crash-resume re-scroll walks the already-captured
   * prefix first: every page ARRIVES with hasMore:true but its items all dedupe away (count never
   * grows). Under the normal reducer each zero-new arrival is a stall, so we'd hit `giveup` ~
   * GIVEUP_STALL_CYCLES pages in — before the uncaptured tail. When `resuming` is true, a zero-new
   * page that ARRIVED is treated as PROGRESS (stall reset, scroll): TikTok answered, so it is
   * paginating FORWARD, not throttling.
   *
   * The grace is BOUNDED (fix round 1 — an unattended autonomous run must never scroll forever):
   *   (a) it drops on the first count growth (`state.grew` — the prefix is provably behind us);
   *   (b) a repeated identical non-null cursor is non-progress (`state.lastPageCursor`);
   *   (c) genuine SILENCE (a `tick`, no arrival) always accrues stall.
   * So even a resumed run always terminates: done, or a reported giveup. Default false.
   *
   * NOTE: a resume run must start from the persisted baseline — `initialScrollState(initialCount)` —
   * or the first prefix page would read as growth from 0 and instantly burn the grace.
   */
  resuming?: boolean;
}

/** How many consecutive unanswered backoff cycles before we declare a (reported) incomplete. */
export const GIVEUP_STALL_CYCLES = 8;

/**
 * Fix round 2 — the ABSOLUTE per-run cap on grace-granted scrolls (a resume's zero-growth-but-arrived
 * pages treated as forward progress). Past this many, the resume grace stops and the run falls to
 * normal stall/giveup bounding, so a null-cursor + perpetual-zero-growth resume can never scroll
 * forever unattended.
 *
 * Sizing (generous but finite): TikTok item_list pages carry ~30 items, and one grace-scroll walks
 * roughly one already-captured page of the prefix. 400 grace-scrolls ⇒ ~12,000 items of prefix — well
 * past any real corpus (the founder's largest observed was ~4,661), so a legitimate resume of even a
 * very large captured prefix reaches its uncaptured tail (which then produces growth, dropping the
 * grace anyway) long before the cap bites. The cap only ever fires on the pathological no-progress case.
 */
export const MAX_GRACE_SCROLLS = 400;

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

/**
 * @param initialCount the count baseline this run starts from. A fresh manual run passes 0 (default);
 * a RESUME run passes the persisted total, so re-scrolled prefix pages read as zero-new (grace-
 * eligible) instead of as a bogus first-page "growth" that would instantly burn the resume grace.
 */
export function initialScrollState(initialCount = 0): ScrollState {
  return {
    lastCount: initialCount,
    hasMore: true,
    stall: 0,
    status: "scrolling",
    reason: null,
    updatedAt: 0,
    grew: false,
    lastPageCursor: null,
    graceScrolls: 0,
  };
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
    const cursor = event.cursor ?? null;
    // Completion — a hasMore:false is EVIDENCE, not truth (capture-control-plane, §2.1 fix). It is a real
    // `done` ONLY when corroborated: reconciled against ground truth, OR NOT at full velocity (a genuine
    // end-of-list decelerates first). An UNcorroborated claim (arrived mid-velocity, unreconciled) is the
    // well-formed fake-done — it yields a NON-terminal `claimed` the glue routes to the recovery spine,
    // never `done`. Callers that pass no `atFullVelocity` (every pre-existing caller/test) corroborate by
    // default, so the historical `hasMore:false ⇒ done` behavior is preserved verbatim.
    if (event.hasMore === false) {
      const lastCount = Math.max(state.lastCount, event.newCount);
      const corroborated = event.reconciled === true || event.atFullVelocity !== true;
      if (corroborated) {
        return {
          state: { ...state, lastCount, hasMore: false, stall: 0, status: "done", reason: null, updatedAt: now },
          action: { kind: "done" },
        };
      }
      // Uncorroborated: reject the false claim. Keep hasMore:true (we still think more may exist) so the
      // reducer's tick invariant holds, and emit a non-terminal `claimed`. `claimed` is NOT absorbing —
      // if the spine's reload-resume gets past the wall, a later growth page resumes scrolling below.
      return {
        state: {
          ...state,
          lastCount,
          hasMore: true,
          stall: 0,
          status: "claimed",
          reason: null,
          updatedAt: now,
          lastPageCursor: cursor ?? state.lastPageCursor,
        },
        action: { kind: "claimed" },
      };
    }
    // New items → progress. Reset the stall counter and keep scrolling. `grew` flips permanently:
    // any growth proves a resume's re-scroll has passed its captured prefix (fix round 1a).
    if (event.newCount > state.lastCount) {
      return {
        state: {
          ...state,
          lastCount: event.newCount,
          hasMore: true,
          stall: 0,
          status: "scrolling",
          reason: null,
          updatedAt: now,
          grew: true,
          lastPageCursor: cursor ?? state.lastPageCursor,
        },
        action: { kind: "scroll" },
      };
    }
    // A captured page with no growth. In a RESUME run (carry-forward 1) this is the expected shape
    // over the captured prefix — TikTok answered (an arrival), so it is paginating forward toward
    // the uncaptured tail; count that as PROGRESS (reset stall, keep scrolling) so a long prefix
    // can't prematurely `giveup`. The grace is BOUNDED — it holds only while ALL of:
    //   (a) no growth has been seen yet (`!state.grew` — growth proves the prefix is behind us),
    //   (b) the cursor is advancing (a repeated identical non-null cursor is a throttle serving the
    //       same stale page, not forward pagination — never progress), and
    //   (c) the absolute cap isn't reached (fix round 2 — a null-cursor + always-arriving +
    //       zero-growth resume trips neither (a) nor (b) nor silence, so without this it had NO bound).
    // Outside the grace, a zero-new arrival is indistinguishable from a throttle stall → the normal
    // stall/giveup bound applies, so even an unattended resumed run always terminates.
    const cursorRepeated = cursor != null && cursor === state.lastPageCursor;
    if (deps.resuming && !state.grew && !cursorRepeated && state.graceScrolls < MAX_GRACE_SCROLLS) {
      return {
        state: {
          ...state,
          hasMore: true,
          stall: 0,
          status: "scrolling",
          reason: null,
          updatedAt: now,
          lastPageCursor: cursor ?? state.lastPageCursor,
          graceScrolls: state.graceScrolls + 1,
        },
        action: { kind: "scroll" },
      };
    }
    return stall({ ...state, lastPageCursor: cursor ?? state.lastPageCursor }, true, now, backoff);
  }

  // tick: no page arrived this cycle → a stall. (state.hasMore is always true here: false is only
  // ever written together with status:"done", which the absorbing check above already returned.)
  return stall(state, state.hasMore, now, backoff);
}
