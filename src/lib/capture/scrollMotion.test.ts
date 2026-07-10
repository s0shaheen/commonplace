// Tests for the physical-motion reducer — the §6.1 SCROLL-01 fix. Everything is hand-computed from
// the exported constants with a sequenced/seeded rng; no Math.random, no Date.now, ever.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  stepMotion,
  initialMotionState,
  DOWN_PX_MIN,
  DOWN_PX_MAX,
  UP_PX_MIN,
  UP_PX_MAX,
  MAX_DOWN_STEPS,
  MAX_RETRIGGERS,
  type MotionState,
  type MotionInputs,
} from "./scrollMotion.js";

/** A deterministic rng that replays a fixed sequence (throws if over-drawn — pins draw count). */
function seq(values: number[]): () => number {
  let i = 0;
  return () => {
    if (i >= values.length) throw new Error(`rng over-drawn: ${values.length} values provided`);
    return values[i++]!;
  };
}

/** Convenience input builder — every field explicit, overridable per test. */
function inputs(over: Partial<MotionInputs> = {}): MotionInputs {
  return { now: 1000, arrivedSinceLast: false, requestsIssued: 0, dwellElapsedMs: 1500, ...over };
}

describe("motion constants (pinned so review can check the researched bands)", () => {
  it("pins the down/up bands and the down/retrigger budgets", () => {
    expect(DOWN_PX_MIN).toBe(400);
    expect(DOWN_PX_MAX).toBe(900);
    expect(UP_PX_MIN).toBe(300);
    expect(UP_PX_MAX).toBe(600);
    expect(MAX_DOWN_STEPS).toBe(4);
    expect(MAX_RETRIGGERS).toBe(3);
  });
});

describe("initialMotionState", () => {
  it("is a fresh stepping episode stamped with now()", () => {
    expect(initialMotionState(4242)).toEqual({
      phase: "stepping",
      noArrivalStreak: 0,
      downSteps: 0,
      retriggerAttempts: 0,
      lastRequestCount: 0,
      updatedAt: 4242,
    });
  });
});

describe("stepMotion — arrival branch (progress)", () => {
  it("arrival ⇒ down, resets streak+attempts, snapshots lastRequestCount, px in-band", () => {
    // Start mid-episode so the resets are observable.
    const state: MotionState = {
      phase: "retriggering",
      noArrivalStreak: 5,
      downSteps: 3,
      retriggerAttempts: 2,
      lastRequestCount: 3,
      updatedAt: 0,
    };
    const { state: next, command } = stepMotion(
      state,
      inputs({ arrivedSinceLast: true, requestsIssued: 7, now: 2000 }),
      { rng: seq([0.5]) },
    );
    expect(command).toEqual({ kind: "down", px: Math.round(DOWN_PX_MIN + 0.5 * (DOWN_PX_MAX - DOWN_PX_MIN)) });
    expect((command as { px: number }).px).toBeGreaterThanOrEqual(DOWN_PX_MIN);
    expect((command as { px: number }).px).toBeLessThanOrEqual(DOWN_PX_MAX);
    expect(next).toEqual({
      phase: "stepping",
      noArrivalStreak: 0,
      downSteps: 0, // reset on arrival
      retriggerAttempts: 0,
      lastRequestCount: 7, // snapshotted from requestsIssued
      updatedAt: 2000,
    });
  });

  it("down px is band-clamped at the rng extremes (0 ⇒ MIN, 1 ⇒ MAX)", () => {
    const s = initialMotionState(0);
    const lo = stepMotion(s, inputs({ arrivedSinceLast: true }), { rng: seq([0]) }).command;
    const hi = stepMotion(s, inputs({ arrivedSinceLast: true }), { rng: seq([1]) }).command;
    expect(lo).toEqual({ kind: "down", px: DOWN_PX_MIN });
    expect(hi).toEqual({ kind: "down", px: DOWN_PX_MAX });
  });
});

describe("PACE-03 — the down delta is genuine full-range jitter, never a fixed step", () => {
  it("two consecutive down commands with different rng ⇒ different px, both in-band", () => {
    const s = initialMotionState(0);
    const a = stepMotion(s, inputs({ arrivedSinceLast: true }), { rng: seq([0.1]) }).command as { px: number };
    const b = stepMotion(s, inputs({ arrivedSinceLast: true }), { rng: seq([0.9]) }).command as { px: number };
    expect(a.px).not.toBe(b.px);
    for (const px of [a.px, b.px]) {
      expect(px).toBeGreaterThanOrEqual(DOWN_PX_MIN);
      expect(px).toBeLessThanOrEqual(DOWN_PX_MAX);
    }
  });
});

describe("stepMotion — self-inflicted stall (no arrival, no new request) ⇒ down×N → retrigger×N → stall", () => {
  it("emits MAX_DOWN_STEPS downs, then MAX_RETRIGGERS retriggers, then a stall; streak climbs monotonically", () => {
    // After an arrival at requestsIssued=5, lastRequestCount=5. requestsIssued stays 5 (no request
    // fires) across the whole no-arrival episode ⇒ self-inflicted branch every step. The ladder now
    // travels DOWN first (to REACH a not-yet-hit sentinel) before it retriggers (to re-fire a fired one).
    let state: MotionState = {
      phase: "stepping",
      noArrivalStreak: 0,
      downSteps: 0,
      retriggerAttempts: 0,
      lastRequestCount: 5,
      updatedAt: 0,
    };
    const staticInputs = inputs({ arrivedSinceLast: false, requestsIssued: 5 });

    // Rung (a): plain-down travel, up to MAX_DOWN_STEPS. Each down draws rng from the DOWN band.
    for (let n = 1; n <= MAX_DOWN_STEPS; n++) {
      const { state: next, command } = stepMotion(state, staticInputs, { rng: seq([0.5]) });
      expect(command.kind).toBe("down");
      const px = (command as { px: number }).px;
      expect(px).toBeGreaterThanOrEqual(DOWN_PX_MIN);
      expect(px).toBeLessThanOrEqual(DOWN_PX_MAX);
      expect(next.phase).toBe("stepping");
      expect(next.downSteps).toBe(n);
      expect(next.retriggerAttempts).toBe(0); // retriggers untouched until the down budget is spent
      expect(next.noArrivalStreak).toBe(n);
      state = next;
    }

    // Rung (b): down budget spent ⇒ retrigger, up to MAX_RETRIGGERS. Each draws rng from the UP band.
    for (let n = 1; n <= MAX_RETRIGGERS; n++) {
      const { state: next, command } = stepMotion(state, staticInputs, { rng: seq([0.5]) });
      expect(command.kind).toBe("retrigger");
      const upPx = (command as { upPx: number }).upPx;
      expect(upPx).toBeGreaterThanOrEqual(UP_PX_MIN);
      expect(upPx).toBeLessThanOrEqual(UP_PX_MAX); // never larger than UP_PX_MAX (glue clamps down further)
      expect(next.phase).toBe("retriggering");
      expect(next.downSteps).toBe(MAX_DOWN_STEPS); // frozen at the cap
      expect(next.retriggerAttempts).toBe(n);
      expect(next.noArrivalStreak).toBe(MAX_DOWN_STEPS + n);
      state = next;
    }

    // Rung (c): both budgets spent ⇒ the exact boundary: a confirmed stall (no rng on this branch).
    const { state: after, command } = stepMotion(state, staticInputs, { rng: seq([]) });
    expect(command).toEqual({ kind: "stall" });
    expect(after.phase).toBe("stalled");
    expect(after.downSteps).toBe(MAX_DOWN_STEPS); // frozen, not incremented past the cap
    expect(after.retriggerAttempts).toBe(MAX_RETRIGGERS); // frozen, not incremented past the cap
    expect(after.noArrivalStreak).toBe(MAX_DOWN_STEPS + MAX_RETRIGGERS + 1);
  });

  it("first no-arrival step with the down budget spent ⇒ retrigger, band-clamped at rng=1 (never exceeds UP_PX_MAX)", () => {
    const state: MotionState = {
      phase: "stepping",
      noArrivalStreak: 0,
      downSteps: MAX_DOWN_STEPS, // down budget already spent ⇒ next self-inflicted step retriggers
      retriggerAttempts: 0,
      lastRequestCount: 5,
      updatedAt: 0,
    };
    const { command } = stepMotion(state, inputs({ requestsIssued: 5 }), { rng: seq([1]) });
    expect(command).toEqual({ kind: "retrigger", upPx: UP_PX_MAX });
  });

  it("first no-arrival step of a fresh episode ⇒ a plain DOWN (reach the sentinel), band-clamped", () => {
    const state: MotionState = {
      phase: "stepping",
      noArrivalStreak: 0,
      downSteps: 0,
      retriggerAttempts: 0,
      lastRequestCount: 5,
      updatedAt: 0,
    };
    const { command } = stepMotion(state, inputs({ requestsIssued: 5 }), { rng: seq([1]) });
    expect(command).toEqual({ kind: "down", px: DOWN_PX_MAX });
  });
});

describe("stepMotion — the requestsIssued discriminator (both directions)", () => {
  // downSteps at the cap so the NON-backoff (self-inflicted) branch resolves to `retrigger` — this
  // pins the discriminator itself (backoff vs not-backoff), independent of the down-travel rung.
  const base: MotionState = {
    phase: "stepping",
    noArrivalStreak: 0,
    downSteps: MAX_DOWN_STEPS,
    retriggerAttempts: 0,
    lastRequestCount: 5,
    updatedAt: 0,
  };

  it("no arrival BUT requestsIssued advanced ⇒ backoff (NOT retrigger) — server backpressure", () => {
    const { state: next, command } = stepMotion(
      base,
      inputs({ arrivedSinceLast: false, requestsIssued: 6, now: 3000 }),
      { rng: seq([]) }, // backoff draws no rng
    );
    expect(command).toEqual({ kind: "backoff" });
    expect(next.phase).toBe("stalled");
    expect(next.noArrivalStreak).toBe(1);
    expect(next.retriggerAttempts).toBe(0); // untouched — a retrigger was never attempted
    expect(next.downSteps).toBe(MAX_DOWN_STEPS); // untouched — a request fired, not self-inflicted travel
    expect(next.lastRequestCount).toBe(5); // NOT advanced — the request is still outstanding
    expect(next.updatedAt).toBe(3000);
  });

  it("same state, requestsIssued NOT advanced ⇒ retrigger — the discriminator flips", () => {
    const { command } = stepMotion(base, inputs({ requestsIssued: 5 }), { rng: seq([0.5]) });
    expect(command.kind).toBe("retrigger");
  });

  it("backpressure persists across steps while the request stays unanswered (never flips to retrigger)", () => {
    const s1 = stepMotion(base, inputs({ requestsIssued: 6 }), { rng: seq([]) }).state;
    const { command } = stepMotion(s1, inputs({ requestsIssued: 6 }), { rng: seq([]) });
    expect(command).toEqual({ kind: "backoff" });
  });
});

describe("stepMotion — determinism & purity", () => {
  it("same (state, inputs, rng-sequence) ⇒ identical output, called twice", () => {
    const state: MotionState = {
      phase: "retriggering",
      noArrivalStreak: 2,
      downSteps: MAX_DOWN_STEPS, // down budget spent ⇒ this no-arrival step draws rng for a retrigger
      retriggerAttempts: 1,
      lastRequestCount: 4,
      updatedAt: 100,
    };
    const inp = inputs({ arrivedSinceLast: false, requestsIssued: 4, now: 500 });
    const a = stepMotion(state, inp, { rng: seq([0.42]) });
    const b = stepMotion(state, inp, { rng: seq([0.42]) });
    expect(a).toEqual(b);

    // Also on the arrival branch (which consumes rng).
    const c = stepMotion(state, inputs({ arrivedSinceLast: true, requestsIssued: 9 }), { rng: seq([0.73]) });
    const d = stepMotion(state, inputs({ arrivedSinceLast: true, requestsIssued: 9 }), { rng: seq([0.73]) });
    expect(c).toEqual(d);
  });

  it("the module source has no Date.now / Math.random / DOM references (grep-verified)", () => {
    const src = readFileSync(fileURLToPath(new URL("./scrollMotion.ts", import.meta.url)), "utf8");
    expect(src).not.toMatch(/Math\.random/);
    expect(src).not.toMatch(/Date\.now/);
    expect(src).not.toMatch(/\bdocument\b/);
    expect(src).not.toMatch(/\bwindow\b/);
    expect(src).not.toMatch(/\bglobalThis\b/);
    expect(src).not.toMatch(/performance\./);
  });
});
