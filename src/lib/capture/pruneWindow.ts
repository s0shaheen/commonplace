// DOM tile eviction, pure — the §2.3 memory fix (the "slows at 1k, crashes at 3k" vector). TikTok
// appends grid tiles forever as you scroll and its own virtualization is unreliable at depth, so
// thousands of nodes + React fibers + decoded thumbnails accumulate until the renderer OOMs.
// content-visibility only skipped PAINT — it evicted nothing. This decides which tiles to actually
// remove. Capture is network-sourced (main-world intercepts item_list), so a tile carries ZERO
// corpus data once its page is captured — evicting it can never lose anything; it exists only to
// keep TikTok paginating. All `.remove()` calls live in content.js glue; this stays pure + tested.
//
// Model: TikTok appends at the END, so the newest tiles are the highest indices. We keep the most
// recent `liveWindow` tiles (indices [total−liveWindow, total)) and evict the older prefix.

/**
 * How many of the most-recent tiles to keep live in the DOM near the viewport bottom.
 *
 * Reasoned trade-off (pinned in the test): TikTok's saved/likes grid is ~4-6 tiles per row, so 60
 * tiles ≈ 10-15 rows ≈ 2-3 viewport pages. That is:
 *   • big enough that TikTok's own append/scroll math and its bottom loader sentinel stay in the DOM
 *     and keep firing, AND that the "scroll last item into view" nudge (content.js:nudgeToBottom)
 *     still has a real newest-tile to target — so pagination never stalls from our pruning;
 *   • small enough that DOM size is bounded by a CONSTANT (≈60 tiles) regardless of corpus size, so
 *     heap/DOM-nodes stay ~flat from 100 items to 5,000 — the whole point of Task 3.
 */
export const DEFAULT_LIVE_WINDOW = 60;

/**
 * Indices safe to remove from a grid of `total` logical tiles, given `alreadyEvicted` older tiles
 * already removed (a running count — indices [0, alreadyEvicted) are gone). Returns the newly-safe
 * prefix [alreadyEvicted, total − liveWindow), keeping the most-recent `liveWindow` tiles inviolate.
 *
 * Contract (see pruneWindow.test.ts):
 *   • never an index ≥ total − liveWindow (the live window is never touched);
 *   • never an already-evicted index (min ≥ alreadyEvicted);
 *   • idempotent — call again with alreadyEvicted advanced by the last result and, if nothing grew,
 *     you get []; monotonic — as `total` grows, only the newly-safe indices appear, never re-emitted;
 *   • [] when total ≤ liveWindow, and never a negative range.
 *
 * The glue removes `result.length` OLDEST tiles, so the effective remove-count is always
 * max(0, present − liveWindow) (present = total − alreadyEvicted) — independent of the absolute
 * index labels, which is what makes it robust to TikTok doing its own virtualized removals.
 */
export function tilesToEvict(total: number, liveWindow: number, alreadyEvicted: number): number[] {
  const keepFrom = total - liveWindow; // first index that belongs to the live window
  const end = Math.max(alreadyEvicted, keepFrom); // exclusive upper bound; clamps away negatives
  const out: number[] = [];
  for (let i = alreadyEvicted; i < end; i++) out.push(i);
  return out;
}
