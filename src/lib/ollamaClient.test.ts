import { describe, test, expect } from "vitest";
import { parseOllamaResponse } from "./ollamaClient.js";
import type { ExtractorOutput } from "./types.js";

const validOutput: ExtractorOutput = {
  mentions: [
    {
      surface: "Kill Bill",
      type: "music_recording",
      evidence: [{ channel: "VERBAL_AUDIO", assertion_mode: "SHOWN", confidence: 0.9 }],
    },
  ],
  concepts: [],
  claims: [],
  structured: [],
  facets: [
    { facet: "topic", value: "entertainment", evidence: [{ channel: "VISUAL_SCENE", assertion_mode: "INFERRED", confidence: 0.8 }] },
  ],
};

describe("parseOllamaResponse", () => {
  test("happy path: message.content holds a valid ExtractorOutput", () => {
    const res = parseOllamaResponse({ message: { content: JSON.stringify(validOutput) } });
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.output.mentions[0]!.type).toBe("music_recording");
  });

  test("parse_fail on garbage content", () => {
    expect(parseOllamaResponse({ message: { content: "not json at all" } })).toEqual({
      ok: false,
      error: "parse_fail",
    });
  });

  test("schema_invalid on a schema-violating output (shared hard gate)", () => {
    const bad = {
      ...validOutput,
      mentions: [
        { surface: "Kasama", type: "restaurant", evidence: [{ channel: "VISUAL_TEXT", assertion_mode: "SHOWN", confidence: 1 }] },
      ],
    };
    expect(parseOllamaResponse({ message: { content: JSON.stringify(bad) } })).toEqual({
      ok: false,
      error: "schema_invalid",
    });
  });

  test("empty_response when there is no message content", () => {
    expect(parseOllamaResponse({})).toEqual({ ok: false, error: "empty_response" });
  });
});
