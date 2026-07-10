// RED-first tests for DOM tile eviction — the §2.3 memory fix as a pure unit test. The function
// decides WHICH tiles are safe to remove; all DOM `.remove()` lives in content.js glue. Everything
// here is hand-computed against the exported DEFAULT_LIVE_WINDOW; no DOM, no clock, no rng.
import { describe, it, expect } from "vitest";
import { tilesToEvict, DEFAULT_LIVE_WINDOW } from "./pruneWindow.js";

describe("DEFAULT_LIVE_WINDOW (pinned so review can check the memory/functionality trade-off)", () => {
  it("keeps ~2-3 pages of tiles so TikTok's own scroll+append + the nudge keep working", () => {
    // Big enough that the appended-at-bottom loader sentinel and the last-item scrollIntoView
    // target both stay in the DOM; small enough to bound memory regardless of corpus size.
    expect(DEFAULT_LIVE_WINDOW).toBe(60);
  });
});

describe("tilesToEvict — never touch the live window", () => {
  it("hand-computed: total 100, window 60, none evicted yet ⇒ indices [0..39]", () => {
    const out = tilesToEvict(100, 60, 0);
    expect(out).toEqual(Array.from({ length: 40 }, (_, i) => i));
    expect(out.length).toBe(40);
  });

  it("never returns an index ≥ total − liveWindow (the live window is inviolate)", () => {
    const total = 100;
    const liveWindow = 60;
    const out = tilesToEvict(total, liveWindow, 0);
    for (const i of out) expect(i).toBeLessThan(total - liveWindow); // < 40
    expect(Math.max(...out)).toBe(total - liveWindow - 1); // 39, the last safe index
  });

  it("never returns an already-evicted index (min returned ≥ alreadyEvicted)", () => {
    const out = tilesToEvict(130, 60, 40);
    expect(Math.min(...out)).toBeGreaterThanOrEqual(40);
    expect(out).toEqual(Array.from({ length: 30 }, (_, i) => i + 40)); // [40..69]
  });
});

describe("tilesToEvict — empty when nothing is safe to remove", () => {
  it("total < liveWindow ⇒ []", () => {
    expect(tilesToEvict(10, 60, 0)).toEqual([]);
  });

  it("total === liveWindow ⇒ [] (every tile is live)", () => {
    expect(tilesToEvict(60, 60, 0)).toEqual([]);
  });

  it("total === 0 ⇒ []", () => {
    expect(tilesToEvict(0, 60, 0)).toEqual([]);
  });

  it("alreadyEvicted already at/past keepFrom ⇒ [] (never a negative range)", () => {
    // keepFrom = 100 − 60 = 40; we've somehow already evicted 50 → nothing left to evict.
    expect(tilesToEvict(100, 60, 50)).toEqual([]);
  });
});

describe("tilesToEvict — idempotence + monotonic growth (the resumable-poll contract)", () => {
  it("second call after evicting the first result returns nothing new when nothing grew", () => {
    const first = tilesToEvict(100, 60, 0); // [0..39]
    const newlyEvicted = first.length; // 40
    const second = tilesToEvict(100, 60, newlyEvicted); // total unchanged
    expect(second).toEqual([]);
  });

  it("as total grows, only the newly-safe indices are returned (never re-emitted)", () => {
    // Cycle 1: 100 tiles, evict [0..39]. Now alreadyEvicted = 40.
    const c1 = tilesToEvict(100, 60, 0);
    expect(c1).toEqual(Array.from({ length: 40 }, (_, i) => i));
    // Cycle 2: TikTok appended 30 more (total 130); only [40..69] become newly evictable.
    const c2 = tilesToEvict(130, 60, 40);
    expect(c2).toEqual(Array.from({ length: 30 }, (_, i) => i + 40));
    // No index is emitted twice across cycles.
    expect(c1.filter((i) => c2.includes(i))).toEqual([]);
  });

  it("the effective remove-count is always max(0, present − liveWindow) regardless of index labels", () => {
    // present = total − alreadyEvicted. The glue removes `result.length` oldest tiles, so the
    // count must equal present − liveWindow when present > liveWindow (drift-proof — see glue).
    const cases: Array<[number, number, number]> = [
      [100, 60, 0], // present 100 → remove 40
      [130, 60, 40], // present 90 → remove 30
      [80, 60, 40], // present 40 → remove 0
      [200, 60, 100], // present 100 → remove 40
    ];
    for (const [total, lw, ae] of cases) {
      const present = total - ae;
      expect(tilesToEvict(total, lw, ae).length).toBe(Math.max(0, present - lw));
    }
  });

  it("returns a contiguous ascending run of integers", () => {
    const out = tilesToEvict(250, 60, 30);
    expect(out.every((n) => Number.isInteger(n))).toBe(true);
    for (let k = 1; k < out.length; k++) expect(out[k]! - out[k - 1]!).toBe(1);
  });
});
