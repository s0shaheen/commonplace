import { describe, test, expect } from "vitest";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { toOpenSchemaItem, toOpenSchemaExport, mmssToSeconds, type ExportDeps } from "./openSchema.js";
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
          evidence: [{ channel: "VERBAL_AUDIO", assertion_mode: "SHOWN", confidence: 0.9, t_start: "1:05", t_end: "1:12" }],
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

  test("MM:SS t_start/t_end parse to a seconds media-fragment selector value", () => {
    const music = findExt(out, (e: any) => e.kind === "named_entity" && e.surface === "Kill Bill");
    expect(music.evidence[0].selector.value).toBe("t=65,72"); // "1:05"→65, "1:12"→72
  });

  test("invalid-by-construction guard: nil:false with externalId:null is rejected by the schema", () => {
    const corrupt = JSON.parse(JSON.stringify(out));
    const music = corrupt.extractions.find((e: any) => e.kind === "named_entity" && e.surface === "Kill Bill");
    music.grounding.externalId = null;
    music.grounding.nil = false;
    expect(validateItem(corrupt)).toBe(false);
  });
});

// ── F4/F5 coverage: a NIL grounding, the concept/claim/structured builders, per-record
//    extractor_ref provenance, and a raw (unanalyzed) record. ────────────────────────────────
const nilGrounding: GroundedEntity = {
  mention: { surface: "Unknown Song", type: "music_recording" },
  resolved: false,
  id: null,
  source: null,
  name: null,
  confidence: 0.42,
  provenance: { source: "musicbrainz", query: "Unknown Song", candidateCount: 2, selectedIndex: null },
};

// This record was analyzed on a DIFFERENT model than the export-time deps carry (F5): managed
// gemini-2.5-flash, while `deps.extractorRef.model` is gemini-2.5-flash-lite.
const recVariants: LibraryRecord = {
  id: "9000000000000000001",
  status: "grounded",
  updatedAt: "2026-07-08T00:00:00.000Z",
  item: {
    id: "9000000000000000001",
    sources: ["likes"],
    desc: "",
    createTime: null,
    author: "creator",
    authorName: null,
    url: null,
    playUrl: null,
    downloadUrl: null,
    cover: null,
    durationSec: 30,
    hasSubtitles: false,
    subtitleUrl: null,
    isSlideshow: false,
    music: null,
    hashtags: [],
    stats: { plays: null, likes: null, comments: null, shares: null, collects: null },
  },
  analysis: {
    lane: "managed",
    ingestion: "keyframes_vtt",
    model: "gemini-2.5-flash", // ← differs from deps.extractorRef.model
    promptVersion: "extract@v2",
    analyzedAt: "2026-07-08T00:00:00.000Z",
    output: {
      mentions: [
        {
          surface: "Unknown Song",
          type: "music_recording",
          evidence: [{ channel: "VERBAL_AUDIO", assertion_mode: "SHOWN", confidence: 0.6 }],
        },
      ],
      concepts: [
        { surface: "resilience", evidence: [{ channel: "VERBAL_TEXT", assertion_mode: "STATED", confidence: 0.7 }] },
      ],
      claims: [
        {
          statement: "The bridge opened in 1937.",
          evidence: [{ channel: "VERBAL_TEXT", assertion_mode: "REPORTED", confidence: 0.8 }],
        },
      ],
      structured: [
        {
          schemaOrgType: "Recipe",
          evidence: [{ channel: "VISUAL_TEXT", assertion_mode: "SHOWN", confidence: 0.75 }],
          slots: [{ name: "prepTime", value: "PT10M" }],
          steps: [{ order: 1, text: "Mix the batter." }],
        },
      ],
      facets: [],
    },
  },
  groundings: [nilGrounding],
  regroundPending: [],
};

// A raw capture with no analysis at all → extractions must be empty, still Ajv-valid.
const recRaw: LibraryRecord = {
  id: "9000000000000000002",
  status: "raw",
  updatedAt: "2026-07-08T00:00:00.000Z",
  item: {
    id: "9000000000000000002",
    sources: ["posts"],
    desc: "just a caption",
    createTime: null,
    author: null,
    authorName: null,
    url: null,
    playUrl: null,
    downloadUrl: null,
    cover: null,
    durationSec: 10,
    hasSubtitles: false,
    subtitleUrl: null,
    isSlideshow: false,
    music: null,
    hashtags: [],
    stats: { plays: null, likes: null, comments: null, shares: null, collects: null },
  },
};

describe("toOpenSchemaItem — NIL grounding + remaining builders + per-record provenance (F4/F5)", () => {
  const out = toOpenSchemaItem(recVariants, deps) as any;

  test("the emitted object validates against the REAL frozen schema", () => {
    const ok = validateItem(out);
    if (!ok) console.error(validateItem.errors);
    expect(ok).toBe(true);
  });

  test("a NIL grounding emits {externalId:null, nil:true} with the calibration confidence", () => {
    const music = findExt(out, (e: any) => e.kind === "named_entity" && e.surface === "Unknown Song");
    expect(music.grounding.externalId).toBeNull();
    expect(music.grounding.nil).toBe(true);
    expect(music.grounding.grounding_confidence).toBe(0.42);
  });

  test("the concept builder emits a valid concept extraction", () => {
    const c = findExt(out, (e: any) => e.kind === "concept");
    expect(c.surface).toBe("resilience");
    expect(c.evidence[0].channel).toBe("VERBAL_TEXT");
  });

  test("the claim builder emits a valid claim extraction", () => {
    const c = findExt(out, (e: any) => e.kind === "claim");
    expect(c.statement).toBe("The bridge opened in 1937.");
  });

  test("the structured builder emits slots (as observations) and steps", () => {
    const s = findExt(out, (e: any) => e.kind === "structured_content");
    expect(s.schemaOrgType).toBe("Recipe");
    expect(s.slots[0]).toEqual({ name: "prepTime", value: { value: "PT10M", observedAt: "2026-07-08T12:00:00Z" } });
    expect(s.steps[0]).toEqual({ order: 1, text: "Mix the batter." });
  });

  test("F5: evidence is stamped with the RECORD's model, not the export-time deps model", () => {
    expect(deps.extractorRef.model).toBe("gemini-2.5-flash-lite"); // guard: the two genuinely differ
    for (const e of out.extractions) {
      expect(e.evidence[0].extractor_ref.model).toBe("gemini-2.5-flash"); // recVariants.analysis.model
      expect(e.evidence[0].extractor_ref.version).toBe("extract@v2"); // from analysis.promptVersion
      expect(e.evidence[0].extractor_ref.prompt).toBe("extract@v2");
      expect(e.evidence[0].extractor_ref.run).toBe("run-1"); // run stamp still from deps
    }
  });
});

describe("toOpenSchemaItem — a raw record with no analysis (F4)", () => {
  const out = toOpenSchemaItem(recRaw, deps) as any;

  test("emits an empty extractions array and validates against the frozen schema", () => {
    expect(out.extractions).toEqual([]);
    const ok = validateItem(out);
    if (!ok) console.error(validateItem.errors);
    expect(ok).toBe(true);
  });
});

// ── XPLAT-01: cross-platform tagging threads through the open-schema export ──────────────────
const igRec: LibraryRecord = {
  id: "CxAMPLE001",
  status: "raw",
  updatedAt: "2026-07-08T00:00:00.000Z",
  item: {
    id: "CxAMPLE001",
    platform: "instagram",
    sources: ["saved"],
    collections: ["Recipes"],
    desc: "brown butter pasta in one pan",
    createTime: null,
    author: "example.kitchen",
    authorName: null,
    url: "https://www.instagram.com/reel/CxAMPLE001/",
    playUrl: null,
    downloadUrl: null,
    cover: null,
    durationSec: null,
    hasSubtitles: false,
    subtitleUrl: null,
    isSlideshow: false,
    music: null,
    hashtags: ["pasta"],
    stats: { plays: null, likes: null, comments: null, shares: null, collects: null },
    savedAt: "2025-07-02T23:46:40.000Z",
  },
};

describe("toOpenSchemaItem — cross-platform tagging (XPLAT-01)", () => {
  const out = toOpenSchemaItem(igRec, deps) as any;

  test("an Instagram item validates against the REAL frozen schema", () => {
    const ok = validateItem(out);
    if (!ok) console.error(validateItem.errors);
    expect(ok).toBe(true);
  });

  test("origin.platform carries the item's platform tag (instagram)", () => {
    expect(out.origin.platform).toBe("instagram");
    expect(out.origin.profile).toBe("instagram/1.0");
  });

  test("the IG 'saved' source maps to the frozen 'bookmark' save kind", () => {
    expect(out.saves[0].sources[0].kind).toBe("bookmark");
  });

  test("collection membership rides on the save", () => {
    expect(out.saves[0].collections).toEqual(["Recipes"]);
  });

  test("an existing TikTok item with NO platform field still exports as tiktok (the default)", () => {
    const ttOut = toOpenSchemaItem(rec, deps) as any; // `rec` carries no `platform` field
    expect(ttOut.origin.platform).toBe("tiktok");
    expect(ttOut.origin.profile).toBe("tiktok/1.0");
    expect("collections" in ttOut.saves[0]).toBe(false); // no collections key when absent
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

describe("mmssToSeconds — MM:SS video-time string → seconds (rc.7)", () => {
  test("parses M:SS and MM:SS", () => {
    expect(mmssToSeconds("0:12")).toBe(12);
    expect(mmssToSeconds("1:05")).toBe(65);
    expect(mmssToSeconds("10:00")).toBe(600);
    expect(mmssToSeconds("12:34")).toBe(754);
  });
  test("returns null for malformed input (tolerant — the selector is then omitted)", () => {
    expect(mmssToSeconds("12")).toBeNull();
    expect(mmssToSeconds("1:2")).toBeNull();
    expect(mmssToSeconds("")).toBeNull();
    expect(mmssToSeconds("bad")).toBeNull();
  });
});
