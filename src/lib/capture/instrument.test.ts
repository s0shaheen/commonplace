// Pure telemetry module — no Date.now/performance/document reads in here (mirrors queue.ts's
// injected-I/O style). Tests drive sampleMemory/formatHudLine with fixed inputs only.
import { describe, it, expect } from "vitest";
import { sampleMemory, formatHudLine, shouldLogSample, type CaptureSample } from "./instrument.js";

describe("shouldLogSample — the sample-log interval gate (Task-1 review carry: thresholds live in tested modules)", () => {
  it("below the interval ⇒ false", () => {
    expect(shouldLogSample(0, 4_999, 5_000)).toBe(false);
  });

  it("exactly at the interval ⇒ true", () => {
    expect(shouldLogSample(0, 5_000, 5_000)).toBe(true);
  });

  it("past the interval ⇒ true", () => {
    expect(shouldLogSample(10_000, 15_001, 5_000)).toBe(true);
  });

  it("first-ever sample (prevTs 0, real clock ts) ⇒ true", () => {
    expect(shouldLogSample(0, 1_752_000_000_000, 5_000)).toBe(true);
  });
});

describe("sampleMemory", () => {
  it("computes heapUsedMB from usedJSHeapSize, rounded, bytes → MB", () => {
    const s = sampleMemory({
      now: 1000,
      capturedCount: 42,
      domNodes: 500,
      heap: { usedJSHeapSize: 512 * 1024 * 1024 }, // exactly 512MB
    });
    expect(s).toEqual<CaptureSample>({ ts: 1000, capturedCount: 42, domNodes: 500, heapUsedMB: 512 });
  });

  it("rounds a non-exact byte count to the nearest MB", () => {
    const s = sampleMemory({
      now: 1000,
      capturedCount: 1,
      domNodes: 1,
      heap: { usedJSHeapSize: 10_500_000 }, // ~10.014MB -> rounds to 10
    });
    expect(s.heapUsedMB).toBe(10);
  });

  it("heap: undefined -> heapUsedMB null (Chrome only exposes performance.memory under some flags)", () => {
    const s = sampleMemory({ now: 5, capturedCount: 0, domNodes: 0, heap: undefined });
    expect(s.heapUsedMB).toBeNull();
  });

  it("heap: {} (field absent) -> heapUsedMB null", () => {
    const s = sampleMemory({ now: 5, capturedCount: 0, domNodes: 0, heap: {} });
    expect(s.heapUsedMB).toBeNull();
  });

  it("passes through ts/capturedCount/domNodes unchanged", () => {
    const s = sampleMemory({ now: 123456, capturedCount: 1240, domNodes: 8300, heap: undefined });
    expect(s.ts).toBe(123456);
    expect(s.capturedCount).toBe(1240);
    expect(s.domNodes).toBe(8300);
  });
});

describe("formatHudLine", () => {
  const base: CaptureSample = { ts: 0, capturedCount: 1240, domNodes: 8300, heapUsedMB: 512 };

  it("renders the full line with source/hasMore/state", () => {
    const line = formatHudLine(base, { source: "likes", hasMore: true, state: "scrolling" });
    expect(line).toBe("⛏ 1240 · likes · more:yes · heap 512MB · dom 8300 · scrolling");
  });

  it("renders the null-heap case as 'heap —'", () => {
    const noHeap: CaptureSample = { ...base, heapUsedMB: null };
    const line = formatHudLine(noHeap, { source: "likes", hasMore: true, state: "scrolling" });
    expect(line).toContain("heap —");
  });

  it("renders hasMore: false as more:no", () => {
    const line = formatHudLine(base, { source: "favorites", hasMore: false, state: "done" });
    expect(line).toContain("more:no");
  });

  it("renders hasMore: null as more:—", () => {
    const line = formatHudLine(base, { source: "favorites", hasMore: null, state: "starting" });
    expect(line).toContain("more:—");
  });

  it("is deterministic for the same input (no clock formatting)", () => {
    const a = formatHudLine(base, { source: "likes", hasMore: true, state: "scrolling" });
    const b = formatHudLine(base, { source: "likes", hasMore: true, state: "scrolling" });
    expect(a).toBe(b);
  });

  it("handles a missing source gracefully", () => {
    const line = formatHudLine(base, { hasMore: true });
    expect(line).toContain("1240");
    expect(line).not.toContain("undefined");
  });

  it("renders the evicted-tiles count when provided (Task 3 DOM eviction)", () => {
    const line = formatHudLine(base, { source: "likes", hasMore: true, state: "scrolling", evicted: 120 });
    expect(line).toBe("⛏ 1240 · likes · more:yes · heap 512MB · dom 8300 · evicted 120 · scrolling");
  });

  it("omits the evicted segment when absent or null (back-compat with pre-eviction callers)", () => {
    expect(formatHudLine(base, { source: "likes", hasMore: true, state: "scrolling" })).not.toContain("evicted");
    expect(formatHudLine(base, { source: "likes", hasMore: true, state: "scrolling", evicted: null })).not.toContain(
      "evicted",
    );
  });

  it("renders evicted 0 explicitly (0 is a real value, not 'absent')", () => {
    expect(formatHudLine(base, { source: "likes", hasMore: true, state: "scrolling", evicted: 0 })).toContain(
      "evicted 0",
    );
  });
});
