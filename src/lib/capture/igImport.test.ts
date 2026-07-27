// Tests for the Instagram "Download Your Data" saved-posts importer — the cross-platform sibling of
// dydImport.ts (the TikTok DYD lane). The fixture at fixtures/ig-saved-sample.json is structure-faithful
// to the REAL your_instagram_activity/saved/saved_posts.json (+ saved_collections). Coverage: shortcode
// id / permalink join key / caption / hashtags / owner, platform tag, savedAt from the epoch-seconds
// timestamp, collection membership, dedup + source-union + earliest-savedAt, and malformed skips.

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseInstagramSaved } from "./igImport.js";
import type { CapturedItem } from "../types.js";

const root = join(__dirname, "..", "..", "..");
const fixture = JSON.parse(readFileSync(join(root, "fixtures", "ig-saved-sample.json"), "utf8"));
const savedPosts = fixture; // the file root carries `saved_posts` + `saved_collections`
const collections = fixture; // (same root object) — the parser reads `saved_collections` off it

describe("parseInstagramSaved — real IG saved_posts.json shape (against the fixture)", () => {
  const res = parseInstagramSaved(savedPosts, collections);
  const items = res.items;
  const byId = (id: string) => items.find((i) => i.id === id) as CapturedItem;

  it("parses every saved post and reports counts (2 seen, 0 skipped, 2 items)", () => {
    expect(res.savedSeen).toBe(2);
    expect(res.skipped).toBe(0);
    expect(items).toHaveLength(2);
  });

  it("parses the shortcode from a /reel/<code>/ URL as the id", () => {
    expect(byId("CxAMPLE001").id).toBe("CxAMPLE001");
    expect(typeof byId("CxAMPLE001").id).toBe("string");
  });

  it("parses the shortcode from a /p/<code>/ URL as the id", () => {
    expect(byId("CxAMPLE002").id).toBe("CxAMPLE002");
  });

  it("keeps the permalink as the url (the join key for later capture/enrichment)", () => {
    expect(byId("CxAMPLE001").url).toBe("https://www.instagram.com/reel/CxAMPLE001/");
    expect(byId("CxAMPLE002").url).toBe("https://www.instagram.com/p/CxAMPLE002/");
  });

  it("tags every item platform:'instagram'", () => {
    expect(byId("CxAMPLE001").platform).toBe("instagram");
    expect(byId("CxAMPLE002").platform).toBe("instagram");
  });

  it("uses the Caption label as the item description", () => {
    expect(byId("CxAMPLE001").desc).toBe("brown butter pasta in one pan — save this for a weeknight");
    expect(byId("CxAMPLE002").desc).toBe("Yoo Yee is worth the hype — full menu review");
  });

  it("parses the Hashtags label string into a hashtags array (leading # stripped)", () => {
    expect(byId("CxAMPLE001").hashtags).toEqual(["pasta", "weeknightdinner", "brownbutter"]);
    expect(byId("CxAMPLE002").hashtags).toEqual(["nycfood", "restaurant"]);
  });

  it("reads the owner username from the nested Owner dict as author", () => {
    expect(byId("CxAMPLE001").author).toBe("example.kitchen");
    expect(byId("CxAMPLE002").author).toBe("example.eats");
  });

  it("carries savedAt from the epoch-seconds timestamp, normalized to ISO-8601 UTC", () => {
    expect(byId("CxAMPLE001").savedAt).toBe("2025-07-02T23:46:40.000Z");
    expect(byId("CxAMPLE002").savedAt).toBe("2025-07-01T20:00:00.000Z");
  });

  it("records collection membership for a post listed under a saved_collections entry", () => {
    expect(byId("CxAMPLE001").collections).toEqual(["Recipes"]);
  });

  it("leaves collections undefined for a post in no collection", () => {
    expect(byId("CxAMPLE002").collections).toBeUndefined();
  });

  it("tags the source as ['saved'] (IG has one saved surface, not favorites/likes)", () => {
    expect(byId("CxAMPLE001").sources).toEqual(["saved"]);
  });

  it("leaves every enrichment-only media/stat field at its null/empty default", () => {
    const it0 = byId("CxAMPLE001");
    expect(it0.playUrl).toBeNull();
    expect(it0.cover).toBeNull();
    expect(it0.createTime).toBeNull();
    expect(it0.durationSec).toBeNull();
    expect(it0.music).toBeNull();
    expect(it0.stats).toEqual({ plays: null, likes: null, comments: null, shares: null, collects: null });
  });
});

describe("parseInstagramSaved — dedup, source-union, earliest-savedAt", () => {
  it("dedupes by shortcode, unions sources, and keeps the EARLIEST savedAt", () => {
    const json = {
      saved_posts: [
        {
          timestamp: 1751500000, // later
          label_values: [{ label: "URL", value: "https://www.instagram.com/reel/DUP0001/" }],
        },
        {
          timestamp: 1751000000, // earlier — should win
          label_values: [
            { label: "URL", value: "https://www.instagram.com/reel/DUP0001/" },
            { label: "Caption", value: "second copy" },
          ],
        },
      ],
    };
    const { items, savedSeen, skipped } = parseInstagramSaved(json);
    expect(savedSeen).toBe(2);
    expect(skipped).toBe(0);
    expect(items).toHaveLength(1);
    expect(items[0]!.id).toBe("DUP0001");
    expect(items[0]!.sources).toEqual(["saved"]);
    expect(items[0]!.savedAt).toBe(new Date(1751000000 * 1000).toISOString()); // earliest
  });

  it("unions collection membership across a post that appears under two collections", () => {
    const json = {
      saved_posts: [{ timestamp: 1751500000, label_values: [{ label: "URL", value: "https://www.instagram.com/p/MULTI01/" }] }],
      saved_collections: [
        {
          label_values: [
            { label: "Name", value: "Recipes" },
            { title: "Posts", dict: [{ dict: [{ label: "URL", value: "https://www.instagram.com/p/MULTI01/" }], title: "Post" }] },
          ],
        },
        {
          label_values: [
            { label: "Name", value: "Travel" },
            { title: "Posts", dict: [{ dict: [{ label: "URL", value: "https://www.instagram.com/p/MULTI01/" }], title: "Post" }] },
          ],
        },
      ],
    };
    const { items } = parseInstagramSaved(json, json);
    expect(items[0]!.collections!.sort()).toEqual(["Recipes", "Travel"]);
  });
});

describe("parseInstagramSaved — malformed / robustness", () => {
  it("skips non-object entries, entries with no URL, and URLs with no parseable shortcode", () => {
    const json = {
      saved_posts: [
        "not-an-object",
        { timestamp: 1, label_values: [{ label: "Caption", value: "no url here" }] },
        { timestamp: 2, label_values: [{ label: "URL", value: "https://www.instagram.com/explore/" }] },
        { timestamp: 3, label_values: [{ label: "URL", value: "https://www.instagram.com/reel/GOOD001/" }] },
      ],
    };
    const res = parseInstagramSaved(json);
    expect(res.savedSeen).toBe(4);
    expect(res.items.map((i) => i.id)).toEqual(["GOOD001"]);
    expect(res.skipped).toBe(3);
  });

  it("returns an empty result for null, {}, and a shape with no saved_posts", () => {
    for (const bad of [null, {}, { saved_posts: [] }, { something_else: 1 }]) {
      const res = parseInstagramSaved(bad);
      expect(res.items).toEqual([]);
      expect(res.skipped).toBe(0);
    }
  });

  it("reads a bare top-level array of saved posts (root IS the list)", () => {
    const json = [{ timestamp: 1751500000, label_values: [{ label: "URL", value: "https://www.instagram.com/reel/BARE001/" }] }];
    expect(parseInstagramSaved(json).items.map((i) => i.id)).toEqual(["BARE001"]);
  });

  it("reads the alternate `saved_saved_media` container key (older export vintage)", () => {
    const json = {
      saved_saved_media: [{ timestamp: 1751500000, label_values: [{ label: "URL", value: "https://www.instagram.com/reel/ALT001/" }] }],
    };
    expect(parseInstagramSaved(json).items.map((i) => i.id)).toEqual(["ALT001"]);
  });

  it("leaves hashtags empty and author null when those labels are absent", () => {
    const json = { saved_posts: [{ timestamp: 1751500000, label_values: [{ label: "URL", value: "https://www.instagram.com/reel/BAREFIELDS/" }] }] };
    const item = parseInstagramSaved(json).items[0]!;
    expect(item.hashtags).toEqual([]);
    expect(item.author).toBeNull();
    expect(item.desc).toBe("");
  });
});
