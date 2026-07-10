// Tests for the geometry-driven motion+completion reducer — the re-founded continuous-scroll fix
// (§6.1). Every expectation is hand-computed from the exported constants; no Date.now, no Math.random.
// The load-bearing invariant under test: `done` comes ONLY from a `terminal` input; reaching the bottom
// with the loader dead is `exhausted` (a distinct reported-incomplete), NEVER a false `done`.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  stepDrive,
  initialDriveState,
  FRONTIER_GAP_FRAC,
  STUCK_MS,
  MAX_STUCK_RETRIGGERS,
  type DriveState,
  type DriveInputs,
} from "./scrollDrive.js";

// A fixed geometry: clientHeight 1000, scrollHeight 10000 ⇒ maxScroll 9000, frontier threshold
// 9000 − 0.75·1000 = 8250. scrollTop ≥ 8250 is "at frontier"; below it is "content ahead".
const CLIENT = 1000;
const HEIGHT = 10000;
const MAXSCROLL = HEIGHT - CLIENT; // 9000
const FRONTIER = MAXSCROLL - FRONTIER_GAP_FRAC * CLIENT; // 8250

/** Convenience input builder — every field explicit, overridable per test. */
function inputs(over: Partial<DriveInputs> = {}): DriveInputs {
  return {
    nowMs: 1000,
    scrollTop: 0,
    scrollHeight: HEIGHT,
    clientHeight: CLIENT,
    grewSinceLast: false,
    terminal: false,
    ...over,
  };
}

describe("drive constants (pinned so review can check the tuned bands)", () => {
  it("pins the frontier gap fraction, stuck window, and jiggle budget", () => {
    expect(FRONTIER_GAP_FRAC).toBe(0.75);
    expect(STUCK_MS).toBe(2500);
    expect(MAX_STUCK_RETRIGGERS).toBe(4);
  });
});

describe("initialDriveState", () => {
  it("starts advancing, growth-anchored at now(), zero jiggles", () => {
    expect(initialDriveState(4242)).toEqual({
      mode: "advance",
      lastGrowthMs: 4242,
      stuckRetriggers: 0,
      updatedAt: 4242,
    });
  });
});

describe("stepDrive — terminal is the ONLY completion, and it wins over everything", () => {
  it("terminal:true ⇒ done, even at the frontier and even mid-stuck", () => {
    const stuck: DriveState = { mode: "retrigger", lastGrowthMs: 0, stuckRetriggers: 3, updatedAt: 0 };
    const { state, mode } = stepDrive(stuck, inputs({ nowMs: 99999, scrollTop: MAXSCROLL, terminal: true }));
    expect(mode).toBe("done");
    expect(state.mode).toBe("done");
  });

  it("terminal:true ⇒ done even while content is still ahead (geometry cannot veto a verified terminal)", () => {
    const { mode } = stepDrive(initialDriveState(0), inputs({ scrollTop: 0, terminal: true }));
    expect(mode).toBe("done");
  });

  it("done is absorbing — no later input re-opens capture", () => {
    const done = stepDrive(initialDriveState(0), inputs({ terminal: true })).state;
    // Feed a non-terminal, content-ahead, growing tick — still done.
    const after = stepDrive(done, inputs({ nowMs: 5000, scrollTop: 0, grewSinceLast: true, terminal: false }));
    expect(after.mode).toBe("done");
    expect(after.state.mode).toBe("done");
    expect(after.state.updatedAt).toBe(5000); // now() still flows in (observability), deterministically
  });
});

describe("stepDrive — advance vs hold (the self-pacing frontier clamp)", () => {
  it("content ahead (scrollTop below the frontier) ⇒ advance", () => {
    const { state, mode } = stepDrive(initialDriveState(0), inputs({ scrollTop: FRONTIER - 1 }));
    expect(mode).toBe("advance");
    expect(state.mode).toBe("advance");
  });

  it("content ahead beats a stuck timer — advance even when STUCK_MS has elapsed with no growth", () => {
    const old: DriveState = { mode: "hold", lastGrowthMs: 0, stuckRetriggers: 0, updatedAt: 0 };
    const { mode } = stepDrive(old, inputs({ nowMs: STUCK_MS + 5000, scrollTop: 0 }));
    expect(mode).toBe("advance"); // not-at-frontier is checked before any stuck logic
  });

  it("at the frontier with growth inside STUCK_MS ⇒ hold (the next page is loading — sit and let it fire)", () => {
    const s: DriveState = { mode: "advance", lastGrowthMs: 1000, stuckRetriggers: 0, updatedAt: 1000 };
    const { mode } = stepDrive(s, inputs({ nowMs: 1000 + STUCK_MS - 1, scrollTop: MAXSCROLL }));
    expect(mode).toBe("hold");
  });

  it("the frontier boundary is inclusive: scrollTop exactly at the threshold is 'at frontier' (hold)", () => {
    const s: DriveState = { mode: "advance", lastGrowthMs: 1000, stuckRetriggers: 0, updatedAt: 1000 };
    const atThreshold = stepDrive(s, inputs({ nowMs: 1000, scrollTop: FRONTIER }));
    expect(atThreshold.mode).toBe("hold"); // >= threshold, recent growth ⇒ hold
    const justBelow = stepDrive(s, inputs({ nowMs: 1000, scrollTop: FRONTIER - 1 }));
    expect(justBelow.mode).toBe("advance");
  });
});

describe("stepDrive — grewSinceLast resets the stuck episode", () => {
  it("growth anchors lastGrowthMs at now() and clears stuckRetriggers", () => {
    const stuck: DriveState = { mode: "retrigger", lastGrowthMs: 1000, stuckRetriggers: 3, updatedAt: 1000 };
    // At the frontier, stale (would otherwise retrigger/exhaust) — but growth this tick resets it to hold.
    const { state, mode } = stepDrive(stuck, inputs({ nowMs: 9999, scrollTop: MAXSCROLL, grewSinceLast: true }));
    expect(mode).toBe("hold"); // reset window ⇒ now − lastGrowthMs = 0 < STUCK_MS
    expect(state.lastGrowthMs).toBe(9999);
    expect(state.stuckRetriggers).toBe(0);
  });
});

describe("stepDrive — the retrigger ladder and the exhausted boundary", () => {
  it("at the frontier, stale, with jiggles remaining ⇒ retrigger (spend one, reset the stuck window)", () => {
    const s: DriveState = { mode: "hold", lastGrowthMs: 1000, stuckRetriggers: 0, updatedAt: 1000 };
    const { state, mode } = stepDrive(s, inputs({ nowMs: 1000 + STUCK_MS, scrollTop: MAXSCROLL }));
    expect(mode).toBe("retrigger");
    expect(state.stuckRetriggers).toBe(1);
    expect(state.lastGrowthMs).toBe(1000 + STUCK_MS); // reset to now ⇒ the jiggle gets a fresh window
  });

  it("the retrigger→exhausted boundary is exact at MAX_STUCK_RETRIGGERS", () => {
    const stale = (stuckRetriggers: number): DriveState => ({ mode: "hold", lastGrowthMs: 0, stuckRetriggers, updatedAt: 0 });
    const now = STUCK_MS; // exactly STUCK_MS stale ⇒ past the growth window
    // One jiggle short of the cap ⇒ still retriggers (spends the last jiggle).
    const last = stepDrive(stale(MAX_STUCK_RETRIGGERS - 1), inputs({ nowMs: now, scrollTop: MAXSCROLL }));
    expect(last.mode).toBe("retrigger");
    expect(last.state.stuckRetriggers).toBe(MAX_STUCK_RETRIGGERS);
    // At the cap ⇒ exhausted (a reported incomplete — never a false done, never a silent stop).
    const done = stepDrive(stale(MAX_STUCK_RETRIGGERS), inputs({ nowMs: now, scrollTop: MAXSCROLL }));
    expect(done.mode).toBe("exhausted");
    expect(done.state.mode).toBe("exhausted");
  });

  it("full stuck episode: hold → retrigger×MAX_STUCK_RETRIGGERS → exhausted, advancing the clock by STUCK_MS", () => {
    // Start fresh; drive the frontier with no growth, stepping the clock by exactly STUCK_MS each tick.
    let state = initialDriveState(0);
    const seen: string[] = [];
    for (let i = 0; i <= MAX_STUCK_RETRIGGERS + 1; i++) {
      const r = stepDrive(state, inputs({ nowMs: i * STUCK_MS, scrollTop: MAXSCROLL }));
      state = r.state;
      seen.push(r.mode);
    }
    // t=0 hold (fresh growth window), then one retrigger per STUCK_MS window (each resets the window),
    // then exhausted once the jiggle budget is spent.
    expect(seen).toEqual([
      "hold",
      ...Array(MAX_STUCK_RETRIGGERS).fill("retrigger"),
      "exhausted",
    ]);
  });

  it("a growth arrival mid-ladder rescues the run back to hold (jiggle count cleared)", () => {
    let state = initialDriveState(0);
    ({ state } = stepDrive(state, inputs({ nowMs: STUCK_MS, scrollTop: MAXSCROLL }))); // retrigger #1
    expect(state.stuckRetriggers).toBe(1);
    // Now a page finally loads → growth: back to hold, stuckRetriggers cleared.
    const r = stepDrive(state, inputs({ nowMs: STUCK_MS + 500, scrollTop: MAXSCROLL, grewSinceLast: true }));
    expect(r.mode).toBe("hold");
    expect(r.state.stuckRetriggers).toBe(0);
  });
});

describe("stepDrive — determinism & purity", () => {
  it("same (state, inputs) ⇒ identical output, called twice", () => {
    const s: DriveState = { mode: "hold", lastGrowthMs: 100, stuckRetriggers: 2, updatedAt: 100 };
    const inp = inputs({ nowMs: 5000, scrollTop: MAXSCROLL });
    expect(stepDrive(s, inp)).toEqual(stepDrive(s, inp));
  });

  it("the module source has no Date.now / Math.random / DOM references (grep-verified)", () => {
    const src = readFileSync(fileURLToPath(new URL("./scrollDrive.ts", import.meta.url)), "utf8");
    expect(src).not.toMatch(/Math\.random/);
    expect(src).not.toMatch(/Date\.now/);
    expect(src).not.toMatch(/\bdocument\b/);
    expect(src).not.toMatch(/\bwindow\b/);
    expect(src).not.toMatch(/\bglobalThis\b/);
    expect(src).not.toMatch(/performance\./);
  });
});
