// Tests for the own-session depth lane's PURE pieces:
//  1. The permalink WORKLIST reducer — one item at a time, deduped, and OBEYING the ban-halt (it
//     delegates the halt decision to banGuard, never bot-hammers a sweep). This is the classifier/spine
//     pointed at a permalink worklist; the live driving (open tab + intercept) is the pilot-time gate.
//  2. `normalizeItemDetail` — the signed item-detail envelope (itemInfo.itemStruct) → a partial with the
//     transcript (subtitleUrl), reusing capture.js's extractItems (single source of truth, no fork).
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  emptyWorklist,
  enqueuePermalink,
  nextPermalink,
  markDone,
  normalizeItemDetail,
} from "./ownSession.js";

const healthy = { httpErrorStreak: 0, challengeCycles: 0 };

describe("own-session worklist", () => {
  it("enqueues permalinks and dedupes (pending + already-done)", () => {
    let wl = emptyWorklist();
    wl = enqueuePermalink(wl, "https://tt/@a/video/1");
    wl = enqueuePermalink(wl, "https://tt/@a/video/1"); // dup → ignored
    wl = enqueuePermalink(wl, "https://tt/@a/video/2");
    expect(wl.pending).toEqual(["https://tt/@a/video/1", "https://tt/@a/video/2"]);
    wl = markDone(wl, "https://tt/@a/video/1");
    wl = enqueuePermalink(wl, "https://tt/@a/video/1"); // already done → not re-queued
    expect(wl.pending).toEqual(["https://tt/@a/video/2"]);
    expect(wl.done).toEqual(["https://tt/@a/video/1"]);
  });

  it("hands out ONE permalink at a time (FIFO head)", () => {
    let wl = enqueuePermalink(enqueuePermalink(emptyWorklist(), "u1"), "u2");
    expect(nextPermalink(wl, healthy)).toEqual({ kind: "item", url: "u1" });
    wl = markDone(wl, "u1");
    expect(nextPermalink(wl, healthy)).toEqual({ kind: "item", url: "u2" });
  });

  it("OBEYS the ban-halt — never hands out a permalink once banGuard says halt", () => {
    const wl = enqueuePermalink(emptyWorklist(), "u1");
    const banned = { httpErrorStreak: 6, challengeCycles: 0 }; // trips shouldHaltForBlock
    const r = nextPermalink(wl, banned);
    expect(r.kind).toBe("halt");
  });

  it("is idle when nothing is pending", () => {
    expect(nextPermalink(emptyWorklist(), healthy)).toEqual({ kind: "idle" });
  });
});

describe("normalizeItemDetail", () => {
  const sample = JSON.parse(
    readFileSync(fileURLToPath(new URL("../../../fixtures/tiktok-item-detail-sample.json", import.meta.url)), "utf8"),
  );

  it("extracts the full envelope incl the transcript (subtitleUrl) from itemInfo.itemStruct", () => {
    const out = normalizeItemDetail(sample);
    expect(out.desc).toBe("3-ingredient weeknight pasta you'll actually make");
    expect(out.author).toBe("chefanna");
    expect(out.subtitleUrl).toBe("https://v16-webapp.tiktok.com/EXAMPLE-eng.vtt");
    expect(out.hasSubtitles).toBe(true);
    expect(out.durationSec).toBe(47);
    expect(out.stats?.likes).toBe(128400);
    expect(out.music).toEqual({ name: "original sound", author: "Chef Anna" });
  });

  it("a malformed / empty payload → an empty partial, never a throw", () => {
    expect(normalizeItemDetail({})).toEqual({});
    expect(normalizeItemDetail(null)).toEqual({});
  });
});
