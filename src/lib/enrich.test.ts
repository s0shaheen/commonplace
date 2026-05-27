import { describe, test, expect } from "vitest";
import { enrichItem, mergeVisualIntoText, type EnrichDeps } from "./enrich.js";
import type { CapturedItem, GeminiResult } from "./types.js";

const item: CapturedItem = {
  id: "7001",
  desc: "best pasta in brooklyn",
  createTime: 1,
  author: "foodietravels",
  authorName: null,
  url: null,
  playUrl: "https://cdn/7001.mp4",
  downloadUrl: null,
  cover: null,
  durationSec: 42,
  hasSubtitles: true,
  subtitleUrl: "https://cdn/7001.vtt",
  isSlideshow: false,
  music: null,
  hashtags: ["pasta"],
  stats: { plays: null, likes: null, comments: null, shares: null, collects: null },
};

const okText: GeminiResult = {
  ok: true,
  enrichment: {
    transcript: "welcome to brooklyn",
    entities: [{ type: "restaurant", name: "Lilia", raw: "Lilia" }],
    takeaways: ["go to lilia"],
  },
};

function deps(over: Partial<EnrichDeps> = {}): EnrichDeps {
  return {
    callGemini: async () => okText,
    fetchSubtitles: async () => "welcome to brooklyn",
    fetchMedia: async () => [{ mimeType: "video/mp4", data: "QkFTRTY0" }],
    basePrompts: { text: "TEXT", visual: "VISUAL", slideshow: "SLIDE" },
    ...over,
  };
}

describe("enrichItem — text tier", () => {
  test("produces a text-tier enriched item with entities", async () => {
    const out = await enrichItem(item, deps(), "text");
    expect(out.enrichment.tier).toBe("text");
    expect(out.enrichment.entities[0]!.name).toBe("Lilia");
    expect(out.enrichment.transcript).toBe("welcome to brooklyn");
    expect(out.enrichment.error).toBeUndefined();
  });

  test("records error and stays raw when Gemini fails", async () => {
    const out = await enrichItem(item, deps({ callGemini: async () => ({ ok: false, error: "parse_fail" }) }), "text");
    expect(out.enrichment.tier).toBe("raw");
    expect(out.enrichment.error).toBe("parse_fail");
    expect(out.enrichment.entities).toEqual([]);
  });

  test("skips subtitle fetch when item has none", async () => {
    let called = false;
    const out = await enrichItem(
      { ...item, hasSubtitles: false, subtitleUrl: null },
      deps({ fetchSubtitles: async () => { called = true; return ""; } }),
      "text",
    );
    expect(called).toBe(false);
    expect(out.enrichment.tier).toBe("text");
  });

  test("never throws when callGemini rejects → raw with gemini_threw", async () => {
    const out = await enrichItem(item, deps({ callGemini: async () => { throw new Error("network down"); } }), "text");
    expect(out.enrichment.tier).toBe("raw");
    expect(out.enrichment.error).toBe("gemini_threw");
  });

  test("treats a subtitle-fetch rejection as non-fatal and still enriches", async () => {
    const out = await enrichItem(item, deps({ fetchSubtitles: async () => { throw new Error("no subs"); } }), "text");
    expect(out.enrichment.tier).toBe("text");
  });
});

describe("enrichItem — visual tier", () => {
  test("records media_fetch_failed and stays raw when media fetch returns empty", async () => {
    const out = await enrichItem(item, deps({ fetchMedia: async () => [] }), "visual");
    expect(out.enrichment.tier).toBe("raw");
    expect(out.enrichment.error).toBe("media_fetch_failed");
  });

  test("produces a visual-tier item when media + gemini succeed", async () => {
    const visual: GeminiResult = {
      ok: true,
      enrichment: { on_screen_text: ["LILIA"], entities: [{ type: "place", name: "Williamsburg", raw: "Williamsburg" }], takeaways: [] },
    };
    const out = await enrichItem(item, deps({ callGemini: async () => visual }), "visual");
    expect(out.enrichment.tier).toBe("visual");
    expect(out.enrichment.on_screen_text).toEqual(["LILIA"]);
  });

  test("never throws when fetchMedia rejects → raw with media_fetch_failed", async () => {
    const out = await enrichItem(item, deps({ fetchMedia: async () => { throw new Error("cdn down"); } }), "visual");
    expect(out.enrichment.tier).toBe("raw");
    expect(out.enrichment.error).toBe("media_fetch_failed");
  });

  test("uses the slideshow prompt for slideshows", async () => {
    let usedBody: any;
    const out = await enrichItem(
      { ...item, isSlideshow: true },
      deps({
        callGemini: async (body) => {
          usedBody = body;
          return { ok: true, enrichment: { entities: [], takeaways: [] } };
        },
      }),
      "visual",
    );
    const parts = usedBody.contents[0].parts;
    expect(parts[parts.length - 1].text).toContain("SLIDE");
    expect(out.enrichment.tier).toBe("visual");
  });
});

describe("mergeVisualIntoText", () => {
  test("upgrades tier, unions entities by key, adds on_screen_text", () => {
    const textItem = { ...item, enrichment: { ...okText.enrichment, tier: "text" as const } };
    const merged = mergeVisualIntoText(textItem, {
      ok: true,
      enrichment: {
        on_screen_text: ["LILIA"],
        entities: [
          { type: "restaurant", name: "lilia", raw: "Lilia sign" }, // dup of existing
          { type: "place", name: "Williamsburg", raw: "Williamsburg" }, // new
        ],
        takeaways: [],
      },
    });
    expect(merged.enrichment.tier).toBe("visual");
    expect(merged.enrichment.on_screen_text).toEqual(["LILIA"]);
    expect(merged.enrichment.entities).toHaveLength(2);
  });

  test("keeps text tier + entities and records error when visual fails", () => {
    const textItem = { ...item, enrichment: { ...okText.enrichment, tier: "text" as const } };
    const merged = mergeVisualIntoText(textItem, { ok: false, error: "media_fetch_failed" });
    expect(merged.enrichment.tier).toBe("text");
    expect(merged.enrichment.entities).toHaveLength(1);
    expect(merged.enrichment.error).toBe("media_fetch_failed");
  });
});
