// Engine lanes + the ingestion router.
//
// Two lanes behind one `EngineLane` interface: the managed Gemini lane and the local Ollama
// lane. Both build a prompt (with or without the transcript inline, depending on ingestion),
// call an injected `fetchJson`, and pass the response THROUGH the shared hard gate. The
// router (`routeIngestion`) decides keyframes_vtt vs native from config; `analyzeItem` picks
// the configured lane and runs it. Model IDs and keys never live here — they arrive via deps.

import type { CapturedItem, ExtractorResult } from "./types.js";
import type { CpConfig } from "./config.js";
import {
  buildMediaBody,
  buildFileDataBody,
  parseExtractorResponse,
  type GeminiBody,
  type MediaPart,
  type ServiceTier,
} from "./geminiClient.js";
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
// keyframes_vtt → N image parts (inlineData — small) + prompt WITH transcript; native → the video
// uploaded through the FILE API and referenced as a `fileData` part + prompt WITHOUT the transcript
// inline (the audio is in the video). Inline base64 is NOT used for video: it breaks above ~20MB.
// The upload itself is IO (network + poll-until-ACTIVE), so it is INJECTED as `fileUpload` and owned
// by the glue; this core stays pure-ish and testable. Key goes in the `x-goog-api-key` HEADER, never
// the query string (URL keys leak into logs).
export function createGeminiLane(deps: {
  fetchJson(url: string, init: RequestInit): Promise<unknown>;
  key: string;
  model: string;
  basePrompt: string;
  /** Upload video bytes via the File API and resolve once the file is ACTIVE. Absent ⇒ no native path. */
  fileUpload?(bytes: MediaPart, mimeType: string): Promise<{ fileUri: string }>;
  /** Inference tier (DEC-036). Defaults to "standard"; production analysis passes "flex" (50% off). */
  serviceTier?: ServiceTier;
}): EngineLane {
  const tier: ServiceTier = deps.serviceTier ?? "standard";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${deps.model}:generateContent`;
  return {
    id: "managed",
    async analyze(input, ingestion) {
      let body: GeminiBody;
      if (ingestion === "native") {
        if (!input.videoBytes) return { ok: false, error: "media_fetch_failed" };
        // No uploader wired ⇒ a typed failure BEFORE any model call — never a silent inline fallback
        // (which would fail on real videos) and never a burned request.
        if (!deps.fileUpload) return { ok: false, error: "file_upload_unavailable" };
        const mimeType = input.videoBytes.mimeType || "video/mp4";
        const { fileUri } = await deps.fileUpload(input.videoBytes, mimeType);
        const prompt = buildExtractorPrompt(deps.basePrompt, input.item, "");
        body = buildFileDataBody(prompt, { fileUri, mimeType }, tier);
      } else {
        const prompt = buildExtractorPrompt(deps.basePrompt, input.item, input.transcript);
        body = buildMediaBody(prompt, input.keyframes, tier);
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

// The ingestion router (extractor-v2). The LOCAL lane is ALWAYS keyframes_vtt — open VLMs are deaf,
// so native (audio-bearing) ingestion is meaningless there, whatever the config says. On the managed
// lane, `ingestion` decides and now DEFAULTS to native; keyframes_vtt stays available as an explicit
// escape hatch, with the escalateNative heuristic kept for it (moot under the native default).
// NOTE: routing to native does not guarantee native RUNS — the lane falls back honestly when the
// video bytes or the File API uploader are unavailable (typed error, never a silent empty analysis).
export function routeIngestion(item: CapturedItem, cfg: CpConfig): Ingestion {
  if (cfg.engineLane !== "managed") return "keyframes_vtt";
  if (cfg.ingestion === "native") return "native";
  if (cfg.escalateNative && !item.hasSubtitles) return "native";
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
