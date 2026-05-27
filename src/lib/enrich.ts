import type { CapturedItem, EnrichedItem, EnrichmentTier, GeminiResult } from "./types.js";
import { dedupeEntities } from "./entities.js";
import { buildTextPrompt, buildVisualPrompt, buildSlideshowPrompt } from "./prompts.js";
import { buildTextBody, buildMediaBody, type MediaPart, type GeminiBody } from "./geminiClient.js";

export interface EnrichDeps {
  callGemini: (body: GeminiBody) => Promise<GeminiResult>;
  fetchSubtitles: (url: string) => Promise<string>;
  fetchMedia: (item: CapturedItem) => Promise<MediaPart[]>;
  basePrompts: { text: string; visual: string; slideshow: string };
}

function raw(item: CapturedItem, error?: string): EnrichedItem {
  return { ...item, enrichment: { tier: "raw", entities: [], takeaways: [], error } };
}

export async function enrichItem(
  item: CapturedItem,
  deps: EnrichDeps,
  tier: Exclude<EnrichmentTier, "raw">,
): Promise<EnrichedItem> {
  if (tier === "text") {
    let transcript = "";
    if (item.hasSubtitles && item.subtitleUrl) {
      // A subtitle-fetch failure is non-fatal — enrich from caption alone.
      try {
        transcript = await deps.fetchSubtitles(item.subtitleUrl);
      } catch {
        transcript = "";
      }
    }
    const prompt = buildTextPrompt(deps.basePrompts.text, item, transcript);
    let res: GeminiResult;
    try {
      res = await deps.callGemini(buildTextBody(prompt));
    } catch {
      return raw(item, "gemini_threw");
    }
    if (!res.ok) return raw(item, res.error);
    return { ...item, enrichment: { ...res.enrichment, entities: dedupeEntities(res.enrichment.entities), tier: "text" } };
  }

  // visual tier
  let media: MediaPart[];
  try {
    media = await deps.fetchMedia(item);
  } catch {
    return raw(item, "media_fetch_failed");
  }
  if (media.length === 0) return raw(item, "media_fetch_failed");
  const prompt = item.isSlideshow
    ? buildSlideshowPrompt(deps.basePrompts.slideshow, item)
    : buildVisualPrompt(deps.basePrompts.visual, item);
  let res: GeminiResult;
  try {
    res = await deps.callGemini(buildMediaBody(prompt, media));
  } catch {
    return raw(item, "gemini_threw");
  }
  if (!res.ok) return raw(item, res.error);
  return { ...item, enrichment: { ...res.enrichment, entities: dedupeEntities(res.enrichment.entities), tier: "visual" } };
}

export function mergeVisualIntoText(textItem: EnrichedItem, visual: GeminiResult): EnrichedItem {
  if (!visual.ok) return { ...textItem, enrichment: { ...textItem.enrichment, error: visual.error } };
  const combined = dedupeEntities([...textItem.enrichment.entities, ...visual.enrichment.entities]);
  return {
    ...textItem,
    enrichment: {
      ...textItem.enrichment,
      tier: "visual",
      on_screen_text: visual.enrichment.on_screen_text ?? textItem.enrichment.on_screen_text,
      entities: combined,
      // Intentional asymmetry: takeaways prefer existing-if-nonempty; on_screen_text uses ?? (visual-first, text fallback).
      takeaways: textItem.enrichment.takeaways.length
        ? textItem.enrichment.takeaways
        : visual.enrichment.takeaways,
      error: undefined,
    },
  };
}
