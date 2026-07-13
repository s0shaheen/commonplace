// Single-active-driver lease (CONC-01, §4 "no global single-capture lock"). Beyond the SW-lifetime
// in-memory `supervisorRunning` boolean (which dies with every SW idle-out), a PERSISTED TTL lease is
// the real guard that only ONE tab / one Sync drives capture at a time — two driven runs would double
// the anti-bot footprint on the founder's real account.
//
// PURE: the lease is a plain record; these functions decide acquire/renew/expiry from an injected clock.
// The glue owns the persistence (extension storage) and the tab id. So "a second tab can't steal a live
// lease, but a stale one (older than TTL) is reclaimable" is a deterministic unit test.

export interface CaptureLease {
  /** The tab currently authorized to drive capture. */
  tabId: number;
  /** Injected-clock ms when the lease was acquired or last renewed (the freshness anchor). */
  startedAt: number;
  /** Lifetime in ms — a lease older than this is stale and reclaimable by anyone. */
  ttl: number;
}

/** Generous default TTL. The revive alarm renews every ~60s while the driven tab still scrolls, so a
 *  live run never lets its lease lapse; 10 min covers a long captcha/overlay pause without a false steal. */
export const DEFAULT_LEASE_TTL_MS = 10 * 60_000;

/** Is this lease still within its TTL as of `nowMs`? A missing lease is never active. */
export function leaseIsActive(lease: CaptureLease | null | undefined, nowMs: number): boolean {
  if (!lease) return false;
  return nowMs - lease.startedAt < lease.ttl;
}

/**
 * May `tabId` acquire the lease right now? Yes if there is no lease, the current lease is stale (past
 * TTL), or `tabId` already holds it (a re-acquire / renew by the same driver). A DIFFERENT tab holding a
 * live lease blocks — that is the whole point.
 */
export function canAcquire(current: CaptureLease | null | undefined, tabId: number, nowMs: number): boolean {
  if (!leaseIsActive(current, nowMs)) return true;
  return current!.tabId === tabId;
}

/** Mint a fresh lease for `tabId` as of `nowMs`. */
export function acquireLease(tabId: number, nowMs: number, ttl: number = DEFAULT_LEASE_TTL_MS): CaptureLease {
  return { tabId, startedAt: nowMs, ttl };
}

/** Renew an existing lease (bump its freshness anchor to `nowMs`); tabId + ttl are preserved. */
export function renewLease(lease: CaptureLease, nowMs: number): CaptureLease {
  return { ...lease, startedAt: nowMs };
}
