// Human-cadence pacing — the §2.2 fix for TikTok's ~360-item soft throttle, as a pure module.
//
// The recon fact this exists for (recon/0.1-findings.md:13): automated FAST scroll
// deterministically trips a ~360-item soft throttle (3 runs all stopped at 359); human-paced
// scrolling does not. Anti-bot throttles key on inhuman cadence/REGULARITY, so the fix is two
// pieces of timing, both jittered:
//
//   1. `nextDwellMs` — the pause between scroll nudges. A human scanning a grid does not pause on
//      a metronome: most inter-scroll gaps sit in a ~0.9–2.2 s band, and every handful of scrolls
//      they linger on something (an occasional longer "look"). We model exactly that: a uniform
//      base dwell 900–2200 ms, plus (with probability ~1/7 per nudge) an extra uniform
//      1500–4000 ms look-pause. Worst case 2200+4000 = 6200 ms, so the 6500 ms ceiling is a
//      safety clamp, never the shaper.
//
//   2. `backoffMs` — what to do when TikTok stops answering while hasMore is still true (the
//      throttle). Exponential from ~2 s, doubling per stall cycle, capped at 60 s, with a
//      multiplicative ×(1 + 0.15·rng) jitter so repeated waits never land on identical intervals.
//      Same shape as queue.ts's backoff; constants tuned for a rate-limit we must WAIT OUT, not a
//      transient API error.
//
// PURE: the rng is injected (no Math.random, no Date.now in here) — Math.random lives only in the
// content.js glue, mirroring queue.ts / scrollState.ts. Deterministic given the rng sequence.

/** Base (always-paid) dwell between scroll nudges: uniform in [MIN, MAX] ms. */
export const BASE_DWELL_MIN_MS = 900;
export const BASE_DWELL_MAX_MS = 2200;

/** The occasional longer "look" pause: taken with prob ~1/7 per nudge, adds uniform [MIN, MAX] ms. */
export const LONG_PAUSE_PROB = 1 / 7;
export const LONG_PAUSE_MIN_MS = 1500;
export const LONG_PAUSE_MAX_MS = 4000;

/** Hard clamp bounds — never dwell < floor, never > ceiling (ceiling is slack: max natural = 6200). */
export const DWELL_FLOOR_MS = 900;
export const DWELL_CEIL_MS = 6500;

/** Throttle backoff: 2s · 2^(stall-1), capped at 60s, ×(1 + 0.15·rng) jitter. */
export const BACKOFF_BASE_MS = 2000;
export const BACKOFF_MAX_MS = 60_000;
export const BACKOFF_JITTER = 0.15;

/**
 * The jittered human dwell before the next scroll nudge. Draws rng() up to three times:
 * base size, long-pause gate (strict `< LONG_PAUSE_PROB`), and (only if taken) long-pause size.
 */
export function nextDwellMs(rng: () => number): number {
  let ms = BASE_DWELL_MIN_MS + rng() * (BASE_DWELL_MAX_MS - BASE_DWELL_MIN_MS);
  if (rng() < LONG_PAUSE_PROB) {
    ms += LONG_PAUSE_MIN_MS + rng() * (LONG_PAUSE_MAX_MS - LONG_PAUSE_MIN_MS);
  }
  return Math.round(Math.min(Math.max(ms, DWELL_FLOOR_MS), DWELL_CEIL_MS));
}

/**
 * Capped exponential backoff for a throttle stall (scrollState's `wait`): 2000·2^(stallCount−1),
 * capped at 60 000, then ×(1 + 0.15·rng()). Monotonic non-decreasing in stallCount for a fixed
 * rng; with rng=0 the schedule at stall 1..8 is [2000, 4000, 8000, 16000, 32000, 60000, 60000, 60000].
 */
export function backoffMs(stallCount: number, rng: () => number): number {
  const capped = Math.min(BACKOFF_BASE_MS * 2 ** (stallCount - 1), BACKOFF_MAX_MS);
  return Math.round(capped * (1 + BACKOFF_JITTER * rng()));
}
