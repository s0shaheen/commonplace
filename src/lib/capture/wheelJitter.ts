// Anti-block wheel cadence (C7 + PACE): the trusted-wheel pump used to dispatch a CONSTANT deltaY 120
// every 30ms — a perfectly regular ~4000px/s metronome, a textbook bot tell. The founder scrolls his
// 10k list by hand FAST with no block, so speed itself is fine; the risk is the ROBOTIC regularity.
// This PURE module produces a jittered {deltaY, intervalMs} per pump tick — varied delta, varied gap,
// and an occasional brief micro-pause — so the stream reads like a human flicking a trackpad, not a
// clock. The rng is INJECTED (no ambient randomness here); the SW glue owns the timer and passes the
// platform rng, so "the cadence never lands on identical intervals" is a deterministic unit test.
//
// Three speed profiles let the cautious slow down without touching code (config cp_config.captureSpeed):
//   conservative — gentler, for the risk-averse; normal (default) — ≈ the live-proven throughput,
//   jittered; fast — the founder's "go fast" setting. All stay FAST; only the regularity is broken.

export type CaptureSpeed = "conservative" | "normal" | "fast";

export interface SpeedProfile {
  /** Inter-tick gap band (ms) — the normal, short "keep flicking" interval. */
  minIntervalMs: number;
  maxIntervalMs: number;
  /** Per-tick downward wheel delta band (px). */
  minDeltaY: number;
  maxDeltaY: number;
  /** Probability a given tick becomes a brief micro-pause (a longer gap — the human "look" beat). */
  microPauseProb: number;
  /** Micro-pause gap band (ms). */
  microPauseMinMs: number;
  microPauseMaxMs: number;
}

// Tuned around the live-proven constant (deltaY 120 @ 30ms): `normal` keeps ≈ that average throughput
// but jitters both axes ±; `fast` is quicker/heavier; `conservative` is slower/lighter with more pauses.
export const SPEED_PROFILES: Record<CaptureSpeed, SpeedProfile> = {
  conservative: {
    minIntervalMs: 45,
    maxIntervalMs: 90,
    minDeltaY: 70,
    maxDeltaY: 130,
    microPauseProb: 1 / 8,
    microPauseMinMs: 500,
    microPauseMaxMs: 1200,
  },
  normal: {
    minIntervalMs: 20,
    maxIntervalMs: 45,
    minDeltaY: 90,
    maxDeltaY: 160,
    microPauseProb: 1 / 12,
    microPauseMinMs: 250,
    microPauseMaxMs: 700,
  },
  fast: {
    minIntervalMs: 16,
    maxIntervalMs: 34,
    minDeltaY: 110,
    maxDeltaY: 190,
    microPauseProb: 1 / 16,
    microPauseMinMs: 180,
    microPauseMaxMs: 450,
  },
};

/** Coerce an untrusted config value to a valid speed (default "normal" — the pinned safe default). */
export function resolveSpeed(raw: unknown): CaptureSpeed {
  return raw === "conservative" || raw === "fast" ? raw : "normal";
}

export interface WheelTick {
  /** Downward wheel delta to dispatch this tick (always positive; the pump applies it down). */
  deltaY: number;
  /** How long to wait before the NEXT tick — normally short, occasionally a micro-pause. */
  intervalMs: number;
}

/**
 * The jittered wheel decision for one pump tick. Draws rng() up to three times, in a FIXED order so the
 * draw count is deterministic for tests: (1) delta size, (2) micro-pause gate (strict `<`), and (3) —
 * only if the gate opens — the micro-pause size. When the gate is closed the interval is a short normal
 * gap. Pure and deterministic given the rng sequence.
 */
export function nextWheel(rng: () => number, speed: CaptureSpeed): WheelTick {
  const p = SPEED_PROFILES[speed];
  const deltaY = Math.round(p.minDeltaY + rng() * (p.maxDeltaY - p.minDeltaY));
  const microPause = rng() < p.microPauseProb;
  const intervalMs = microPause
    ? Math.round(p.microPauseMinMs + rng() * (p.microPauseMaxMs - p.microPauseMinMs))
    : Math.round(p.minIntervalMs + rng() * (p.maxIntervalMs - p.minIntervalMs));
  return { deltaY, intervalMs };
}
