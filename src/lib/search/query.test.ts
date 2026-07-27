import { describe, test, expect } from "vitest";
import { buildIndex, type IndexableItem } from "./index.js";
import { query } from "./query.js";
import type { Analysis, CapturedItem, Channel, NamedEntityType } from "../types.js";

// ── Fixture helpers ──────────────────────────────────────────────────────────────────────────
// Small AnalyzedItem-shaped fixtures built inline (per the change contract). A full CapturedItem
// has many required fields; `mkItem` fills honest defaults so a test only states what it exercises.

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

// Build an Analysis carrying entity mentions plus transcript / on-screen-text quotes. Transcript
// text rides VERBAL_AUDIO evidence; on-screen text rides VISUAL_TEXT — the real channel semantics.
function analysis(opts: {
  mentions?: { surface: string; type?: NamedEntityType; aliases?: string[] }[];
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
        type: m.type ?? "place",
        aliases: m.aliases,
        evidence: [ev("VISUAL_SCENE", m.surface)],
      })),
      concepts: quotes.length ? [{ surface: "quotes", evidence: quotes }] : [],
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

describe("query — ranking across weighted layers", () => {
  test("entity-name match outranks caption match outranks transcript match", () => {
    const items: IndexableItem[] = [
      mkItem({ id: "transcript-hit", analysis: analysis({ transcript: ["I loved the pasta"] }) }),
      mkItem({ id: "caption-hit", desc: "the best pasta in town" }),
      mkItem({ id: "entity-hit", analysis: analysis({ mentions: [{ surface: "Pasta", type: "brand_org" }] }) }),
    ];
    const index = buildIndex(items);
    const results = query(index, "pasta");
    expect(results.map((r) => r.id)).toEqual(["entity-hit", "caption-hit", "transcript-hit"]);
  });

  test("entity match ranks above an item whose only match is a transcript word", () => {
    const items: IndexableItem[] = [
      mkItem({ id: "spoken", analysis: analysis({ transcript: ["we drove past Lilia yesterday"] }) }),
      mkItem({ id: "resolved", analysis: analysis({ mentions: [{ surface: "Lilia", type: "place" }] }) }),
    ];
    const results = query(buildIndex(items), "lilia");
    expect(results[0]!.id).toBe("resolved");
    expect(results[0]!.matchedFields[0]).toBe("entity");
  });
});

describe("query — the dark matter", () => {
  test("finds an item whose ONLY match is in the transcript (no caption, no hashtags)", () => {
    const items: IndexableItem[] = [
      mkItem({ id: "unrelated", desc: "a sunset timelapse", hashtags: ["nature"] }),
      mkItem({
        id: "dark-matter",
        desc: "morning vlog",
        hashtags: ["vlog"],
        analysis: analysis({ transcript: ["today we visit the Notre Dame cathedral"] }),
      }),
    ];
    const results = query(buildIndex(items), "cathedral");
    expect(results.map((r) => r.id)).toEqual(["dark-matter"]);
    expect(results[0]!.matchedFields).toContain("transcript");
  });
});

describe("query — token matching", () => {
  test("multi-token query is AND: only items matching every token are returned", () => {
    const items: IndexableItem[] = [
      mkItem({ id: "both", desc: "sourdough bread recipe" }),
      mkItem({ id: "one", desc: "sourdough starter tips" }),
    ];
    const results = query(buildIndex(items), "sourdough recipe");
    expect(results.map((r) => r.id)).toEqual(["both"]);
  });

  test("prefix match: a query token matches an index token that starts with it", () => {
    const items = [mkItem({ id: "a", desc: "homemade focaccia" })];
    const results = query(buildIndex(items), "focac");
    expect(results.map((r) => r.id)).toEqual(["a"]);
  });

  test("substring match: a query token matches an index token that contains it mid-word", () => {
    const items = [mkItem({ id: "a", desc: "unbelievable" })];
    const results = query(buildIndex(items), "lieva");
    expect(results.map((r) => r.id)).toEqual(["a"]);
  });

  test("case and punctuation are folded (normalization discipline)", () => {
    const items = [mkItem({ id: "a", desc: "Joe's Pizza!" })];
    expect(query(buildIndex(items), "JOES").map((r) => r.id)).toEqual(["a"]);
    expect(query(buildIndex(items), "pizza").map((r) => r.id)).toEqual(["a"]);
  });
});

describe("query — honest empties and recency", () => {
  test("no match returns an empty array (never a fabricated result)", () => {
    const items = [mkItem({ id: "a", desc: "a cooking video" })];
    expect(query(buildIndex(items), "quantum")).toEqual([]);
  });

  test("empty query returns recent items, newest first", () => {
    const items: IndexableItem[] = [
      mkItem({ id: "old", savedAt: "2026-01-01T00:00:00Z", desc: "old" }),
      mkItem({ id: "new", savedAt: "2026-06-01T00:00:00Z", desc: "new" }),
      mkItem({ id: "mid", savedAt: "2026-03-01T00:00:00Z", desc: "mid" }),
    ];
    const results = query(buildIndex(items), "");
    expect(results.map((r) => r.id)).toEqual(["new", "mid", "old"]);
    expect(results.every((r) => r.matchedFields.length === 0)).toBe(true);
  });

  test("recency (savedAt) breaks ties between equally-scored matches", () => {
    const items: IndexableItem[] = [
      mkItem({ id: "older", desc: "taco recipe", savedAt: "2026-01-01T00:00:00Z" }),
      mkItem({ id: "newer", desc: "taco recipe", savedAt: "2026-05-01T00:00:00Z" }),
    ];
    const results = query(buildIndex(items), "taco");
    expect(results.map((r) => r.id)).toEqual(["newer", "older"]);
  });
});

describe("query — performance sanity", () => {
  test("building + querying a 5,000-item library stays well under a second", () => {
    const items: IndexableItem[] = [];
    for (let i = 0; i < 5000; i++) {
      items.push(
        mkItem({
          id: `item-${i}`,
          desc: `caption number ${i} about food and travel`,
          hashtags: ["foodie", "travel"],
          author: "creator",
          savedAt: new Date(1_700_000_000_000 + i * 1000).toISOString(),
          analysis: analysis({
            mentions: [{ surface: `Place ${i % 200}`, type: "place" }],
            transcript: [`in this clip we talk about restaurant ${i % 500} and the neighbourhood around it`],
            onscreen: [`caption overlay ${i % 300}`],
          }),
        }),
      );
    }
    const t0 = performance.now();
    const index = buildIndex(items);
    const built = performance.now();
    const results = query(index, "restaurant neighbourhood");
    const done = performance.now();
    expect(results.length).toBeGreaterThan(0);
    // Well under a second for build + a real multi-token query on a 5k library.
    expect(done - t0).toBeLessThan(1000);
    // eslint-disable-next-line no-console
    console.log(`[perf] build=${(built - t0).toFixed(1)}ms query=${(done - built).toFixed(1)}ms (5k items)`);
  });
});
