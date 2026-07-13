// Account-safety kill-switch (C7): "never keep hammering a wall." A resumable pause already HOLDS the
// wheel (no requests forced) while the founder solves a one-off captcha — that path is account-safe and
// stays. This module is the STRONGER, terminal guard for a SUSTAINED block: when the server walls us
// repeatedly (a run of 429/5xx, or a challenge that keeps re-blocking after each auto-resume), we stop
// entirely — detach the debugger and surface a user-visible notice — rather than grind against it.
//
// PURE: streak counts in, a boolean out. The glue owns the counters (reset on a healthy arrival) and the
// side effects (detach + notify + end the run). So "N consecutive server errors halts" is a unit test.

/** Consecutive 429/5xx arrivals (no healthy page between) before we halt to protect the account. */
export const HTTP_ERROR_HALT_STREAK = 6;

/** Distinct challenge/captcha pause cycles this run (each auto-resumed then re-blocked) before we halt. */
export const CHALLENGE_HALT_CYCLES = 3;

/** The user-visible reason surfaced when the kill-switch fires — honest, actionable, never a fake done. */
export const BAN_HALT_REASON =
  "TikTok is repeatedly blocking capture — stopped to protect your account. Wait a while, then Sync again.";

export interface BanFacts {
  /** Consecutive http_error (429/5xx) arrivals since the last healthy page. */
  httpErrorStreak: number;
  /** Challenge/captcha pause cycles entered this run since the last healthy page. */
  challengeCycles: number;
}

/**
 * Should the run HALT now for account safety? True once a sustained-block ceiling is crossed on either
 * axis: repeated server errors OR a challenge that keeps re-blocking. Both counters are reset by the glue
 * on any healthy arrival, so a transient wall never trips this — only a real, persistent block does.
 */
export function shouldHaltForBlock(f: BanFacts): boolean {
  return f.httpErrorStreak >= HTTP_ERROR_HALT_STREAK || f.challengeCycles >= CHALLENGE_HALT_CYCLES;
}
