// Pure up-nudge clamp for the retrigger motion (SCROLL-01 / §6.1, eviction interaction §6.4).
//
// The retrigger (scrollMotion.ts `retrigger` command) scrolls UP by a jittered upPx, then back down
// past the prior max, so TikTok's edge-triggered IntersectionObserver sentinel leaves and re-enters
// the viewport and re-fires. But eviction (pruneGrid) REMOVES the oldest tiles: the scroll content
// above the topmost LIVE tile is gone. Scrolling up into that evicted region is pointless (there is
// nothing to see) and risks confusing the virtualized grid — so the up-distance must stay AT or BELOW
// the topmost live tile's top.
//
// This is the pure clamp: given the desired up-distance and two content-space measurements the glue
// reads from the DOM (the scroller's current scrollTop, and the topmost live tile's top offset in the
// same content coordinates), return the largest safe up-distance. No DOM, no clock, no RNG here — the
// glue owns the reads (offsetTop / getBoundingClientRect), this owns the arithmetic, so the clamp is a
// deterministic unit test rather than a live-run gamble (invariant §5.1).

/**
 * The largest up-scroll (px) that keeps the viewport top AT or BELOW the topmost live tile — i.e. that
 * never scrolls up into evicted space above it.
 *
 * Both `scrollTop` and `topmostTileTop` are in the scroller's CONTENT coordinate space (distance from
 * the top of the scrollable content): `scrollTop` is where the viewport top currently sits, and
 * `topmostTileTop` is where the oldest still-present tile begins. The headroom we may scroll up before
 * the viewport top reaches that tile is `scrollTop - topmostTileTop`.
 *
 *  - Result is clamped to `[0, desiredUp]`: never negative (when the topmost tile is already at/below
 *    the viewport top there is no live content above to scroll into → 0), and never more than asked.
 *  - When the glue has no tile to measure it passes `topmostTileTop = 0` (the top of the scroller),
 *    so the fallback bound is simply `scrollTop` — scroll up no further than the content top.
 *
 * @param desiredUp      the up-distance the motion core asked for (already band-clamped to UP_PX_MAX).
 * @param scrollTop      scroller.scrollTop (content-space position of the viewport top).
 * @param topmostTileTop content-space top offset of the topmost live tile (0 = top of scroller).
 */
export function clampUpPx(desiredUp: number, scrollTop: number, topmostTileTop: number): number {
  const headroom = scrollTop - topmostTileTop;
  const safe = Math.min(desiredUp, headroom);
  return Math.max(0, Math.round(safe));
}
