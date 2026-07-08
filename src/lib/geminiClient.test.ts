import { describe, test, expect } from "vitest";
import {
  buildTextBody,
  buildMediaBody,
  buildGenerationConfig,
  toGeminiResponseSchema,
  parseExtractorResponse,
} from "./geminiClient.js";
import type { ExtractorOutput } from "./types.js";

const grounded: ExtractorOutput = {
  mentions: [
    {
      surface: "Kill Bill",
      type: "music_recording",
      evidence: [{ channel: "VERBAL_AUDIO", assertion_mode: "SHOWN", confidence: 0.9, t_start: 12, t_end: 19 }],
    },
  ],
  concepts: [],
  claims: [],
  structured: [],
  facets: [
    { facet: "topic", value: "entertainment", evidence: [{ channel: "VISUAL_SCENE", assertion_mode: "INFERRED", confidence: 0.8 }] },
  ],
};

const wrap = (text: string) => ({ candidates: [{ content: { parts: [{ text }] } }] });

describe("buildTextBody / buildMediaBody", () => {
  test("wraps the prompt as a single text part with constrained JSON config", () => {
    const body = buildTextBody("HELLO");
    expect(body.contents[0]!.parts[0]).toEqual({ text: "HELLO" });
    expect(body.generationConfig.responseMimeType).toBe("application/json");
    expect(body.generationConfig.temperature).toBe(0);
    expect(typeof body.generationConfig.responseSchema).toBe("object");
  });

  test("includes inline media parts before the prompt text", () => {
    const body = buildMediaBody("PROMPT", [{ mimeType: "video/mp4", data: "QkFTRTY0" }]);
    expect(body.contents[0]!.parts[0]).toEqual({ inlineData: { mimeType: "video/mp4", data: "QkFTRTY0" } });
    expect(body.contents[0]!.parts.at(-1)).toEqual({ text: "PROMPT" });
  });
});

describe("buildGenerationConfig", () => {
  test("temperature 0, JSON mime, and a response schema", () => {
    const cfg = buildGenerationConfig();
    expect(cfg.temperature).toBe(0);
    expect(cfg.responseMimeType).toBe("application/json");
    expect(cfg.responseSchema).toBeTypeOf("object");
  });
});

describe("toGeminiResponseSchema", () => {
  const scan = (node: unknown, pred: (k: string, v: unknown) => boolean): boolean => {
    if (Array.isArray(node)) return node.some((n) => scan(n, pred));
    if (node && typeof node === "object") {
      for (const [k, v] of Object.entries(node)) {
        if (pred(k, v)) return true;
        if (scan(v, pred)) return true;
      }
    }
    return false;
  };

  test("contains no `additionalProperties` / `$schema` / `$id` key anywhere", () => {
    const schema = toGeminiResponseSchema();
    expect(scan(schema, (k) => k === "additionalProperties")).toBe(false);
    expect(scan(schema, (k) => k === "$schema")).toBe(false);
    expect(scan(schema, (k) => k === "$id")).toBe(false);
  });

  test("keeps the 9-value NamedEntity type enum intact", () => {
    const schema = toGeminiResponseSchema();
    const has9Enum = scan(
      schema,
      (k, v) =>
        k === "enum" &&
        Array.isArray(v) &&
        v.length === 9 &&
        v.includes("music_recording") &&
        v.includes("game") &&
        !v.includes("restaurant"),
    );
    expect(has9Enum).toBe(true);
  });
});

describe("parseExtractorResponse", () => {
  test("happy path: a full Gemini envelope → ok with the typed output", () => {
    const res = parseExtractorResponse(wrap(JSON.stringify(grounded)));
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.output.mentions[0]!.type).toBe("music_recording");
      expect(res.output.facets[0]!.facet).toBe("topic");
    }
  });

  test("accepts fenced JSON", () => {
    const res = parseExtractorResponse(wrap("```json\n" + JSON.stringify(grounded) + "\n```"));
    expect(res.ok).toBe(true);
  });

  test("empty_response when no candidate text", () => {
    expect(parseExtractorResponse({})).toEqual({ ok: false, error: "empty_response" });
    expect(parseExtractorResponse({ candidates: [{ content: {} }] })).toEqual({
      ok: false,
      error: "empty_response",
    });
  });

  test("parse_fail on non-JSON", () => {
    expect(parseExtractorResponse(wrap("not json at all"))).toEqual({ ok: false, error: "parse_fail" });
    expect(parseExtractorResponse(wrap("```json\n{bad json}\n```"))).toEqual({ ok: false, error: "parse_fail" });
  });

  test("schema_invalid for a retired 'restaurant' mention type", () => {
    const bad = {
      ...grounded,
      mentions: [
        { surface: "Kasama", type: "restaurant", evidence: [{ channel: "VISUAL_TEXT", assertion_mode: "SHOWN", confidence: 1 }] },
      ],
    };
    expect(parseExtractorResponse(wrap(JSON.stringify(bad)))).toEqual({ ok: false, error: "schema_invalid" });
  });

  test("schema_invalid when evidence confidence is out of range (1.5)", () => {
    const bad = {
      ...grounded,
      mentions: [
        { surface: "Kill Bill", type: "music_recording", evidence: [{ channel: "VERBAL_AUDIO", assertion_mode: "SHOWN", confidence: 1.5 }] },
      ],
    };
    expect(parseExtractorResponse(wrap(JSON.stringify(bad)))).toEqual({ ok: false, error: "schema_invalid" });
  });

  test("schema_invalid when a mention has zero evidence (hard gate)", () => {
    const bad = { ...grounded, mentions: [{ surface: "x", type: "place", evidence: [] }] };
    expect(parseExtractorResponse(wrap(JSON.stringify(bad)))).toEqual({ ok: false, error: "schema_invalid" });
  });

  test("schema_invalid when a top-level key is missing", () => {
    const { structured, ...rest } = grounded;
    void structured;
    expect(parseExtractorResponse(wrap(JSON.stringify(rest)))).toEqual({ ok: false, error: "schema_invalid" });
  });

  test("schema_invalid for a facet assignment with an unknown axis ('vibe')", () => {
    const bad = {
      ...grounded,
      facets: [
        { facet: "vibe", value: "chill", evidence: [{ channel: "VISUAL_SCENE", assertion_mode: "INFERRED", confidence: 0.8 }] },
      ],
    };
    expect(parseExtractorResponse(wrap(JSON.stringify(bad)))).toEqual({ ok: false, error: "schema_invalid" });
  });

  test("schema_invalid when a mention carries a leaked id key (externalId) — additionalProperties backstop", () => {
    const bad = {
      ...grounded,
      mentions: [
        { surface: "Kill Bill", type: "music_recording", externalId: "Q123", evidence: [{ channel: "VERBAL_AUDIO", assertion_mode: "SHOWN", confidence: 0.9 }] },
      ],
    };
    expect(parseExtractorResponse(wrap(JSON.stringify(bad)))).toEqual({ ok: false, error: "schema_invalid" });
  });

  test("schema_invalid when an evidence object carries an unknown key", () => {
    const bad = {
      ...grounded,
      mentions: [
        { surface: "Kill Bill", type: "music_recording", evidence: [{ channel: "VERBAL_AUDIO", assertion_mode: "SHOWN", confidence: 0.9, mbid: "abc" }] },
      ],
    };
    expect(parseExtractorResponse(wrap(JSON.stringify(bad)))).toEqual({ ok: false, error: "schema_invalid" });
  });

  test("schema_invalid when facets is a flat object, not an array of assignments", () => {
    const bad = { ...grounded, facets: { topic: "food" } };
    expect(parseExtractorResponse(wrap(JSON.stringify(bad)))).toEqual({ ok: false, error: "schema_invalid" });
  });
});
