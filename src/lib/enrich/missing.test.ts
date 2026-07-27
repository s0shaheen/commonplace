// Tests for the PURE content-gap detectors. `needsEnrichment` is the COARSE gate the pipeline consults
// before any network call: an item is content-poor iff it lacks a caption OR a poster. A live capture
// (caption + poster present) is content-rich and skips enrichment entirely — even if it has no
// transcript (transcript alone never drags a content-rich item onto the network). `missingFields`
// derives the per-aspect flags tierPolicy reads.
import { describe, it, expect } from "vitest";
import { needsEnrichment, missingFields } from "./missing.js";
import type { CapturedItem } from "../types.js";

function item(over: Partial<CapturedItem>): CapturedItem {
  return {
    id: "1",
    sources: [],
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
    ...over,
  };
}

describe("needsEnrichment", () => {
  it("a DYD skeleton (no caption, no poster) needs enrichment", () => {
    expect(needsEnrichment(item({}))).toBe(true);
  });

  it("a live-captured item (caption + poster) is content-rich → skips, even without a transcript", () => {
    const live = item({ desc: "cooking dinner", cover: "https://cdn/c.jpg", subtitleUrl: null });
    expect(needsEnrichment(live)).toBe(false);
  });

  it("an Instagram import (caption present, poster missing) still needs enrichment for the poster", () => {
    const ig = item({ platform: "instagram", desc: "a reel caption", cover: null });
    expect(needsEnrichment(ig)).toBe(true);
  });

  it("a whitespace-only caption counts as absent", () => {
    expect(needsEnrichment(item({ desc: "   ", cover: "https://cdn/c.jpg" }))).toBe(true);
  });
});

describe("missingFields", () => {
  it("flags every gap on a skeleton", () => {
    expect(missingFields(item({}))).toEqual({ caption: true, poster: true, transcript: true });
  });

  it("a fully-populated item has no gaps", () => {
    const full = item({ desc: "x", cover: "https://cdn/c.jpg", subtitleUrl: "https://cdn/s.vtt", hasSubtitles: true });
    expect(missingFields(full)).toEqual({ caption: false, poster: false, transcript: false });
  });

  it("treats a transcript as present when hasSubtitles is set even if the URL is later fetched", () => {
    const t = item({ desc: "x", cover: "https://cdn/c.jpg", hasSubtitles: true });
    expect(missingFields(t).transcript).toBe(false);
  });
});
