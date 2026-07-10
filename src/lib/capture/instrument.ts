// Pure capture telemetry. No Date.now/Math.random/performance/document reads in here — the
// caller (content.js glue) injects `now`, `performance.memory`, and a DOM-node count, mirroring
// queue.ts's injected-I/O style so this stays a deterministic unit test rather than a vibe.
//
// Chrome only exposes `performance.memory` under some flags (and never off-Chromium), so
// heapUsedMB is null-safe by design: absent heap object OR absent field → null, never a throw.

export interface CaptureSample {
  ts: number;
  capturedCount: number;
  domNodes: number;
  heapUsedMB: number | null;
}

const BYTES_PER_MB = 1024 * 1024;

export function sampleMemory(input: {
  now: number;
  capturedCount: number;
  domNodes: number;
  heap?: { usedJSHeapSize?: number } | undefined;
}): CaptureSample {
  const bytes = input.heap?.usedJSHeapSize;
  const heapUsedMB = typeof bytes === "number" ? Math.round(bytes / BYTES_PER_MB) : null;
  return {
    ts: input.now,
    capturedCount: input.capturedCount,
    domNodes: input.domNodes,
    heapUsedMB,
  };
}

/**
 * The console-sample interval gate (Task-1 review carry-forward: thresholds live in tested
 * modules, not glue). True when at least `intervalMs` has elapsed since the last logged sample —
 * including the first-ever sample (prevTs 0 against a real clock ts).
 */
export function shouldLogSample(prevTs: number, ts: number, intervalMs: number): boolean {
  return ts - prevTs >= intervalMs;
}

/**
 * A compact single-line HUD render, e.g.:
 *   "⛏ 1240 · likes · more:yes · heap 512MB · dom 8300 · evicted 120 · scrolling"
 * Deterministic for a given (sample, extra) pair — no clock formatting, so it's directly testable.
 * `evicted` (Task 3 DOM eviction) is shown only when supplied — 0 is a real value and IS rendered;
 * absent/null omits the segment (back-compat with pre-eviction callers).
 */
export function formatHudLine(
  s: CaptureSample,
  extra: { source?: string | null; hasMore?: boolean | null; state?: string; evicted?: number | null },
): string {
  const source = extra.source ?? "—";
  const more = extra.hasMore === true ? "yes" : extra.hasMore === false ? "no" : "—";
  const heap = s.heapUsedMB === null ? "heap —" : `heap ${s.heapUsedMB}MB`;
  const evicted = extra.evicted == null ? "" : ` · evicted ${extra.evicted}`;
  const state = extra.state ? ` · ${extra.state}` : "";
  return `⛏ ${s.capturedCount} · ${source} · more:${more} · ${heap} · dom ${s.domNodes}${evicted}${state}`;
}
