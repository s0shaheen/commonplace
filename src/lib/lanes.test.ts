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
    const lane = createGeminiLane({ fetchJson, key: "k", model: "gemini-3.6-flash", basePrompt: "BASE" });
    const res = await lane.analyze(makeInput(), "keyframes_vtt");

    expect(res.ok).toBe(true);
    expect(calls).toHaveLength(1);
    const { url, init } = calls[0]!;
    expect(url).toBe("https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent");
    expect(headerOf(init, "x-goog-api-key")).toBe("k");

    const body = bodyOf(init);
    const parts = body.contents[0].parts;
    expect(parts).toHaveLength(7);
    for (let i = 0; i < 6; i++) expect(parts[i]).toHaveProperty("inlineData");
    expect(parts[6]).toHaveProperty("text");
    expect(parts[6].text).toContain(TRANSCRIPT);
    expect("temperature" in body.generationConfig).toBe(false); // gemini-3.x default sampling
  });

  test("native: 1 fileData video part (File API) BEFORE the text part; transcript NOT inline", async () => {
    const { calls, fetchJson } = geminiFake(JSON.stringify(validOutput));
    const uploads: { mimeType: string }[] = [];
    const lane = createGeminiLane({
      fetchJson,
      key: "k",
      model: "gemini-3.6-flash",
      basePrompt: "BASE",
      fileUpload: async (_bytes, mimeType) => {
        uploads.push({ mimeType });
        return { fileUri: "https://generativelanguage.googleapis.com/v1beta/files/abc123" };
      },
    });
    const res = await lane.analyze(makeInput({ item: makeItem({ hasSubtitles: false }) }), "native");

    expect(res.ok).toBe(true);
    // the video went through the File API (not inline base64, which breaks above ~20MB)
    expect(uploads).toEqual([{ mimeType: "video/mp4" }]);
    const body = bodyOf(calls[0]!.init);
    const parts = body.contents[0].parts;
    expect(parts).toHaveLength(2);
    expect(parts[0].fileData).toEqual({
      fileUri: "https://generativelanguage.googleapis.com/v1beta/files/abc123",
      mimeType: "video/mp4",
    });
    expect(parts[0].inlineData).toBeUndefined();
    expect(parts[1]).toHaveProperty("text");
    expect(parts[1].text).not.toContain(TRANSCRIPT);
  });

  test("native without a fileUpload dep → typed failure, and the model is NEVER called", async () => {
    const { calls, fetchJson } = geminiFake(JSON.stringify(validOutput));
    const lane = createGeminiLane({ fetchJson, key: "k", model: "gemini-3.6-flash", basePrompt: "BASE" });
    expect(await lane.analyze(makeInput(), "native")).toEqual({ ok: false, error: "file_upload_unavailable" });
    expect(calls).toHaveLength(0);
  });

  test("native with no video bytes → media_fetch_failed, no upload and no model call", async () => {
    const { calls, fetchJson } = geminiFake(JSON.stringify(validOutput));
    let uploaded = 0;
    const lane = createGeminiLane({
      fetchJson, key: "k", model: "gemini-3.6-flash", basePrompt: "BASE",
      fileUpload: async () => { uploaded++; return { fileUri: "u" }; },
    });
    expect(await lane.analyze(makeInput({ videoBytes: null }), "native")).toEqual({ ok: false, error: "media_fetch_failed" });
    expect(uploaded).toBe(0);
    expect(calls).toHaveLength(0);
  });

  test("keyframes stay inlineData (small images) — the File API is the native-video path only", async () => {
    const { calls, fetchJson } = geminiFake(JSON.stringify(validOutput));
    let uploaded = 0;
    const lane = createGeminiLane({
      fetchJson, key: "k", model: "gemini-3.6-flash", basePrompt: "BASE",
      fileUpload: async () => { uploaded++; return { fileUri: "u" }; },
    });
    await lane.analyze(makeInput(), "keyframes_vtt");
    expect(uploaded).toBe(0);
    expect(bodyOf(calls[0]!.init).contents[0].parts[0]).toHaveProperty("inlineData");
  });

  test("the hard gate holds through the lane: a 'restaurant' mention → schema_invalid", async () => {
    const { fetchJson } = geminiFake(JSON.stringify(restaurantOutput));
    const lane = createGeminiLane({ fetchJson, key: "k", model: "gemini-3.6-flash", basePrompt: "BASE" });
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
  test("default cfg (managed) → native regardless of subtitles — extractor-v2 flip", () => {
    expect(routeIngestion(makeItem({ hasSubtitles: true }), DEFAULT_CONFIG)).toBe("native");
    expect(routeIngestion(makeItem({ hasSubtitles: false }), DEFAULT_CONFIG)).toBe("native");
  });

  test("the LOCAL lane is ALWAYS keyframes_vtt (open VLMs are deaf), whatever the config says", () => {
    const local = { ...DEFAULT_CONFIG, engineLane: "local" as const };
    expect(routeIngestion(makeItem(), local)).toBe("keyframes_vtt");
    expect(routeIngestion(makeItem(), { ...local, ingestion: "native" as const })).toBe("keyframes_vtt");
    expect(routeIngestion(makeItem({ hasSubtitles: false }), { ...local, escalateNative: true })).toBe("keyframes_vtt");
  });

  test("explicit ingestion:keyframes_vtt on the managed lane is honoured (the escape hatch)", () => {
    const cfg = { ...DEFAULT_CONFIG, ingestion: "keyframes_vtt" as const };
    expect(routeIngestion(makeItem({ hasSubtitles: true }), cfg)).toBe("keyframes_vtt");
  });

  test("escalateNative + no subtitles + managed → native (heuristic kept, now moot under the default)", () => {
    const cfg = { ...DEFAULT_CONFIG, ingestion: "keyframes_vtt" as const, escalateNative: true };
    expect(routeIngestion(makeItem({ hasSubtitles: false }), cfg)).toBe("native");
    expect(routeIngestion(makeItem({ hasSubtitles: true }), cfg)).toBe("keyframes_vtt");
  });
});

describe("analyzeItem", () => {
  test("selects the configured lane + routed ingestion and returns both (default: managed + native)", async () => {
    const { fetchJson } = geminiFake(JSON.stringify(validOutput));
    const managed = createGeminiLane({
      fetchJson, key: "k", model: "gemini-3.6-flash", basePrompt: "BASE",
      fileUpload: async () => ({ fileUri: "https://generativelanguage.googleapis.com/v1beta/files/x" }),
    });
    const { fetchJson: ollamaJson } = ollamaFake(JSON.stringify(validOutput));
    const local = createOllamaLane({ fetchJson: ollamaJson, endpoint: "http://localhost:11434", model: "qwen3-vl:8b", basePrompt: "BASE" });

    const out = await analyzeItem(makeInput(), DEFAULT_CONFIG, { managed, local });
    expect(out.lane).toBe("managed");
    expect(out.ingestion).toBe("native"); // extractor-v2 default flip
    expect(out.result.ok).toBe(true);
  });

  test("the local lane routes to keyframes_vtt and reports the ingestion actually used", async () => {
    const { fetchJson } = geminiFake(JSON.stringify(validOutput));
    const managed = createGeminiLane({ fetchJson, key: "k", model: "gemini-3.6-flash", basePrompt: "BASE" });
    const { fetchJson: ollamaJson } = ollamaFake(JSON.stringify(validOutput));
    const local = createOllamaLane({ fetchJson: ollamaJson, endpoint: "http://localhost:11434", model: "qwen3-vl:8b", basePrompt: "BASE" });

    const out = await analyzeItem(makeInput(), { ...DEFAULT_CONFIG, engineLane: "local" }, { managed, local });
    expect(out.lane).toBe("local");
    expect(out.ingestion).toBe("keyframes_vtt");
    expect(out.result.ok).toBe(true);
  });
});
