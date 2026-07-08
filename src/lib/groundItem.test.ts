import { describe, it, expect } from "vitest";
import { groundItemMentions } from "./groundItem.js";
import type { Candidate, GroundedEntity, KbResolver, Mention, Selector } from "./grounding.js";
import type { CapturedItem, MentionOut, NamedEntityType } from "./types.js";

function makeItem(over: Partial<CapturedItem> = {}): CapturedItem {
  return {
    id: "1",
    sources: ["favorites"],
    desc: "a caption",
    createTime: null,
    author: "acme",
    authorName: "Acme",
    url: null,
    playUrl: null,
    downloadUrl: null,
    cover: null,
    durationSec: 29,
    hasSubtitles: true,
    subtitleUrl: null,
    isSlideshow: false,
    music: { name: "Kill Bill", author: "SZA" },
    hashtags: [],
    stats: { plays: null, likes: null, comments: null, shares: null, collects: null },
    ...over,
  };
}

function mention(surface: string, type: NamedEntityType): MentionOut {
  return { surface, type, evidence: [{ channel: "VERBAL_AUDIO", assertion_mode: "SHOWN", confidence: 0.9 }] };
}

function countingResolver(source: Candidate["source"], type: NamedEntityType, candidates: Candidate[]) {
  const state = { calls: 0 };
  const resolver: KbResolver = {
    source,
    handles: (t) => t === type,
    search: async () => {
      state.calls++;
      return candidates;
    },
  };
  return { resolver, state };
}

function makeCache(seed: Record<string, GroundedEntity> = {}) {
  const store = new Map<string, GroundedEntity>(Object.entries(seed));
  const puts: Array<{ k: string; g: GroundedEntity }> = [];
  return {
    store,
    puts,
    cacheGet: async (k: string) => store.get(k),
    cachePut: async (k: string, g: GroundedEntity) => {
      store.set(k, g);
      puts.push({ k, g });
    },
  };
}

const mbCandidate: Candidate = { id: "mbid-1", source: "musicbrainz", name: "Kill Bill", score: 100 };

describe("groundItemMentions", () => {
  it("dedupes, resolves, NILs honestly, and marks unavailable types for reground", async () => {
    const item = makeItem();
    const mentions = [
      mention("Kill Bill", "music_recording"),
      mention("Kill Bill", "music_recording"), // duplicate save of the same song
      mention("Dune", "screen_work"),
      mention("Lucali", "place"), // Places DISABLED → no resolver in the array
    ];
    const mb = countingResolver("musicbrainz", "music_recording", [mbCandidate]);
    const wd = countingResolver("wikidata", "screen_work", []); // 0 candidates → honest NIL
    const select: Selector = async () => ({ index: 0, confidence: 0.93 });
    const cache = makeCache();

    const res = await groundItemMentions(item, mentions, {
      resolvers: [mb.resolver, wd.resolver], // NO places resolver
      select,
      cacheGet: cache.cacheGet,
      cachePut: cache.cachePut,
    });

    // Two GroundedEntities: the resolved song + the honest Dune NIL. Place is NOT here.
    expect(res.groundings).toHaveLength(2);

    const music = res.groundings.find((g) => g.mention.type === "music_recording")!;
    expect(music.resolved).toBe(true);
    expect(music.id).toBe("mbid-1");
    expect(music.confidence).toBe(0.93);

    const dune = res.groundings.find((g) => g.mention.type === "screen_work")!;
    expect(dune.resolved).toBe(false);
    expect(dune.id).toBeNull();
    expect(dune.provenance.candidateCount).toBe(0);

    // Unavailable resolver ≠ NIL: place goes to reground, no GroundedEntity, never a fake NIL.
    expect(res.regroundPending).toEqual(["place"]);
    expect(res.groundings.some((g) => g.mention.type === "place")).toBe(false);

    // Dedupe: one lookup for the duplicated song.
    expect(mb.state.calls).toBe(1);
    // Both the resolved and the NIL are cached (NIL is a measured metric worth keeping).
    expect(cache.puts).toHaveLength(2);
  });

  it("serves grounded results from cache on a second run without touching resolvers", async () => {
    const item = makeItem();
    const mentions = [mention("Kill Bill", "music_recording"), mention("Dune", "screen_work"), mention("Lucali", "place")];
    const mb = countingResolver("musicbrainz", "music_recording", [mbCandidate]);
    const wd = countingResolver("wikidata", "screen_work", []);
    const select: Selector = async () => ({ index: 0, confidence: 0.93 });
    const cache = makeCache();
    const deps = { resolvers: [mb.resolver, wd.resolver], select, cacheGet: cache.cacheGet, cachePut: cache.cachePut };

    const first = await groundItemMentions(item, mentions, deps);
    mb.state.calls = 0;
    wd.state.calls = 0;

    const second = await groundItemMentions(item, mentions, deps);
    expect(mb.state.calls).toBe(0);
    expect(wd.state.calls).toBe(0);
    expect(second.groundings).toEqual(first.groundings);
    expect(second.regroundPending).toEqual(["place"]);
  });

  it("records a below-gate selector confidence on the NIL (calibration needs it)", async () => {
    const item = makeItem();
    const mb = countingResolver("musicbrainz", "music_recording", [mbCandidate]);
    const select: Selector = async () => ({ index: 0, confidence: 0.3 }); // < default gate 0.5
    const cache = makeCache();

    const res = await groundItemMentions(item, [mention("Kill Bill", "music_recording")], {
      resolvers: [mb.resolver],
      select,
      cacheGet: cache.cacheGet,
      cachePut: cache.cachePut,
    });

    expect(res.groundings).toHaveLength(1);
    expect(res.groundings[0]!.resolved).toBe(false);
    expect(res.groundings[0]!.id).toBeNull();
    expect(res.groundings[0]!.confidence).toBe(0.3);
  });

  it("passes the music artist hint through from item.music.author", async () => {
    const item = makeItem({ music: { name: "Kill Bill", author: "SZA" } });
    let seen: string | undefined;
    const resolver: KbResolver = {
      source: "musicbrainz",
      handles: (t) => t === "music_recording",
      search: async (m) => {
        seen = m.hints?.artist;
        return [mbCandidate];
      },
    };
    const select: Selector = async () => ({ index: 0, confidence: 0.9 });
    const cache = makeCache();
    await groundItemMentions(item, [mention("Kill Bill", "music_recording")], {
      resolvers: [resolver],
      select,
      cacheGet: cache.cacheGet,
      cachePut: cache.cachePut,
    });
    expect(seen).toBe("SZA");
  });

  it("passes the clip caption to the selector as hints.context (disambiguation context)", async () => {
    const item = makeItem({ desc: "the 2021 Denis Villeneuve film, in IMAX" });
    let seen: Mention | undefined;
    const wd = countingResolver("wikidata", "screen_work", [
      { id: "Q1", source: "wikidata", name: "Dune (2021 film)", score: 100 },
    ]);
    const select: Selector = async (m) => {
      seen = m;
      return { index: 0, confidence: 0.9 };
    };
    const cache = makeCache();
    await groundItemMentions(item, [mention("Dune", "screen_work")], {
      resolvers: [wd.resolver],
      select,
      cacheGet: cache.cacheGet,
      cachePut: cache.cachePut,
    });
    expect(seen?.hints?.context).toContain("2021 Denis Villeneuve film");
  });

  it("caps the injected caption at 500 chars so a long desc can't blow the prompt", async () => {
    const item = makeItem({ desc: "x".repeat(900) });
    let seen: Mention | undefined;
    const wd = countingResolver("wikidata", "screen_work", [
      { id: "Q1", source: "wikidata", name: "Dune (2021 film)", score: 100 },
    ]);
    const select: Selector = async (m) => {
      seen = m;
      return { index: 0, confidence: 0.9 };
    };
    const cache = makeCache();
    await groundItemMentions(item, [mention("Dune", "screen_work")], {
      resolvers: [wd.resolver],
      select,
      cacheGet: cache.cacheGet,
      cachePut: cache.cachePut,
    });
    expect(seen?.hints?.context?.length).toBe(500);
  });
});
