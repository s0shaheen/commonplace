import { describe, test, expect, afterEach } from "vitest";
import { parseVtt, fetchVideoBytes, VIDEO_BYTES_LIMIT, INLINE_LIMIT } from "./mediaFetch.js";
import type { CapturedItem } from "./types.js";

describe("parseVtt", () => {
  test("extracts caption text from a basic cue list with numeric ids", () => {
    const vtt = `WEBVTT

1
00:00:00.000 --> 00:00:02.000
hello there

2
00:00:02.000 --> 00:00:04.000
welcome`;
    expect(parseVtt(vtt)).toBe("hello there welcome");
  });

  test("dedupes consecutive repeated caption lines (rolling captions)", () => {
    const vtt = `WEBVTT

00:00:00.000 --> 00:00:01.000
hello

00:00:01.000 --> 00:00:02.000
hello

00:00:02.000 --> 00:00:03.000
world`;
    expect(parseVtt(vtt)).toBe("hello world");
  });

  test("strips NOTE blocks and header metadata", () => {
    const vtt = `WEBVTT
Kind: captions
Language: en

NOTE this is a comment
that spans lines

00:00:00.000 --> 00:00:02.000
real caption`;
    expect(parseVtt(vtt)).toBe("real caption");
  });

  test("strips inline tags, handles hour-length timestamps and CRLF", () => {
    const vtt = "WEBVTT\r\n\r\n01:02:03.000 --> 01:02:05.000\r\n<c>tagged</c> text\r\n";
    expect(parseVtt(vtt)).toBe("tagged text");
  });

  test("skips non-numeric cue identifiers", () => {
    const vtt = `WEBVTT

intro-1
00:00:00.000 --> 00:00:02.000
real text`;
    expect(parseVtt(vtt)).toBe("real text");
  });

  test("returns empty string for empty or header-only input", () => {
    expect(parseVtt("WEBVTT\n\n")).toBe("");
    expect(parseVtt("")).toBe("");
  });
});

// The native lane uploads video through the FILE API, so the video ceiling is no longer the
// ~18MB inline-base64 limit. The pilot's real clips ran 8.7–33.8MB — 4 of 6 exceeded the old
// inline cap, so keeping it would have silently degraded most native runs to keyframes.
describe("fetchVideoBytes — the File API ceiling (not the inline one)", () => {
  const realFetch = globalThis.fetch;
  afterEach(() => { globalThis.fetch = realFetch; });

  const item = (over: Partial<CapturedItem> = {}) =>
    ({ id: "1", sources: [], desc: "", createTime: null, author: null, authorName: null, url: null,
       playUrl: "https://v16.example.com/play.mp4", downloadUrl: null, cover: null, durationSec: 20,
       hasSubtitles: false, subtitleUrl: null, isSlideshow: false, music: null, hashtags: [],
       stats: { plays: null, likes: null, comments: null, shares: null, collects: null }, ...over }) as CapturedItem;

  const serve = (size: number) => {
    globalThis.fetch = (async () => ({
      ok: true, status: 200,
      blob: async () => new Blob([new Uint8Array(size)], { type: "video/mp4" }),
    })) as unknown as typeof fetch;
  };

  test("the video ceiling is well above the inline-base64 limit", () => {
    expect(VIDEO_BYTES_LIMIT).toBeGreaterThan(INLINE_LIMIT);
    expect(VIDEO_BYTES_LIMIT).toBeGreaterThanOrEqual(64 * 1024 * 1024);
  });

  test("a 30MB video — over the old inline cap — still yields bytes for the File API path", async () => {
    serve(30 * 1024 * 1024);
    const parts = await fetchVideoBytes(item());
    expect(parts).toHaveLength(1);
    expect(parts[0]!.mimeType).toBe("video/mp4");
  });

  test("a video beyond the ceiling yields [] so the caller falls back honestly", async () => {
    serve(VIDEO_BYTES_LIMIT + 1);
    expect(await fetchVideoBytes(item())).toEqual([]);
  });

  test("no playUrl → [] with no fetch at all", async () => {
    let called = 0;
    globalThis.fetch = (async () => { called++; return { ok: true, blob: async () => new Blob([]) }; }) as unknown as typeof fetch;
    expect(await fetchVideoBytes(item({ playUrl: null }))).toEqual([]);
    expect(called).toBe(0);
  });
});
