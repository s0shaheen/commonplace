// Tests for the PURE monotonic merge. The one invariant: enrichment fills ABSENT fields only and NEVER
// overwrites a present value with an absent one — the same field-merge discipline the store's upsert
// uses, so a poorer lane run after a richer one can only ever ADD, never erase. Platform-agnostic.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { merge } from "./merge.js";
import type { CapturedItem } from "../types.js";

function skeleton(id = "1"): CapturedItem {
  return {
    id,
    sources: ["favorites"],
    desc: "",
    createTime: null,
    author: null,
    authorName: null,
    url: `https://www.tiktok.com/@a/video/${id}`,
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

describe("merge — monotonic field fill", () => {
  it("a richer lane fills every gap a skeleton left", () => {
    const out = merge(skeleton(), {
      desc: "best pasta ever #pasta",
      author: "chef",
      authorName: "Chef Anna",
      cover: "https://cdn/cover.jpg",
      hashtags: ["pasta"],
      subtitleUrl: "https://cdn/sub.vtt",
      music: { name: "Song", author: "Artist" },
      stats: { plays: 5000, likes: 999, comments: 12, shares: 3, collects: null },
    });
    expect(out.desc).toBe("best pasta ever #pasta");
    expect(out.author).toBe("chef");
    expect(out.cover).toBe("https://cdn/cover.jpg");
    expect(out.hashtags).toEqual(["pasta"]);
    expect(out.subtitleUrl).toBe("https://cdn/sub.vtt");
    expect(out.hasSubtitles).toBe(true); // a filled subtitleUrl flips hasSubtitles
    expect(out.music).toEqual({ name: "Song", author: "Artist" });
    expect(out.stats.plays).toBe(5000);
  });

  it("NEVER overwrites a present value with an absent one (a poorer lane after a richer one)", () => {
    const rich: CapturedItem = {
      ...skeleton(),
      desc: "real caption",
      author: "realauthor",
      cover: "https://cdn/real.jpg",
      hashtags: ["keep"],
      subtitleUrl: "https://cdn/real.vtt",
      hasSubtitles: true,
      music: { name: "RealSong", author: "RealArtist" },
    };
    const out = merge(rich, {
      desc: "", // absent — must not erase "real caption"
      author: null,
      cover: null,
      hashtags: [],
      subtitleUrl: null,
      music: null,
    });
    expect(out.desc).toBe("real caption");
    expect(out.author).toBe("realauthor");
    expect(out.cover).toBe("https://cdn/real.jpg");
    expect(out.hashtags).toEqual(["keep"]);
    expect(out.subtitleUrl).toBe("https://cdn/real.vtt");
    expect(out.music).toEqual({ name: "RealSong", author: "RealArtist" });
  });

  it("merges stats sub-field-wise: fills absent stats, preserves present ones", () => {
    const item: CapturedItem = {
      ...skeleton(),
      stats: { plays: null, likes: 100, comments: null, shares: null, collects: null },
    };
    const out = merge(item, {
      stats: { plays: 5000, likes: 999, comments: 42, shares: null, collects: null },
    });
    expect(out.stats.plays).toBe(5000); // was absent → filled
    expect(out.stats.likes).toBe(100); // was present → preserved, NOT overwritten by 999
    expect(out.stats.comments).toBe(42); // filled
  });

  it("fills an absent music object but preserves a present one", () => {
    expect(merge(skeleton(), { music: { name: "S", author: "A" } }).music).toEqual({ name: "S", author: "A" });
    const withMusic: CapturedItem = { ...skeleton(), music: { name: "Keep", author: null } };
    expect(merge(withMusic, { music: { name: "New", author: "X" } }).music).toEqual({ name: "Keep", author: null });
  });

  it("preserves identity + capture provenance (id, sources, platform) untouched", () => {
    const item: CapturedItem = { ...skeleton("abc"), platform: "instagram", sources: ["saved"] };
    const out = merge(item, { desc: "cap" });
    expect(out.id).toBe("abc");
    expect(out.sources).toEqual(["saved"]);
    expect(out.platform).toBe("instagram");
  });

  it("is a pure copy — does not mutate the input item", () => {
    const item = skeleton();
    const before = JSON.stringify(item);
    merge(item, { desc: "cap", cover: "x" });
    expect(JSON.stringify(item)).toBe(before);
  });
});

describe("merge purity", () => {
  it("the module source has no Date.now / Math.random / DOM references (grep-verified)", () => {
    const src = readFileSync(fileURLToPath(new URL("./merge.ts", import.meta.url)), "utf8");
    expect(src).not.toMatch(/Math\.random/);
    expect(src).not.toMatch(/Date\.now/);
    expect(src).not.toMatch(/\bdocument\b/);
    expect(src).not.toMatch(/\bwindow\b/);
  });
});
