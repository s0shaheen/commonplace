import { describe, test, expect } from "vitest";
import { buildTextPrompt, buildVisualPrompt, buildSlideshowPrompt } from "./prompts.js";
import type { CapturedItem } from "./types.js";

const base: CapturedItem = {
  id: "7001",
  desc: "best pasta in brooklyn",
  createTime: 1,
  author: "foodietravels",
  authorName: "Foodie Travels",
  url: "https://www.tiktok.com/@foodietravels/video/7001",
  playUrl: "u",
  downloadUrl: null,
  cover: null,
  durationSec: 42,
  hasSubtitles: true,
  subtitleUrl: "s",
  isSlideshow: false,
  music: null,
  hashtags: ["pasta", "brooklyn"],
  stats: { plays: null, likes: null, comments: null, shares: null, collects: null },
};

describe("buildTextPrompt", () => {
  test("includes base prompt, caption, hashtags, and subtitle text", () => {
    const out = buildTextPrompt("BASE_TEXT_PROMPT", base, "Welcome to Brooklyn pasta.");
    expect(out).toContain("BASE_TEXT_PROMPT");
    expect(out).toContain("best pasta in brooklyn");
    expect(out).toContain("#pasta #brooklyn");
    expect(out).toContain("Welcome to Brooklyn pasta.");
  });
  test("omits the subtitle section when there is no transcript", () => {
    const out = buildTextPrompt("BASE", { ...base, hasSubtitles: false }, "");
    expect(out).not.toMatch(/Subtitles:/);
  });
});

describe("buildVisualPrompt", () => {
  test("appends caption to the base visual prompt", () => {
    const out = buildVisualPrompt("BASE_VISUAL", base);
    expect(out).toContain("BASE_VISUAL");
    expect(out).toContain("best pasta in brooklyn");
  });
});

describe("buildSlideshowPrompt", () => {
  test("appends caption to the base slideshow prompt", () => {
    const out = buildSlideshowPrompt("BASE_SLIDE", base);
    expect(out).toContain("BASE_SLIDE");
    expect(out).toContain("best pasta in brooklyn");
  });
});
