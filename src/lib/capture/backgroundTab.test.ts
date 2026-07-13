// Tests for background-tab resilience (Wave C). Pure; hand-computed from HIDDEN_STALL_GRACE_MS.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { assessVisibility, HIDDEN_STALL_GRACE_MS } from "./backgroundTab.js";

describe("assessVisibility", () => {
  it("a visible tab is always ok, however long since the last page", () => {
    expect(assessVisibility({ hidden: false, msSinceHealthy: 999_999 })).toBe("ok");
  });

  it("a hidden tab that is STILL paginating (recent healthy page) is ok", () => {
    expect(assessVisibility({ hidden: true, msSinceHealthy: HIDDEN_STALL_GRACE_MS - 1 })).toBe("ok");
  });

  it("a hidden tab with no healthy page for the grace window is hidden_stalled", () => {
    expect(assessVisibility({ hidden: true, msSinceHealthy: HIDDEN_STALL_GRACE_MS })).toBe("hidden_stalled");
    expect(assessVisibility({ hidden: true, msSinceHealthy: HIDDEN_STALL_GRACE_MS + 5000 })).toBe("hidden_stalled");
  });

  it("honors a custom grace window", () => {
    expect(assessVisibility({ hidden: true, msSinceHealthy: 3000, graceMs: 5000 })).toBe("ok");
    expect(assessVisibility({ hidden: true, msSinceHealthy: 5000, graceMs: 5000 })).toBe("hidden_stalled");
  });
});

describe("purity", () => {
  it("the module source has no Date.now / Math.random / DOM references (grep-verified)", () => {
    const src = readFileSync(fileURLToPath(new URL("./backgroundTab.ts", import.meta.url)), "utf8");
    expect(src).not.toMatch(/Math\.random/);
    expect(src).not.toMatch(/Date\.now/);
    expect(src).not.toMatch(/\bdocument\b/);
    expect(src).not.toMatch(/\bwindow\b/);
  });
});
