import { describe, it, expect } from "vitest";
import {
  groundMention,
  type KbResolver,
  type Candidate,
  type Mention,
  type GroundingDeps,
} from "./grounding.js";
import { parseMusicBrainzRecordings, createMusicBrainzResolver } from "./resolvers/musicbrainz.js";

function fakeResolver(
  source: Candidate["source"],
  type: Mention["type"],
  candidates: Candidate[],
): KbResolver {
  return { source, handles: (t) => t === type, search: async () => candidates };
}

const song: Candidate = {
  id: "mbid-123",
  source: "musicbrainz",
  name: "Jazz Is for Ordinary People",
  score: 100,
};

describe("groundMention (orchestrator)", () => {
  it("resolves a mention to the selected candidate's durable ID, source and provenance", async () => {
    const deps: GroundingDeps = {
      resolvers: [fakeResolver("musicbrainz", "music_recording", [song])],
      select: async () => ({ index: 0, confidence: 0.9 }),
    };
    const r = await groundMention(
      { surface: "jazz is for ordinary people", type: "music_recording", hints: { artist: "berlioz" } },
      deps,
    );
    expect(r.resolved).toBe(true);
    expect(r.id).toBe("mbid-123");
    expect(r.source).toBe("musicbrainz");
    expect(r.name).toBe("Jazz Is for Ordinary People");
    expect(r.confidence).toBe(0.9);
    expect(r.provenance.candidateCount).toBe(1);
    expect(r.provenance.selectedIndex).toBe(0);
  });

  it("abstains (NIL) when no resolver handles the mention type", async () => {
    const deps: GroundingDeps = {
      resolvers: [fakeResolver("musicbrainz", "music_recording", [song])],
      select: async () => ({ index: 0, confidence: 1 }),
    };
    const r = await groundMention({ surface: "Kasama", type: "place" }, deps);
    expect(r.resolved).toBe(false);
    expect(r.id).toBeNull();
    expect(r.provenance.source).toBeNull();
  });

  it("abstains (NIL) when the resolver returns zero candidates, without calling the selector", async () => {
    const deps: GroundingDeps = {
      resolvers: [fakeResolver("musicbrainz", "music_recording", [])],
      select: async () => {
        throw new Error("selector must not run when there are no candidates");
      },
    };
    const r = await groundMention({ surface: "nothing here", type: "music_recording" }, deps);
    expect(r.resolved).toBe(false);
    expect(r.provenance.candidateCount).toBe(0);
  });

  it("abstains (NIL) when the selector declines to pick (returns null)", async () => {
    const deps: GroundingDeps = {
      resolvers: [fakeResolver("musicbrainz", "music_recording", [song])],
      select: async () => null,
    };
    const r = await groundMention({ surface: "too ambiguous", type: "music_recording" }, deps);
    expect(r.resolved).toBe(false);
    expect(r.id).toBeNull();
  });

  it("abstains (NIL) below the confidence gate, but still records the confidence for calibration", async () => {
    const deps: GroundingDeps = {
      resolvers: [fakeResolver("musicbrainz", "music_recording", [song])],
      select: async () => ({ index: 0, confidence: 0.3 }),
      minConfidence: 0.5,
    };
    const r = await groundMention({ surface: "weak match", type: "music_recording" }, deps);
    expect(r.resolved).toBe(false);
    expect(r.id).toBeNull();
    expect(r.confidence).toBe(0.3);
  });
});

describe("MusicBrainz resolver", () => {
  it("parses MusicBrainz recording-search JSON into durable-ID candidates", () => {
    const mbJson = {
      recordings: [
        {
          id: "abc-mbid",
          title: "Jazz Is for Ordinary People",
          score: 100,
          "artist-credit": [{ name: "berlioz" }],
        },
      ],
    };
    const cands = parseMusicBrainzRecordings(mbJson);
    expect(cands).toHaveLength(1);
    expect(cands[0]!.id).toBe("abc-mbid");
    expect(cands[0]!.source).toBe("musicbrainz");
    expect(cands[0]!.name).toBe("Jazz Is for Ordinary People");
    expect(cands[0]!.score).toBe(100);
    expect(cands[0]!.meta?.artist).toBe("berlioz");
  });

  it("routes only music/media mentions and queries by surface + artist hint", async () => {
    let calledUrl = "";
    const resolver = createMusicBrainzResolver({
      fetchJson: async (url: string) => {
        calledUrl = url;
        return {
          recordings: [
            { id: "mbid-x", title: "Song", score: 88, "artist-credit": [{ name: "Artist" }] },
          ],
        };
      },
    });
    expect(resolver.source).toBe("musicbrainz");
    expect(resolver.handles("music_recording")).toBe(true);
    expect(resolver.handles("place")).toBe(false);

    const cands = await resolver.search({ surface: "Song", type: "music_recording", hints: { artist: "Artist" } });
    expect(cands[0]!.id).toBe("mbid-x");
    expect(calledUrl).toContain("/recording");
    expect(calledUrl.toLowerCase()).toContain("song");
    expect(calledUrl.toLowerCase()).toContain("artist");
  });
});
