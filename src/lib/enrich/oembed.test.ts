// Tests for the oEmbed adapter's PURE normalizer against the captured real-shape fixture. The free
// default lane: caption (from `title`, hashtags parsed out of it), author name + handle, poster.
// A malformed/empty payload is a clean empty partial, never a throw.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { normalizeOembed } from "./oembed.js";

const sample = JSON.parse(
  readFileSync(fileURLToPath(new URL("../../../fixtures/tiktok-oembed-sample.json", import.meta.url)), "utf8"),
);

describe("normalizeOembed", () => {
  it("maps the real oEmbed shape → caption/author/poster/hashtags", () => {
    const out = normalizeOembed(sample);
    expect(out.desc).toBe(sample.title);
    expect(out.author).toBe("chefanna");
    expect(out.authorName).toBe("Chef Anna");
    expect(out.cover).toBe(sample.thumbnail_url);
    expect(out.hashtags).toEqual(["pasta", "weeknightdinner", "easyrecipe"]);
  });

  it("does not fabricate depth fields oEmbed cannot provide (no transcript, no stats)", () => {
    const out = normalizeOembed(sample);
    expect(out.subtitleUrl).toBeUndefined();
    expect(out.stats).toBeUndefined();
    expect(out.music).toBeUndefined();
  });

  it("a payload with no hashtags in the title yields an empty hashtag list", () => {
    expect(normalizeOembed({ title: "just a plain caption", author_unique_id: "x" }).hashtags).toEqual([]);
  });

  it("an empty / malformed payload → an empty partial, never a throw", () => {
    expect(normalizeOembed({})).toEqual({});
    expect(normalizeOembed(null)).toEqual({});
    expect(normalizeOembed("garbage")).toEqual({});
  });
});
