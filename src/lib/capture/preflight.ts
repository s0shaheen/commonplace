// Pure preflight gate: run-start FACTS in, VERDICT out (C8, capture-resilience §7). NO DOM/clock/RNG —
// the content-script glue does every DOM read (profile-path check, login-CTA query, tile count, run
// arrival baseline) and hands us plain facts. So this is a deterministic unit test, not a live-run
// gamble (invariant §5.1: every decision lives in a pure module behind thin glue).
//
// Live evidence (2026-07-12): a capture run fired while the dev browser's TikTok session was LOGGED
// OUT. The profile page showed a "Log in" CTA and 0 personal content, so there was nothing to scroll —
// and capture ground for ~10s through the hold→retrigger→exhausted ladder before giving up with a
// generic "reached the bottom" reason. It should detect "not logged in" IMMEDIATELY and report a
// clear, actionable reason. This gate does that — BEFORE the frame driver ever starts.
//
// Design bias (load-bearing): CONSERVATIVE — never false-block a legitimate run. A wrong "not logged
// in" on a real capture is worse than grinding a few seconds, because it silently drops the founder's
// corpus. So `not_logged_in` fires ONLY on an unambiguous logged-out page (all three tells at once);
// every ambiguous case falls through to `ready` and the existing ladders own it.

export type PreflightVerdict = "ready" | "not_logged_in" | "not_profile";

export interface PreflightFacts {
  /** location.pathname is a /@handle profile page (not a video permalink, not the FYP). */
  onProfilePage: boolean;
  /** A prominent logged-OUT signal: a header "Log in" / "Sign up" CTA is present (logged-in users see an avatar/upload instead). */
  loginCtaPresent: boolean;
  /** Count of the user's own saved/grid tiles currently in the DOM (video/photo anchors). */
  ownTileCount: number;
  /** Whether ANY item_list network arrival has been seen this run yet (network is truth — content is loading/loaded). */
  sawItemListArrival: boolean;
}

/**
 * Assess run-start facts into a preflight verdict.
 *
 * `not_logged_in` (highest precedence, but the strictest guard) fires ONLY when ALL THREE logged-out
 * tells co-occur:
 *   1. a login CTA is present (logged-in users see an avatar/upload, never a "Log in" button),
 *   2. zero own tiles are in the DOM (no personal content to scroll), AND
 *   3. no item_list network arrival has been seen this run yet (the network is truth — a real session
 *      loading its grid produces arrivals; a logged-out page produces none).
 * Any one of these missing means the page is NOT unambiguously logged out, so we do NOT block:
 *   - a logged-in-but-EMPTY list (0 favorites) has NO login CTA → stays `ready`,
 *   - a flagged-empty session (SESS-01) typically HAS seen item_list arrivals (empty_ok) → stays
 *     `ready` and the existing session-recovery ladder owns it,
 *   - a login CTA that co-exists with real tiles (a promo/upsell strip on a populated page) → `ready`.
 *
 * `not_profile` fires when the run wasn't pointed at a profile surface at all (the FYP / a video
 * permalink) — but only AFTER the logged-out check, so a logged-out non-profile page still reports the
 * more actionable `not_logged_in`.
 *
 * Everything else is `ready` — proceed exactly as today.
 */
export function assessPreflight(facts: PreflightFacts): PreflightVerdict {
  // 1. LOGGED OUT — the unambiguous triple-guard. All three tells, or we don't block.
  if (facts.loginCtaPresent && facts.ownTileCount === 0 && facts.sawItemListArrival === false) {
    return "not_logged_in";
  }

  // 2. NOT A PROFILE SURFACE — the run was pointed at the FYP / a video, not a saved-list page.
  //    (Checked AFTER logged-out so a logged-out FYP still reports the more actionable reason.)
  if (!facts.onProfilePage) {
    return "not_profile";
  }

  // 3. READY — a legitimate run. Proceed.
  return "ready";
}
