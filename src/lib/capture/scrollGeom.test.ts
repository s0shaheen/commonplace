// Tests for the retrigger up-nudge clamp (SCROLL-01 / §6.1, eviction interaction §6.4). Hand-computed
// from the arithmetic; no DOM, no Date.now, no Math.random.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { clampUpPx } from "./scrollGeom.js";

describe("clampUpPx — the retrigger up-distance stays above the topmost live tile", () => {
  it("returns the desired up when there is ample headroom", () => {
    // viewport top at 5000, topmost live tile begins at 1000 → 4000px headroom, 600 desired ⇒ 600.
    expect(clampUpPx(600, 5000, 1000)).toBe(600);
  });

  it("clamps to the headroom when the desired up would overscroll into evicted space", () => {
    // Only 250px between the viewport top (1250) and the topmost tile (1000) → clamp 600 down to 250.
    expect(clampUpPx(600, 1250, 1000)).toBe(250);
  });

  it("returns 0 when the topmost tile is already at or below the viewport top (no live space above)", () => {
    // Topmost tile top (1400) is BELOW the viewport top (1200) ⇒ negative headroom ⇒ clamped to 0.
    expect(clampUpPx(600, 1200, 1400)).toBe(0);
    // Exactly at the viewport top ⇒ 0.
    expect(clampUpPx(600, 1400, 1400)).toBe(0);
  });

  it("falls back to scrollTop as the bound when no tile is measured (topmostTileTop = 0)", () => {
    // With no tile the glue passes 0 (top of scroller); headroom is the full scrollTop.
    expect(clampUpPx(600, 400, 0)).toBe(400); // desired 600 > 400 available ⇒ 400
    expect(clampUpPx(600, 900, 0)).toBe(600); // 900 available ⇒ full 600
  });

  it("never returns more than the desired up even with huge headroom", () => {
    expect(clampUpPx(300, 100000, 0)).toBe(300);
  });

  it("rounds to an integer px", () => {
    expect(clampUpPx(600, 1250.7, 1000.2)).toBe(Math.round(250.5));
  });

  it("is pure: no Date.now / Math.random / DOM references in the source", () => {
    const src = readFileSync(fileURLToPath(new URL("./scrollGeom.ts", import.meta.url)), "utf8");
    expect(src).not.toMatch(/Math\.random/);
    expect(src).not.toMatch(/Date\.now/);
    expect(src).not.toMatch(/\bdocument\b/);
    expect(src).not.toMatch(/\bwindow\b/);
  });
});
