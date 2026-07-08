// Local-lane client for Ollama (open VLMs, e.g. qwen3-vl). Mirrors the Gemini client's
// contract: build a request envelope, and parse the response THROUGH the same hard gate
// (`gateExtractorOutput`) so a schema-violating local model is rejected identically to a
// managed one. The model IDs never live here — they arrive via config/deps.

import type { ExtractorResult } from "./types.js";
import { gateExtractorOutput, stripFences, toGeminiResponseSchema } from "./geminiClient.js";

export interface OllamaBody {
  model: string;
  stream: false;
  format: object; // JSON schema for structured output (the Gemini-stripped extractor schema)
  messages: { role: "user"; content: string; images: string[] }[];
}

// Ollama's /api/chat envelope: prompt as the single user message, keyframes as base64 images,
// `format` constrains decoding to the extractor schema. `stream:false` returns one JSON blob.
export function buildOllamaBody(model: string, prompt: string, images: string[]): OllamaBody {
  return {
    model,
    stream: false,
    format: toGeminiResponseSchema(),
    messages: [{ role: "user", content: prompt, images }],
  };
}

// Extract message.content → JSON.parse → shared hard gate. Same failure vocabulary as the
// Gemini parser (empty_response / parse_fail / schema_invalid).
export function parseOllamaResponse(json: unknown): ExtractorResult {
  const content = (json as { message?: { content?: string } })?.message?.content;
  if (!content) return { ok: false, error: "empty_response" };
  let parsed: unknown;
  try {
    parsed = JSON.parse(stripFences(content));
  } catch {
    return { ok: false, error: "parse_fail" };
  }
  return gateExtractorOutput(parsed);
}
