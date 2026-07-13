// Tests for the TikTok "Download your data" (DYD) importer — the second capture lane. The fixture is
// shaped like the REAL current DYD JSON (per the Step-1 research documented in dydImport.ts): the
// canonical `Activity → Like List → ItemFavoriteList` (likes) and `Activity → Favorite Videos →
// FavoriteVideoList` (favorites) nesting, with per-entry `Date` + `Link`. Coverage: ids/urls/authors/
// sources/savedAt, the URL-less skip, favorites-vs-likes tagging, the both-lists union, and the
// defensive multi-key / multi-layout reads.

import { describe, it, expect } from "vitest";
import { parseTikTokDyd, parseTikTokDydResult } from "./dydImport.js";
import type { CapturedItem } from "../types.js";

// A realistic DYD export root: canonical Activity nesting, `Date`+`Link` per entry (UTC space form).
const realExport = {
  Activity: {
    "Like List": {
      ItemFavoriteList: [
        { Date: "2025-01-02 09:15:30", Link: "https://www.tiktok.com/@alice/video/7111111111111111111" },
        { Date: "2025-01-03 18:45:00", Link: "https://www.tiktok.com/@bob/video/7222222222222222222" },
        // A shared video — also appears under Favorites below (must dedupe + union sources).
        { Date: "2025-02-01 12:00:00", Link: "https://www.tiktok.com/@carol/video/7333333333333333333" },
        // URL-less / unparseable → skipped.
        { Date: "2025-01-04 00:00:00", Link: "" },
      ],
    },
    "Favorite Videos": {
      FavoriteVideoList: [
        { Date: "2025-01-10 10:00:00", Link: "https://www.tiktok.com/@dave/video/7444444444444444444" },
        { Date: "2025-02-05 08:30:00", Link: "https://www.tiktok.com/@carol/video/7333333333333333333" },
        // A photo/slideshow favorite → isSlideshow true, id still parsed.
        { Date: "2025-01-11 11:11:11", Link: "https://www.tiktok.com/@erin/photo/7555555555555555555" },
      ],
    },
  },
};

describe("parseTikTokDyd — canonical Activity nesting", () => {
  const items = parseTikTokDyd(realExport);
  const byId = (id: string) => items.find((i) => i.id === id) as CapturedItem;

  it("parses every valid entry and skips the URL-less one (3 likes valid + 3 favorites, 1 shared)", () => {
    // 3 valid likes (7111,7222,7333) + 3 favorites (7444,7333,7555); 7333 shared ⇒ 5 unique.
    expect(items).toHaveLength(5);
    const res = parseTikTokDydResult(realExport);
    expect(res.likesSeen).toBe(4); // includes the URL-less entry
    expect(res.favoritesSeen).toBe(3);
    expect(res.skipped).toBe(1); // the empty-Link like
  });

  it("extracts the numeric video id as a STRING from the /video/ URL", () => {
    expect(byId("7111111111111111111").id).toBe("7111111111111111111");
    expect(typeof byId("7111111111111111111").id).toBe("string");
  });

  it("extracts the author handle from /@handle/ and rebuilds the canonical url", () => {
    expect(byId("7111111111111111111").author).toBe("alice");
    expect(byId("7111111111111111111").url).toBe("https://www.tiktok.com/@alice/video/7111111111111111111");
  });

  it("carries savedAt from the export Date, normalized to ISO-8601 UTC (no local-time misparse)", () => {
    expect(byId("7111111111111111111").savedAt).toBe("2025-01-02T09:15:30Z");
  });

  it("tags likes-only items sources:['likes'] and favorites-only items sources:['favorites']", () => {
    expect(byId("7111111111111111111").sources).toEqual(["likes"]); // like-only
    expect(byId("7444444444444444444").sources).toEqual(["favorites"]); // favorite-only
  });

  it("UNIONs sources for a video in BOTH lists (favorites read first ⇒ ['favorites','likes'])", () => {
    expect([...byId("7333333333333333333").sources].sort()).toEqual(["favorites", "likes"]);
  });

  it("flags a /photo/ favorite as a slideshow but still parses its id", () => {
    expect(byId("7555555555555555555").isSlideshow).toBe(true);
    expect(byId("7555555555555555555").id).toBe("7555555555555555555");
  });

  it("leaves every live-lane-only media/stat field at its null/empty default", () => {
    const it0 = byId("7111111111111111111");
    expect(it0.playUrl).toBeNull();
    expect(it0.cover).toBeNull();
    expect(it0.createTime).toBeNull();
    expect(it0.desc).toBe("");
    expect(it0.hashtags).toEqual([]);
    expect(it0.stats).toEqual({ plays: null, likes: null, comments: null, shares: null, collects: null });
  });
});

describe("parseTikTokDyd — defensive multi-key field reads (casing drift across vintages)", () => {
  it("reads lowercase `link`/`date` (the Like List vintage that lower-cases them)", () => {
    const json = {
      Activity: {
        "Like List": {
          ItemFavoriteList: [{ date: "2024-12-01 00:00:00", link: "https://www.tiktok.com/@zed/video/7999999999999999999" }],
        },
      },
    };
    const items = parseTikTokDyd(json);
    expect(items).toHaveLength(1);
    expect(items[0]!.id).toBe("7999999999999999999");
    expect(items[0]!.author).toBe("zed");
    expect(items[0]!.savedAt).toBe("2024-12-01T00:00:00Z");
  });

  it("reads the `VideoLink` and `shareURL` link variants", () => {
    const json = {
      Activity: {
        "Favorite Videos": {
          FavoriteVideoList: [
            { Date: "2025-03-01 01:02:03", VideoLink: "https://www.tiktok.com/@vk/video/7010101010101010101" },
            { Date: "2025-03-02 01:02:03", shareURL: "https://www.tiktokv.com/share/video/7020202020202020202/" },
          ],
        },
      },
    };
    const items = parseTikTokDyd(json).map((i) => i.id).sort();
    expect(items).toEqual(["7010101010101010101", "7020202020202020202"]);
  });
});

describe("parseTikTokDyd — defensive multi-LAYOUT container reads", () => {
  it("reads the newer `Activity → Your Activity → …` nesting", () => {
    const json = {
      Activity: {
        "Your Activity": {
          "Like List": { ItemFavoriteList: [{ Date: "2025-01-01 00:00:00", Link: "https://www.tiktok.com/@n/video/7123123123123123123" }] },
        },
      },
    };
    expect(parseTikTokDyd(json).map((i) => i.id)).toEqual(["7123123123123123123"]);
  });

  it("reads the newest top-level `Likes and Favorites → …` split", () => {
    const json = {
      "Likes and Favorites": {
        "Favorite Videos": { FavoriteVideoList: [{ Date: "2025-01-01 00:00:00", Link: "https://www.tiktok.com/@m/video/7321321321321321321" }] },
      },
    };
    const items = parseTikTokDyd(json);
    expect(items).toHaveLength(1);
    expect(items[0]!.sources).toEqual(["favorites"]);
  });

  it("reads a passed-in Activity sub-tree (root IS the Activity node)", () => {
    const activityNode = {
      "Like List": { ItemFavoriteList: [{ Date: "2025-01-01 00:00:00", Link: "https://www.tiktok.com/@x/video/7808080808080808080" }] },
    };
    expect(parseTikTokDyd(activityNode).map((i) => i.id)).toEqual(["7808080808080808080"]);
  });
});

describe("parseTikTokDyd — robustness on empty / malformed input", () => {
  it("returns [] for null, empty object, and a shape with no lists", () => {
    expect(parseTikTokDyd(null)).toEqual([]);
    expect(parseTikTokDyd({})).toEqual([]);
    expect(parseTikTokDyd({ Activity: {} })).toEqual([]);
    expect(parseTikTokDyd({ Activity: { "Like List": {} } })).toEqual([]);
  });

  it("skips non-object entries and entries whose link has no numeric id", () => {
    const json = {
      Activity: {
        "Like List": {
          ItemFavoriteList: [
            "not-an-object",
            { Date: "2025-01-01 00:00:00", Link: "https://www.tiktok.com/@u/video/notanid" },
            { Date: "2025-01-01 00:00:00", Link: "https://www.tiktok.com/@u/video/7717171717171717171" },
          ],
        },
      },
    };
    const res = parseTikTokDydResult(json);
    expect(res.items.map((i) => i.id)).toEqual(["7717171717171717171"]);
    expect(res.skipped).toBe(2);
  });

  it("keeps the original link as url when no @handle is present, and author null", () => {
    const json = {
      Activity: {
        "Favorite Videos": {
          FavoriteVideoList: [{ Date: "2025-01-01 00:00:00", Link: "https://www.tiktokv.com/share/video/7616161616161616161/" }],
        },
      },
    };
    const [item] = parseTikTokDyd(json);
    expect(item!.id).toBe("7616161616161616161");
    expect(item!.author).toBeNull();
    expect(item!.url).toBe("https://www.tiktokv.com/share/video/7616161616161616161/");
  });

  it("preserves an unrecognized date shape verbatim (no silent drop)", () => {
    const json = {
      Activity: {
        "Like List": {
          ItemFavoriteList: [{ Date: "01/02/2025", Link: "https://www.tiktok.com/@q/video/7515151515151515151" }],
        },
      },
    };
    expect(parseTikTokDyd(json)[0]!.savedAt).toBe("01/02/2025");
  });
});
