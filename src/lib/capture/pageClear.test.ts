// Tests for the mid-run page-CLEAR detector (live symptom 2026-07-13: the grid "completely
// stopped/cleared" at ~6k). The load-bearing property: a clear is a TRANSITION (populated → empty),
// never just "few tiles" — so the initial empty grid and eviction's live-window trims can't forge one,
// but TikTok's flagged "Something went wrong" / a discard that wipes a populated grid do.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  stepPageClear,
  initialPageClearState,
  POPULATED_MIN_TILES,
  CLEARED_MAX_TILES,
  type PageClearState,
} from "./pageClear.js";

describe("pageClear constants", () => {
  it("populated threshold sits well above the initial/first-page count and below the live window", () => {
    expect(POPULATED_MIN_TILES).toBe(12);
    expect(CLEARED_MAX_TILES).toBe(2);
    expect(CLEARED_MAX_TILES).toBeLessThan(POPULATED_MIN_TILES);
  });
});

describe("stepPageClear — a clear is a POPULATED→EMPTY transition, never just 'few tiles'", () => {
  it("the initial empty grid is NOT a clear (never populated yet)", () => {
    const { cleared, state } = stepPageClear(initialPageClearState(), { tiles: 0, errorState: false });
    expect(cleared).toBe(false);
    expect(state.peakTiles).toBe(0);
  });

  it("a grid filling up is not a clear; peakTiles climbs monotonically", () => {
    let state = initialPageClearState();
    for (const tiles of [4, 20, 60, 60]) {
      const r = stepPageClear(state, { tiles, errorState: false });
      state = r.state;
      expect(r.cleared).toBe(false);
    }
    expect(state.peakTiles).toBe(60);
  });

  it("a populated grid collapsing to ~0 tiles IS a clear", () => {
    const populated: PageClearState = { peakTiles: 60 };
    const { cleared } = stepPageClear(populated, { tiles: 0, errorState: false });
    expect(cleared).toBe(true);
  });

  it("collapse to exactly CLEARED_MAX_TILES is a clear (boundary inclusive)", () => {
    const populated: PageClearState = { peakTiles: 40 };
    expect(stepPageClear(populated, { tiles: CLEARED_MAX_TILES, errorState: false }).cleared).toBe(true);
    expect(stepPageClear(populated, { tiles: CLEARED_MAX_TILES + 1, errorState: false }).cleared).toBe(false);
  });

  it("eviction's live-window trim (still many tiles) is NOT a clear", () => {
    const populated: PageClearState = { peakTiles: 200 };
    // Eviction never drops below its live window (60) — well above CLEARED_MAX_TILES.
    expect(stepPageClear(populated, { tiles: 60, errorState: false }).cleared).toBe(false);
  });
});

describe("stepPageClear — a visible error/empty-state clears a populated grid even with lingering tiles", () => {
  it("errorState + populated ⇒ clear, even if a few skeleton tiles remain", () => {
    const populated: PageClearState = { peakTiles: 30 };
    const { cleared } = stepPageClear(populated, { tiles: 5, errorState: true });
    expect(cleared).toBe(true);
  });

  it("errorState BEFORE the grid was ever populated ⇒ NOT a clear (nothing to lose)", () => {
    const fresh: PageClearState = { peakTiles: POPULATED_MIN_TILES - 1 };
    const { cleared } = stepPageClear(fresh, { tiles: 0, errorState: true });
    expect(cleared).toBe(false);
  });

  it("exactly POPULATED_MIN_TILES peak counts as populated (boundary inclusive)", () => {
    const atThreshold: PageClearState = { peakTiles: POPULATED_MIN_TILES };
    expect(stepPageClear(atThreshold, { tiles: 0, errorState: false }).cleared).toBe(true);
  });
});

describe("stepPageClear — determinism & purity", () => {
  it("same (state, inputs) ⇒ identical output", () => {
    const s: PageClearState = { peakTiles: 50 };
    const inp = { tiles: 1, errorState: false };
    expect(stepPageClear(s, inp)).toEqual(stepPageClear(s, inp));
  });

  it("no Date.now / Math.random / DOM references (grep-verified)", () => {
    const src = readFileSync(fileURLToPath(new URL("./pageClear.ts", import.meta.url)), "utf8");
    expect(src).not.toMatch(/Math\.random/);
    expect(src).not.toMatch(/Date\.now/);
    expect(src).not.toMatch(/\bdocument\b/);
    expect(src).not.toMatch(/\bwindow\b/);
    expect(src).not.toMatch(/\bglobalThis\b/);
    expect(src).not.toMatch(/performance\./);
  });
});
