import { describe, test, expect } from "vitest";
import { toItemsCsv, toMentionsCsv } from "./csv.js";
import type { AnalyzedItem, EvidenceOut } from "../types.js";

const ev: EvidenceOut[] = [{ channel: "VISUAL_TEXT", assertion_mode: "SHOWN", confidence: 0.9 }];

const items: AnalyzedItem[] = [
  {
    id: "7001",
    desc: 'pasta, "the best"',
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
    hashtags: ["pasta", "brooklyn"],
    sources: [],
    stats: { plays: 10, likes: null, comments: null, shares: null, collects: null },
    analysis: {
      lane: "local",
      ingestion: "keyframes_vtt",
      model: "gemini-2.5-flash-lite",
      promptVersion: "extract@v1",
      analyzedAt: "2026-07-08T00:00:00.000Z",
      output: {
        mentions: [{ type: "place", surface: "Lilia", evidence: ev }],
        concepts: [],
        facets: [],
        claims: [{ statement: "go", evidence: ev }],
        structured: [],
      },
    },
  },
];

describe("toItemsCsv", () => {
  test("has a header row and escapes quotes/commas", () => {
    const csv = toItemsCsv(items);
    const lines = csv.trim().split("\n");
    expect(lines[0]).toContain("id,url,author,caption");
    expect(lines[0]).toContain("lane,mentions,claims,plays");
    expect(lines[1]).toContain('"pasta, ""the best"""'); // RFC-4180 escaping
    expect(lines[1]).toContain("pasta|brooklyn"); // hashtags joined
    expect(lines[1]).toContain("place:Lilia"); // mention as type:surface
  });
});

describe("toMentionsCsv", () => {
  test("one row per mention with joined item ids", () => {
    const csv = toMentionsCsv(items);
    expect(csv.trim().split("\n")[0]).toBe("key,type,surface,item_ids");
    expect(csv).toContain("place:lilia,place,Lilia,7001");
  });

  test("toMentionsCsv aggregates item ids across items sharing a mention", () => {
    const two: AnalyzedItem[] = [
      { ...items[0]!, id: "7001" },
      { ...items[0]!, id: "7002" },
    ];
    const csv = toMentionsCsv(two);
    expect(csv).toContain("place:lilia,place,Lilia,7001|7002");
  });
});

describe("toItemsCsv escaping", () => {
  test("toItemsCsv quotes a caption containing a newline", () => {
    const withNl: AnalyzedItem[] = [{ ...items[0]!, id: "7003", desc: "line1\nline2" }];
    const csv = toItemsCsv(withNl);
    expect(csv).toContain('"line1\nline2"');
  });

  test("toItemsCsv on empty input emits header only", () => {
    const csv = toItemsCsv([]);
    expect(csv.trim()).toBe("id,url,author,caption,hashtags,lane,mentions,claims,plays");
  });
});
