import { describe, it, expect } from "vitest";
import { parsePlacesSearch, createPlacesResolver } from "./places.js";

const headerOf = (init: RequestInit, k: string) => (init.headers as Record<string, string>)[k];
const bodyOf = (init: RequestInit) => JSON.parse(init.body as string);

describe("parsePlacesSearch", () => {
  it("maps a Text Search result to a durable place_id candidate", () => {
    const cands = parsePlacesSearch({
      places: [{ id: "ChIJN1t_tDeuEmsRUsoyG83frY4", displayName: { text: "Lucali" } }],
    });
    expect(cands).toHaveLength(1);
    expect(cands[0]).toEqual({
      id: "ChIJN1t_tDeuEmsRUsoyG83frY4",
      source: "places",
      name: "Lucali",
    });
  });

  it("returns [] for empty or missing places array", () => {
    expect(parsePlacesSearch({ places: [] })).toEqual([]);
    expect(parsePlacesSearch({})).toEqual([]);
    expect(parsePlacesSearch(null)).toEqual([]);
  });
});

describe("createPlacesResolver", () => {
  it("routes only place mentions", () => {
    const resolver = createPlacesResolver({ fetchJson: async () => ({ places: [] }), key: "pk" });
    expect(resolver.source).toBe("places");
    expect(resolver.handles("place")).toBe(true);
    expect(resolver.handles("music_recording")).toBe(false);
    expect(resolver.handles("screen_work")).toBe(false);
  });

  it("POSTs searchText with the SKU-discipline field mask AND key header verbatim", async () => {
    let calledUrl = "";
    let calledInit: RequestInit | undefined;
    const resolver = createPlacesResolver({
      fetchJson: async (url: string, init: RequestInit) => {
        calledUrl = url;
        calledInit = init;
        return { places: [{ id: "ChIJ-abc", displayName: { text: "Lucali" } }] };
      },
      key: "pk",
    });

    const cands = await resolver.search({ surface: "Lucali", type: "place" });
    expect(cands[0]!.id).toBe("ChIJ-abc");
    expect(calledUrl).toBe("https://places.googleapis.com/v1/places:searchText");
    expect(calledInit!.method).toBe("POST");
    // The cost-control contract, made testable: both headers exactly.
    expect(headerOf(calledInit!, "X-Goog-FieldMask")).toBe("places.id,places.displayName");
    expect(headerOf(calledInit!, "X-Goog-Api-Key")).toBe("pk");
    expect(headerOf(calledInit!, "Content-Type")).toBe("application/json");
    const body = bodyOf(calledInit!);
    expect(body.textQuery).toBe("Lucali");
    expect(body.pageSize).toBe(5);
  });

  it("appends hints.locale to the text query when present", async () => {
    let calledInit: RequestInit | undefined;
    const resolver = createPlacesResolver({
      fetchJson: async (_url: string, init: RequestInit) => {
        calledInit = init;
        return { places: [] };
      },
      key: "pk",
    });
    await resolver.search({ surface: "Lucali", type: "place", hints: { locale: "Brooklyn" } });
    expect(bodyOf(calledInit!).textQuery).toBe("Lucali, Brooklyn");
  });

  it("refuses construction without a key (SKU discipline)", () => {
    expect(() => createPlacesResolver({ fetchJson: async () => ({}), key: "" })).toThrow();
  });
});
