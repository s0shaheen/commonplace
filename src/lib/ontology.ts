// The frozen ontology surface: the 9 groundable NamedEntity types, their authority
// routing, the evidence vocab (channels + assertion modes), and the closed facet
// vocabulary — all derived from the frozen files in `schema/vocab/` (resolveJsonModule).
import type {
  NamedEntityType,
  Channel,
  AssertionMode,
  FacetName,
} from "./types.js";
import anchors from "../../schema/vocab/named-entity-anchors.json";
import facetsVocab from "../../schema/vocab/facets.json";

// The 9 frozen types, in schema (extractor-output.schema.json enum) order.
export const NAMED_ENTITY_TYPES: readonly NamedEntityType[] = [
  "music_recording",
  "place",
  "screen_work",
  "book",
  "person",
  "product",
  "brand_org",
  "software_app",
  "game",
];

export function isNamedEntityType(value: string): value is NamedEntityType {
  return (NAMED_ENTITY_TYPES as readonly string[]).includes(value);
}

// ── Authority routing (from schema/vocab/named-entity-anchors.json) ──────────────
// music_recording → musicbrainz; place → google_places; everything else → wikidata
// (book's primary anchor is wikidata; openlibrary is a secondary link-out).
export type Authority = "musicbrainz" | "google_places" | "wikidata";

const AUTHORITY_BY_TYPE: Record<string, Authority> = Object.fromEntries(
  anchors.types.map((t) => {
    // "wikidata / openlibrary" → primary "wikidata".
    const primary = t.grounds_to.split("/")[0]!.trim();
    return [t.type, primary as Authority];
  }),
);

export function typeToAuthority(t: NamedEntityType): Authority {
  return AUTHORITY_BY_TYPE[t] ?? "wikidata";
}

// ── Evidence vocab (the 6 channels + 4 assertion modes) ──────────────────────────
export const CHANNELS: readonly Channel[] = [
  "VERBAL_AUDIO",
  "VERBAL_TEXT",
  "VISUAL_SCENE",
  "VISUAL_TEXT",
  "NONVERBAL_AUDIO",
  "STRUCTURED_METADATA",
];

export const ASSERTION_MODES: readonly AssertionMode[] = [
  "STATED",
  "SHOWN",
  "REPORTED",
  "INFERRED",
];

export function isChannel(value: string): value is Channel {
  return (CHANNELS as readonly string[]).includes(value);
}

export function isAssertionMode(value: string): value is AssertionMode {
  return (ASSERTION_MODES as readonly string[]).includes(value);
}

// ── Closed facet vocabulary (from schema/vocab/facets.json) ───────────────────────
// A map from facet axis → its allowed values. Kept OUT of the JSON Schemas so the
// vocab can evolve additively; membership is enforced at runtime by the schema gate.
export const FACETS = Object.fromEntries(
  Object.entries(facetsVocab.facets).map(([facet, def]) => [facet, def.values]),
) as unknown as Record<FacetName, readonly string[]>;
