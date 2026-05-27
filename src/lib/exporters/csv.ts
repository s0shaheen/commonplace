import type { EnrichedItem } from "../types.js";
import { buildEntityIndex } from "../entities.js";

function cell(value: unknown): string {
  const s = value == null ? "" : String(value);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function row(cells: unknown[]): string {
  return cells.map(cell).join(",");
}

const ITEM_HEADER = [
  "id",
  "url",
  "author",
  "caption",
  "hashtags",
  "tier",
  "entities",
  "takeaways",
  "plays",
];

export function toItemsCsv(items: EnrichedItem[]): string {
  const lines = [ITEM_HEADER.join(",")];
  for (const it of items) {
    lines.push(
      row([
        it.id,
        it.url ?? "",
        it.author ?? "",
        it.desc,
        it.hashtags.join("|"),
        it.enrichment.tier,
        it.enrichment.entities.map((e) => `${e.type}:${e.name}`).join("|"),
        it.enrichment.takeaways.join("|"),
        it.stats.plays ?? "",
      ]),
    );
  }
  return lines.join("\n") + "\n";
}

export function toEntitiesCsv(items: EnrichedItem[]): string {
  const lines = ["key,type,name,item_ids"];
  for (const e of buildEntityIndex(items)) {
    lines.push(row([e.key, e.type, e.name, e.itemIds.join("|")]));
  }
  return lines.join("\n") + "\n";
}
