import type { AnalyzedItem } from "../types.js";
import { buildMentionIndex } from "../entities.js";

export function toJsonBundle(items: AnalyzedItem[]): string {
  return JSON.stringify(
    {
      version: 2,
      schema: "commonplace/1.0.0-rc.6",
      exported_at: new Date().toISOString(),
      items,
      mentions: buildMentionIndex(items),
    },
    null,
    2,
  );
}
