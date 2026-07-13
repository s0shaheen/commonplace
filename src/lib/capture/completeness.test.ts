// Tests for the completeness verdict (COMPL-07). Pure; hand-computed from COMPLETENESS_MIN_RATIO.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { assessCompleteness, COMPLETENESS_MIN_RATIO } from "./completeness.js";

describe("assessCompleteness — a verified terminal is always done", () => {
  it("terminalDone ⇒ done, even when captured is below declared (a terminal is authoritative)", () => {
    expect(assessCompleteness({ terminalDone: true, captured: 10, declared: 1000 })).toBe("done");
  });

  it("terminalDone ⇒ done even with an unknown declared count", () => {
    expect(assessCompleteness({ terminalDone: true, captured: 500, declared: null })).toBe("done");
  });
});

describe("assessCompleteness — no terminal: suspicious vs giveup", () => {
  it("grossly below a known declared count ⇒ suspicious", () => {
    // 100 of a declared 1000 is 10% — far below 85%.
    expect(assessCompleteness({ terminalDone: false, captured: 100, declared: 1000 })).toBe("suspicious");
  });

  it("roughly in line with declared ⇒ giveup (not suspicious)", () => {
    // 950 of 1000 = 95% ≥ 85% → no strong short-fall signal.
    expect(assessCompleteness({ terminalDone: false, captured: 950, declared: 1000 })).toBe("giveup");
  });

  it("declared unknown ⇒ giveup (can't prove a short-fall)", () => {
    expect(assessCompleteness({ terminalDone: false, captured: 3, declared: null })).toBe("giveup");
  });

  it("declared zero or negative is ignored ⇒ giveup", () => {
    expect(assessCompleteness({ terminalDone: false, captured: 0, declared: 0 })).toBe("giveup");
  });
});

describe("assessCompleteness — the ratio boundary", () => {
  const declared = 1000;
  it("exactly at the threshold is NOT suspicious", () => {
    const atThreshold = Math.ceil(COMPLETENESS_MIN_RATIO * declared); // 850
    expect(assessCompleteness({ terminalDone: false, captured: atThreshold, declared })).toBe("giveup");
  });

  it("just below the threshold IS suspicious", () => {
    const justBelow = Math.floor(COMPLETENESS_MIN_RATIO * declared) - 1; // 849
    expect(assessCompleteness({ terminalDone: false, captured: justBelow, declared })).toBe("suspicious");
  });

  it("honors a custom minRatio", () => {
    expect(assessCompleteness({ terminalDone: false, captured: 600, declared: 1000, minRatio: 0.5 })).toBe("giveup");
    expect(assessCompleteness({ terminalDone: false, captured: 400, declared: 1000, minRatio: 0.5 })).toBe("suspicious");
  });
});

describe("purity", () => {
  it("the module source has no Date.now / Math.random / DOM references (grep-verified)", () => {
    const src = readFileSync(fileURLToPath(new URL("./completeness.ts", import.meta.url)), "utf8");
    expect(src).not.toMatch(/Math\.random/);
    expect(src).not.toMatch(/Date\.now/);
    expect(src).not.toMatch(/\bdocument\b/);
    expect(src).not.toMatch(/\bwindow\b/);
  });
});
