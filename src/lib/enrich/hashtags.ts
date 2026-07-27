// PURE hashtag extraction from a caption. `#pasta #weeknight-dinner` → ["pasta", "weeknight"].
// Unicode-aware (letters/numbers/underscore), strips the leading '#', dedupes preserving first-seen
// order. Shared by the oEmbed and tikwm adapters (both get hashtags only via the caption text).
export function parseHashtags(text: string | null | undefined): string[] {
  if (typeof text !== "string" || text === "") return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const m of text.matchAll(/#([\p{L}\p{N}_]+)/gu)) {
    const tag = m[1]!;
    if (!seen.has(tag)) {
      seen.add(tag);
      out.push(tag);
    }
  }
  return out;
}
