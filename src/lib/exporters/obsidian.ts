import type { EnrichedItem } from "../types.js";
import { buildEntityIndex } from "../entities.js";

export interface VaultFile {
  path: string;
  content: string;
}

function sanitize(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, "_").trim();
}

// JSON strings are valid YAML 1.2 double-quoted scalars, so this safely escapes
// colons, quotes, newlines, etc. in user-controlled front-matter values.
function yamlStr(value: string): string {
  return JSON.stringify(value);
}

function itemNote(item: EnrichedItem): VaultFile {
  const e = item.enrichment;
  const fm = [
    "---",
    `id: ${yamlStr(item.id)}`,
    `creator: ${yamlStr(item.author ?? "")}`,
    `url: ${yamlStr(item.url ?? "")}`,
    `tier: ${e.tier}`,
    "---",
  ].join("\n");
  const heading = (item.desc || item.id).replace(/\s*\n+\s*/g, " ").trim();
  const tags = item.hashtags.map((t) => `#${t}`).join(" ");
  const entityLinks = e.entities.map((ent) => `- [[${sanitize(ent.name)}]] (${ent.type})`).join("\n");
  const takeaways = e.takeaways.map((t) => `- ${t}`).join("\n");
  const body = [
    fm,
    "",
    `# ${heading}`,
    tags,
    "",
    "## Takeaways",
    takeaways || "_none_",
    "",
    "## Entities",
    entityLinks || "_none_",
    "",
    "## Transcript",
    e.transcript ?? "_none_",
    "",
    item.url ? `[Open on TikTok](${item.url})` : "",
  ].join("\n");
  return { path: `items/${sanitize(item.id)}.md`, content: body };
}

export function toObsidianVault(items: EnrichedItem[]): VaultFile[] {
  // Guard against two distinct names sanitizing to the same filename (e.g. "Joe/s" vs "Joe:s"):
  // disambiguate the path so no note is silently overwritten. Wikilinks for such rare
  // sanitize-collisions remain ambiguous in Obsidian — a known v1 limitation.
  const used = new Set<string>();
  const uniquePath = (path: string): string => {
    if (!used.has(path)) {
      used.add(path);
      return path;
    }
    const dot = path.lastIndexOf(".");
    const stem = path.slice(0, dot);
    const ext = path.slice(dot);
    let i = 2;
    while (used.has(`${stem}-${i}${ext}`)) i++;
    const next = `${stem}-${i}${ext}`;
    used.add(next);
    return next;
  };

  const files: VaultFile[] = items.map((item) => {
    const note = itemNote(item);
    return { path: uniquePath(note.path), content: note.content };
  });
  for (const entry of buildEntityIndex(items)) {
    const backlinks = entry.itemIds.map((id) => `- [[${id}]]`).join("\n");
    files.push({
      path: uniquePath(`entities/${sanitize(entry.type)}/${sanitize(entry.name)}.md`),
      content: ["---", `type: ${entry.type}`, "---", "", `# ${entry.name}`, "", "## Saved in", backlinks].join("\n"),
    });
  }
  return files;
}
