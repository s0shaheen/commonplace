// Completeness accounting → honest-incompleteness verdict (COMPL-07, the TRUST feature, §6.6). The
// founder must be able to trust the sweep got EVERYTHING — so per source we compare what we captured
// this run against the count TikTok's own UI declares, and refuse to dress a grossly-short capture up as
// complete.
//
// PURE: facts in (did we reach a verified terminal · how many did we capture · how many does the source
// declare) → one of three honest statuses out. The scroll outcome + the declared-count read live in the
// glue; this module owns the decision so "a source captured far below its declared count and never hit a
// clean terminal is SUSPICIOUS, not done" is a unit test.
//
// The taxonomy (distinct honest outcomes; completion stays verified-terminal-only, invariant §5.3):
//   • done       — a VERIFIED hasMore:false terminal was reached (authoritative; a declared count can be
//                  stale/privacy-hidden/wrong, so a real terminal wins even if it's below declared).
//   • suspicious — NO clean terminal AND captured is grossly below a known declared count: strong
//                  evidence of real truncation. Never presented or exported as complete.
//   • giveup     — the run ended incomplete but without a strong short-fall signal (declared unknown, or
//                  captured is roughly in line with declared): the honest reported-incomplete we already had.

export type CompletenessStatus = "done" | "suspicious" | "giveup";

/** Below this fraction of the declared count (and no clean terminal) ⇒ "suspicious". ~85% tolerates the
 *  normal small gap between a live-changing declared count and a full capture without crying wolf. */
export const COMPLETENESS_MIN_RATIO = 0.85;

export interface CompletenessInputs {
  /** The scroll reached a VERIFIED terminal (isTerminalPage on a healthy hasMore:false page). */
  terminalDone: boolean;
  /** Distinct items captured for THIS source THIS run (the per-run new-id delta, NOT the global total). */
  captured: number;
  /** The source's declared saved count from the profile UI, or null when unreadable. */
  declared: number | null;
  /** Override the short-fall threshold (default COMPLETENESS_MIN_RATIO). */
  minRatio?: number;
}

/**
 * Assess a finished source-run into an honest completeness status. A verified terminal is always "done";
 * otherwise a known declared count that we fell grossly short of makes the run "suspicious"; everything
 * else is the plain "giveup". Deterministic for fixed inputs.
 */
export function assessCompleteness(inp: CompletenessInputs): CompletenessStatus {
  // A verified terminal is authoritative — declared counts are advisory and often wrong/hidden.
  if (inp.terminalDone) return "done";

  const minRatio = inp.minRatio ?? COMPLETENESS_MIN_RATIO;
  const declared = inp.declared;
  if (declared != null && declared > 0 && inp.captured < minRatio * declared) {
    return "suspicious";
  }
  return "giveup";
}
