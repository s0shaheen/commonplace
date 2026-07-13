// Background-tab resilience (§4 "background-tab throttling — the big one", Wave C). An unattended run's
// tab may be backgrounded/occluded. The trusted-wheel scroll WRITE is now service-worker-driven (a
// debugger-dispatched wheel loop), which keeps firing while the tab is hidden — BUT TikTok's own
// rendering + IntersectionObserver lazy-load are throttled/paused for a hidden tab, so the grid may stop
// paginating even though wheels are dispatched. That reads as a silent stall for a reason unrelated to
// TikTok. This module owns the decision: a hidden tab that has ALSO stopped producing pages is a "bring
// the tab forward" situation — pause+notify (or, opt-in, foreground it) rather than grind.
//
// PURE: visibility + how long since the last healthy page in → a verdict out. The glue owns the tab's
// hidden flag and the arrival timestamps. So "hidden + stalled ⇒ act; hidden but still paginating ⇒
// leave it alone; a brief tab-switch ⇒ leave it alone" is a unit test, not a live-run guess.

export type VisibilityVerdict = "ok" | "hidden_stalled";

/** How long a hidden tab may go WITHOUT a healthy page before we act. Long enough that flipping to
 *  another tab for a moment (while pages keep arriving) never trips it; short enough that a genuinely
 *  parked hidden tab is caught quickly. */
export const HIDDEN_STALL_GRACE_MS = 10_000;

/** The user-visible reason surfaced when a hidden tab has stalled — actionable, auto-resumes when shown. */
export const HIDDEN_PAUSE_REASON =
  "the TikTok tab is in the background and stopped loading — bring it forward to keep capturing (Chrome pauses hidden tabs). Capture resumes automatically.";

export interface VisibilityInputs {
  /** The driven tab's hidden flag (backgrounded/occluded). */
  hidden: boolean;
  /** ms since the last HEALTHY (transport:"ok") page arrived this run. */
  msSinceHealthy: number;
  /** Override the grace period (default HIDDEN_STALL_GRACE_MS). */
  graceMs?: number;
  /** Background CAPTURE mode (config.captureBackground). When true, the SW-held debugger has focus
   *  emulation ON (Emulation.setFocusEmulationEnabled), so Chrome treats the tab as focused/visible even
   *  while backgrounded — TikTok never throttles it and pagination keeps running. The hidden flag may
   *  still read true, but "hidden" is no longer a reason to act: this verdict returns "ok" regardless.
   *  The normal arrival-stall path (scrollWatch) is the only thing that can still conclude the run. */
  backgroundMode?: boolean;
}

/**
 * Decide whether a hidden tab has stalled long enough to act on. Only "hidden_stalled" when the tab is
 * hidden AND no healthy page has arrived for `graceMs` — a hidden tab that is STILL paginating is fine
 * (the SW-driven wheel is surviving the background), and a visible tab is always fine.
 *
 * With `backgroundMode` on (focus emulation applied on the debugger attach), a hidden tab is treated as
 * running normally: we NEVER pause merely for being hidden — trust the emulation and let only the normal
 * arrival-stall path decide the run. The hidden-pause is thus a FALLBACK for when backgroundMode is off.
 */
export function assessVisibility(inp: VisibilityInputs): VisibilityVerdict {
  if (inp.backgroundMode) return "ok"; // focus emulation keeps the hidden tab live — hidden is not "stalled"
  const grace = inp.graceMs ?? HIDDEN_STALL_GRACE_MS;
  if (inp.hidden && inp.msSinceHealthy >= grace) return "hidden_stalled";
  return "ok";
}
