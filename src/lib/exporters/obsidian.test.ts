import { describe, test, expect } from "vitest";
import { toObsidianVault } from "./obsidian.js";
import type { EnrichedItem } from "../types.js";

const items: EnrichedItem[] = [
  {
    id: "7001",
    desc: "best pasta",
    createTime: 1,
    author: "foodietravels",
    authorName: null,
    url: "https://t/7001",
    playUrl: null,
    downloadUrl: null,
    cover: null,
    durationSec: 1,
    hasSubtitles: false,
    subtitleUrl: null,
    isSlideshow: false,
    music: null,
    hashtags: ["pasta"],
    stats: { plays: null, likes: null, comments: null, shares: null, collects: null },
    enrichment: {
      tier: "text",
      transcript: "welcome",
      entities: [{ type: "restaurant", name: "Lilia", raw: "Lilia" }],
      takeaways: ["go to lilia"],
    },
  },
];

describe("toObsidianVault", () => {
  const files = toObsidianVault(items);

  test("creates one item note and one entity note", () => {
    const paths = files.map((f) => f.path).sort();
    expect(paths).toContain("items/7001.md");
    expect(paths).toContain("entities/restaurant/Lilia.md");
  });

  test("item note has front-matter, a wikilink to the entity, and a hashtag", () => {
    const note = files.find((f) => f.path === "items/7001.md")!.content;
    expect(note).toMatch(/^---\n/);
    expect(note).toContain('creator: "foodietravels"');
    expect(note).toContain("[[Lilia]]");
    expect(note).toContain("#pasta");
    expect(note).toContain("welcome");
  });

  test("entity note backlinks its source item", () => {
    const note = files.find((f) => f.path === "entities/restaurant/Lilia.md")!.content;
    expect(note).toContain("[[7001]]");
  });

  test("escapes front-matter and collapses multi-line captions in the heading", () => {
    const tricky: EnrichedItem[] = [{ ...items[0]!, id: "7008", author: "weird: name", desc: "line one\nline two" }];
    const note = toObsidianVault(tricky).find((f) => f.path === "items/7008.md")!.content;
    expect(note).toContain('creator: "weird: name"');
    expect(note).toContain("# line one line two");
    expect(note).not.toContain("# line one\nline two");
  });

  test("renders _none_ for items with no entities or takeaways", () => {
    const bare: EnrichedItem[] = [{ ...items[0]!, id: "7009", enrichment: { tier: "text", entities: [], takeaways: [] } }];
    const note = toObsidianVault(bare).find((f) => f.path === "items/7009.md")!.content;
    expect(note).toContain("## Takeaways\n_none_");
    expect(note).toContain("## Entities\n_none_");
  });

  test("entity note lists all source items for a multi-item entity", () => {
    const two: EnrichedItem[] = [{ ...items[0]!, id: "7001" }, { ...items[0]!, id: "7002" }];
    const note = toObsidianVault(two).find((f) => f.path === "entities/restaurant/Lilia.md")!.content;
    expect(note).toContain("- [[7001]]");
    expect(note).toContain("- [[7002]]");
  });

  test("sanitizes illegal characters in entity names for path and wikilink", () => {
    const withSlash: EnrichedItem[] = [
      { ...items[0]!, id: "7010", enrichment: { tier: "text", entities: [{ type: "restaurant", name: "Joe/s Pizza", raw: "Joe/s" }], takeaways: [] } },
    ];
    const files = toObsidianVault(withSlash);
    expect(files.map((f) => f.path)).toContain("entities/restaurant/Joe_s Pizza.md");
    expect(files.find((f) => f.path === "items/7010.md")!.content).toContain("[[Joe_s Pizza]]");
  });
});
