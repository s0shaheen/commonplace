import { describe, it, expect } from "vitest";
import {
  MAX_POSTER_ATTEMPTS,
  isPermanentlyFailed,
  selectPosterWork,
  recordFailure,
  recordSuccess,
  posterProgress,
  runPosterPass,
  type PosterCandidate,
  type PosterFailures,
  type PosterPassDeps,
} from "./posterPass.js";

// ── work selection + failure bookkeeping (the pure state machine) ──────────────────

function cand(id: string, cover: string | null, hasPoster = false): PosterCandidate {
  return { id, cover, hasPoster };
}

describe("selectPosterWork", () => {
  it("picks records with a cover URL, no poster yet, not permanently failed — up to batchSize", () => {
    const recs = [
      cand("a", "http://cdn/a.jpg"), // eligible
      cand("b", null), // no cover → skip
      cand("c", "http://cdn/c.jpg", true), // already has poster → skip
      cand("d", "http://cdn/d.jpg"), // eligible
      cand("e", "http://cdn/e.jpg"), // eligible
    ];
    const failures: PosterFailures = {};
    expect(selectPosterWork(recs, failures, 10)).toEqual(["a", "d", "e"]);
    // batchSize caps the pull
    expect(selectPosterWork(recs, failures, 2)).toEqual(["a", "d"]);
  });

  it("excludes permanently-failed items (attempts at the ceiling)", () => {
    const recs = [cand("a", "http://cdn/a.jpg"), cand("b", "http://cdn/b.jpg")];
    const failures: PosterFailures = { a: MAX_POSTER_ATTEMPTS };
    expect(selectPosterWork(recs, failures, 10)).toEqual(["b"]);
  });
});

describe("isPermanentlyFailed", () => {
  it("is true only at/after the attempt ceiling", () => {
    expect(isPermanentlyFailed("x", {})).toBe(false);
    expect(isPermanentlyFailed("x", { x: MAX_POSTER_ATTEMPTS - 1 })).toBe(false);
    expect(isPermanentlyFailed("x", { x: MAX_POSTER_ATTEMPTS })).toBe(true);
  });
});

describe("recordFailure / recordSuccess", () => {
  it("failure increments; success clears; both are pure (no mutation)", () => {
    const f0: PosterFailures = {};
    const f1 = recordFailure(f0, "a");
    expect(f1).toEqual({ a: 1 });
    expect(f0).toEqual({}); // input untouched
    const f2 = recordFailure(f1, "a");
    expect(f2).toEqual({ a: 2 });
    const f3 = recordSuccess(f2, "a");
    expect(f3).toEqual({});
    // success on an unknown id is a no-op that preserves identity
    expect(recordSuccess(f0, "z")).toBe(f0);
  });
});

describe("posterProgress", () => {
  it("counts total (needed a poster) / done / failed / remaining", () => {
    const recs = [
      cand("a", "http://cdn/a.jpg", true), // done
      cand("b", "http://cdn/b.jpg"), // remaining
      cand("c", "http://cdn/c.jpg"), // failed (perma)
      cand("d", null), // never needed one → not counted
    ];
    const p = posterProgress(recs, { c: MAX_POSTER_ATTEMPTS });
    expect(p).toEqual({ total: 3, done: 1, failed: 1, remaining: 1 });
  });
});

// ── the resumable orchestrator (injected I/O, à la queue.ts) ───────────────────────

// A tiny in-memory harness: a mutable candidate table + a fetch script that maps id → ok|fail.
function harness(
  initial: PosterCandidate[],
  fetchResult: (id: string) => boolean,
  opts?: { batchSize?: number; concurrency?: number },
) {
  const table = new Map(initial.map((c) => [c.id, { ...c }]));
  let failuresStore: PosterFailures = {};
  const scheduleCalls: string[] = [];
  const storeCalls: string[] = [];
  const logs: string[] = [];
  let inFlight = 0;
  let maxInFlight = 0;

  const deps: PosterPassDeps = {
    listCandidates: async () => [...table.values()].map((c) => ({ ...c })),
    getFailures: async () => ({ ...failuresStore }),
    setFailures: async (f) => {
      failuresStore = { ...f };
    },
    storePoster: async (id) => {
      inFlight++;
      maxInFlight = Math.max(maxInFlight, inFlight);
      storeCalls.push(id);
      await new Promise((r) => setTimeout(r, 0));
      inFlight--;
      const ok = fetchResult(id);
      if (ok) table.get(id)!.hasPoster = true; // storePoster is what flips done-ness
      return { ok };
    },
    schedule: <T>(fn: () => Promise<T>): Promise<T> => {
      // record the id being scheduled via a side-channel is awkward; count calls only
      scheduleCalls.push("");
      return fn();
    },
    log: (m) => logs.push(m),
    batchSize: opts?.batchSize ?? 100,
    concurrency: opts?.concurrency ?? 3,
  };
  return { deps, table, get failures() { return failuresStore; }, scheduleCalls, storeCalls, logs, get maxInFlight() { return maxInFlight; } };
}

describe("runPosterPass", () => {
  it("stores every poster once, through the rate-limited schedule, then terminates", async () => {
    const recs = [cand("a", "u/a"), cand("b", "u/b"), cand("c", "u/c")];
    const h = harness(recs, () => true);
    const res = await runPosterPass(h.deps);
    expect(res.stored).toBe(3);
    expect(res.failed).toBe(0);
    expect(h.storeCalls.sort()).toEqual(["a", "b", "c"]);
    expect(h.scheduleCalls.length).toBe(3); // every store went through the limiter
    expect(h.failures).toEqual({}); // clean run leaves no failure state
    // idempotent: a second run finds no work
    const res2 = await runPosterPass(h.deps);
    expect(res2.stored).toBe(0);
    expect(h.storeCalls.length).toBe(3); // no re-fetch
  });

  it("skips items that already have a poster (resumption after SW death)", async () => {
    const recs = [cand("a", "u/a", true), cand("b", "u/b")];
    const h = harness(recs, () => true);
    const res = await runPosterPass(h.deps);
    expect(res.stored).toBe(1);
    expect(h.storeCalls).toEqual(["b"]); // "a" never re-fetched
  });

  it("a persistently-failing poster is retried up to the ceiling, then marked permanent (non-fatal)", async () => {
    const recs = [cand("dead", "u/dead"), cand("ok", "u/ok")];
    const h = harness(recs, (id) => id !== "dead"); // "dead" always fails
    const res = await runPosterPass(h.deps);
    expect(res.stored).toBe(1); // "ok" succeeded
    expect(res.failed).toBe(1); // "dead" gave up
    // exactly MAX attempts on the dead URL, then excluded → the pass still terminates
    expect(h.storeCalls.filter((id) => id === "dead").length).toBe(MAX_POSTER_ATTEMPTS);
    expect(isPermanentlyFailed("dead", h.failures)).toBe(true);
  });

  it("respects the concurrency bound", async () => {
    const recs = Array.from({ length: 12 }, (_, i) => cand(`i-${i}`, `u/${i}`));
    const h = harness(recs, () => true, { concurrency: 3, batchSize: 100 });
    await runPosterPass(h.deps);
    expect(h.maxInFlight).toBeLessThanOrEqual(3);
    expect(h.maxInFlight).toBe(3); // and it actually parallelizes to the bound
  });

  it("logs progress as posters: X/Y (Z failed) per batch", async () => {
    const recs = [cand("a", "u/a"), cand("b", "u/b")];
    const h = harness(recs, () => true, { batchSize: 1 }); // force two batches
    await runPosterPass(h.deps);
    expect(h.logs.some((m) => /^posters: \d+\/\d+ \(\d+ failed\)$/.test(m))).toBe(true);
    // final batch reports both done
    expect(h.logs.at(-1)).toBe("posters: 2/2 (0 failed)");
  });
});
