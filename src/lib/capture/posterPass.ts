// The decoupled poster pass — capture intake no longer fetches media; posters land in a separate,
// throttled, resumable pass that starts the instant a source finishes enumerating (scroll_done) and
// resumes on the SW's revival alarm if a pass was interrupted. This is the §4.3 / Task-4 fix for the
// inline-poster crash vector (§2.3: 3k image fetches + Blob decodes contending with the live scroll).
//
// PURE, injected I/O à la queue.ts: the orchestrator takes its record listing, failure store, the
// rate-limited scheduler, and the per-item store call as `PosterPassDeps` — no globals, no fetch, no
// clock in here — so "a killed pass resumes without re-fetching or losing posters" is a unit test.
//
// The state machine is DERIVED, not bookkept per-item:
//   • pending — has a `cover` URL, no poster stored yet, attempts < ceiling
//   • done    — a poster blob is stored (record.posterRef set) → drops out of selection forever
//   • failed  — attempts hit MAX_POSTER_ATTEMPTS → permanently excluded (a missed poster is just a
//               missed poster; signed cover URLs expire in hours, so retrying a dead URL is pointless)
// Only the failure counts need persisting (the `meta` store); done-ness lives in the item records
// themselves, so we never double-store the same truth and a resumed pass reads it straight back.

/** Bounded retries: a cover URL that fails this many times is given up on (non-fatal). */
export const MAX_POSTER_ATTEMPTS = 3;

/** The minimal record shape the pass needs — decoupled from store.ts's LibraryRecord. */
export interface PosterCandidate {
  id: string;
  /** The signed cover URL (`item.cover`); null when the item never had a poster. */
  cover: string | null;
  /** True once a poster blob is stored for this item (record.posterRef present). */
  hasPoster: boolean;
}

/** Persisted retry bookkeeping: itemId → consecutive failed attempts. Absent = 0. */
export type PosterFailures = Record<string, number>;

/** A candidate is permanently failed once its attempts reach the ceiling. */
export function isPermanentlyFailed(id: string, failures: PosterFailures): boolean {
  return (failures[id] ?? 0) >= MAX_POSTER_ATTEMPTS;
}

/**
 * Select up to `batchSize` item ids that still need a poster: a `cover` URL present, no poster yet,
 * and not permanently failed. Order-preserving; this IS the pending-set of the derived state machine.
 */
export function selectPosterWork(
  records: PosterCandidate[],
  failures: PosterFailures,
  batchSize: number,
): string[] {
  const out: string[] = [];
  for (const r of records) {
    if (out.length >= batchSize) break;
    if (!r.cover) continue; // never needed a poster
    if (r.hasPoster) continue; // done
    if (isPermanentlyFailed(r.id, failures)) continue; // given up on
    out.push(r.id);
  }
  return out;
}

/** Pure transition: a failed attempt bumps the count (input untouched). */
export function recordFailure(failures: PosterFailures, id: string): PosterFailures {
  return { ...failures, [id]: (failures[id] ?? 0) + 1 };
}

/** Pure transition: a success clears any prior failures for the id (identity-preserving no-op if absent). */
export function recordSuccess(failures: PosterFailures, id: string): PosterFailures {
  if (!(id in failures)) return failures;
  const next = { ...failures };
  delete next[id];
  return next;
}

export interface PosterProgress {
  total: number; // records that need/needed a poster (have a cover, or already stored one)
  done: number; // posters stored
  failed: number; // permanently given up on
  remaining: number; // still to attempt
}

/** Snapshot for the periodic `posters: X/Y (Z failed)` log line. */
export function posterProgress(records: PosterCandidate[], failures: PosterFailures): PosterProgress {
  let total = 0;
  let done = 0;
  let failed = 0;
  for (const r of records) {
    if (!r.cover && !r.hasPoster) continue; // never needed a poster
    total++;
    if (r.hasPoster) done++;
    else if (isPermanentlyFailed(r.id, failures)) failed++;
  }
  return { total, done, failed, remaining: total - done - failed };
}

// ── The resumable orchestrator ──────────────────────────────────────────────────────

export interface PosterPassDeps {
  /** Re-read every batch so freshly-stored posters (and their done-ness) drop out of selection. */
  listCandidates(): Promise<PosterCandidate[]>;
  getFailures(): Promise<PosterFailures>;
  setFailures(f: PosterFailures): Promise<void>;
  /** Fetch + store one poster. `ok:false` is a (non-fatal) failed attempt — log-and-move-on. */
  storePoster(id: string, coverUrl: string): Promise<{ ok: boolean }>;
  /** The rate-limited scheduler (createRateLimiter) — every storePoster call routes through it. */
  schedule<T>(fn: () => Promise<T>): Promise<T>;
  /** Progress sink (`posters: X/Y (Z failed)`), called once per batch. */
  log(msg: string): void;
  batchSize: number;
  concurrency: number;
}

/**
 * Drain the poster pass in `batchSize` chunks until no work remains. Each batch runs a bounded
 * worker pool (`concurrency`) whose store calls route through `schedule` (the rate limiter serializes
 * STARTS; the pool bounds in-flight blob memory — the same shape resolvers use in offscreen.ts).
 *
 * Resumability: a successful `storePoster` persists the poster (and record.posterRef) as its own
 * write, so a mid-pass SW death loses only the CURRENT batch's un-persisted failure counts (a killed
 * attempt is not a real failed attempt, exactly like reviveJobs preserving attempts) — never a stored
 * poster. The next invocation (scroll_done or the revival alarm) re-selects the remaining work.
 */
export async function runPosterPass(deps: PosterPassDeps): Promise<{ stored: number; failed: number }> {
  let failures = await deps.getFailures();
  let stored = 0;

  for (;;) {
    const candidates = await deps.listCandidates();
    const work = selectPosterWork(candidates, failures, deps.batchSize);
    if (work.length === 0) break;

    const coverById = new Map(candidates.map((c) => [c.id, c.cover] as const));
    const outcomes: { id: string; ok: boolean }[] = [];
    let next = 0;

    const worker = async (): Promise<void> => {
      while (next < work.length) {
        const id = work[next++]!;
        const cover = coverById.get(id) ?? null;
        if (!cover) {
          outcomes.push({ id, ok: false });
          continue;
        }
        const r = await deps.schedule(() => deps.storePoster(id, cover));
        outcomes.push({ id, ok: r.ok });
      }
    };
    await Promise.all(Array.from({ length: Math.min(deps.concurrency, work.length) }, () => worker()));

    // Fold outcomes into failures sequentially (pure transitions) AFTER the pool drains — no
    // lost-update race between concurrent workers on the shared failure map.
    for (const o of outcomes) {
      failures = o.ok ? recordSuccess(failures, o.id) : recordFailure(failures, o.id);
      if (o.ok) stored++;
    }
    await deps.setFailures(failures);

    // Re-read for the progress line: this batch's successes just flipped done-ness in the store, so
    // the pre-batch `candidates` snapshot would undercount `done`.
    const p = posterProgress(await deps.listCandidates(), failures);
    deps.log(`posters: ${p.done}/${p.total} (${p.failed} failed)`);
  }

  const final = posterProgress(await deps.listCandidates(), failures);
  return { stored, failed: final.failed };
}
