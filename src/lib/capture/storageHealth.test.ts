import { describe, it, expect } from "vitest";
import {
  assessStores,
  isQuotaExceeded,
  shouldCreateAlarm,
  REQUIRED_STORES,
  type StoreName,
} from "./storageHealth.js";

const ALL: StoreName[] = ["items", "posters", "jobs", "meta"];

describe("assessStores", () => {
  it("attempt 0, all four present → ok", () => {
    expect(assessStores(ALL, 0)).toEqual({ kind: "ok" });
  });

  it("all present is ok regardless of attempt (extra unknown stores ignored)", () => {
    expect(assessStores([...ALL, "somethingElse"], 1)).toEqual({ kind: "ok" });
    expect(assessStores(ALL, 5)).toEqual({ kind: "ok" });
  });

  it("attempt 0, some missing → reopen_upgrade with exactly the missing set", () => {
    expect(assessStores(["items", "meta"], 0)).toEqual({
      kind: "reopen_upgrade",
      missing: ["posters", "jobs"],
    });
  });

  it("attempt 0, a store-less DB → reopen_upgrade listing all four", () => {
    expect(assessStores([], 0)).toEqual({ kind: "reopen_upgrade", missing: ALL });
  });

  it("attempt 1, still missing (the version+1 upgrade did not fix it) → rebuild", () => {
    expect(assessStores(["items"], 1)).toEqual({ kind: "rebuild" });
    expect(assessStores([], 1)).toEqual({ kind: "rebuild" });
  });

  it("attempt >= 2, still missing (rebuild failed) → unrecoverable", () => {
    expect(assessStores([], 2)).toEqual({ kind: "unrecoverable" });
    expect(assessStores(["jobs"], 3)).toEqual({ kind: "unrecoverable" });
  });

  it("negative/coerced attempt is treated as the first rung", () => {
    expect(assessStores([], -1)).toEqual({ kind: "reopen_upgrade", missing: ALL });
  });

  it("REQUIRED_STORES is exactly the four canonical stores", () => {
    expect([...REQUIRED_STORES]).toEqual(ALL);
  });
});

describe("isQuotaExceeded", () => {
  it("true for a DOMException-shaped QuotaExceededError", () => {
    expect(isQuotaExceeded({ name: "QuotaExceededError" })).toBe(true);
  });

  it("true for a real DOMException when available", () => {
    if (typeof DOMException !== "undefined") {
      expect(isQuotaExceeded(new DOMException("full", "QuotaExceededError"))).toBe(true);
    }
  });

  it("false for other errors and non-objects", () => {
    expect(isQuotaExceeded(new Error("boom"))).toBe(false);
    expect(isQuotaExceeded({ name: "AbortError" })).toBe(false);
    expect(isQuotaExceeded(undefined)).toBe(false);
    expect(isQuotaExceeded(null)).toBe(false);
    expect(isQuotaExceeded("QuotaExceededError")).toBe(false);
  });
});

describe("shouldCreateAlarm", () => {
  it("true when no alarm exists yet (create it)", () => {
    expect(shouldCreateAlarm(undefined)).toBe(true);
  });

  it("false when an alarm is already registered (leave its schedule untouched)", () => {
    const existing = { name: "cp_queue_revive", periodInMinutes: 1, scheduledTime: 0 } as chrome.alarms.Alarm;
    expect(shouldCreateAlarm(existing)).toBe(false);
  });
});
