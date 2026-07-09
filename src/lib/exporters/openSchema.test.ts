import { describe, test, expect } from "vitest";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { toOpenSchemaItem, toOpenSchemaExport, type ExportDeps } from "./openSchema.js";
import type { LibraryRecord } from "../store.js";
import type { GroundedEntity } from "../grounding.js";

// ── Ajv against the REAL frozen contract (item.schema.json $refs extraction.schema.json) ──
const root = join(__dirname, "..", "..", "..");
const load = (f: string) => JSON.parse(readFileSync(join(root, "schema", "json", f), "utf8"));
const ajv = new Ajv2020({ strict: false });
addFormats(ajv);
ajv.addSchema(load("extraction.schema.json")); // pre-register so item's relative $ref resolves
const validateItem = ajv.compile(load("item.schema.json"));

// ── The hand-built fixture: Task-1 `grounded` ExtractorOutput + a resolved MB grounding +
//    a `place` mention deferred to regroundPending. ────────────────────────────────────────
const deps: ExportDeps = {
  nowIso: "2026-07-08T12:00:00Z",
  extractorRef: { model: "gemini-2.5-flash-lite", version: "1", prompt: "extract@v1", run: "run-1" },
};

const musicGrounding: GroundedEntity = {
  mention: { surface: "Kill Bill", type: "music_recording", hints: { artist: "SZA" } },
  resolved: true,
  id: "5a7c1234-0000-4000-8000-000000000000",
  source: "musicbrainz",
  name: "Kill Bill",
  confidence: 0.93,
  provenance: { source: "musicbrainz", query: "Kill Bill", candidateCount: 3, selectedIndex: 0 },
};

const rec: LibraryRecord = {
  id: "7578265440993199126",
  status: "grounded",
  posterRef: "poster:7578265440993199126",
  updatedAt: "2026-07-08T00:00:00.000Z",
  item: {
    id: "7578265440993199126",
    sources: ["favorites"],
    desc: "he made the sacrifice play. #ironman",
    createTime: 1775813549,
    author: "no1persona",
    authorName: "persona",
    url: "https://www.tiktok.com/@no1persona/video/7578265440993199126",
    playUrl: "https://v16.example.com/play.mp4",
    downloadUrl: "https://v16.example.com/dl.mp4",
    cover: "https://p19.example.com/cover.jpg",
    durationSec: 78,
    hasSubtitles: true,
    subtitleUrl: "https://sub.example.com/cap.vtt",
    isSlideshow: false,
    music: { name: "Kill Bill", author: "SZA" },
    hashtags: ["ironman"],
    stats: { plays: 1000, likes: 200, comments: 30, shares: 10, collects: 5 },
  },
  analysis: {
    lane: "managed",
    ingestion: "keyframes_vtt",
    model: "gemini-2.5-flash-lite",
    promptVersion: "extract@v1",
    analyzedAt: "2026-07-08T00:00:00.000Z",
    output: {
      mentions: [
        {
          surface: "Kill Bill",
          type: "music_recording",
          evidence: [{ channel: "VERBAL_AUDIO", assertion_mode: "SHOWN", confidence: 0.9, t_start: 12, t_end: 19 }],
        },
        {
          surface: "Lilia",
          type: "place",
          evidence: [{ channel: "VISUAL_SCENE", assertion_mode: "SHOWN", confidence: 0.7 }],
        },
      ],
      concepts: [],
      claims: [],
      structured: [],
      facets: [
        {
          facet: "topic",
          value: "entertainment",
          evidence: [{ channel: "VISUAL_SCENE", assertion_mode: "INFERRED", confidence: 0.8 }],
        },
      ],
    },
  },
  groundings: [musicGrounding],
  regroundPending: ["place"],
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const findExt = (out: any, pred: (e: any) => boolean) => out.extractions.find(pred);

describe("toOpenSchemaItem — maps a LibraryRecord onto the frozen item.schema.json contract", () => {
  const out = toOpenSchemaItem(rec, deps) as any;

  test("the emitted object validates against the REAL frozen schema", () => {
    const ok = validateItem(out);
    if (!ok) console.error(validateItem.errors);
    expect(ok).toBe(true);
  });

  test("identity.canonicalId is the TikTok id", () => {
    expect(out.identity.canonicalId).toBe("7578265440993199126");
  });

  test("saves[0].sources[0] carries the injected capture time as `at`", () => {
    expect(out.saves[0].sources[0]).toEqual({ kind: "favorites", at: "2026-07-08T12:00:00Z" });
  });

  test("the resolved music mention carries the MB externalId, nil:false", () => {
    const music = findExt(out, (e: any) => e.kind === "named_entity" && e.surface === "Kill Bill");
    expect(music.grounding.externalId).toBe("5a7c1234-0000-4000-8000-000000000000");
    expect(music.grounding.nil).toBe(false);
    expect(music.grounding.authority).toBe("musicbrainz");
  });

  test("the regroundPending place mention has NO grounding key (never a fake NIL)", () => {
    const place = findExt(out, (e: any) => e.kind === "named_entity" && e.surface === "Lilia");
    expect("grounding" in place).toBe(false);
  });

  test("facet evidence carries the model-emitted channel, never a pipeline stamp", () => {
    const facet = findExt(out, (e: any) => e.kind === "facet");
    expect(facet.evidence[0].channel).toBe("VISUAL_SCENE");
  });

  test("every extraction's evidence is stamped with the pipeline extractor_ref", () => {
    for (const e of out.extractions) {
      expect(e.evidence[0].extractor_ref.model).toBe("gemini-2.5-flash-lite");
    }
  });

  test("t_start/t_end become a media-fragment selector value", () => {
    const music = findExt(out, (e: any) => e.kind === "named_entity" && e.surface === "Kill Bill");
    expect(music.evidence[0].selector.value).toBe("t=12,19");
  });

  test("invalid-by-construction guard: nil:false with externalId:null is rejected by the schema", () => {
    const corrupt = JSON.parse(JSON.stringify(out));
    const music = corrupt.extractions.find((e: any) => e.kind === "named_entity" && e.surface === "Kill Bill");
    music.grounding.externalId = null;
    music.grounding.nil = false;
    expect(validateItem(corrupt)).toBe(false);
  });
});

describe("toOpenSchemaExport — the bundle wrapper", () => {
  test("stamps the frozen schemaVersion and carries every record's item", () => {
    const bundle = JSON.parse(toOpenSchemaExport([rec], deps));
    expect(bundle.schemaVersion).toBe("1.0.0-rc.6");
    expect(bundle.exportedAt).toBe("2026-07-08T12:00:00Z");
    expect(bundle.items).toHaveLength(1);
    expect(validateItem(bundle.items[0])).toBe(true);
  });
});
