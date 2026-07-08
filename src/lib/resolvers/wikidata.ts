// Wikidata resolver (free, keyless) — the wbsearchentities endpoint IS the candidate
// generator (no local index). One QID grounds the "generalized" entity types; SPEC §14
// deliberately routes screen_work here (the QID carries TMDB/IMDb/Letterboxd link-out
// properties) rather than calling TMDB. NOT place (→ Places), NOT music_recording (→ MusicBrainz).
import type { Candidate, KbResolver } from "../grounding.js";
import type { NamedEntityType } from "../types.js";

const WIKIDATA_TYPES: readonly NamedEntityType[] = [
  "screen_work",
  "book",
  "person",
  "product",
  "brand_org",
  "software_app",
  "game",
];

interface WdSearchItem {
  id?: string;
  label?: string;
  description?: string;
}

export function parseWikidataSearch(json: unknown): Candidate[] {
  const search = (json as { search?: WdSearchItem[] } | null)?.search ?? [];
  const out: Candidate[] = [];
  for (const it of search) {
    if (!it?.id || !it.label) continue;
    out.push({
      id: it.id,
      source: "wikidata",
      name: it.label,
      meta: it.description ? { description: it.description } : undefined,
    });
  }
  return out;
}

export interface WikidataDeps {
  fetchJson: (url: string, headers?: Record<string, string>) => Promise<unknown>;
}

export function createWikidataResolver(deps: WikidataDeps): KbResolver {
  return {
    source: "wikidata",
    handles: (type) => WIKIDATA_TYPES.includes(type),
    async search(mention) {
      const surface = encodeURIComponent(mention.surface);
      // origin=* makes wbsearchentities return CORS-friendly responses for the MV3 worker.
      const url =
        `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${surface}` +
        `&language=en&format=json&type=item&limit=5&origin=*`;
      const json = await deps.fetchJson(url, {
        // SPEC §14 etiquette UA (browsers may drop it as a forbidden header; harmless).
        "User-Agent": "Commonplace/0.1 (https://commonplacehq.com)",
      });
      return parseWikidataSearch(json);
    },
  };
}
