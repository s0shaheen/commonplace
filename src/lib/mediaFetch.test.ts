import { describe, test, expect } from "vitest";
import { parseVtt } from "./mediaFetch.js";

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
