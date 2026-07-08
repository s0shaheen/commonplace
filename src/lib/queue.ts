// The resumable engine queue — a PURE state machine. All I/O (the store, the per-item work, the
// clock, the jitter source, the concurrency bound) is injected via `QueueDeps`, which is the whole
// point: it makes "a 500-item batch survives a service-worker kill mid-run" a deterministic unit
// test rather than a vibe.
//
// The durability contract lives in three moves:
//   1. runQueue CHECKPOINTS a job to "analyzing" (a store write) BEFORE it does any work. If the
//      worker dies here, the job is left mid-flight in the store — recoverable, not lost.
//   2. reviveJobs, run on the next wake, sweeps every mid-flight ("analyzing"/"grounding") job back
//      to "pending". Idempotent: a job that's already terminal or pending is untouched.
//   3. runQueue is memory-bounded — it holds at most `concurrency` items' media at once, so a
//      500-item batch never materializes 500 videos in memory.
//
// The MV3 service worker is killed aggressively (~30s idle). background.ts's alarm re-runs this
// loop every minute; between the checkpoint and the revive, no completed work is redone and no
// in-flight work is dropped.

import type { CpStore, JobRecord } from "./store.js";

export interface QueueDeps {
  store: Pick<CpStore, "getJobs" | "putJob" | "putJobs" | "getRecord" | "saveAnalysis" | "saveGroundings">;
  /** The per-item unit of work (fetch → analyze → ground). Injected so the loop stays pure. */
  processItem(itemId: string): Promise<{ ok: true } | { ok: false; error: string; rateLimited?: boolean }>;
  now(): number;
  /** jitter ∈ [0,1); injected for deterministic backoff in tests. */
  jitter(): number;
  concurrency: number;
}

const MAX_ATTEMPTS = 5;
const BASE_BACKOFF_MS = 1000;
const MAX_BACKOFF_MS = 60_000;

/**
 * Exponential backoff with a full-jitter cap: `1000 * 2^(attempts-1)`, capped at 60s, then scaled
 * by `(1 + 0.1*jitter)`. Pinned schedule (jitter 0): 1→1000, 2→2000, … 7→60000 (cap), 9→60000.
 */
export function backoffMs(attempts: number, jitter: number): number {
  const base = BASE_BACKOFF_MS * 2 ** (attempts - 1);
  const capped = Math.min(base, MAX_BACKOFF_MS);
  return Math.round(capped * (1 + 0.1 * jitter));
}

/**
 * Sweep every mid-flight job — "analyzing" or "grounding", i.e. checkpointed but not finished when
 * the process died — back to "pending" (retryable now). Attempts are preserved (a kill is not a
 * failed attempt). Idempotent: terminal/pending jobs are left alone, so a second call revives 0.
 */
export async function reviveJobs(store: QueueDeps["store"], now: number): Promise<{ revived: number }> {
  const jobs = await store.getJobs();
  const stuck = jobs.filter((j) => j.status === "analyzing" || j.status === "grounding");
  if (stuck.length === 0) return { revived: 0 };
  await store.putJobs(stuck.map((j) => ({ ...j, status: "pending", nextAttemptAt: now })));
  return { revived: stuck.length };
}

/**
 * Enqueue a fresh pending job for every library record still "raw" that has no job yet. Idempotent:
 * a raw record whose job already exists (in any state) is skipped, so re-running never duplicates.
 */
export async function enqueueMissing(store: CpStore, now: number): Promise<{ enqueued: number }> {
  const [records, jobs] = await Promise.all([store.allRecords(), store.getJobs()]);
  const haveJob = new Set(jobs.map((j) => j.itemId));
  const fresh: JobRecord[] = [];
  for (const rec of records) {
    if (rec.status !== "raw") continue;
    if (haveJob.has(rec.id)) continue;
    fresh.push({ id: `job:${rec.id}`, itemId: rec.id, status: "pending", attempts: 0, nextAttemptAt: now });
  }
  if (fresh.length) await store.putJobs(fresh);
  return { enqueued: fresh.length };
}

/**
 * Drain the queue with a bounded worker pool. Each due pending job (nextAttemptAt ≤ now) is
 * checkpointed to "analyzing" BEFORE `processItem` runs, then written to its terminal/retry state
 * after. At most `concurrency` jobs are in flight (the memory bound). The due set is snapshotted at
 * entry, so jobs re-queued with a future backoff are retried on a later call, not spun on here.
 *
 * `opts.maxTicks` caps how many jobs are DISPATCHED, then returns immediately WITHOUT awaiting the
 * in-flight ones — this is the unit-test's simulated service-worker kill: the ≤concurrency jobs
 * still running are left checkpointed as "analyzing" for reviveJobs to recover.
 */
export async function runQueue(
  deps: QueueDeps,
  opts?: { maxTicks?: number },
): Promise<{ done: number; failed: number }> {
  const { store, concurrency } = deps;
  const maxTicks = opts?.maxTicks ?? Infinity;

  const jobs = await store.getJobs();
  const now0 = deps.now();
  // Snapshot the due set once, in a deterministic order, so the pool draws from a stable queue.
  const ready = jobs
    .filter((j) => j.status === "pending" && j.nextAttemptAt <= now0)
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

  let done = 0;
  let failed = 0;
  let dispatched = 0;
  const inFlight = new Set<Promise<void>>();

  const runOne = async (job: JobRecord): Promise<void> => {
    // CHECKPOINT before work: if we die now, the job is recoverable, never silently lost.
    await store.putJob({ ...job, status: "analyzing" });
    const result = await deps.processItem(job.itemId);
    const now = deps.now();
    if (result.ok) {
      await store.putJob({ ...job, status: "done" });
      done++;
      return;
    }
    const attempts = job.attempts + 1;
    if (!result.rateLimited && attempts >= MAX_ATTEMPTS) {
      await store.putJob({ ...job, status: "failed", attempts, lastError: result.error });
      failed++;
      return;
    }
    // Rate-limited OR a retryable error under the attempt ceiling → back off and re-queue as pending.
    await store.putJob({
      ...job,
      status: "pending",
      attempts,
      nextAttemptAt: now + backoffMs(attempts, deps.jitter()),
      lastError: result.error,
    });
  };

  while (dispatched < maxTicks && (ready.length > 0 || inFlight.size > 0)) {
    while (inFlight.size < concurrency && ready.length > 0 && dispatched < maxTicks) {
      const job = ready.shift()!;
      dispatched++;
      const p: Promise<void> = runOne(job).finally(() => inFlight.delete(p));
      inFlight.add(p);
    }
    if (dispatched >= maxTicks) break; // simulated kill: abandon in-flight, leave them "analyzing"
    if (inFlight.size === 0) break;
    await Promise.race(inFlight);
  }

  return { done, failed };
}
