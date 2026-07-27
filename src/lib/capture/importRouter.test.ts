// Tests for the pure import router: given a decompressed export (entry paths + a JSON reader), or a
// bare extracted .json, decide the platform and run the right parser. PURE given a pure reader — the
// actual unzip + byte decode + JSON.parse is thin glue in options.ts; this owns the routing decision.

import { describe, it, expect } from "vitest";
import { routeZipImport, routeBareJson } from "./importRouter.js";

// A realistic TikTok DYD root (canonical Activity nesting) and an IG saved-posts root.
const tiktokJson = {
  Activity: {
    "Like List": { ItemFavoriteList: [{ Date: "2025-01-02 09:15:30", Link: "https://www.tiktok.com/@a/video/7111111111111111111" }] },
    "Favorite Videos": { FavoriteVideoList: [{ Date: "2025-01-10 10:00:00", Link: "https://www.tiktok.com/@b/video/7444444444444444444" }] },
  },
};
const igPostsJson = {
  saved_posts: [
    { timestamp: 1751500000, label_values: [{ label: "URL", value: "https://www.instagram.com/reel/IG000001/" }] },
    { timestamp: 1751400000, label_values: [{ label: "URL", value: "https://www.instagram.com/p/IG000002/" }] },
  ],
};
const igCollectionsJson = {
  saved_collections: [
    {
      label_values: [
        { label: "Name", value: "Recipes" },
        { title: "Posts", dict: [{ dict: [{ label: "URL", value: "https://www.instagram.com/reel/IG000001/" }], title: "Post" }] },
      ],
    },
  ],
};

// Build a reader that maps a zip entry path → its parsed JSON, given a {path: json} table.
const reader = (table: Record<string, unknown>) => (path: string) => table[path];

describe("routeZipImport — routes by entry path", () => {
  it("routes a TikTok export zip (user_data_tiktok.json) to the DYD parser", () => {
    const paths = ["Download Data/user_data_tiktok.json", "readme.txt"];
    const r = routeZipImport(paths, reader({ "Download Data/user_data_tiktok.json": tiktokJson }))!;
    expect(r.platform).toBe("tiktok");
    expect(r.items.map((i) => i.id).sort()).toEqual(["7111111111111111111", "7444444444444444444"]);
    expect(r.declared).toBe(2); // 1 like + 1 favorite seen
  });

  it("routes the older bare user_data.json entry name too", () => {
    const r = routeZipImport(["user_data.json"], reader({ "user_data.json": tiktokJson }))!;
    expect(r.platform).toBe("tiktok");
  });

  it("routes an Instagram export zip (.../saved/saved_posts.json) to the IG parser, with collections", () => {
    const paths = [
      "your_instagram_activity/saved/saved_posts.json",
      "your_instagram_activity/saved/saved_collections.json",
      "personal_information/personal_information.json",
    ];
    const r = routeZipImport(
      paths,
      reader({
        "your_instagram_activity/saved/saved_posts.json": igPostsJson,
        "your_instagram_activity/saved/saved_collections.json": igCollectionsJson,
      }),
    )!;
    expect(r.platform).toBe("instagram");
    expect(r.items.map((i) => i.id).sort()).toEqual(["IG000001", "IG000002"]);
    expect(r.declared).toBe(2);
    const reel = r.items.find((i) => i.id === "IG000001")!;
    expect(reel.collections).toEqual(["Recipes"]); // collections sibling was picked up
  });

  it("returns null when no recognized entry is present", () => {
    expect(routeZipImport(["notes.txt", "photos/img_0001.jpg"], reader({}))).toBeNull();
  });
});

describe("routeBareJson — routes an extracted .json by shape (TikTok is the default)", () => {
  it("routes a bare TikTok user_data json to the DYD parser", () => {
    const r = routeBareJson(tiktokJson)!;
    expect(r.platform).toBe("tiktok");
    expect(r.items).toHaveLength(2);
  });

  it("routes a bare IG saved_posts json to the IG parser", () => {
    const r = routeBareJson(igPostsJson)!;
    expect(r.platform).toBe("instagram");
    expect(r.items.map((i) => i.id).sort()).toEqual(["IG000001", "IG000002"]);
  });

  it("recognizes a bare top-level array of IG saved posts", () => {
    const r = routeBareJson(igPostsJson.saved_posts)!;
    expect(r.platform).toBe("instagram");
  });

  it("falls back to a TikTok route (with zero items) for an empty/unknown object — preserving the old UX", () => {
    const r = routeBareJson({})!;
    expect(r.platform).toBe("tiktok");
    expect(r.items).toHaveLength(0);
    expect(r.declared).toBe(0);
  });
});
