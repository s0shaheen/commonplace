import type { EnrichedItem } from "../types.js";
import { buildEntityIndex } from "../entities.js";

export function toJsonBundle(items: EnrichedItem[]): string {
  return JSON.stringify(
    { version: 1, exported_at: new Date().toISOString(), items, entities: buildEntityIndex(items) },
    null,
    2,
  );
}
