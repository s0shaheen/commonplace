import type { GeminiResult, Entity } from "./types.js";
import { isEntityType } from "./ontology.js";

export interface MediaPart {
  mimeType: string;
  data: string; // base64
}

interface GeminiBody {
  contents: { parts: Array<{ text: string } | { inlineData: MediaPart }> }[];
  generationConfig: { temperature: number; responseMimeType: string; maxOutputTokens: number };
}

const GEN_CONFIG = { temperature: 0.2, responseMimeType: "application/json", maxOutputTokens: 16384 };

export function buildTextBody(prompt: string): GeminiBody {
  return { contents: [{ parts: [{ text: prompt }] }], generationConfig: { ...GEN_CONFIG } };
}

export function buildMediaBody(prompt: string, media: MediaPart[]): GeminiBody {
  const parts = [...media.map((m) => ({ inlineData: m })), { text: prompt }];
  return { contents: [{ parts }], generationConfig: { ...GEN_CONFIG } };
}

function coerceEntities(raw: unknown): Entity[] {
  if (!Array.isArray(raw)) return [];
  const out: Entity[] = [];
  for (const e of raw) {
    if (!e || typeof e !== "object") continue;
    const obj = e as Record<string, unknown>;
    if (typeof obj.type !== "string" || !isEntityType(obj.type)) continue;
    if (typeof obj.name !== "string" || obj.name.trim() === "") continue;
    out.push({
      type: obj.type,
      name: obj.name,
      raw: typeof obj.raw === "string" ? obj.raw : obj.name,
      specs:
        obj.specs && typeof obj.specs === "object" && !Array.isArray(obj.specs)
          ? (obj.specs as Record<string, string>)
          : undefined,
    });
  }
  return out;
}

function coerceStringArray(raw: unknown): string[] {
  return Array.isArray(raw) ? raw.filter((x): x is string => typeof x === "string") : [];
}

function stripFences(text: string): string {
  return text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();
}

export function parseGeminiResponse(json: unknown): GeminiResult {
  const text = (json as { candidates?: { content?: { parts?: { text?: string }[] } }[] })
    ?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) return { ok: false, error: "empty_response" };
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(stripFences(text));
  } catch {
    return { ok: false, error: "parse_fail" };
  }
  return {
    ok: true,
    enrichment: {
      transcript: typeof parsed.transcript === "string" ? parsed.transcript : undefined,
      on_screen_text: Array.isArray(parsed.on_screen_text)
        ? coerceStringArray(parsed.on_screen_text)
        : undefined,
      entities: coerceEntities(parsed.entities),
      takeaways: coerceStringArray(parsed.takeaways),
      structured_content:
        parsed.structured_content && typeof parsed.structured_content === "object"
          ? (parsed.structured_content as Record<string, unknown>)
          : undefined,
      facets:
        parsed.facets && typeof parsed.facets === "object"
          ? (parsed.facets as { topic?: string; genre?: string; affect?: string })
          : undefined,
    },
  };
}
