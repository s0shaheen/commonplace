import { describe, it, expect } from "vitest";
import { parseWikidataSearch, createWikidataResolver } from "./wikidata.js";

describe("parseWikidataSearch", () => {
  it("maps a wbsearchentities hit to a durable-QID candidate with description meta", () => {
    const cands = parseWikidataSearch({
      search: [{ id: "Q3577037", label: "Dune", description: "2021 film by Denis Villeneuve" }],
    });
    expect(cands).toHaveLength(1);
    expect(cands[0]).toEqual({
      id: "Q3577037",
      source: "wikidata",
      name: "Dune",
      meta: { description: "2021 film by Denis Villeneuve" },
    });
  });

  it("returns [] for empty or missing search array", () => {
    expect(parseWikidataSearch({ search: [] })).toEqual([]);
    expect(parseWikidataSearch({})).toEqual([]);
    expect(parseWikidataSearch(null)).toEqual([]);
  });

  it("skips entries lacking id or label", () => {
    const cands = parseWikidataSearch({
      search: [{ id: "Q1" }, { label: "no id" }, { id: "Q2", label: "ok" }],
    });
    expect(cands).toHaveLength(1);
    expect(cands[0]!.id).toBe("Q2");
  });
});

describe("createWikidataResolver", () => {
  it("routes generalized types but NOT place or music_recording", () => {
    const resolver = createWikidataResolver({ fetchJson: async () => ({ search: [] }) });
    expect(resolver.source).toBe("wikidata");
    for (const t of ["screen_work", "book", "person", "product", "brand_org", "software_app", "game"] as const) {
      expect(resolver.handles(t)).toBe(true);
    }
    expect(resolver.handles("place")).toBe(false);
    expect(resolver.handles("music_recording")).toBe(false);
  });

  it("queries the keyless wbsearchentities endpoint with the surface", async () => {
    let calledUrl = "";
    const resolver = createWikidataResolver({
      fetchJson: async (url: string) => {
        calledUrl = url;
        return { search: [{ id: "Q3577037", label: "Dune" }] };
      },
    });
    const cands = await resolver.search({ surface: "Dune", type: "screen_work" });
    expect(cands[0]!.id).toBe("Q3577037");
    expect(calledUrl).toContain("wbsearchentities");
    expect(calledUrl).toContain("search=Dune");
    expect(calledUrl).toContain("format=json");
  });
});
