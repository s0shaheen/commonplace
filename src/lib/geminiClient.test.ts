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
      evidence: [{ channel: "VERBAL_AUDIO", assertion_mode: "SHOWN", confidence: 0.9, t_start: "0:12", t_end: "0:19" }],
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
    // Gemini 3.x: no temperature/top_p/top_k (default sampling; temp-0 is the numeric-loop trigger).
    expect("temperature" in body.generationConfig).toBe(false);
    expect(typeof body.generationConfig.responseSchema).toBe("object");
  });

  test("includes inline media parts before the prompt text", () => {
    const body = buildMediaBody("PROMPT", [{ mimeType: "video/mp4", data: "QkFTRTY0" }]);
    expect(body.contents[0]!.parts[0]).toEqual({ inlineData: { mimeType: "video/mp4", data: "QkFTRTY0" } });
    expect(body.contents[0]!.parts.at(-1)).toEqual({ text: "PROMPT" });
  });
});

describe("buildGenerationConfig — vendor-aligned for gemini-3.x (extractor-v2)", () => {
  test("no temperature/top_p/top_k (default sampling; removes the numeric-loop trigger)", () => {
    const cfg = buildGenerationConfig() as unknown as Record<string, unknown>;
    expect("temperature" in cfg).toBe(false);
    expect("top_p" in cfg).toBe(false);
    expect("topP" in cfg).toBe(false);
    expect("top_k" in cfg).toBe(false);
    expect("topK" in cfg).toBe(false);
  });
  test("constrained JSON: responseMimeType + a response schema", () => {
    const cfg = buildGenerationConfig();
    expect(cfg.responseMimeType).toBe("application/json");
    expect(cfg.responseSchema).toBeTypeOf("object");
  });
  test("thinkingConfig.thinkingLevel 'low' (extraction is classification-shaped)", () => {
    expect(buildGenerationConfig().thinkingConfig).toEqual({ thinkingLevel: "low" });
  });
  test("bounded maxOutputTokens so no run can spew a tens-of-thousands-token runaway", () => {
    const cfg = buildGenerationConfig();
    expect(cfg.maxOutputTokens).toBe(8192);
  });
  test("mediaResolution HIGH — the extractor reads fine on-screen text (menus/signs/prices)", () => {
    expect(buildGenerationConfig().mediaResolution).toBe("MEDIA_RESOLUTION_HIGH");
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

  test("schema_invalid when an evidence timestamp is a NUMBER (rc.7: t_start/t_end are MM:SS strings)", () => {
    const bad = {
      ...grounded,
      mentions: [
        { surface: "Kill Bill", type: "music_recording", evidence: [{ channel: "VERBAL_AUDIO", assertion_mode: "SHOWN", confidence: 0.9, t_start: 12, t_end: 19 }] },
      ],
    };
    expect(parseExtractorResponse(wrap(JSON.stringify(bad)))).toEqual({ ok: false, error: "schema_invalid" });
  });

  test("a complete valid response is NOT marked partial", () => {
    const res = parseExtractorResponse(wrap(JSON.stringify(grounded)));
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.partial).toBeFalsy();
  });
});

describe("parseExtractorResponse — JSON-repair on truncation → honest partial (never a silent drop)", () => {
  // A MAX_TOKENS envelope: finishReason set, text cut off mid-array partway through the 3rd mention.
  const wrapTrunc = (text: string) => ({ candidates: [{ finishReason: "MAX_TOKENS", content: { parts: [{ text }] } }] });
  const ev = `"evidence":[{"channel":"VISUAL_TEXT","assertion_mode":"SHOWN","confidence":0.9}]`;
  // Two COMPLETE mentions, then a third cut off mid-token, and the remaining top-level keys never emitted.
  const truncated =
    `{"mentions":[` +
    `{"surface":"Kasama","type":"place",${ev}},` +
    `{"surface":"UPS","type":"brand_org",${ev}},` +
    `{"surface":"Tony So`;

  test("salvages the complete elements, drops the incomplete one, and marks the result partial", () => {
    const res = parseExtractorResponse(wrapTrunc(truncated));
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.partial).toBe(true);
      expect(res.output.mentions.map((m) => m.surface)).toEqual(["Kasama", "UPS"]);
      // keys the model never reached become empty arrays (honest incompleteness, not a fabricated value)
      expect(res.output.concepts).toEqual([]);
      expect(res.output.structured).toEqual([]);
    }
  });

  test("the salvaged partial still passes the hard gate (a would-be invalid element cannot slip in)", () => {
    // The trailing incomplete element is discarded, so only gate-valid complete elements remain.
    const res = parseExtractorResponse(wrapTrunc(truncated));
    expect(res.ok).toBe(true);
    if (res.ok) for (const m of res.output.mentions) expect(m.evidence.length).toBeGreaterThan(0);
  });

  test("genuine non-JSON is still parse_fail — an empty salvage is never dressed up as a partial", () => {
    expect(parseExtractorResponse(wrapTrunc("not json at all"))).toEqual({ ok: false, error: "parse_fail" });
    // truncation so early that no complete element exists → nothing to salvage → parse_fail
    expect(parseExtractorResponse(wrapTrunc(`{"mentions":[{"surf`))).toEqual({ ok: false, error: "parse_fail" });
  });
});
