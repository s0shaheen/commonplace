// The flagged-session empty-200 → auto-refresh recovery ladder — a PURE reducer (SESS-01/CHAL-UX, spec §6.5).
//
// Observed live (2026-07-10, founder session): while a session is flagged (pre/post-captcha), the `*_list`
// API calls return HTTP 200 with an EMPTY body while the SPA grid renders blank — and a MANUAL PAGE REFRESH
// fixes it (seen 2–3×). This reducer automates exactly that fix, bounded so it can't become bot-behavior:
//
//   healthy → suspect → refreshing (ONE reload) → challenged (pause+notify)
//
// The invariants that make it account-safe:
//  - N consecutive `empty_ok`s (EMPTY_STREAK_TO_ACT) before we act — a single empty page is a fluke, not a flag.
//  - Exactly ONE reload per run per source (MAX_RELOADS_PER_RUN) — reload-hammering a flagged session is a
//    behavioral tell; `reloadsUsed` is MONOTONIC within a run (a healthy arrival resets the streak/phase but
//    NEVER refills the reload budget).
//  - Still empty after the reload ⇒ escalate to the challenge path (pause+notify), NEVER giveup-as-stall.
//  - Absorbing-ish, not absorbing: once `challenged`, a later `healthy_arrival` auto-resumes (→ healthy+continue).
//
// Pure: no Date.now/Math.random/DOM/fetch — `now` is injected, signals are passed in. The glue performs the
// side effects (location.reload(), chrome notification) that the returned commands describe.

export type RecoveryPhase = "healthy" | "suspect" | "refreshing" | "challenged";

export interface RecoveryState {
  phase: RecoveryPhase;
  /** Consecutive empty-200 arrivals since the last healthy page. Reset to 0 on a healthy arrival. */
  emptyStreak: number;
  /** Reloads spent this run (MONOTONIC — a healthy arrival does NOT refill it; anti-hammer guarantee). */
  reloadsUsed: number;
  /** now() at the last transition; observability only, never a decision input. */
  updatedAt: number;
}

export type RecoverySignal = "healthy_arrival" | "empty_ok" | "challenge" | "offline";

export type RecoveryCommand =
  | { kind: "continue" }
  | { kind: "reload" } // glue does location.reload() (once per run per source)
  | { kind: "pause_notify"; reason: string }; // hand to the captcha/challenge UX (freeze giveup, notify, auto-resume)

export interface RecoveryDeps {
  now: number;
}

/**
 * N consecutive empty-200s before we act. Chosen 2 (spec allows 2–3).
 *
 * WHY 2, NOT 3: the flagged empty-200 is a STABLE state, not a blip — live, `post`/`collect`/`favorite`
 * item_list ALL returned empty together while `story`/`explore` still answered, and the manual fix is a
 * single refresh. So two consecutive confirmations already rule out a lone-page fluke (a genuinely empty
 * sub-tab, an arrival race) without dawdling on a known-stable failure. Requiring 3 would burn an extra
 * full page-cycle staring at a confirmed-blank grid before a fix that is already bounded to once-per-run
 * and instantly undone by any healthy arrival. And because `healthy_arrival` resets the streak, a transient
 * empty-then-data can never reach 2 — so 2 is the minimum that is both responsive and false-positive-safe.
 */
export const EMPTY_STREAK_TO_ACT = 2;

/** At most ONE reload per run per source — reload-looping a flagged session is bot-hammering. */
export const MAX_RELOADS_PER_RUN = 1;

export function initialRecoveryState(now: number): RecoveryState {
  return { phase: "healthy", emptyStreak: 0, reloadsUsed: 0, updatedAt: now };
}

const CHALLENGE_REASON = "session challenge — solve it in the TikTok tab; capture resumes automatically";
const FLAGGED_REASON =
  "TikTok returned empty pages after a refresh — the session looks flagged; try again shortly or solve any challenge in the tab";
const OFFLINE_REASON = "offline — capture paused, resumes when you're back online";

export function stepRecovery(
  state: RecoveryState,
  signal: RecoverySignal,
  deps: RecoveryDeps,
): { state: RecoveryState; command: RecoveryCommand } {
  const now = deps.now;

  switch (signal) {
    case "healthy_arrival":
      // A single healthy page clears a suspect streak OR a challenged pause → auto-resume. reloadsUsed
      // is preserved (monotonic per run) so a healthy blip mid-run can't refill the reload budget.
      return {
        state: { phase: "healthy", emptyStreak: 0, reloadsUsed: state.reloadsUsed, updatedAt: now },
        command: { kind: "continue" },
      };

    case "empty_ok": {
      const emptyStreak = state.emptyStreak + 1;
      // Below the threshold: a suspected flag, but keep going — one/near-one empty page is not yet a flag.
      if (emptyStreak < EMPTY_STREAK_TO_ACT) {
        return {
          state: { ...state, phase: "suspect", emptyStreak, updatedAt: now },
          command: { kind: "continue" },
        };
      }
      // Threshold reached with a reload still in the budget: automate the founder's manual refresh, ONCE.
      if (state.reloadsUsed < MAX_RELOADS_PER_RUN) {
        return {
          state: { phase: "refreshing", emptyStreak, reloadsUsed: state.reloadsUsed + 1, updatedAt: now },
          command: { kind: "reload" },
        };
      }
      // Threshold reached but the reload is spent AND it's still empty → the flag survived a refresh.
      // Escalate to the challenge path (pause+notify) — never giveup-as-stall, never a reload loop.
      return {
        state: { ...state, phase: "challenged", emptyStreak, updatedAt: now },
        command: { kind: "pause_notify", reason: FLAGGED_REASON },
      };
    }

    case "challenge":
      // A definitive challenge/captcha signal — freeze giveup, pause, notify; healthy_arrival auto-resumes.
      return {
        state: { ...state, phase: "challenged", updatedAt: now },
        command: { kind: "pause_notify", reason: CHALLENGE_REASON },
      };

    case "offline":
      // Orthogonal to the flag ladder: pause+notify, but DO NOT consume a reload and DO NOT advance the
      // empty streak (offline is a network drop, not evidence of a flagged session). "challenged" is the
      // generic paused-awaiting-external-recovery phase here; the next healthy arrival auto-resumes.
      return {
        state: { ...state, phase: "challenged", updatedAt: now },
        command: { kind: "pause_notify", reason: OFFLINE_REASON },
      };
  }
}
