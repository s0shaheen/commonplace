import type { CapturedItem } from "./types.js";

function captionBlock(item: CapturedItem): string {
  const tags = item.hashtags.length ? `\nHashtags: ${item.hashtags.map((t) => `#${t}`).join(" ")}` : "";
  return `Caption: ${item.desc}${tags}`;
}

export function buildTextPrompt(basePrompt: string, item: CapturedItem, transcript: string): string {
  const subs = transcript.trim() ? `\n\nSubtitles:\n${transcript.trim()}` : "";
  return `${basePrompt}\n\n${captionBlock(item)}${subs}`;
}

export function buildVisualPrompt(basePrompt: string, item: CapturedItem): string {
  return `${basePrompt}\n\n${captionBlock(item)}`;
}

export function buildSlideshowPrompt(basePrompt: string, item: CapturedItem): string {
  return `${basePrompt}\n\n${captionBlock(item)}`;
}
