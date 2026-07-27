// The single recovery spine (capture-control-plane) — a PURE reducer. Every recoverable bad state the
// classifier reports feeds ONE budgeted, idempotent path instead of scattered per-case nudges:
//
//   PROGRESSING            → continue
//   STALLED_VITAL          → nudge            (a bounded motion nudge; the glue/scrollWatch bounds it)
//   NOT_VITAL / uncorrob.  → reload_resume    (checkpoint → reload → resume-from-cursor; ONCE per source)
//     CLAIMED_DONE           …then verdict(incomplete, reason) once the reload budget is spent
//   CHALLENGED             → pause_for_human  (freeze counters; auto-resume on the next healthy arrival)
//   corroborated CLAIMED_DONE → verdict(done) (the ONLY path to a real done)
//
// This is also the resume-after-flag discriminator: reload+resume proceeds PAST the wall ⇒ it was a
// session flag (the spine handled it, next input reads PROGRESSING → continue); it RE-WALLS at the same
// cursor with the budget spent ⇒ a hard cap ⇒ an honest, reason-labeled incomplete (never a fake done),
// and the ZIP/enrichment lane covers the tail.
//
// The account-safety invariant is structural: reload_resume is capped at ONE per source per run
// (`reloadsUsed` monotonic, mirroring sessionRecovery), with full-jitter backoff — never an unbounded
// retry loop, never reload-hammering a flagged session.
//
// PURE: `now()` and `rng()` are injected (no wall clock, no rng, no DOM read in here) and the backoff
// schedule is injectable (pacing.ts), so "reload once, then honest incomplete" is a deterministic unit test.

import type { ObservedState } from "./captureState.js";
import { BACKOFF_BASE_MS, BACKOFF_MAX_MS } from "./pacing.js";

export interface SpineState {
  /** reload-resume attempts already spent for the CURRENT source this run (MONOTONIC — anti-hammer). */
  reloadsUsed: number;
  /** The cursor at which we last walled — lets a re-wall at the SAME cursor be reported as a hard cap. */
  lastWallCursor: string | null;
  /** Whether we are currently paused for a human (a challenge). Cleared on the next healthy arrival. */
  paused: boolean;
  /** now() at the last transition; observability only, never a decision input. */
  updatedAt: number;
}

export interface SpineBudget {
  /** Max reload-resume per source per run. One (per capture-resilience §6.5 — reload-looping is a tell). */
  maxReloads: number;
}

export const DEFAULT_SPINE_BUDGET: SpineBudget = { maxReloads: 1 };

export interface SpineInput {
  /** The classifier's observed state. */
  observed: ObservedState;
  /** For CLAIMED_DONE: whether the completion claim is corroborated (velocity/vitality/reconciliation). */
  corroborated: boolean;
  /** The current wall cursor (for re-wall-at-same-cursor detection). */
  cursor: string | null;
  /** Distinct items captured for this source this run (for the incomplete shortfall reason). */
  captured: number;
  /** The source's declared count, or null when unreadable. */
  declared: number | null;
}

export type SpineCommand =
  | { kind: "continue" }
  | { kind: "nudge" }
  | { kind: "reload_resume"; backoffMs: number }
  | { kind: "pause_for_human" }
  | { kind: "verdict"; verdict: "done" }
  | { kind: "verdict"; verdict: "incomplete"; reason: string };

export interface SpineDeps {
  now(): number;
  rng(): number;
  /** Optional injected backoff (pacing.ts). Falls back to full-jitter over pacing's base/cap constants. */
  backoffMs?: (attempt: number, rng: () => number) => number;
}

export function initialSpineState(now = 0): SpineState {
  return { reloadsUsed: 0, lastWallCursor: null, paused: false, updatedAt: now };
}

/**
 * Full-jitter backoff (AWS "Exponential Backoff And Jitter"): sleep = rand(0, min(cap, base·2^attempt)).
 * Reuses pacing.ts's base/cap constants so the schedule lives in one place; the FULL-jitter shape (0..cap,
 * not pacing's ×(1+0.15·rng) equal-jitter) maximally de-syncs the one reload so it never looks metronomic.
 */
export function fullJitterBackoffMs(attempt: number, rng: () => number): number {
  const capped = Math.min(BACKOFF_BASE_MS * 2 ** attempt, BACKOFF_MAX_MS);
  return Math.round(rng() * capped);
}

/** The honest, reason-labeled incomplete surfaced when the reload budget is spent — never "done". */
function incompleteReason(inp: SpineInput, state: SpineState): string {
  const short =
    inp.declared != null && inp.declared > 0
      ? `${inp.captured} of ~${inp.declared} captured`
      : `${inp.captured} captured`;
  const rewalled = inp.cursor != null && inp.cursor === state.lastWallCursor;
  const cap = rewalled ? " re-walled at the same cursor;" : "";
  return `capture ended incomplete — ${short};${cap} the platform's "done" could not be corroborated`;
}

/**
 * The reducer: `(state, input, budget, deps) → { state, command }`. Pure and deterministic for a fixed
 * tuple. Precedence is ordered so a challenge always pauses (never burns a reload) and a corroborated
 * completion is the only done.
 */
export function step(
  state: SpineState,
  inp: SpineInput,
  budget: SpineBudget,
  deps: SpineDeps,
): { state: SpineState; command: SpineCommand } {
  const now = deps.now();
  const backoff = deps.backoffMs ?? fullJitterBackoffMs;

  // CHALLENGED — pause for the human; FREEZE the counters (reloadsUsed untouched) and notify. The next
  // healthy arrival (PROGRESSING) auto-resumes below. A challenge is never a giveup and never a reload.
  if (inp.observed === "CHALLENGED") {
    return { state: { ...state, paused: true, updatedAt: now }, command: { kind: "pause_for_human" } };
  }

  // Corroborated completion — the ONLY path to a real done.
  if (inp.observed === "CLAIMED_DONE" && inp.corroborated === true) {
    return { state: { ...state, paused: false, updatedAt: now }, command: { kind: "verdict", verdict: "done" } };
  }

  // A recoverable bad state: an UNcorroborated completion claim, or a dead/blank grid.
  const recoverable =
    inp.observed === "NOT_VITAL" || (inp.observed === "CLAIMED_DONE" && inp.corroborated !== true);
  if (recoverable) {
    if (state.reloadsUsed < budget.maxReloads) {
      // Checkpoint → reload → resume-from-cursor, ONCE. Record the wall cursor so a re-wall is a hard cap.
      return {
        state: {
          ...state,
          reloadsUsed: state.reloadsUsed + 1,
          lastWallCursor: inp.cursor,
          paused: false,
          updatedAt: now,
        },
        command: { kind: "reload_resume", backoffMs: backoff(state.reloadsUsed, deps.rng) },
      };
    }
    // Budget spent → honest, persisted, reason-labeled incomplete. Never "done".
    return {
      state: { ...state, paused: false, updatedAt: now },
      command: { kind: "verdict", verdict: "incomplete", reason: incompleteReason(inp, state) },
    };
  }

  // STALLED_VITAL — a self-inflicted lazy-load stall: a bounded motion nudge (glue/scrollWatch bounds it).
  if (inp.observed === "STALLED_VITAL") {
    return { state: { ...state, paused: false, updatedAt: now }, command: { kind: "nudge" } };
  }

  // PROGRESSING (incl. the healthy arrival that auto-resumes a pause) — continue.
  return { state: { ...state, paused: false, updatedAt: now }, command: { kind: "continue" } };
}
