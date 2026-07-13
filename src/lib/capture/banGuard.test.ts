// Tests for the account-safety kill-switch (C7). Hand-computed from the exported ceilings; pure.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  shouldHaltForBlock,
  HTTP_ERROR_HALT_STREAK,
  CHALLENGE_HALT_CYCLES,
  BAN_HALT_REASON,
} from "./banGuard.js";

describe("shouldHaltForBlock", () => {
  it("does not halt below either ceiling", () => {
    expect(shouldHaltForBlock({ httpErrorStreak: 0, challengeCycles: 0 })).toBe(false);
    expect(shouldHaltForBlock({ httpErrorStreak: HTTP_ERROR_HALT_STREAK - 1, challengeCycles: 0 })).toBe(false);
    expect(shouldHaltForBlock({ httpErrorStreak: 0, challengeCycles: CHALLENGE_HALT_CYCLES - 1 })).toBe(false);
  });

  it("halts once the http_error streak reaches its ceiling", () => {
    expect(shouldHaltForBlock({ httpErrorStreak: HTTP_ERROR_HALT_STREAK, challengeCycles: 0 })).toBe(true);
    expect(shouldHaltForBlock({ httpErrorStreak: HTTP_ERROR_HALT_STREAK + 3, challengeCycles: 0 })).toBe(true);
  });

  it("halts once challenge cycles reach the ceiling (a re-blocking captcha)", () => {
    expect(shouldHaltForBlock({ httpErrorStreak: 0, challengeCycles: CHALLENGE_HALT_CYCLES })).toBe(true);
  });

  it("BAN_HALT_REASON is a non-empty, actionable string", () => {
    expect(BAN_HALT_REASON.length).toBeGreaterThan(10);
  });
});

describe("purity", () => {
  it("the module source has no Date.now / Math.random / DOM references (grep-verified)", () => {
    const src = readFileSync(fileURLToPath(new URL("./banGuard.ts", import.meta.url)), "utf8");
    expect(src).not.toMatch(/Math\.random/);
    expect(src).not.toMatch(/Date\.now/);
    expect(src).not.toMatch(/\bdocument\b/);
    expect(src).not.toMatch(/\bwindow\b/);
  });
});
