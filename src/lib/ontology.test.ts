import { describe, it, expect } from "vitest";
import { NAMED_ENTITY_TYPES, isNamedEntityType, typeToAuthority, FACETS } from "./ontology.js";

describe("frozen ontology", () => {
  it("has exactly the 9 frozen NamedEntity types, in schema order", () => {
    expect(NAMED_ENTITY_TYPES).toEqual([
      "music_recording","place","screen_work","book","person","product","brand_org","software_app","game",
    ]);
  });
  it("rejects the retired types", () => {
    expect(isNamedEntityType("restaurant")).toBe(false); // absorbed into place (anchors vocab)
    expect(isNamedEntityType("media")).toBe(false);
    expect(isNamedEntityType("recipe")).toBe(false);     // recipe is StructuredContent, not an entity
    expect(isNamedEntityType("place")).toBe(true);
  });
  it("routes types to the frozen authorities", () => {
    expect(typeToAuthority("music_recording")).toBe("musicbrainz");
    expect(typeToAuthority("place")).toBe("google_places");
    expect(typeToAuthority("screen_work")).toBe("wikidata");
    expect(typeToAuthority("book")).toBe("wikidata");
    expect(typeToAuthority("game")).toBe("wikidata");
  });
  it("facet vocab comes from the frozen file", () => {
    expect(FACETS.topic).toContain("food");
    expect(FACETS.actionability).toContain("ragebait_suspect");
    expect(Object.keys(FACETS)).toHaveLength(9);
  });
});
