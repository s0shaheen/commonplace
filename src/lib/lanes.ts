// Engine lanes + the ingestion router.
//
// Two lanes behind one `EngineLane` interface: the managed Gemini lane and the local Ollama
// lane. Both build a prompt (with or without the transcript inline, depending on ingestion),
// call an injected `fetchJson`, and pass the response THROUGH the shared hard gate. The
// router (`routeIngestion`) decides keyframes_vtt vs native from config; `analyzeItem` picks
// the configured lane and runs it. Model IDs and keys never live here — they arrive via deps.

import type { CapturedItem, ExtractorResult } from "./types.js";
import type { CpConfig } from "./config.js";
import { buildMediaBody, parseExtractorResponse, type GeminiBody, type MediaPart } from "./geminiClient.js";
import { buildOllamaBody, parseOllamaResponse } from "./ollamaClient.js";
import { buildExtractorPrompt } from "./prompts.js";

export type LaneId = "managed" | "local";
export type Ingestion = "keyframes_vtt" | "native";

export interface AnalyzeInput {
  item: CapturedItem;
  transcript: string;
  keyframes: MediaPart[];
  videoBytes: MediaPart | null;
}

export interface EngineLane {
  id: LaneId;
  analyze(input: AnalyzeInput, ingestion: Ingestion): Promise<ExtractorResult>;
}

const JSON_HEADERS = { "content-type": "application/json" };

// ── Managed lane: Gemini ──────────────────────────────────────────────────────────
// keyframes_vtt → N image parts + prompt WITH transcript; native → 1 video inlineData +
// prompt WITHOUT the transcript inline (the audio is in the video). Key goes in the
// `x-goog-api-key` HEADER, never the query string (URL keys leak into logs).
export function createGeminiLane(deps: {
  fetchJson(url: string, init: RequestInit): Promise<unknown>;
  key: string;
  model: string;
  basePrompt: string;
}): EngineLane {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${deps.model}:generateContent`;
  return {
    id: "managed",
    async analyze(input, ingestion) {
      let body: GeminiBody;
      if (ingestion === "native") {
        if (!input.videoBytes) return { ok: false, error: "media_fetch_failed" };
        const prompt = buildExtractorPrompt(deps.basePrompt, input.item, "");
        body = buildMediaBody(prompt, [input.videoBytes]);
      } else {
        const prompt = buildExtractorPrompt(deps.basePrompt, input.item, input.transcript);
        body = buildMediaBody(prompt, input.keyframes);
      }
      const json = await deps.fetchJson(url, {
        method: "POST",
        headers: { ...JSON_HEADERS, "x-goog-api-key": deps.key },
        body: JSON.stringify(body),
      });
      return parseExtractorResponse(json);
    },
  };
}

// ── Local lane: Ollama (open VLMs) ──────────────────────────────────────────────────
// Only keyframes_vtt is supported: open VLMs are DEAF, so native (audio-bearing) ingestion
// is refused WITHOUT a model call (SPEC §13). keyframes_vtt → prompt WITH transcript + the
// keyframes as base64 images.
export function createOllamaLane(deps: {
  fetchJson(url: string, init: RequestInit): Promise<unknown>;
  endpoint: string;
  model: string;
  basePrompt: string;
}): EngineLane {
  return {
    id: "local",
    async analyze(input, ingestion) {
      if (ingestion === "native") return { ok: false, error: "native_unsupported_local" };
      const prompt = buildExtractorPrompt(deps.basePrompt, input.item, input.transcript);
      const body = buildOllamaBody(deps.model, prompt, input.keyframes.map((k) => k.data));
      const json = await deps.fetchJson(`${deps.endpoint}/api/chat`, {
        method: "POST",
        headers: JSON_HEADERS,
        body: JSON.stringify(body),
      });
      return parseOllamaResponse(json);
    },
  };
}

// The ingestion router. `ingestion:"native"` picks native — but only on the managed lane;
// the local lane always falls back to keyframes_vtt (deaf VLMs). Otherwise keyframes_vtt,
// except the ONE escalation heuristic: escalateNative && no-subtitles && managed → native.
// The cascade is RETRACTED — with the default flag off this is always keyframes_vtt.
export function routeIngestion(item: CapturedItem, cfg: CpConfig): Ingestion {
  if (cfg.ingestion === "native") {
    return cfg.engineLane === "managed" ? "native" : "keyframes_vtt";
  }
  if (cfg.escalateNative && !item.hasSubtitles && cfg.engineLane === "managed") return "native";
  return "keyframes_vtt";
}

// Select the configured lane, route ingestion, run it. Returns the lane + ingestion actually
// used alongside the result so the caller can record real provenance (never synthetic).
export async function analyzeItem(
  input: AnalyzeInput,
  cfg: CpConfig,
  lanes: Record<LaneId, EngineLane>,
): Promise<{ result: ExtractorResult; lane: LaneId; ingestion: Ingestion }> {
  const lane = cfg.engineLane;
  const ingestion = routeIngestion(input.item, cfg);
  const result = await lanes[lane].analyze(input, ingestion);
  return { result, lane, ingestion };
}
