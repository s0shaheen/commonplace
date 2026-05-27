import type { Entity, EnrichedItem, EntityIndexEntry } from "./types.js";

export function normalizeName(name: string): string {
  return name
    .normalize("NFKC")
    .toLowerCase()
    .trim()
    .replace(/^@/, "")
    .replace(/\s+/g, " ")
    .replace(/^the\s+/, "");
}

export function entityKey(entity: Entity): string {
  return `${entity.type}:${normalizeName(entity.name)}`;
}

export function dedupeEntities(entities: Entity[]): Entity[] {
  const byKey = new Map<string, Entity>();
  for (const e of entities) {
    const key = entityKey(e);
    const existing = byKey.get(key);
    if (!existing) {
      // First occurrence wins: its `raw` and `name` become the display values.
      byKey.set(key, { ...e, specs: e.specs ? { ...e.specs } : undefined });
    } else if (e.specs) {
      existing.specs = { ...(existing.specs ?? {}), ...e.specs };
    }
  }
  return [...byKey.values()];
}

export function buildEntityIndex(items: EnrichedItem[]): EntityIndexEntry[] {
  const byKey = new Map<string, EntityIndexEntry>();
  for (const item of items) {
    for (const e of dedupeEntities(item.enrichment?.entities ?? [])) {
      const key = entityKey(e);
      let entry = byKey.get(key);
      if (!entry) {
        entry = { key, type: e.type, name: e.name, itemIds: [] };
        byKey.set(key, entry);
      }
      if (!entry.itemIds.includes(item.id)) entry.itemIds.push(item.id);
    }
  }
  return [...byKey.values()];
}
