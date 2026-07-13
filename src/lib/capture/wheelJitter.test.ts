// Tests for the anti-block wheel cadence (C7 + PACE). Every expectation is hand-computed from the
// exported SPEED_PROFILES with a sequenced/seeded rng — no Math.random. The point under test: the
// cadence is JITTERED (delta + gap vary within a band) and STAYS FAST (never a metronome, never a crawl),
// with an occasional micro-pause when the gate opens.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { nextWheel, resolveSpeed, SPEED_PROFILES, type CaptureSpeed } from "./wheelJitter.js";

/** A deterministic rng that replays a fixed sequence (throws if over-drawn — pins draw count). */
function seq(values: number[]): () => number {
  let i = 0;
  return () => {
    if (i >= values.length) throw new Error(`rng over-drawn: ${values.length} values provided`);
    return values[i++]!;
  };
}

describe("resolveSpeed", () => {
  it("passes through valid speeds, defaults everything else to normal", () => {
    expect(resolveSpeed("conservative")).toBe("conservative");
    expect(resolveSpeed("fast")).toBe("fast");
    expect(resolveSpeed("normal")).toBe("normal");
    expect(resolveSpeed(undefined)).toBe("normal");
    expect(resolveSpeed("turbo")).toBe("normal");
    expect(resolveSpeed(null)).toBe("normal");
  });
});

describe("nextWheel — jitter within the profile band, micro-pause on gate open", () => {
  it("rng=0 gives the band minimums with a short (non-pause) interval", () => {
    // draws: delta=0 → minDeltaY; gate=0.9 (≥ prob) → no pause; interval=0 → minIntervalMs.
    const p = SPEED_PROFILES.normal;
    const tick = nextWheel(seq([0, 0.9, 0]), "normal");
    expect(tick.deltaY).toBe(p.minDeltaY);
    expect(tick.intervalMs).toBe(p.minIntervalMs);
  });

  it("rng=~1 gives the band maximums (short interval when the gate stays closed)", () => {
    const p = SPEED_PROFILES.fast;
    // delta≈1 → maxDeltaY; gate=0.9 (≥ prob for fast=1/16) → no pause; interval≈1 → maxIntervalMs.
    const tick = nextWheel(seq([1, 0.9, 1]), "fast");
    expect(tick.deltaY).toBe(p.maxDeltaY);
    expect(tick.intervalMs).toBe(p.maxIntervalMs);
  });

  it("opens the micro-pause gate (rng < prob) → a longer interval from the pause band", () => {
    const p = SPEED_PROFILES.conservative;
    // delta=0.5 → mid; gate=0 (< 1/8) → micro-pause; pauseSize=0 → microPauseMinMs.
    const tick = nextWheel(seq([0.5, 0, 0]), "conservative");
    expect(tick.deltaY).toBe(Math.round(p.minDeltaY + 0.5 * (p.maxDeltaY - p.minDeltaY)));
    expect(tick.intervalMs).toBe(p.microPauseMinMs);
  });

  it("draws exactly three rng values per tick (delta, gate, one interval)", () => {
    // Three values suffice regardless of the gate; a fourth is never drawn (would be unused).
    expect(() => nextWheel(seq([0.3, 0.99, 0.5]), "normal")).not.toThrow(); // gate closed
    expect(() => nextWheel(seq([0.3, 0.0, 0.5]), "normal")).not.toThrow(); // gate open
    // Two values is one short — the interval draw throws (pins the draw count at 3, not 2).
    expect(() => nextWheel(seq([0.3, 0.99]), "normal")).toThrow();
  });

  it("all profiles keep every interval and delta strictly positive and within band", () => {
    const speeds: CaptureSpeed[] = ["conservative", "normal", "fast"];
    for (const speed of speeds) {
      const p = SPEED_PROFILES[speed];
      for (const r of [0, 0.25, 0.5, 0.75, 0.999]) {
        const short = nextWheel(seq([r, 0.99, r]), speed); // gate closed
        expect(short.deltaY).toBeGreaterThanOrEqual(p.minDeltaY);
        expect(short.deltaY).toBeLessThanOrEqual(p.maxDeltaY);
        expect(short.intervalMs).toBeGreaterThanOrEqual(p.minIntervalMs);
        expect(short.intervalMs).toBeLessThanOrEqual(p.maxIntervalMs);
        const paused = nextWheel(seq([r, 0, r]), speed); // gate open
        expect(paused.intervalMs).toBeGreaterThanOrEqual(p.microPauseMinMs);
        expect(paused.intervalMs).toBeLessThanOrEqual(p.microPauseMaxMs);
      }
    }
  });

  it("fast is faster than conservative on average (band midpoints)", () => {
    const mid = (a: number, b: number) => (a + b) / 2;
    const f = SPEED_PROFILES.fast;
    const c = SPEED_PROFILES.conservative;
    expect(mid(f.minIntervalMs, f.maxIntervalMs)).toBeLessThan(mid(c.minIntervalMs, c.maxIntervalMs));
    expect(mid(f.minDeltaY, f.maxDeltaY)).toBeGreaterThan(mid(c.minDeltaY, c.maxDeltaY));
  });
});

describe("purity", () => {
  it("the module source has no Date.now / Math.random / DOM references (grep-verified)", () => {
    const src = readFileSync(fileURLToPath(new URL("./wheelJitter.ts", import.meta.url)), "utf8");
    expect(src).not.toMatch(/Math\.random/);
    expect(src).not.toMatch(/Date\.now/);
    expect(src).not.toMatch(/\bdocument\b/);
    expect(src).not.toMatch(/\bwindow\b/);
    expect(src).not.toMatch(/performance\./);
  });
});
