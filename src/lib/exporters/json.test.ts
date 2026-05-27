import { describe, test, expect } from "vitest";
import { toJsonBundle } from "./json.js";
import type { EnrichedItem } from "../types.js";

const items: EnrichedItem[] = [
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
    enrichment: { tier: "text", entities: [{ type: "restaurant", name: "Lilia", raw: "Lilia" }], takeaways: ["go"] },
  },
];

describe("toJsonBundle", () => {
  test("emits valid JSON with items and an entity index", () => {
    const out = JSON.parse(toJsonBundle(items));
    expect(out.items).toHaveLength(1);
    expect(out.entities[0].key).toBe("restaurant:lilia");
    expect(out.entities[0].itemIds).toEqual(["7001"]);
  });

  test("toJsonBundle on empty input yields empty items + entities arrays", () => {
    const out = JSON.parse(toJsonBundle([]));
    expect(out.items).toEqual([]);
    expect(out.entities).toEqual([]);
  });
});
