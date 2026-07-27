// The observed-state classifier (capture-control-plane) — a PURE combinational reducer. Sensor facts in →
// exactly ONE observed state out. This is the single place that treats the platform's completion claim as
// EVIDENCE, not truth: every existing sensor (interceptParse transport, pageClear vitality, overlay/ban,
// completeness reconciliation) is demoted to an input here, and NONE of them individually ends a run.
//
// The bug this closes (live, 2026-07-13): TikTok returned a well-formed 2xx hasMore:false at 5,191/5,989
// (86.7% — ABOVE the 85% ratio tolerance) at +24 items/s, with hasMore:true one beat prior, then a black
// screen. A ratio check alone cannot catch that. The discriminator is VELOCITY + VITALITY: a genuine
// end-of-list DECELERATES (the stream had already slowed / the cursor stopped advancing) or the captured
// count RECONCILES with declared/ZIP ground truth; a fake-done arrives MID-velocity (the immediately prior
// page had hasMore:true while the count was still climbing), followed by a vitality drop / empty pages.
//
// PURE: no clock, no rng, no DOM — the classifier is a total function of its inputs (the glue tracks the
// velocity interval and gathers the sensor facts), so every branch below is a deterministic unit test.

import type { TransportSignal } from "./interceptParse.js";

export type ObservedState =
  | "PROGRESSING" // items arriving, or a request issued and we are legitimately waiting on it
  | "STALLED_VITAL" // vital grid, no growth, and we did not even ask ⇒ a self-inflicted lazy-load stall
  | "NOT_VITAL" // the grid went blank, or a run of empty pages ⇒ the session/tab is not rendering content
  | "CHALLENGED" // a captcha/login overlay or a ban signal — wins over ANY completion claim
  | "CLAIMED_DONE"; // the platform claims hasMore:false on a healthy page — EVIDENCE; corroboration decides trust

export interface CaptureStateInputs {
  /** The latest healthy page's paging claim (false = "no more"). Evidence only — never trusted alone. */
  hasMoreClaim: boolean;
  /** Transport signal of the latest arrival (interceptParse.classifyTransport). */
  transport: TransportSignal;
  /** Unique-item count delta over the recent interval (>0 ⇒ items are arriving right now). */
  recentGrowth: number;
  /** The immediately PRIOR page reported hasMore:true (part of the fake-done velocity fingerprint). */
  priorPageHadMore: boolean;
  /** The unique-item count was still CLIMBING at the prior page (the stream had not decelerated). */
  priorPageGrew: boolean;
  /** A list request was ISSUED since the last observe tick (main-world requestIssued bumped). */
  requestIssued: boolean;
  /** The grid still renders content (pageClear vitality). false ⇒ blank/cleared. */
  vital: boolean;
  /** Consecutive empty_ok (flagged-session empty-200) pages seen. */
  consecutiveEmptyOk: number;
  /** A captcha/login/unknown-blocking overlay is present (overlayClassifier → challenge/pause_notify). */
  overlayChallenge: boolean;
  /** The account-safety kill-switch says halt (banGuard.shouldHaltForBlock). */
  banSignal: boolean;
  /** The captured count reconciles with the declared/ZIP ground truth (completeness reconciliation). */
  reconciled: boolean;
}

export interface Classification {
  state: ObservedState;
  /** Meaningful only for CLAIMED_DONE: whether the completion claim is corroborated (→ genuine done). */
  corroborated: boolean;
}

/** A run of this many consecutive empty_ok pages reads as NOT_VITAL (mirrors sessionRecovery's streak). */
export const EMPTY_OK_NOT_VITAL = 2;

/**
 * The fake-done velocity fingerprint: the stream was at FULL velocity going INTO this claim — the
 * immediately prior page reported hasMore:true while the unique-item count was still climbing. A genuine
 * end-of-list decelerates first, so this being true is the tell that a hasMore:false is premature.
 */
export function atFullVelocity(inp: CaptureStateInputs): boolean {
  return inp.priorPageHadMore === true && inp.priorPageGrew === true;
}

/**
 * Is a hasMore:false completion claim CORROBORATED (→ genuine done)? Corroborated iff the captured count
 * RECONCILES with ground truth, OR the stream had DECELERATED (not at full velocity) on a still-vital grid
 * with no empty-page streak. Reconciliation always wins — if we truly have everything, velocity is moot.
 */
export function isCorroborated(inp: CaptureStateInputs): boolean {
  if (inp.reconciled === true) return true;
  return !atFullVelocity(inp) && inp.vital === true && inp.consecutiveEmptyOk === 0;
}

/**
 * Classify the sensor facts into exactly one observed state. Precedence (ordered, each documented):
 *  1. CHALLENGED — a captcha/login overlay or ban signal wins over EVERYTHING, incl. a completion claim.
 *  2. CLAIMED_DONE — a positive hasMore:false on a HEALTHY transport. The salient observed fact; the
 *     `corroborated` flag (velocity + vitality + reconciliation) tells the spine whether to trust it.
 *  3. NOT_VITAL — the grid went blank, or a run of empty pages: the session/tab is not rendering content.
 *  4. PROGRESSING — items arrived this interval: the run is healthy, keep going.
 *  5. STALLED_VITAL vs PROGRESSING — a vital, no-growth tick: if we did not even issue a request it is a
 *     self-inflicted lazy-load stall (→ nudge); if a request WAS issued we are waiting on the server, which
 *     the glue backs off (→ PROGRESSING). This is main-world's requestIssued discriminator.
 */
export function classify(inp: CaptureStateInputs): Classification {
  // 1. A challenge/ban is decisive regardless of any completion claim.
  if (inp.overlayChallenge === true || inp.banSignal === true) {
    return { state: "CHALLENGED", corroborated: false };
  }

  // 2. A positive completion claim on a healthy transport — evidence, corroboration decides trust.
  if (inp.transport === "ok" && inp.hasMoreClaim === false) {
    return { state: "CLAIMED_DONE", corroborated: isCorroborated(inp) };
  }

  // 3. The grid is blank, or a stable run of empty pages — not rendering content.
  if (inp.vital !== true || inp.consecutiveEmptyOk >= EMPTY_OK_NOT_VITAL) {
    return { state: "NOT_VITAL", corroborated: false };
  }

  // 4. Items are arriving — healthy progress.
  if (inp.recentGrowth > 0) {
    return { state: "PROGRESSING", corroborated: false };
  }

  // 5. Vital, no growth: no request issued ⇒ self-inflicted stall (nudge); else waiting on the server.
  if (inp.requestIssued !== true) {
    return { state: "STALLED_VITAL", corroborated: false };
  }
  return { state: "PROGRESSING", corroborated: false };
}
