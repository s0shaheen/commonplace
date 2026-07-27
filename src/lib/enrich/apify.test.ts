// Tests for the Apify BACKUP adapter's PURE normalizer against the representative fixture. Same target
// fields as tikwm (caption/author/music/stats/cover/play/duration + English subtitle). A malformed
// payload is a clean empty partial, never a throw. Used ONLY on tikwm failover.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { normalizeApify } from "./apify.js";

const sample = JSON.parse(
  readFileSync(fileURLToPath(new URL("../../../fixtures/apify-tiktok-sample.json", import.meta.url)), "utf8"),
);

describe("normalizeApify", () => {
  it("maps a TikTok actor item → caption/author/music/stats/cover/play/duration", () => {
    const out = normalizeApify(sample);
    expect(out.desc).toBe(sample.text);
    expect(out.author).toBe("chefanna");
    expect(out.authorName).toBe("Chef Anna");
    expect(out.cover).toBe(sample.videoMeta.coverUrl);
    expect(out.playUrl).toBe(sample.videoUrl);
    expect(out.durationSec).toBe(47);
    expect(out.music).toEqual({ name: "original sound", author: "Chef Anna" });
    expect(out.hashtags).toEqual(["pasta", "weeknightdinner"]);
    expect(out.stats).toEqual({ plays: 2100000, likes: 128400, comments: 812, shares: 3300, collects: 45200 });
  });

  it("picks the English subtitle track when present", () => {
    expect(normalizeApify(sample).subtitleUrl).toBe("https://v16-webapp.tiktok.com/EXAMPLE-eng.vtt");
  });

  it("accepts a single-element dataset array (the actor's typical output)", () => {
    expect(normalizeApify([sample]).desc).toBe(sample.text);
  });

  it("a malformed / empty payload → an empty partial, never a throw", () => {
    expect(normalizeApify({})).toEqual({});
    expect(normalizeApify(null)).toEqual({});
    expect(normalizeApify([])).toEqual({});
  });
});
