// PURE storage-health decisions — no IndexedDB, no chrome, no clock. Facts in, decision out, so every
// rung of the self-heal ladder (STORE-01 / S-DB-2) and the alarm-registration guard (S-SW-4) are
// unit-tested WITHOUT a real DB or a chrome mock. The glue that owns the DB handle (store.ts's
// `recoverStore`) reads a `HealthAction` from `assessStores` and executes it; this module never
// touches storage or chrome itself. Invariant 1: pure core behind thin glue.

/** The four object stores the `commonplace` DB must always contain to be usable. */
export type StoreName = "items" | "posters" | "jobs" | "meta";

/** The required-store set, in a stable order (used to derive the missing set + guard creation). */
export const REQUIRED_STORES: readonly StoreName[] = ["items", "posters", "jobs", "meta"];

/** The next self-heal rung to execute, decided purely from on-disk facts + attempt count. */
export type HealthAction =
  | { kind: "ok" } //                                  every required store is present → use it
  | { kind: "reopen_upgrade"; missing: StoreName[] } // reopen at version+1 with a guarded create
  | { kind: "rebuild" } //                             deleteDB + full recreate (LAST resort; data loss)
  | { kind: "unrecoverable" }; //                      give up → throw → halt capture + surface

/**
 * Decide the next storage self-heal rung from the stores actually present on disk and how many
 * recovery attempts have already been spent. The `commonplace` DB is treated as ADVERSARIAL: a v1 DB
 * can exist WITHOUT its stores (a bare `indexedDB.open` with no version created it store-less), which
 * the version-gated `upgrade` callback can never fix on its own. Deterministic ladder:
 *
 *   - all required stores present            → `ok` (regardless of attempt)
 *   - missing, attempt 0                      → `reopen_upgrade(missing)`: reopen at version+1 with a
 *                                               contains()-guarded, oldVersion-driven idempotent
 *                                               upgrade that creates ONLY the gap (never clobbers a
 *                                               populated store)
 *   - missing, attempt 1 (upgrade didn't fix) → `rebuild`: deleteDB + recreate — the LAST resort, so
 *                                               it loses data and must be logged loudly
 *   - missing, attempt >= 2 (rebuild failed)  → `unrecoverable`: throw → HALT capture, never let a
 *                                               swallowed write present as done (invariant 4)
 *
 * Pure: no I/O, no clock — the caller supplies the present-store list after each (re)open.
 */
export function assessStores(present: readonly string[], attempt: number): HealthAction {
  const have = new Set(present);
  const missing = REQUIRED_STORES.filter((name) => !have.has(name));
  if (missing.length === 0) return { kind: "ok" };
  if (attempt <= 0) return { kind: "reopen_upgrade", missing };
  if (attempt === 1) return { kind: "rebuild" };
  return { kind: "unrecoverable" };
}

/**
 * Classify a caught error as an IndexedDB storage-full failure (S-SW-1 / invariant 3+4). A
 * QuotaExceeded on a write is DISTINCT: it must halt capture with a "storage full" state, never be
 * counted toward a failure ceiling, and never present as done. Checks the error `name` rather than
 * `instanceof DOMException` so it holds in a Node test env where the caught value may be re-wrapped.
 */
export function isQuotaExceeded(err: unknown): boolean {
  return (
    !!err &&
    typeof err === "object" &&
    (err as { name?: unknown }).name === "QuotaExceededError"
  );
}

/**
 * Idempotent revive-alarm registration guard (S-SW-4). The `cp_queue_revive` alarm is the ONE
 * resumability spine; an unconditional top-level `chrome.alarms.create` resets its periodic timer on
 * every sub-minute SW cold start, so under steady capture traffic it can effectively never fire.
 * Register it ONLY when absent: `chrome.alarms.get` → create iff `undefined`. Pure so the guard is
 * unit-tested without a chrome mock.
 */
export function shouldCreateAlarm(existing: chrome.alarms.Alarm | undefined): boolean {
  return existing === undefined;
}
