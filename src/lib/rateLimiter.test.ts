import { describe, it, expect, vi, afterEach } from "vitest";
import { createRateLimiter } from "./rateLimiter.js";

afterEach(() => {
  vi.useRealTimers();
});

describe("createRateLimiter", () => {
  it("runs the first call immediately and spaces the second by minIntervalMs", async () => {
    vi.useFakeTimers();
    const limit = createRateLimiter(1000);
    const order: number[] = [];

    const p1 = limit(async () => {
      order.push(1);
      return "a";
    });
    const p2 = limit(async () => {
      order.push(2);
      return "b";
    });

    // Flush microtasks without advancing the clock: only the first call should have run.
    await vi.advanceTimersByTimeAsync(0);
    expect(order).toEqual([1]);

    // The second call is gated behind the 1000 ms interval.
    await vi.advanceTimersByTimeAsync(999);
    expect(order).toEqual([1]);
    await vi.advanceTimersByTimeAsync(1);
    expect(order).toEqual([1, 2]);

    // Results preserve submission order regardless of spacing.
    expect(await Promise.all([p1, p2])).toEqual(["a", "b"]);
  });

  it("serializes calls: a call never starts before the previous one settles", async () => {
    vi.useFakeTimers();
    const limit = createRateLimiter(0);
    const events: string[] = [];

    const p1 = limit(async () => {
      events.push("start-1");
      await new Promise((r) => setTimeout(r, 50));
      events.push("end-1");
    });
    const p2 = limit(async () => {
      events.push("start-2");
    });

    await vi.advanceTimersByTimeAsync(100);
    await Promise.all([p1, p2]);
    expect(events).toEqual(["start-1", "end-1", "start-2"]);
  });

  it("keeps the queue alive after a rejected call", async () => {
    vi.useFakeTimers();
    const limit = createRateLimiter(0);

    const p1 = limit(async () => {
      throw new Error("boom");
    });
    const p2 = limit(async () => "ok");

    await vi.advanceTimersByTimeAsync(0);
    await expect(p1).rejects.toThrow("boom");
    await expect(p2).resolves.toBe("ok");
  });
});
