// Tests for the pure import-reconciliation reducer. It answers the question the ZIP front door exists
// to answer: after an import, what did the export recover that the live library did not already hold —
// and how does that compare to the export's own declared index size (the fake-done tail)? PURE over
// (parsedItems, existingIds); it never claims more imported than were parsed (a capture invariant).

import { describe, it, expect } from "vitest";
import { reconcile } from "./importReconcile.js";
import type { CapturedItem } from "../types.js";

// A minimal id-only CapturedItem — reconcile only reads `.id`.
const item = (id: string): CapturedItem => ({
  id,
  sources: ["saved"],
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
});

describe("reconcile", () => {
  it("splits parsed items into added (new) and merged (already in the library)", () => {
    const parsed = [item("a"), item("b"), item("c")];
    const r = reconcile(parsed, ["b"]); // library already holds "b"
    expect(r.added).toBe(2); // a, c are new
    expect(r.merged).toBe(1); // b overlaps
    expect(r.parsed).toBe(3);
  });

  it("reports alreadyPresent as the library's size BEFORE the import", () => {
    const r = reconcile([item("a")], ["x", "y", "z"]);
    expect(r.alreadyPresent).toBe(3);
  });

  it("reports declaredInZip as the raw parsed-list length handed in", () => {
    const r = reconcile([item("a"), item("b"), item("c")], []);
    expect(r.declaredInZip).toBe(3);
  });

  it("dedupes the parsed list by id for the `parsed` count, but declaredInZip keeps the raw length", () => {
    const parsed = [item("a"), item("a"), item("b")]; // "a" twice in the raw list
    const r = reconcile(parsed, []);
    expect(r.declaredInZip).toBe(3); // raw list length
    expect(r.parsed).toBe(2); // unique ids
    expect(r.added).toBe(2);
    expect(r.merged).toBe(0);
  });

  it("NEVER claims more imported than parsed (added + merged === parsed)", () => {
    const parsed = [item("a"), item("b"), item("c"), item("d")];
    const r = reconcile(parsed, ["a", "c"]);
    expect(r.added + r.merged).toBe(r.parsed);
    expect(r.parsed).toBeLessThanOrEqual(r.declaredInZip);
  });

  it("surfaces the recovered un-scrolled tail: export lists more than the library already held", () => {
    // Live capture got 2 (fake-done tail); the export declares 5. Import recovers the 3-item gap.
    const parsed = [item("i1"), item("i2"), item("i3"), item("i4"), item("i5")];
    const r = reconcile(parsed, ["i1", "i2"]); // library already held only i1, i2
    expect(r.declaredInZip).toBe(5);
    expect(r.alreadyPresent).toBe(2);
    expect(r.added).toBe(3); // the recovered tail
    expect(r.merged).toBe(2);
    expect(r.alreadyPresent).toBeLessThan(r.declaredInZip); // "the library already held fewer"
  });

  it("accepts a Set for existingIds and handles an empty import", () => {
    const r = reconcile([], new Set(["a", "b"]));
    expect(r).toEqual({ added: 0, merged: 0, alreadyPresent: 2, parsed: 0, declaredInZip: 0 });
  });
});
