// Tests for the liveness watchdog. Hand-computed from MAX_WEDGE_RETRIES; pure.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { stepWatchdog, initialWatchdog, MAX_WEDGE_RETRIES, type WatchdogState } from "./watchdog.js";

describe("stepWatchdog — bounded re-nudge, then concede", () => {
  it("retries up to MAX_WEDGE_RETRIES, then concedes", () => {
    let state = initialWatchdog();
    const actions: string[] = [];
    for (let i = 0; i < MAX_WEDGE_RETRIES + 2; i++) {
      const r = stepWatchdog(state);
      state = r.state;
      actions.push(r.action);
    }
    // MAX retries of "retry", then "concede" forever after.
    const expected = [
      ...Array(MAX_WEDGE_RETRIES).fill("retry"),
      "concede",
      "concede",
    ];
    expect(actions).toEqual(expected);
  });

  it("each retry advances the retry count by exactly one", () => {
    const s0 = initialWatchdog();
    const r1 = stepWatchdog(s0);
    expect(r1.action).toBe("retry");
    expect(r1.state.retries).toBe(1);
    const r2 = stepWatchdog(r1.state);
    expect(r2.state.retries).toBe(2);
  });

  it("concede does not advance the state (idempotent once budget is spent)", () => {
    const spent: WatchdogState = { retries: MAX_WEDGE_RETRIES };
    const r = stepWatchdog(spent);
    expect(r.action).toBe("concede");
    expect(r.state.retries).toBe(MAX_WEDGE_RETRIES);
  });

  it("a fresh watchdog (reset on healthy arrival) retries again", () => {
    // Simulate: wedge → retries exhausted → a healthy arrival resets → wedge again gets fresh retries.
    let state: WatchdogState = { retries: MAX_WEDGE_RETRIES };
    expect(stepWatchdog(state).action).toBe("concede");
    state = initialWatchdog(); // glue resets on healthy arrival
    expect(stepWatchdog(state).action).toBe("retry");
  });
});

describe("purity", () => {
  it("the module source has no Date.now / Math.random / DOM references (grep-verified)", () => {
    const src = readFileSync(fileURLToPath(new URL("./watchdog.ts", import.meta.url)), "utf8");
    expect(src).not.toMatch(/Math\.random/);
    expect(src).not.toMatch(/Date\.now/);
    expect(src).not.toMatch(/\bdocument\b/);
    expect(src).not.toMatch(/\bwindow\b/);
  });
});
