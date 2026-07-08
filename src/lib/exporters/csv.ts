import type { AnalyzedItem } from "../types.js";
import { buildMentionIndex } from "../entities.js";

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
  "lane",
  "mentions",
  "claims",
  "plays",
];

export function toItemsCsv(items: AnalyzedItem[]): string {
  const lines = [ITEM_HEADER.join(",")];
  for (const it of items) {
    const out = it.analysis.output;
    lines.push(
      row([
        it.id,
        it.url ?? "",
        it.author ?? "",
        it.desc,
        it.hashtags.join("|"),
        it.analysis.lane,
        out.mentions.map((m) => `${m.type}:${m.surface}`).join("|"),
        out.claims.map((c) => c.statement).join("|"),
        it.stats.plays ?? "",
      ]),
    );
  }
  return lines.join("\n") + "\n";
}

export function toMentionsCsv(items: AnalyzedItem[]): string {
  const lines = ["key,type,surface,item_ids"];
  for (const e of buildMentionIndex(items)) {
    lines.push(row([e.key, e.type, e.surface, e.itemIds.join("|")]));
  }
  return lines.join("\n") + "\n";
}
