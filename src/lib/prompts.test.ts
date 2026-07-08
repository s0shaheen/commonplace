import { describe, test, expect } from "vitest";
import { buildExtractorPrompt, PROMPT_VERSION } from "./prompts.js";
import type { CapturedItem } from "./types.js";

const base: CapturedItem = {
  id: "7001",
  desc: "he made the sacrifice play",
  createTime: 1,
  author: "no1persona",
  authorName: "persona",
  url: "https://www.tiktok.com/@no1persona/video/7001",
  playUrl: "u",
  downloadUrl: null,
  cover: null,
  durationSec: 42,
  hasSubtitles: true,
  subtitleUrl: "s",
  isSlideshow: false,
  music: { name: "original sound", author: "persona" },
  hashtags: ["ironman", "avengers"],
  sources: [],
  stats: { plays: null, likes: null, comments: null, shares: null, collects: null },
};

describe("buildExtractorPrompt", () => {
  test("includes the base prompt, caption, hashtags, creator, and music", () => {
    const out = buildExtractorPrompt("BASE_EXTRACT_PROMPT", base, "Tony makes the sacrifice play.");
    expect(out).toContain("BASE_EXTRACT_PROMPT");
    expect(out).toContain("he made the sacrifice play");
    expect(out).toContain("#ironman #avengers");
    expect(out).toContain("persona");
    expect(out).toContain("original sound");
  });

  test("includes the transcript block when a transcript is present", () => {
    const out = buildExtractorPrompt("BASE", base, "Tony makes the sacrifice play.");
    expect(out).toContain("Transcript:");
    expect(out).toContain("Tony makes the sacrifice play.");
  });

  test("omits the transcript block when there is no transcript", () => {
    const out = buildExtractorPrompt("BASE", { ...base, hasSubtitles: false }, "");
    expect(out).not.toMatch(/Transcript:/);
  });

  test("omits the hashtags line when there are none", () => {
    const out = buildExtractorPrompt("BASE", { ...base, hashtags: [] }, "");
    expect(out).not.toMatch(/Hashtags:/);
  });

  test("PROMPT_VERSION is the v1 extractor tag", () => {
    expect(PROMPT_VERSION).toBe("extract@v1");
  });
});
