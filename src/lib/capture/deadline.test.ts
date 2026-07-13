// Tests for the run deadline (hung-run safety). Pure; injected clock.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { isPastDeadline, remainingMs, RUN_DEADLINE_MS } from "./deadline.js";

describe("isPastDeadline", () => {
  it("is false before the cap and true at/after it", () => {
    expect(isPastDeadline(0, RUN_DEADLINE_MS - 1)).toBe(false);
    expect(isPastDeadline(0, RUN_DEADLINE_MS)).toBe(true); // exactly the cap concedes
    expect(isPastDeadline(0, RUN_DEADLINE_MS + 5000)).toBe(true);
  });

  it("measures from the run's start, not absolute time", () => {
    const start = 1_000_000;
    expect(isPastDeadline(start, start + RUN_DEADLINE_MS - 1)).toBe(false);
    expect(isPastDeadline(start, start + RUN_DEADLINE_MS)).toBe(true);
  });

  it("honors a custom deadline", () => {
    expect(isPastDeadline(0, 5000, 6000)).toBe(false);
    expect(isPastDeadline(0, 6000, 6000)).toBe(true);
  });
});

describe("remainingMs", () => {
  it("counts down and clamps at zero", () => {
    expect(remainingMs(0, 0)).toBe(RUN_DEADLINE_MS);
    expect(remainingMs(0, 60_000)).toBe(RUN_DEADLINE_MS - 60_000);
    expect(remainingMs(0, RUN_DEADLINE_MS + 10_000)).toBe(0); // never negative
  });
});

describe("purity", () => {
  it("the module source has no Date.now / Math.random / DOM references (grep-verified)", () => {
    const src = readFileSync(fileURLToPath(new URL("./deadline.ts", import.meta.url)), "utf8");
    expect(src).not.toMatch(/Math\.random/);
    expect(src).not.toMatch(/Date\.now/);
    expect(src).not.toMatch(/\bdocument\b/);
    expect(src).not.toMatch(/\bwindow\b/);
  });
});
