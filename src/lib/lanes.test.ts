import { describe, test, expect } from "vitest";
import {
  createGeminiLane,
  createOllamaLane,
  routeIngestion,
  analyzeItem,
  type AnalyzeInput,
} from "./lanes.js";
import type { MediaPart } from "./geminiClient.js";
import type { CapturedItem, ExtractorOutput } from "./types.js";
import { DEFAULT_CONFIG } from "./config.js";

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

const restaurantOutput = {
  ...validOutput,
  mentions: [
    { surface: "Kasama", type: "restaurant", evidence: [{ channel: "VISUAL_TEXT", assertion_mode: "SHOWN", confidence: 1 }] },
  ],
};

const TRANSCRIPT = "SECRET_TRANSCRIPT_MARKER_98765";

function makeItem(over: Partial<CapturedItem> = {}): CapturedItem {
  return {
    id: "1",
    sources: ["favorites"],
    desc: "a caption",
    createTime: null,
    author: "acme",
    authorName: "Acme",
    url: null,
    playUrl: null,
    downloadUrl: null,
    cover: null,
    durationSec: 29,
    hasSubtitles: true,
    subtitleUrl: null,
    isSlideshow: false,
    music: null,
    hashtags: [],
    stats: { plays: null, likes: null, comments: null, shares: null, collects: null },
    ...over,
  };
}

const sixFrames: MediaPart[] = Array.from({ length: 6 }, (_, i) => ({ mimeType: "image/jpeg", data: `IMG${i}` }));
const videoBytes: MediaPart = { mimeType: "video/mp4", data: "VIDEO64" };

function makeInput(over: Partial<AnalyzeInput> = {}): AnalyzeInput {
  return { item: makeItem(), transcript: TRANSCRIPT, keyframes: sixFrames, videoBytes, ...over };
}

// A fetchJson fake capturing (url, init) and returning a canned envelope; never hits network.
function geminiFake(text: string) {
  const calls: { url: string; init: RequestInit }[] = [];
  const fetchJson = async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return { candidates: [{ content: { parts: [{ text }] } }] };
  };
  return { calls, fetchJson };
}
function ollamaFake(content: string) {
  const calls: { url: string; init: RequestInit }[] = [];
  const fetchJson = async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return { message: { content } };
  };
  return { calls, fetchJson };
}
const bodyOf = (init: RequestInit) => JSON.parse(init.body as string);
const headerOf = (init: RequestInit, k: string) => (init.headers as Record<string, string>)[k];

describe("createGeminiLane", () => {
  test("keyframes_vtt: 6 inlineData images then 1 text part (with transcript); key in header; temp 0", async () => {
    const { calls, fetchJson } = geminiFake(JSON.stringify(validOutput));
    const lane = createGeminiLane({ fetchJson, key: "k", model: "gemini-2.5-flash-lite", basePrompt: "BASE" });
    const res = await lane.analyze(makeInput(), "keyframes_vtt");

    expect(res.ok).toBe(true);
    expect(calls).toHaveLength(1);
    const { url, init } = calls[0]!;
    expect(url).toBe("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent");
    expect(headerOf(init, "x-goog-api-key")).toBe("k");

    const body = bodyOf(init);
    const parts = body.contents[0].parts;
    expect(parts).toHaveLength(7);
    for (let i = 0; i < 6; i++) expect(parts[i]).toHaveProperty("inlineData");
    expect(parts[6]).toHaveProperty("text");
    expect(parts[6].text).toContain(TRANSCRIPT);
    expect(body.generationConfig.temperature).toBe(0);
  });

  test("native: exactly 1 video inlineData + 1 text part, and the transcript is NOT inline", async () => {
    const { calls, fetchJson } = geminiFake(JSON.stringify(validOutput));
    const lane = createGeminiLane({ fetchJson, key: "k", model: "gemini-2.5-flash-lite", basePrompt: "BASE" });
    const res = await lane.analyze(makeInput({ item: makeItem({ hasSubtitles: false }) }), "native");

    expect(res.ok).toBe(true);
    const body = bodyOf(calls[0]!.init);
    const parts = body.contents[0].parts;
    expect(parts).toHaveLength(2);
    expect(parts[0].inlineData.mimeType).toBe("video/mp4");
    expect(parts[1]).toHaveProperty("text");
    expect(parts[1].text).not.toContain(TRANSCRIPT);
  });

  test("the hard gate holds through the lane: a 'restaurant' mention → schema_invalid", async () => {
    const { fetchJson } = geminiFake(JSON.stringify(restaurantOutput));
    const lane = createGeminiLane({ fetchJson, key: "k", model: "gemini-2.5-flash-lite", basePrompt: "BASE" });
    expect(await lane.analyze(makeInput(), "keyframes_vtt")).toEqual({ ok: false, error: "schema_invalid" });
  });
});

describe("createOllamaLane", () => {
  test("keyframes_vtt: POST /api/chat with model, stream:false, format schema, 6 images", async () => {
    const { calls, fetchJson } = ollamaFake(JSON.stringify(validOutput));
    const lane = createOllamaLane({ fetchJson, endpoint: "http://localhost:11434", model: "qwen3-vl:8b", basePrompt: "BASE" });
    const res = await lane.analyze(makeInput(), "keyframes_vtt");

    expect(res.ok).toBe(true);
    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toBe("http://localhost:11434/api/chat");
    const body = bodyOf(calls[0]!.init);
    expect(body.model).toBe("qwen3-vl:8b");
    expect(body.stream).toBe(false);
    expect(body.format.properties.mentions).toBeDefined();
    expect(body.messages[0].images).toHaveLength(6);
  });

  test("native ingestion is unsupported locally and never calls the model", async () => {
    const { calls, fetchJson } = ollamaFake(JSON.stringify(validOutput));
    const lane = createOllamaLane({ fetchJson, endpoint: "http://localhost:11434", model: "qwen3-vl:8b", basePrompt: "BASE" });
    expect(await lane.analyze(makeInput(), "native")).toEqual({ ok: false, error: "native_unsupported_local" });
    expect(calls).toHaveLength(0);
  });
});

describe("routeIngestion", () => {
  test("default cfg → keyframes_vtt regardless of subtitles (escalation OFF)", () => {
    expect(routeIngestion(makeItem({ hasSubtitles: true }), DEFAULT_CONFIG)).toBe("keyframes_vtt");
    expect(routeIngestion(makeItem({ hasSubtitles: false }), DEFAULT_CONFIG)).toBe("keyframes_vtt");
  });

  test("escalateNative + no subtitles + managed lane → native (the only heuristic)", () => {
    const cfg = { ...DEFAULT_CONFIG, escalateNative: true };
    expect(routeIngestion(makeItem({ hasSubtitles: false }), cfg)).toBe("native");
    expect(routeIngestion(makeItem({ hasSubtitles: true }), cfg)).toBe("keyframes_vtt");
  });

  test("ingestion:native on the local lane falls back to keyframes_vtt (open VLMs are deaf)", () => {
    const cfg = { ...DEFAULT_CONFIG, ingestion: "native" as const, engineLane: "local" as const };
    expect(routeIngestion(makeItem(), cfg)).toBe("keyframes_vtt");
  });

  test("ingestion:native on the managed lane → native", () => {
    const cfg = { ...DEFAULT_CONFIG, ingestion: "native" as const };
    expect(routeIngestion(makeItem(), cfg)).toBe("native");
  });
});

describe("analyzeItem", () => {
  test("selects the configured lane + routed ingestion and returns both", async () => {
    const { fetchJson } = geminiFake(JSON.stringify(validOutput));
    const managed = createGeminiLane({ fetchJson, key: "k", model: "gemini-2.5-flash-lite", basePrompt: "BASE" });
    const { fetchJson: ollamaJson } = ollamaFake(JSON.stringify(validOutput));
    const local = createOllamaLane({ fetchJson: ollamaJson, endpoint: "http://localhost:11434", model: "qwen3-vl:8b", basePrompt: "BASE" });

    const out = await analyzeItem(makeInput(), DEFAULT_CONFIG, { managed, local });
    expect(out.lane).toBe("managed");
    expect(out.ingestion).toBe("keyframes_vtt");
    expect(out.result.ok).toBe(true);
  });
});
