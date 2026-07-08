import type { MentionOut, AnalyzedItem, MentionIndexEntry } from "./types.js";

export function normalizeName(name: string): string {
  return name
    .normalize("NFKC")
    .toLowerCase()
    .trim()
    .replace(/^@/, "")
    .replace(/\s+/g, " ")
    .replace(/^the\s+/, "");
}

export function mentionKey(m: { type: string; surface: string }): string {
  return `${m.type}:${normalizeName(m.surface)}`;
}

// Collapse same-key mentions within one item: first occurrence's surface/type/evidence
// win; alternate surfaces and all `aliases` are unioned into the survivor's aliases.
export function dedupeMentions(mentions: MentionOut[]): MentionOut[] {
  const byKey = new Map<string, MentionOut>();
  for (const m of mentions) {
    const key = mentionKey(m);
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, { ...m, aliases: m.aliases ? [...m.aliases] : undefined });
      continue;
    }
    const aliases = new Set<string>(existing.aliases ?? []);
    for (const a of m.aliases ?? []) aliases.add(a);
    if (m.surface !== existing.surface) aliases.add(m.surface);
    existing.aliases = aliases.size ? [...aliases] : undefined;
  }
  return [...byKey.values()];
}

// Cross-item index: one entry per mention key, carrying every item id it appears in
// (first-seen order, deduped).
export function buildMentionIndex(items: AnalyzedItem[]): MentionIndexEntry[] {
  const byKey = new Map<string, MentionIndexEntry>();
  for (const item of items) {
    for (const m of dedupeMentions(item.analysis?.output?.mentions ?? [])) {
      const key = mentionKey(m);
      let entry = byKey.get(key);
      if (!entry) {
        entry = { key, type: m.type, surface: m.surface, itemIds: [] };
        byKey.set(key, entry);
      }
      if (!entry.itemIds.includes(item.id)) entry.itemIds.push(item.id);
    }
  }
  return [...byKey.values()];
}
