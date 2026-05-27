import { describe, test, expect } from "vitest";
import { toItemsCsv, toEntitiesCsv } from "./csv.js";
import type { EnrichedItem } from "../types.js";

const items: EnrichedItem[] = [
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
    stats: { plays: 10, likes: null, comments: null, shares: null, collects: null },
    enrichment: { tier: "text", entities: [{ type: "restaurant", name: "Lilia", raw: "Lilia" }], takeaways: ["go"] },
  },
];

describe("toItemsCsv", () => {
  test("has a header row and escapes quotes/commas", () => {
    const csv = toItemsCsv(items);
    const lines = csv.trim().split("\n");
    expect(lines[0]).toContain("id,url,author,caption");
    expect(lines[1]).toContain('"pasta, ""the best"""'); // RFC-4180 escaping
    expect(lines[1]).toContain("pasta|brooklyn"); // hashtags joined
  });
});

describe("toEntitiesCsv", () => {
  test("one row per entity with joined item ids", () => {
    const csv = toEntitiesCsv(items);
    expect(csv.trim().split("\n")[0]).toBe("key,type,name,item_ids");
    expect(csv).toContain("restaurant:lilia,restaurant,Lilia,7001");
  });

  test("toEntitiesCsv aggregates item ids across items sharing an entity", () => {
    const two: EnrichedItem[] = [
      { ...items[0]!, id: "7001" },
      { ...items[0]!, id: "7002" },
    ];
    const csv = toEntitiesCsv(two);
    expect(csv).toContain("restaurant:lilia,restaurant,Lilia,7001|7002");
  });
});

describe("toItemsCsv escaping", () => {
  test("toItemsCsv quotes a caption containing a newline", () => {
    const withNl: EnrichedItem[] = [{ ...items[0]!, id: "7003", desc: "line1\nline2" }];
    const csv = toItemsCsv(withNl);
    expect(csv).toContain('"line1\nline2"');
  });

  test("toItemsCsv on empty input emits header only", () => {
    const csv = toItemsCsv([]);
    expect(csv.trim()).toBe("id,url,author,caption,hashtags,tier,entities,takeaways,plays");
  });
});
