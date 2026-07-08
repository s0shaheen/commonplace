import { describe, test, expect } from "vitest";
import { toObsidianVault } from "./obsidian.js";
import type { AnalyzedItem, EvidenceOut, ExtractorOutput, MentionOut, ClaimOut } from "../types.js";

const ev: EvidenceOut[] = [{ channel: "VISUAL_TEXT", assertion_mode: "SHOWN", confidence: 0.9 }];

const emptyOutput: ExtractorOutput = { mentions: [], concepts: [], facets: [], claims: [], structured: [] };

function analyzed(
  id: string,
  over: Partial<AnalyzedItem> = {},
  output: { mentions?: MentionOut[]; claims?: ClaimOut[] } = {},
): AnalyzedItem {
  return {
    id,
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
    analysis: {
      lane: "local",
      ingestion: "keyframes_vtt",
      model: "gemini-2.5-flash-lite",
      promptVersion: "extract@v1",
      analyzedAt: "2026-07-08T00:00:00.000Z",
      output: {
        ...emptyOutput,
        mentions: output.mentions ?? [{ type: "place", surface: "Lilia", evidence: ev }],
        claims: output.claims ?? [{ statement: "go to lilia", evidence: ev }],
      },
    },
    ...over,
  };
}

const items: AnalyzedItem[] = [analyzed("7001")];

describe("toObsidianVault", () => {
  const files = toObsidianVault(items);

  test("creates one item note and one entity note", () => {
    const paths = files.map((f) => f.path).sort();
    expect(paths).toContain("items/7001.md");
    expect(paths).toContain("entities/place/Lilia.md");
  });

  test("item note has front-matter (with lane), a wikilink to the mention, a hashtag, and the takeaway", () => {
    const note = files.find((f) => f.path === "items/7001.md")!.content;
    expect(note).toMatch(/^---\n/);
    expect(note).toContain('creator: "foodietravels"');
    expect(note).toContain("lane: local");
    expect(note).toContain("[[Lilia]]");
    expect(note).toContain("#pasta");
    expect(note).toContain("go to lilia");
  });

  test("entity note backlinks its source item", () => {
    const note = files.find((f) => f.path === "entities/place/Lilia.md")!.content;
    expect(note).toContain("[[7001]]");
  });

  test("escapes front-matter and collapses multi-line captions in the heading", () => {
    const tricky = [analyzed("7008", { author: "weird: name", desc: "line one\nline two" })];
    const note = toObsidianVault(tricky).find((f) => f.path === "items/7008.md")!.content;
    expect(note).toContain('creator: "weird: name"');
    expect(note).toContain("# line one line two");
    expect(note).not.toContain("# line one\nline two");
  });

  test("renders _none_ for items with no mentions or takeaways", () => {
    const bare = [analyzed("7009", {}, { mentions: [], claims: [] })];
    const note = toObsidianVault(bare).find((f) => f.path === "items/7009.md")!.content;
    expect(note).toContain("## Takeaways\n_none_");
    expect(note).toContain("## Mentions\n_none_");
  });

  test("entity note lists all source items for a multi-item mention", () => {
    const two = [analyzed("7001"), analyzed("7002")];
    const note = toObsidianVault(two).find((f) => f.path === "entities/place/Lilia.md")!.content;
    expect(note).toContain("- [[7001]]");
    expect(note).toContain("- [[7002]]");
  });

  test("sanitizes illegal characters in mention surfaces for path and wikilink", () => {
    const withSlash = [analyzed("7010", {}, { mentions: [{ type: "place", surface: "Joe/s Pizza", evidence: ev }] })];
    const out = toObsidianVault(withSlash);
    expect(out.map((f) => f.path)).toContain("entities/place/Joe_s Pizza.md");
    expect(out.find((f) => f.path === "items/7010.md")!.content).toContain("[[Joe_s Pizza]]");
  });
});
