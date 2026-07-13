// Tests for the network-driven motion+completion reducer — the trusted-wheel lane fix (live-observed
// 2026-07-13). Every expectation is hand-computed from the exported STALL_MS; no Date.now, no
// Math.random. The load-bearing invariant under test: `done` comes ONLY from a `terminal` input; a
// stall (no healthy arrival for STALL_MS with no terminal) is `giveup` (a distinct reported-incomplete),
// NEVER a false `done`. And there is NO geometry, NO hold, NO retrigger — only advance/done/giveup.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  stepWatch,
  initialWatchState,
  STALL_MS,
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

describe("watch constants (pinned so review can check the tuned stall window)", () => {
  it("pins STALL_MS", () => {
    expect(STALL_MS).toBe(6000);
  });
});

describe("initialWatchState", () => {
  it("starts advancing, arrival-anchored at now()", () => {
    expect(initialWatchState(4242)).toEqual({
      mode: "advance",
      lastArrivalMs: 4242,
      updatedAt: 4242,
    });
  });
});

describe("stepWatch — terminal is the ONLY completion, and it wins over everything", () => {
  it("terminal:true ⇒ done, even deep into a stall", () => {
    const stalling: WatchState = { mode: "advance", lastArrivalMs: 0, updatedAt: 0 };
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
    // Feed a non-terminal, healthy-arriving tick — still done.
    const after = stepWatch(done, inputs({ nowMs: 5000, healthyArrivedSince: true, terminal: false }));
    expect(after.mode).toBe("done");
    expect(after.state.mode).toBe("done");
    expect(after.state.updatedAt).toBe(5000); // now() still flows in (observability), deterministically
  });
});

describe("stepWatch — a healthy arrival keeps the wheel advancing and re-anchors the stall timer", () => {
  it("healthyArrivedSince ⇒ advance, lastArrivalMs re-anchored to now()", () => {
    // Start with an old anchor that would otherwise be well past the stall window.
    const stale: WatchState = { mode: "advance", lastArrivalMs: 0, updatedAt: 0 };
    const { state, mode } = stepWatch(stale, inputs({ nowMs: STALL_MS + 5000, healthyArrivedSince: true }));
    expect(mode).toBe("advance");
    expect(state.lastArrivalMs).toBe(STALL_MS + 5000); // re-anchored ⇒ the stall timer restarts
  });

  it("a healthy arrival rescues a run that was one tick from giving up", () => {
    // Anchor at 0; a tick at exactly STALL_MS with a healthy arrival stays advancing (not giveup).
    const s: WatchState = { mode: "advance", lastArrivalMs: 0, updatedAt: 0 };
    const { mode, state } = stepWatch(s, inputs({ nowMs: STALL_MS, healthyArrivedSince: true }));
    expect(mode).toBe("advance");
    expect(state.lastArrivalMs).toBe(STALL_MS);
  });
});

describe("stepWatch — the stall→giveup boundary is exact at STALL_MS", () => {
  it("just inside the stall window (nowMs - lastArrivalMs < STALL_MS) ⇒ advance", () => {
    const s: WatchState = { mode: "advance", lastArrivalMs: 1000, updatedAt: 1000 };
    const { mode } = stepWatch(s, inputs({ nowMs: 1000 + STALL_MS - 1 }));
    expect(mode).toBe("advance");
  });

  it("exactly STALL_MS with no healthy arrival ⇒ giveup (boundary is inclusive)", () => {
    const s: WatchState = { mode: "advance", lastArrivalMs: 1000, updatedAt: 1000 };
    const { state, mode } = stepWatch(s, inputs({ nowMs: 1000 + STALL_MS }));
    expect(mode).toBe("giveup");
    expect(state.mode).toBe("giveup");
    expect(state.lastArrivalMs).toBe(1000); // anchor preserved (no arrival to move it)
  });

  it("well past STALL_MS with no arrival ⇒ giveup", () => {
    const s: WatchState = { mode: "advance", lastArrivalMs: 0, updatedAt: 0 };
    const { mode } = stepWatch(s, inputs({ nowMs: STALL_MS * 3 }));
    expect(mode).toBe("giveup");
  });
});

describe("stepWatch — a realistic run: advance while pages flow, then giveup on a stall", () => {
  it("keeps advancing across arriving pages, then gives up STALL_MS after the last one", () => {
    let state = initialWatchState(0);
    const seen: string[] = [];
    // Three healthy arrivals, one per second — all advance, each re-anchoring the timer.
    for (let t = 1000; t <= 3000; t += 1000) {
      const r = stepWatch(state, inputs({ nowMs: t, healthyArrivedSince: true }));
      state = r.state;
      seen.push(r.mode);
    }
    // Then the loader dies. Ticks with no arrival: advance until STALL_MS since the last arrival (3000).
    for (let t = 4000; t <= 3000 + STALL_MS; t += 1000) {
      const r = stepWatch(state, inputs({ nowMs: t, healthyArrivedSince: false }));
      state = r.state;
      seen.push(r.mode);
    }
    expect(seen).toEqual([
      "advance", // t=1000 (arrival)
      "advance", // t=2000 (arrival)
      "advance", // t=3000 (arrival, last anchor)
      "advance", // t=4000 (3000ms into the stall)
      "advance", // t=5000
      "advance", // t=6000
      "advance", // t=7000
      "advance", // t=8000
      "giveup", // t=9000 == 3000 + STALL_MS ⇒ conceded
    ]);
  });
});

describe("stepWatch — determinism & purity", () => {
  it("same (state, inputs) ⇒ identical output, called twice", () => {
    const s: WatchState = { mode: "advance", lastArrivalMs: 100, updatedAt: 100 };
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
