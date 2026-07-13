// Tests for the single-active-driver lease (CONC-01). Pure; injected clock.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  acquireLease,
  renewLease,
  canAcquire,
  leaseIsActive,
  DEFAULT_LEASE_TTL_MS,
  type CaptureLease,
} from "./lease.js";

describe("leaseIsActive — TTL window", () => {
  it("a missing lease is never active", () => {
    expect(leaseIsActive(null, 1000)).toBe(false);
    expect(leaseIsActive(undefined, 1000)).toBe(false);
  });

  it("active within TTL, stale at/after TTL", () => {
    const lease: CaptureLease = { tabId: 7, startedAt: 0, ttl: 1000 };
    expect(leaseIsActive(lease, 999)).toBe(true);
    expect(leaseIsActive(lease, 1000)).toBe(false); // exactly TTL is stale (half-open)
    expect(leaseIsActive(lease, 5000)).toBe(false);
  });
});

describe("canAcquire — one driver at a time, stale is reclaimable", () => {
  const now = 10_000;
  it("no lease ⇒ anyone may acquire", () => {
    expect(canAcquire(null, 7, now)).toBe(true);
  });

  it("a live lease held by ANOTHER tab blocks", () => {
    const other: CaptureLease = { tabId: 3, startedAt: now, ttl: DEFAULT_LEASE_TTL_MS };
    expect(canAcquire(other, 7, now)).toBe(false);
  });

  it("a live lease held by the SAME tab may be re-acquired (renew)", () => {
    const own: CaptureLease = { tabId: 7, startedAt: now, ttl: DEFAULT_LEASE_TTL_MS };
    expect(canAcquire(own, 7, now)).toBe(true);
  });

  it("a STALE lease (past TTL) is reclaimable by a different tab", () => {
    const stale: CaptureLease = { tabId: 3, startedAt: 0, ttl: 1000 };
    expect(canAcquire(stale, 7, now)).toBe(true);
  });
});

describe("acquireLease / renewLease", () => {
  it("acquireLease stamps tabId + startedAt + ttl", () => {
    expect(acquireLease(7, 500)).toEqual({ tabId: 7, startedAt: 500, ttl: DEFAULT_LEASE_TTL_MS });
    expect(acquireLease(7, 500, 200)).toEqual({ tabId: 7, startedAt: 500, ttl: 200 });
  });

  it("renewLease bumps startedAt but preserves tabId + ttl", () => {
    const l0 = acquireLease(7, 500, 1000);
    const l1 = renewLease(l0, 900);
    expect(l1).toEqual({ tabId: 7, startedAt: 900, ttl: 1000 });
    // a renewed lease is active where the un-renewed one would have gone stale
    expect(leaseIsActive(l0, 1600)).toBe(false);
    expect(leaseIsActive(l1, 1600)).toBe(true);
  });
});

describe("purity", () => {
  it("the module source has no Date.now / Math.random / DOM references (grep-verified)", () => {
    const src = readFileSync(fileURLToPath(new URL("./lease.ts", import.meta.url)), "utf8");
    expect(src).not.toMatch(/Math\.random/);
    expect(src).not.toMatch(/Date\.now/);
    expect(src).not.toMatch(/\bdocument\b/);
    expect(src).not.toMatch(/\bwindow\b/);
  });
});
