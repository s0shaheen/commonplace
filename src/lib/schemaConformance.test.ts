import { describe, it, expect } from "vitest";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { ExtractorOutput } from "./types.js";

const root = join(__dirname, "..", "..");
const load = (f: string) => JSON.parse(readFileSync(join(root, "schema", "json", f), "utf8"));
const ajv = new Ajv2020({ strict: false });
addFormats(ajv);
const validate = ajv.compile(load("extractor-output.schema.json"));

const minimal: ExtractorOutput = { mentions: [], concepts: [], facets: [], claims: [], structured: [] };
const grounded: ExtractorOutput = {
  mentions: [{ surface: "Kill Bill", type: "music_recording",
    evidence: [{ channel: "VERBAL_AUDIO", assertion_mode: "SHOWN", confidence: 0.9, t_start: 12, t_end: 19 }] }],
  concepts: [], claims: [], structured: [],
  facets: [{ facet: "topic", value: "entertainment",
    evidence: [{ channel: "VISUAL_SCENE", assertion_mode: "INFERRED", confidence: 0.8 }] }],
};

describe("ExtractorOutput conforms to the FROZEN extractor-output.schema.json", () => {
  it("accepts the empty-but-complete output", () => expect(validate(minimal)).toBe(true));
  it("accepts a typed mention with evidence", () => expect(validate(grounded)).toBe(true));
  it("rejects a zero-evidence mention (hard gate)", () => {
    expect(validate({ ...minimal, mentions: [{ surface: "x", type: "place", evidence: [] }] })).toBe(false);
  });
  it("rejects the retired 'restaurant' type", () => {
    expect(validate({ ...minimal, mentions: [{ surface: "x", type: "restaurant",
      evidence: [{ channel: "VISUAL_TEXT", assertion_mode: "SHOWN", confidence: 1 }] }] })).toBe(false);
  });
});
