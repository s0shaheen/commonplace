import { describe, test, expect } from "vitest";
import { buildTextBody, buildMediaBody, parseGeminiResponse } from "./geminiClient.js";

describe("buildTextBody", () => {
  test("wraps the prompt as a single text part with JSON response config", () => {
    const body = buildTextBody("HELLO");
    expect(body.contents[0]!.parts[0]).toEqual({ text: "HELLO" });
    expect(body.generationConfig.responseMimeType).toBe("application/json");
  });
});

describe("buildMediaBody", () => {
  test("includes inline media parts before the prompt text", () => {
    const body = buildMediaBody("PROMPT", [{ mimeType: "video/mp4", data: "QkFTRTY0" }]);
    expect(body.contents[0]!.parts[0]).toEqual({
      inlineData: { mimeType: "video/mp4", data: "QkFTRTY0" },
    });
    expect(body.contents[0]!.parts.at(-1)).toEqual({ text: "PROMPT" });
  });
});

describe("parseGeminiResponse", () => {
  const wrap = (text: string) => ({ candidates: [{ content: { parts: [{ text }] } }] });

  test("parses valid JSON enrichment", () => {
    const res = parseGeminiResponse(
      wrap(JSON.stringify({ transcript: "hi", entities: [], takeaways: ["a"] })),
    );
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.enrichment.transcript).toBe("hi");
      expect(res.enrichment.takeaways).toEqual(["a"]);
    }
  });

  test("strips ```json fences before parsing", () => {
    const res = parseGeminiResponse(wrap("```json\n{\"entities\":[],\"takeaways\":[]}\n```"));
    expect(res.ok).toBe(true);
  });

  test("returns parse_fail on non-JSON", () => {
    const res = parseGeminiResponse(wrap("not json at all"));
    expect(res).toEqual({ ok: false, error: "parse_fail" });
  });

  test("returns empty_response when no candidate text", () => {
    expect(parseGeminiResponse({})).toEqual({ ok: false, error: "empty_response" });
  });

  test("defaults missing entities/takeaways to empty arrays", () => {
    const res = parseGeminiResponse(wrap(JSON.stringify({ transcript: "x" })));
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.enrichment.entities).toEqual([]);
      expect(res.enrichment.takeaways).toEqual([]);
    }
  });

  test("returns parse_fail on fenced-but-invalid JSON", () => {
    const res = parseGeminiResponse(wrap("```json\n{bad json}\n```"));
    expect(res).toEqual({ ok: false, error: "parse_fail" });
  });

  test("returns empty_response when candidate has no parts", () => {
    expect(parseGeminiResponse({ candidates: [{ content: {} }] })).toEqual({
      ok: false,
      error: "empty_response",
    });
  });

  test("drops malformed entities but keeps well-formed ones", () => {
    const res = parseGeminiResponse(
      wrap(
        JSON.stringify({
          entities: [
            { type: "restaurant", name: "Lilia", raw: "Lilia" },
            { type: "restaurant" }, // missing name → dropped
            { type: "not_a_type", name: "X" }, // bad type → dropped
            { name: "no type" }, // missing type → dropped
          ],
          takeaways: ["a", 5, "b"], // non-string dropped
        }),
      ),
    );
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.enrichment.entities).toEqual([{ type: "restaurant", name: "Lilia", raw: "Lilia", specs: undefined }]);
      expect(res.enrichment.takeaways).toEqual(["a", "b"]);
    }
  });
});
