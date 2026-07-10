// RED-first tests for human-cadence pacing — the §2.2 fix (the ~360-item soft throttle) as a unit
// test. Everything here is hand-computed from the exported constants with a sequenced/seeded rng;
// no Math.random, no Date.now, ever.
import { describe, it, expect } from "vitest";
import {
  nextDwellMs,
  backoffMs,
  BASE_DWELL_MIN_MS,
  BASE_DWELL_MAX_MS,
  LONG_PAUSE_PROB,
  LONG_PAUSE_MIN_MS,
  LONG_PAUSE_MAX_MS,
  DWELL_CEIL_MS,
  BACKOFF_BASE_MS,
  BACKOFF_MAX_MS,
  BACKOFF_JITTER,
} from "./pacing.js";

/** A deterministic rng that replays a fixed sequence (throws if over-drawn — pins draw count). */
function seq(values: number[]): () => number {
  let i = 0;
  return () => {
    if (i >= values.length) throw new Error(`rng over-drawn: ${values.length} values provided`);
    return values[i++]!;
  };
}

describe("pacing constants (pinned so review can check ranges)", () => {
  it("pins the founder-visible cadence constants", () => {
    expect(BASE_DWELL_MIN_MS).toBe(900);
    expect(BASE_DWELL_MAX_MS).toBe(2200);
    expect(LONG_PAUSE_PROB).toBeCloseTo(1 / 7);
    expect(LONG_PAUSE_MIN_MS).toBe(1500);
    expect(LONG_PAUSE_MAX_MS).toBe(4000);
    expect(DWELL_CEIL_MS).toBe(6500);
    expect(BACKOFF_BASE_MS).toBe(2000);
    expect(BACKOFF_MAX_MS).toBe(60_000);
    expect(BACKOFF_JITTER).toBeCloseTo(0.15);
  });
});

describe("nextDwellMs — jittered human dwell", () => {
  it("rng [0, high]: minimum base dwell, no long pause ⇒ exactly 900", () => {
    // r1=0 → base 900; r2=0.9 ≥ 1/7 → no long pause. Two draws exactly.
    expect(nextDwellMs(seq([0, 0.9]))).toBe(900);
  });

  it("rng [0.5, 0.5]: mid base dwell, no long pause ⇒ 900 + 0.5*1300 = 1550", () => {
    expect(nextDwellMs(seq([0.5, 0.5]))).toBe(1550);
  });

  it("long-pause branch driven deterministically: rng [0, 0, 0] ⇒ 900 + 1500 = 2400", () => {
    // r2=0 < 1/7 → the occasional longer "look" pause is taken; r3=0 → its minimum, 1500.
    expect(nextDwellMs(seq([0, 0, 0]))).toBe(2400);
  });

  it("long-pause maximum: rng [1, 0, 1] ⇒ 2200 + 4000 = 6200 (still ≤ ceiling)", () => {
    expect(nextDwellMs(seq([1, 0, 1]))).toBe(6200);
    expect(6200).toBeLessThanOrEqual(DWELL_CEIL_MS);
  });

  it("r2 exactly at the threshold (1/7) does NOT take the long pause (strict <)", () => {
    expect(nextDwellMs(seq([0, 1 / 7]))).toBe(900);
  });

  it("never < 900 and never > 6500 across the rng range, both branches", () => {
    const probes = [0, 0.01, 0.1, 1 / 7, 0.25, 0.5, 0.75, 0.99, 1];
    for (const r1 of probes) {
      for (const r3 of probes) {
        const noPause = nextDwellMs(seq([r1, 0.9]));
        expect(noPause).toBeGreaterThanOrEqual(900);
        expect(noPause).toBeLessThanOrEqual(6500);
        const withPause = nextDwellMs(seq([r1, 0, r3]));
        expect(withPause).toBeGreaterThanOrEqual(900);
        expect(withPause).toBeLessThanOrEqual(6500);
      }
    }
  });

  it("returns an integer (whole milliseconds)", () => {
    expect(Number.isInteger(nextDwellMs(seq([0.333, 0.9])))).toBe(true);
    expect(Number.isInteger(nextDwellMs(seq([0.333, 0, 0.777])))).toBe(true);
  });

  it("is deterministic given the same rng sequence", () => {
    expect(nextDwellMs(seq([0.42, 0.05, 0.42]))).toBe(nextDwellMs(seq([0.42, 0.05, 0.42])));
  });
});

describe("backoffMs — capped exponential from ~2s, throttle-shaped (queue.ts shape)", () => {
  it("hand-computed schedule at rng=0, stall 1..8: 2s doubling, capped at 60s", () => {
    const zero = () => 0;
    const schedule = [1, 2, 3, 4, 5, 6, 7, 8].map((n) => backoffMs(n, zero));
    expect(schedule).toEqual([2000, 4000, 8000, 16000, 32000, 60000, 60000, 60000]);
  });

  it("cap respected: even absurd stall counts never exceed 60s pre-jitter / 69s with max jitter", () => {
    expect(backoffMs(50, () => 0)).toBe(60_000);
    expect(backoffMs(50, () => 0.999999)).toBeLessThanOrEqual(Math.round(60_000 * (1 + BACKOFF_JITTER)));
  });

  it("jitter bound: result ∈ [capped, capped*(1+0.15)) — e.g. stall 3 with rng=0.5 ⇒ 8000*1.075 = 8600", () => {
    expect(backoffMs(3, () => 0.5)).toBe(8600);
    // lower bound (rng→0) and upper bound (rng→1) around the un-jittered value
    expect(backoffMs(3, () => 0)).toBe(8000);
    expect(backoffMs(3, () => 0.999999)).toBeLessThanOrEqual(Math.round(8000 * 1.15));
    expect(backoffMs(3, () => 0.999999)).toBeGreaterThanOrEqual(8000);
  });

  it("monotonic non-decreasing in stallCount up to and past the cap (fixed rng)", () => {
    const fixed = () => 0.5;
    let prev = 0;
    for (let stall = 1; stall <= 12; stall++) {
      const ms = backoffMs(stall, fixed);
      expect(ms).toBeGreaterThanOrEqual(prev);
      prev = ms;
    }
  });

  it("returns an integer (whole milliseconds)", () => {
    expect(Number.isInteger(backoffMs(2, () => 0.37))).toBe(true);
  });
});
