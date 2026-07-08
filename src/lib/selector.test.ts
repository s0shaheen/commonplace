import { describe, it, expect } from "vitest";
import { createLlmSelector } from "./selector.js";
import type { Candidate, Mention } from "./grounding.js";

const mention: Mention = { surface: "Dune", type: "screen_work" };
const three: Candidate[] = [
  { id: "Q1", source: "wikidata", name: "Dune (2021 film)" },
  { id: "Q2", source: "wikidata", name: "Dune (1984 film)" },
  { id: "Q3", source: "wikidata", name: "Dune (novel)" },
];

describe("createLlmSelector", () => {
  it("parses a valid pick into {index, confidence}", async () => {
    const select = createLlmSelector(async () => '{"index":0,"confidence":0.85}');
    expect(await select(mention, three)).toEqual({ index: 0, confidence: 0.85 });
  });

  it("returns null when the model explicitly abstains with index:null", async () => {
    const select = createLlmSelector(async () => '{"index":null}');
    expect(await select(mention, three)).toBeNull();
  });

  it("returns null on a malformed (non-JSON) reply — never throws", async () => {
    const select = createLlmSelector(async () => "not json");
    expect(await select(mention, three)).toBeNull();
  });

  it("treats an out-of-range index as abstention", async () => {
    const select = createLlmSelector(async () => '{"index":7,"confidence":0.9}');
    expect(await select(mention, three)).toBeNull();
  });

  it("treats a NaN / non-integer index as abstention", async () => {
    const nan = createLlmSelector(async () => '{"index":"x","confidence":0.9}');
    expect(await nan(mention, three)).toBeNull();
    const frac = createLlmSelector(async () => '{"index":1.5,"confidence":0.9}');
    expect(await frac(mention, three)).toBeNull();
  });

  it("builds a prompt carrying the surface, numbered candidates, and the abstain contract", async () => {
    let prompt = "";
    const select = createLlmSelector(async (p) => {
      prompt = p;
      return '{"index":1,"confidence":0.7}';
    });
    await select(mention, three);
    expect(prompt).toContain("Dune");
    expect(prompt).toContain("Dune (1984 film)");
    expect(prompt).toContain('"index"');
    expect(prompt.toLowerCase()).toContain("abstain");
  });

  it("renders an arbitrary hint (e.g. context) into the prompt so the caption reaches the model", async () => {
    let prompt = "";
    const select = createLlmSelector(async (p) => {
      prompt = p;
      return '{"index":0,"confidence":0.7}';
    });
    const withContext: Mention = {
      surface: "Dune",
      type: "screen_work",
      hints: { context: "the 2021 Denis Villeneuve film" },
    };
    await select(withContext, three);
    expect(prompt).toContain("context=the 2021 Denis Villeneuve film");
  });

  it("tolerates a code-fenced JSON reply", async () => {
    const select = createLlmSelector(async () => '```json\n{"index":2,"confidence":0.6}\n```');
    expect(await select(mention, three)).toEqual({ index: 2, confidence: 0.6 });
  });
});
