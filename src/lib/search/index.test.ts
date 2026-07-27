import { describe, test, expect } from "vitest";
import { buildIndex, tokenize, FIELD_WEIGHTS, type IndexableItem, type SearchField } from "./index.js";
import type { Analysis, CapturedItem, Channel } from "../types.js";

function mkItem(over: Partial<CapturedItem> & { id: string; analysis?: Analysis }): IndexableItem {
  return {
    sources: ["likes"],
    desc: "",
    createTime: null,
    author: null,
    authorName: null,
    url: null,
    playUrl: null,
    downloadUrl: null,
    cover: null,
    durationSec: null,
    hasSubtitles: false,
    subtitleUrl: null,
    isSlideshow: false,
    music: null,
    hashtags: [],
    stats: { plays: null, likes: null, comments: null, shares: null, collects: null },
    ...over,
  };
}

function analysisWith(opts: {
  mentions?: { surface: string; aliases?: string[] }[];
  transcript?: string[];
  onscreen?: string[];
}): Analysis {
  const ev = (channel: Channel, quote: string) =>
    ({ channel, assertion_mode: "STATED" as const, confidence: 0.9, quote });
  const quotes = [
    ...(opts.transcript ?? []).map((q) => ev("VERBAL_AUDIO", q)),
    ...(opts.onscreen ?? []).map((q) => ev("VISUAL_TEXT", q)),
  ];
  return {
    output: {
      mentions: (opts.mentions ?? []).map((m) => ({
        surface: m.surface,
        type: "place",
        aliases: m.aliases,
        evidence: [ev("VISUAL_SCENE", m.surface)],
      })),
      concepts: quotes.length ? [{ surface: "q", evidence: quotes }] : [],
      facets: [],
      claims: [],
      structured: [],
    },
    lane: "managed",
    ingestion: "native",
    model: "test",
    promptVersion: "v1",
    analyzedAt: "2026-01-01T00:00:00Z",
  };
}

// Which fields is `token` filed under, for `id`?
function fieldsFor(index: ReturnType<typeof buildIndex>, token: string, id: string): SearchField[] {
  return (index.postings.get(token) ?? []).filter((p) => p.id === id).map((p) => p.field);
}

describe("buildIndex — captures every weighted text layer", () => {
  const item = mkItem({
    id: "1",
    desc: "caption croissant",
    hashtags: ["baking", "#frenchfood"],
    author: "chefanna",
    authorName: "Anna Baker",
    analysis: analysisWith({
      mentions: [{ surface: "Tartine Bakery", aliases: ["Tartine"] }],
      transcript: ["the lamination technique matters"],
      onscreen: ["OPEN AT SEVEN"],
    }),
  });
  const index = buildIndex([item]);

  test("entity layer: mention surface AND aliases are indexed under 'entity'", () => {
    expect(fieldsFor(index, "tartine", "1")).toContain("entity");
    expect(fieldsFor(index, "bakery", "1")).toContain("entity");
  });

  test("caption layer: `desc` tokens are indexed under 'caption'", () => {
    expect(fieldsFor(index, "croissant", "1")).toEqual(["caption"]);
  });

  test("on-screen layer: VISUAL_TEXT quotes are indexed under 'onscreen'", () => {
    expect(fieldsFor(index, "seven", "1")).toEqual(["onscreen"]);
  });

  test("transcript layer: VERBAL_AUDIO quotes are indexed under 'transcript'", () => {
    expect(fieldsFor(index, "lamination", "1")).toEqual(["transcript"]);
  });

  test("hashtag layer: hashtags are indexed under 'hashtag' (# folded away)", () => {
    expect(fieldsFor(index, "frenchfood", "1")).toEqual(["hashtag"]);
    expect(fieldsFor(index, "baking", "1")).toEqual(["hashtag"]);
  });

  test("author layer: handle and display name are indexed under 'author'", () => {
    expect(fieldsFor(index, "chefanna", "1")).toEqual(["author"]);
    expect(fieldsFor(index, "anna", "1")).toEqual(["author"]);
  });

  test("every layer has a strictly-lower weight than the one above it", () => {
    const ordered: SearchField[] = ["entity", "caption", "onscreen", "transcript", "hashtag", "author"];
    for (let i = 1; i < ordered.length; i++) {
      expect(FIELD_WEIGHTS[ordered[i - 1]!]).toBeGreaterThan(FIELD_WEIGHTS[ordered[i]!]);
    }
  });
});

describe("buildIndex — density and un-analyzed items", () => {
  test("repeat occurrences within a field accumulate a count (density)", () => {
    const index = buildIndex([mkItem({ id: "1", desc: "pizza pizza pizza night" })]);
    const posting = (index.postings.get("pizza") ?? []).find((p) => p.id === "1");
    expect(posting?.count).toBe(3);
  });

  test("a raw item with no analysis still indexes its caption / hashtags / author", () => {
    const index = buildIndex([mkItem({ id: "1", desc: "ramen guide", hashtags: ["food"] })]);
    expect(fieldsFor(index, "ramen", "1")).toEqual(["caption"]);
    expect(fieldsFor(index, "food", "1")).toEqual(["hashtag"]);
  });
});

describe("tokenize — normalization discipline", () => {
  test("folds case and collapses punctuation into token breaks", () => {
    expect(tokenize("The Best Ramen!!! in-town")).toEqual(["the", "best", "ramen", "in", "town"]);
  });

  test("drops intra-word apostrophes (Joe's → joes)", () => {
    expect(tokenize("Joe's Pizza")).toEqual(["joes", "pizza"]);
  });

  test("is Unicode-aware (other-language content tokenizes, not just ASCII)", () => {
    expect(tokenize("東京 ramen")).toEqual(["東京", "ramen"]);
  });

  test("empty / nullish input yields no tokens", () => {
    expect(tokenize("")).toEqual([]);
    expect(tokenize(null)).toEqual([]);
    expect(tokenize("   !!!  ")).toEqual([]);
  });
});
