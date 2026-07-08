import { describe, test, expect } from "vitest";
import { toJsonBundle } from "./json.js";
import type { AnalyzedItem, EvidenceOut } from "../types.js";

const ev: EvidenceOut[] = [{ channel: "VISUAL_TEXT", assertion_mode: "SHOWN", confidence: 0.9 }];

const items: AnalyzedItem[] = [
  {
    id: "7001",
    desc: "pasta",
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
        mentions: [{ type: "place", surface: "Lilia", evidence: ev }],
        concepts: [],
        facets: [],
        claims: [{ statement: "go", evidence: ev }],
        structured: [],
      },
    },
  },
];

describe("toJsonBundle", () => {
  test("emits a v2 bundle with the schema tag, items, and a mention index", () => {
    const out = JSON.parse(toJsonBundle(items));
    expect(out.version).toBe(2);
    expect(out.schema).toBe("commonplace/1.0.0-rc.6");
    expect(out.items).toHaveLength(1);
    expect(out.mentions[0].key).toBe("place:lilia");
    expect(out.mentions[0].itemIds).toEqual(["7001"]);
  });

  test("toJsonBundle on empty input yields empty items + mentions arrays", () => {
    const out = JSON.parse(toJsonBundle([]));
    expect(out.items).toEqual([]);
    expect(out.mentions).toEqual([]);
  });
});
