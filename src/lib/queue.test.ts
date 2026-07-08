import "fake-indexeddb/auto";
import { describe, it, expect } from "vitest";
import { openStore, type CpStore, type JobRecord } from "./store.js";
import type { CapturedItem } from "./types.js";
import { backoffMs, reviveJobs, enqueueMissing, runQueue, type QueueDeps } from "./queue.js";

// ── helpers ──────────────────────────────────────────────────────────────────────

let dbSeq = 0;
function freshStore(): Promise<CpStore> {
  return openStore(`queue-test-${dbSeq++}`);
}

function mkItem(id: string): CapturedItem {
  return {
    id,
    sources: [],
    desc: "",
    createTime: null,
    author: null,
    authorName: null,
    url: null,
    playUrl: null,
    downloadUrl: null,
    cover: null,
    durationSec: null,
    hasSubtitles: false,
    subtitleUrl: null,
    isSlideshow: false,
    music: null,
    hashtags: [],
    stats: { plays: null, likes: null, comments: null, shares: null, collects: null },
  };
}

// Flush pending micro/macrotasks so any dangling result-writes settle before we assert the store.
const flush = () => new Promise((r) => setTimeout(r, 0));

function countByStatus(jobs: JobRecord[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const j of jobs) out[j.status] = (out[j.status] ?? 0) + 1;
  return out;
}

// A never-resolving promise — models a processItem call that is in-flight the instant the
// service worker is killed: it never records a result, so its job stays "analyzing".
const HANG = new Promise<{ ok: true }>(() => {});

describe("backoffMs", () => {
  it("is exponential, capped at 60s, with jitter as a 0..10% multiplier", () => {
    expect([1, 2, 3, 4, 5, 6, 7, 9].map((a) => backoffMs(a, 0))).toEqual([
      1000, 2000, 4000, 8000, 16000, 32000, 60000, 60000,
    ]);
    expect(backoffMs(1, 0.5)).toBe(1050); // 1000 * (1 + 0.1*0.5)
  });
});

describe("runQueue — the resumable state machine", () => {
  it("a 500-item batch survives a mid-run kill with zero loss and zero double-processing", async () => {
    const store = await freshStore();
    const now = () => 10_000_000; // fixed: every enqueued job is due
    const jitter = () => 0;

    // seed 500 raw records → enqueueMissing → 500 pending jobs
    await store.upsertItems(
      Array.from({ length: 500 }, (_, i) => mkItem(`item-${i}`)),
      "2026-07-08T00:00:00Z",
    );
    const { enqueued } = await enqueueMissing(store, now());
    expect(enqueued).toBe(500);
    expect((await store.getJobs()).length).toBe(500);

    // processItem: succeeds on the first 137 calls, then the 138th & 139th HANG (they are the two
    // jobs still in-flight — checkpointed "analyzing" — at the instant the worker is killed).
    let invocations = 0;
    const processItem: QueueDeps["processItem"] = async () => {
      invocations++;
      if (invocations === 138 || invocations === 139) return HANG;
      return { ok: true };
    };
    const deps: QueueDeps = { store, processItem, now, jitter, concurrency: 2 };

    // Simulated kill: cap dispatches at 139 → 137 recorded done, 2 left in-flight "analyzing".
    await runQueue(deps, { maxTicks: 139 });
    await flush();

    let counts = countByStatus(await store.getJobs());
    expect(counts.done).toBe(137);
    expect(counts.analyzing).toBe(2);
    expect(counts.pending).toBe(361);
    expect(137 + 2 + 361).toBe(500); // nothing lost at the kill boundary

    // reviveJobs: the 2 in-flight "analyzing" → "pending". Nothing else moves.
    const { revived } = await reviveJobs(store, now());
    expect(revived).toBe(2);
    counts = countByStatus(await store.getJobs());
    expect(counts.done).toBe(137);
    expect(counts.pending).toBe(363);
    expect(counts.analyzing).toBeUndefined();
    expect(137 + 363).toBe(500);

    // reviveJobs is idempotent — a second call revives nothing.
    expect((await reviveJobs(store, now())).revived).toBe(0);

    // run to completion → every job done, none failed, and no item processed twice to "done".
    const res = await runQueue(deps);
    await flush();
    counts = countByStatus(await store.getJobs());
    expect(counts.done).toBe(500);
    expect(counts.failed ?? 0).toBe(0);
    expect(res.failed).toBe(0);
    // 137 completed pre-kill + 2 in-flight-at-kill (never recorded) + 361 pending + 2 revived retries
    // = 502. The 2 revived items each had processItem CALLED twice but reached "done" exactly once.
    expect(invocations).toBe(502);
  });

  it("429 backs off and retries; hard errors fail after 5 attempts", async () => {
    // ── rate-limit path: two 429s (backoff 1000 then 2000), then success → done, attempts 2 ──
    {
      const store = await freshStore();
      let clock = 1_000_000;
      const now = () => clock;
      let calls = 0;
      const processItem: QueueDeps["processItem"] = async () => {
        calls++;
        if (calls <= 2) return { ok: false, error: "rate", rateLimited: true };
        return { ok: true };
      };
      const deps: QueueDeps = { store, processItem, now, jitter: () => 0, concurrency: 2 };
      await store.putJob({ id: "job:x", itemId: "x", status: "pending", attempts: 0, nextAttemptAt: 0 });

      // attempt 1 → 429 → pending, attempts 1, nextAttemptAt = now + backoff(1) = now + 1000
      await runQueue(deps);
      let job = (await store.getJobs())[0]!;
      expect(job.status).toBe("pending");
      expect(job.attempts).toBe(1);
      expect(job.nextAttemptAt).toBe(1_000_000 + 1000);

      // advance the clock so the job is due again → attempt 2 → 429 → attempts 2, gap 2000
      clock = job.nextAttemptAt;
      await runQueue(deps);
      job = (await store.getJobs())[0]!;
      expect(job.status).toBe("pending");
      expect(job.attempts).toBe(2);
      expect(job.nextAttemptAt).toBe(clock + 2000);

      // advance again → attempt 3 → ok → done, attempts stay 2 (success never increments attempts)
      clock = job.nextAttemptAt;
      const res = await runQueue(deps);
      job = (await store.getJobs())[0]!;
      expect(job.status).toBe("done");
      expect(job.attempts).toBe(2);
      expect(res.done).toBe(1);
    }

    // ── hard-error path: always errors → "failed" after 5 attempts, lastError kept ──
    {
      const store = await freshStore();
      // ever-increasing clock so each backoff is immediately due within one runQueue call
      let clock = 0;
      const now = () => (clock += 1_000_000);
      const processItem: QueueDeps["processItem"] = async () => ({ ok: false, error: "boom" });
      const deps: QueueDeps = { store, processItem, now, jitter: () => 0, concurrency: 2 };
      await store.putJob({ id: "job:y", itemId: "y", status: "pending", attempts: 0, nextAttemptAt: 0 });

      // each runQueue call processes the job once; the ever-advancing clock keeps it due, so
      // successive calls walk attempts 1→2→3→4→5, at which point it flips to "failed".
      let calls = 0;
      for (calls = 0; calls < 10; calls++) {
        const res = await runQueue(deps);
        const job = (await store.getJobs())[0]!;
        if (job.status === "failed") {
          expect(res.failed).toBe(1);
          break;
        }
      }
      const job = (await store.getJobs())[0]!;
      expect(job.status).toBe("failed");
      expect(job.attempts).toBe(5);
      expect(job.lastError).toBe("boom");
    }
  });

  it("respects the concurrency bound", async () => {
    const store = await freshStore();
    await store.putJobs(
      Array.from({ length: 12 }, (_, i) => ({
        id: `job:c-${i}`,
        itemId: `c-${i}`,
        status: "pending" as const,
        attempts: 0,
        nextAttemptAt: 0,
      })),
    );

    let inFlight = 0;
    let maxInFlight = 0;
    const processItem: QueueDeps["processItem"] = async () => {
      inFlight++;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((r) => setTimeout(r, 1)); // hold the slot so overlap is observable
      inFlight--;
      return { ok: true };
    };
    const deps: QueueDeps = { store, processItem, now: () => 5, jitter: () => 0, concurrency: 2 };

    const res = await runQueue(deps);
    expect(res.done).toBe(12);
    expect(maxInFlight).toBeLessThanOrEqual(2);
    expect(maxInFlight).toBe(2); // and it actually parallelizes up to the bound
    expect(countByStatus(await store.getJobs()).done).toBe(12);
  });
});
