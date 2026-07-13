// Tests for the network-driven motion+completion reducer — the trusted-wheel lane fix (live-observed
// 2026-07-13), now with the genuine-stall UP-nudge re-added as a first-class `retrigger` mode. Every
// expectation is hand-computed from the exported constants; no Date.now, no Math.random. Load-bearing
// invariants under test:
//   • `done` comes ONLY from a `terminal` input; a stall is NEVER a false `done`.
//   • the up-nudge (`retrigger`) fires on an ARRIVAL-stall (~RETRIGGER_AFTER_MS), NOT on geometry, so it
//     never fires during healthy scrolling (the old bug) — a healthy arrival at any point resets it.
//   • nudges are spaced by RETRIGGER_COOLDOWN_MS and bounded by MAX_RETRIGGERS; only after they're spent
//     AND the run is still stalled past STALL_MS does it honestly `giveup`.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  stepWatch,
  initialWatchState,
  STALL_MS,
  RETRIGGER_AFTER_MS,
  RETRIGGER_COOLDOWN_MS,
  MAX_RETRIGGERS,
  type WatchState,
  type WatchInputs,
} from "./scrollWatch.js";

/** Convenience input builder — every field explicit, overridable per test. */
function inputs(over: Partial<WatchInputs> = {}): WatchInputs {
  return {
    nowMs: 1000,
    healthyArrivedSince: false,
    terminal: false,
    ...over,
  };
}

describe("watch constants (pinned so review can check the tuned windows)", () => {
  it("pins the retrigger + stall windows", () => {
    expect(RETRIGGER_AFTER_MS).toBe(1800);
    expect(RETRIGGER_COOLDOWN_MS).toBe(1200);
    expect(MAX_RETRIGGERS).toBe(4);
    expect(STALL_MS).toBe(6000);
  });
});

describe("initialWatchState", () => {
  it("starts advancing, arrival-anchored at now(), no nudges spent", () => {
    expect(initialWatchState(4242)).toEqual({
      mode: "advance",
      lastArrivalMs: 4242,
      retriggers: 0,
      lastRetriggerMs: 4242,
      updatedAt: 4242,
    });
  });
});

describe("stepWatch — terminal is the ONLY completion, and it wins over everything", () => {
  it("terminal:true ⇒ done, even deep into a stall", () => {
    const stalling: WatchState = { mode: "advance", lastArrivalMs: 0, retriggers: 3, lastRetriggerMs: 0, updatedAt: 0 };
    const { state, mode } = stepWatch(stalling, inputs({ nowMs: 99999, terminal: true }));
    expect(mode).toBe("done");
    expect(state.mode).toBe("done");
  });

  it("terminal:true ⇒ done even while a healthy page is also arriving (terminal wins)", () => {
    const { mode } = stepWatch(initialWatchState(0), inputs({ healthyArrivedSince: true, terminal: true }));
    expect(mode).toBe("done");
  });

  it("done is absorbing — no later input re-opens capture", () => {
    const done = stepWatch(initialWatchState(0), inputs({ terminal: true })).state;
    const after = stepWatch(done, inputs({ nowMs: 5000, healthyArrivedSince: true, terminal: false }));
    expect(after.mode).toBe("done");
    expect(after.state.mode).toBe("done");
    expect(after.state.updatedAt).toBe(5000); // now() still flows in (observability), deterministically
  });
});

describe("stepWatch — a healthy arrival keeps the wheel advancing, re-anchors the timer, clears nudges", () => {
  it("healthyArrivedSince ⇒ advance, lastArrivalMs re-anchored, retriggers cleared", () => {
    // An old anchor well past the stall window AND some nudges already spent — a healthy arrival rescues it.
    const stale: WatchState = { mode: "retrigger", lastArrivalMs: 0, retriggers: 3, lastRetriggerMs: 4000, updatedAt: 4000 };
    const { state, mode } = stepWatch(stale, inputs({ nowMs: STALL_MS + 5000, healthyArrivedSince: true }));
    expect(mode).toBe("advance");
    expect(state.lastArrivalMs).toBe(STALL_MS + 5000); // re-anchored ⇒ the stall timer restarts
    expect(state.retriggers).toBe(0); // nudge budget refilled
  });

  it("a healthy arrival at the stall boundary keeps advancing (not retrigger, not giveup)", () => {
    const s: WatchState = { mode: "advance", lastArrivalMs: 0, retriggers: 0, lastRetriggerMs: 0, updatedAt: 0 };
    const { mode, state } = stepWatch(s, inputs({ nowMs: STALL_MS, healthyArrivedSince: true }));
    expect(mode).toBe("advance");
    expect(state.lastArrivalMs).toBe(STALL_MS);
  });
});

describe("stepWatch — healthy scrolling NEVER retriggers (the old up-jiggle bug stays dead)", () => {
  it("inside the retrigger window with no arrival ⇒ still advancing (no premature nudge)", () => {
    const s: WatchState = { mode: "advance", lastArrivalMs: 1000, retriggers: 0, lastRetriggerMs: 1000, updatedAt: 1000 };
    const { mode } = stepWatch(s, inputs({ nowMs: 1000 + RETRIGGER_AFTER_MS - 1 }));
    expect(mode).toBe("advance");
  });

  it("a run that keeps getting healthy pages every second never retriggers", () => {
    let state = initialWatchState(0);
    const modes: string[] = [];
    for (let t = 1000; t <= 20000; t += 1000) {
      const r = stepWatch(state, inputs({ nowMs: t, healthyArrivedSince: true }));
      state = r.state;
      modes.push(r.mode);
    }
    expect(modes.every((m) => m === "advance")).toBe(true);
    expect(state.retriggers).toBe(0);
  });
});

describe("stepWatch — the genuine-stall up-nudge fires SOON, spaced, and bounded", () => {
  it("first nudge fires exactly at RETRIGGER_AFTER_MS (boundary inclusive), consuming one nudge", () => {
    const s: WatchState = { mode: "advance", lastArrivalMs: 0, retriggers: 0, lastRetriggerMs: 0, updatedAt: 0 };
    const { state, mode } = stepWatch(s, inputs({ nowMs: RETRIGGER_AFTER_MS }));
    expect(mode).toBe("retrigger");
    expect(state.retriggers).toBe(1);
    expect(state.lastRetriggerMs).toBe(RETRIGGER_AFTER_MS);
    expect(state.lastArrivalMs).toBe(0); // anchor preserved — no arrival moved it
  });

  it("just before RETRIGGER_AFTER_MS ⇒ still advancing", () => {
    const s: WatchState = { mode: "advance", lastArrivalMs: 0, retriggers: 0, lastRetriggerMs: 0, updatedAt: 0 };
    const { mode } = stepWatch(s, inputs({ nowMs: RETRIGGER_AFTER_MS - 1 }));
    expect(mode).toBe("advance");
  });

  it("a second nudge is BLOCKED until the cooldown elapses (advance in between)", () => {
    // One nudge just fired at t=1800. dt is past the retrigger window, but the cooldown gates the next.
    const afterFirst: WatchState = { mode: "retrigger", lastArrivalMs: 0, retriggers: 1, lastRetriggerMs: 1800, updatedAt: 1800 };
    // Still inside the cooldown → advance, no new nudge.
    const mid = stepWatch(afterFirst, inputs({ nowMs: 1800 + RETRIGGER_COOLDOWN_MS - 1 }));
    expect(mid.mode).toBe("advance");
    expect(mid.state.retriggers).toBe(1);
    // Cooldown elapsed → the second nudge fires.
    const next = stepWatch(afterFirst, inputs({ nowMs: 1800 + RETRIGGER_COOLDOWN_MS }));
    expect(next.mode).toBe("retrigger");
    expect(next.state.retriggers).toBe(2);
    expect(next.state.lastRetriggerMs).toBe(1800 + RETRIGGER_COOLDOWN_MS);
  });

  it("stops nudging once MAX_RETRIGGERS is spent (advance, not another retrigger)", () => {
    const spent: WatchState = { mode: "advance", lastArrivalMs: 0, retriggers: MAX_RETRIGGERS, lastRetriggerMs: 5400, updatedAt: 5400 };
    // dt well past the retrigger window + cooldown, but the budget is spent → no nudge, and not yet giveup.
    const { mode } = stepWatch(spent, inputs({ nowMs: 5800 })); // dt 5800 < STALL_MS
    expect(mode).toBe("advance");
  });
});

describe("stepWatch — giveup only AFTER the nudges are spent AND the ceiling is passed", () => {
  it("nudges spent + dt ≥ STALL_MS ⇒ giveup (boundary inclusive)", () => {
    const spent: WatchState = { mode: "advance", lastArrivalMs: 0, retriggers: MAX_RETRIGGERS, lastRetriggerMs: 5400, updatedAt: 5400 };
    const { state, mode } = stepWatch(spent, inputs({ nowMs: STALL_MS }));
    expect(mode).toBe("giveup");
    expect(state.mode).toBe("giveup");
    expect(state.lastArrivalMs).toBe(0);
  });

  it("past STALL_MS but nudges NOT yet spent ⇒ prefers a nudge (retrigger), never a premature giveup", () => {
    // Sparse ticks: only 2 nudges spent by the time dt passes STALL_MS. We must nudge, not concede.
    const s: WatchState = { mode: "advance", lastArrivalMs: 0, retriggers: 2, lastRetriggerMs: 3000, updatedAt: 3000 };
    const { mode, state } = stepWatch(s, inputs({ nowMs: STALL_MS + 500 }));
    expect(mode).toBe("retrigger"); // budget remains → nudge wins over the ceiling
    expect(state.retriggers).toBe(3);
  });
});

describe("stepWatch — a realistic stall: advance → 4 nudges spaced ~cooldown → giveup", () => {
  it("walks the full genuine-stall lifecycle at a 250ms observer cadence", () => {
    // Anchor the last healthy arrival at t=0; no further arrivals. Tick every 250ms and record transitions.
    let state = initialWatchState(0);
    const nudgeTimes: number[] = [];
    let gaveUpAt: number | null = null;
    for (let t = 250; t <= 8000 && gaveUpAt == null; t += 250) {
      const r = stepWatch(state, inputs({ nowMs: t, healthyArrivedSince: false }));
      state = r.state;
      if (r.mode === "retrigger") nudgeTimes.push(t);
      if (r.mode === "giveup") gaveUpAt = t;
    }
    // Exactly MAX_RETRIGGERS nudges, first at ~RETRIGGER_AFTER_MS, spaced ≥ cooldown, then an honest giveup.
    expect(nudgeTimes.length).toBe(MAX_RETRIGGERS);
    // First nudge lands on the first observer tick at/after RETRIGGER_AFTER_MS (250ms cadence ⇒ t=2000).
    expect(nudgeTimes[0]).toBeGreaterThanOrEqual(RETRIGGER_AFTER_MS);
    expect(nudgeTimes[0]).toBeLessThan(RETRIGGER_AFTER_MS + 250);
    for (let i = 1; i < nudgeTimes.length; i++) {
      expect(nudgeTimes[i]! - nudgeTimes[i - 1]!).toBeGreaterThanOrEqual(RETRIGGER_COOLDOWN_MS);
    }
    expect(gaveUpAt).not.toBeNull();
    expect(gaveUpAt!).toBeGreaterThanOrEqual(STALL_MS); // conceded no earlier than the ceiling
  });
});

describe("stepWatch — determinism & purity", () => {
  it("same (state, inputs) ⇒ identical output, called twice", () => {
    const s: WatchState = { mode: "advance", lastArrivalMs: 100, retriggers: 1, lastRetriggerMs: 100, updatedAt: 100 };
    const inp = inputs({ nowMs: 5000 });
    expect(stepWatch(s, inp)).toEqual(stepWatch(s, inp));
  });

  it("the module source has no Date.now / Math.random / DOM references (grep-verified)", () => {
    const src = readFileSync(fileURLToPath(new URL("./scrollWatch.ts", import.meta.url)), "utf8");
    expect(src).not.toMatch(/Math\.random/);
    expect(src).not.toMatch(/Date\.now/);
    expect(src).not.toMatch(/\bdocument\b/);
    expect(src).not.toMatch(/\bwindow\b/);
    expect(src).not.toMatch(/\bglobalThis\b/);
    expect(src).not.toMatch(/performance\./);
  });
});
