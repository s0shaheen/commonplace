import { describe, test, expect } from "vitest";
import { normalizeName, entityKey, dedupeEntities, buildEntityIndex } from "./entities.js";
import type { EnrichedItem, Entity } from "./types.js";

describe("normalizeName", () => {
  test("casefolds, trims, collapses whitespace", () => {
    expect(normalizeName("  Lilia  ")).toBe("lilia");
    expect(normalizeName("The   French   Laundry")).toBe("french laundry");
  });
  test("strips leading @ and 'the'", () => {
    expect(normalizeName("@gordonramsay")).toBe("gordonramsay");
    expect(normalizeName("The Bear")).toBe("bear");
  });
  test("strips @ even with leading whitespace", () => {
    expect(normalizeName(" @handle")).toBe("handle");
  });
});

describe("entityKey", () => {
  test("combines type and normalized name", () => {
    expect(entityKey({ type: "restaurant", name: "Lilia", raw: "Lilia" })).toBe("restaurant:lilia");
  });
  test("same name, different type → different keys", () => {
    const a = entityKey({ type: "place", name: "Rome", raw: "Rome" });
    const b = entityKey({ type: "media", name: "Rome", raw: "Rome" });
    expect(a).not.toBe(b);
  });
});

describe("dedupeEntities", () => {
  test("collapses same-key entities within one item, keeping first raw + merging specs", () => {
    const ents: Entity[] = [
      { type: "restaurant", name: "Lilia", raw: "Lilia", specs: { neighborhood: "Williamsburg" } },
      { type: "restaurant", name: "lilia ", raw: "Lilia in Brooklyn", specs: { city: "Brooklyn" } },
    ];
    const out = dedupeEntities(ents);
    expect(out).toHaveLength(1);
    expect(out[0]!.raw).toBe("Lilia");
    expect(out[0]!.specs).toEqual({ neighborhood: "Williamsburg", city: "Brooklyn" });
  });
});

describe("buildEntityIndex", () => {
  const mk = (id: string, ents: Entity[]): EnrichedItem =>
    ({
      id,
      enrichment: { tier: "text", entities: ents, takeaways: [] },
    }) as unknown as EnrichedItem;

  test("same entity across items → one entry with all item ids in first-seen order", () => {
    const items = [
      mk("7001", [{ type: "restaurant", name: "Lilia", raw: "Lilia" }]),
      mk("7005", [{ type: "restaurant", name: "lilia", raw: "Lilia in Williamsburg" }]),
    ];
    const index = buildEntityIndex(items);
    const lilia = index.find((e) => e.key === "restaurant:lilia");
    expect(lilia).toBeTruthy();
    expect(lilia!.itemIds).toEqual(["7001", "7005"]);
    expect(lilia!.name).toBe("Lilia");
  });

  test("does not duplicate an item id when an entity appears twice in the same item", () => {
    const items = [
      mk("7001", [
        { type: "book", name: "Dune", raw: "Dune" },
        { type: "book", name: "dune", raw: "Dune (1965)" },
      ]),
    ];
    const index = buildEntityIndex(items);
    expect(index.find((e) => e.key === "book:dune")!.itemIds).toEqual(["7001"]);
  });

  test("tolerates an item with no entities", () => {
    const items = [mk("7009", [])];
    expect(buildEntityIndex(items)).toEqual([]);
  });
});
