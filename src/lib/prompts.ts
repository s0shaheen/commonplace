import type { CapturedItem } from "./types.js";

export const PROMPT_VERSION = "extract@v1";

// Appends a CONTEXT block (caption, hashtags, creator, music, transcript-if-present)
// to the frozen extract_v1.md base prompt. The base prompt owns the output contract;
// this only feeds the model the post's known metadata.
export function buildExtractorPrompt(base: string, item: CapturedItem, transcript: string): string {
  const lines: string[] = ["CONTEXT:"];
  lines.push(`Caption: ${item.desc}`);
  if (item.hashtags.length) {
    lines.push(`Hashtags: ${item.hashtags.map((t) => `#${t}`).join(" ")}`);
  }
  const creator = item.authorName ?? item.author;
  if (creator) lines.push(`Creator: ${creator}`);
  if (item.music?.name) {
    const author = item.music.author ? ` — ${item.music.author}` : "";
    lines.push(`Music (post metadata): ${item.music.name}${author}`);
  }
  if (transcript.trim()) {
    lines.push(`Transcript:\n${transcript.trim()}`);
  }
  return `${base}\n\n${lines.join("\n")}`;
}
