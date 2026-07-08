import { describe, test, expect } from "vitest";
import { normalizeName, mentionKey, dedupeMentions, buildMentionIndex } from "./entities.js";
import type { AnalyzedItem, MentionOut, EvidenceOut } from "./types.js";

const ev: EvidenceOut[] = [{ channel: "VISUAL_TEXT", assertion_mode: "SHOWN", confidence: 0.9 }];

describe("normalizeName", () => {
  test("casefolds, trims, collapses whitespace", () => {
    expect(normalizeName("  Lilia  ")).toBe("lilia");
    expect(normalizeName("The   French   Laundry")).toBe("french laundry");
  });
  test("strips leading @ and 'the'", () => {
    expect(normalizeName("@gordonramsay")).toBe("gordonramsay");
    expect(normalizeName("The Bear")).toBe("bear");
  });
  test("strips @ even with leading whitespace", () => {
    expect(normalizeName(" @handle")).toBe("handle");
  });
});

describe("mentionKey", () => {
  test("combines type and normalized surface", () => {
    expect(mentionKey({ type: "place", surface: "Lilia" })).toBe("place:lilia");
  });
  test("same surface, different type → different keys", () => {
    const a = mentionKey({ type: "place", surface: "Rome" });
    const b = mentionKey({ type: "screen_work", surface: "Rome" });
    expect(a).not.toBe(b);
  });
});

describe("dedupeMentions", () => {
  test("collapses same-key mentions within one item, keeping first surface + merging aliases", () => {
    const mentions: MentionOut[] = [
      { type: "place", surface: "Lilia", aliases: ["Lilia NYC"], evidence: ev },
      { type: "place", surface: "lilia ", aliases: ["Lilia Brooklyn"], evidence: ev },
    ];
    const out = dedupeMentions(mentions);
    expect(out).toHaveLength(1);
    expect(out[0]!.surface).toBe("Lilia");
    expect(out[0]!.aliases).toEqual(expect.arrayContaining(["Lilia NYC", "Lilia Brooklyn", "lilia "]));
  });
});

describe("buildMentionIndex", () => {
  const mk = (id: string, mentions: MentionOut[]): AnalyzedItem =>
    ({
      id,
      analysis: { output: { mentions, concepts: [], facets: [], claims: [], structured: [] } },
    }) as unknown as AnalyzedItem;

  test("same mention across items → one entry with all item ids in first-seen order", () => {
    const items = [
      mk("7001", [{ type: "place", surface: "Lilia", evidence: ev }]),
      mk("7005", [{ type: "place", surface: "lilia", evidence: ev }]),
    ];
    const index = buildMentionIndex(items);
    const lilia = index.find((e) => e.key === "place:lilia");
    expect(lilia).toBeTruthy();
    expect(lilia!.itemIds).toEqual(["7001", "7005"]);
    expect(lilia!.surface).toBe("Lilia");
  });

  test("does not duplicate an item id when a mention appears twice in the same item", () => {
    const items = [
      mk("7001", [
        { type: "book", surface: "Dune", evidence: ev },
        { type: "book", surface: "dune", evidence: ev },
      ]),
    ];
    const index = buildMentionIndex(items);
    expect(index.find((e) => e.key === "book:dune")!.itemIds).toEqual(["7001"]);
  });

  test("tolerates an item with no mentions", () => {
    const items = [mk("7009", [])];
    expect(buildMentionIndex(items)).toEqual([]);
  });
});
