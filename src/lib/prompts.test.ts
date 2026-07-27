import { describe, test, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
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

  test("PROMPT_VERSION is the v2 extractor tag (native-video prompt)", () => {
    expect(PROMPT_VERSION).toBe("extract@v2");
  });
});

// The v2 prompt is a SHIPPED CONTRACT, not prose: the closed vocabularies and the iron rule are what
// keep model output gate-valid, so they are asserted against the real file on disk.
describe("prompts/extract_v2.md — the shipped v2 base prompt", () => {
  const v2 = readFileSync(join(__dirname, "..", "..", "prompts", "extract_v2.md"), "utf8");

  test("carries all 9 NamedEntity types verbatim", () => {
    for (const t of ["music_recording", "place", "screen_work", "book", "person", "product", "brand_org", "software_app", "game"]) {
      expect(v2).toContain(t);
    }
  });
  test("carries all 9 facet axes verbatim", () => {
    for (const f of ["affect", "topic", "genre", "intent", "creator_role", "viewer_orientation", "presentation", "content_provenance", "actionability"]) {
      expect(v2).toContain(f);
    }
  });
  test("carries the 6 evidence channels and the 4 assertion modes verbatim", () => {
    for (const c of ["VERBAL_AUDIO", "VERBAL_TEXT", "VISUAL_SCENE", "VISUAL_TEXT", "NONVERBAL_AUDIO", "STRUCTURED_METADATA"]) {
      expect(v2).toContain(c);
    }
    for (const m of ["STATED", "SHOWN", "REPORTED", "INFERRED"]) expect(v2).toContain(m);
  });
  test("states the iron rule (surface + type, NEVER an ID)", () => {
    expect(v2).toMatch(/NEVER output external IDs/i);
    expect(v2).toMatch(/MusicBrainz|Wikidata|Place ID/i);
  });
  test("specifies MM:SS timestamps, not seconds", () => {
    expect(v2).toContain("MM:SS");
    expect(v2).not.toMatch(/t_start.*seconds|seconds.*t_start/i);
  });
  test("is framed for a model that WATCHES + LISTENS (not frames/subtitles)", () => {
    expect(v2).toMatch(/watch|listen/i);
    expect(v2).not.toMatch(/keyframe|subtitle track/i);
  });
  test("is TIGHTER than v1 (3.x over-analyzes on verbose prompts)", () => {
    const v1 = readFileSync(join(__dirname, "..", "..", "prompts", "extract_v1.md"), "utf8");
    expect(v2.split("\n").length).toBeLessThan(v1.split("\n").length);
  });
});
