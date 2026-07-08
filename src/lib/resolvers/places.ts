// Google Places resolver — the "drop-in-later" KB, gated behind a runtime flag + key.
// SKU discipline (SPEC §14): this phase calls ONLY Text Search (places:searchText) with a
// tight field mask (places.id + places.displayName) — NEVER Place Details, which is a
// separate, pricier SKU. The field mask is the cost-control contract; the tests assert it
// verbatim. This resolver is NEVER constructed without a key (Global Constraints), so it
// only enters the resolver array when Places is provisioned — an ABSENT resolver (not a
// NIL) is what tells groundItem to defer a `place` mention to `regroundPending`.
import type { Candidate, KbResolver } from "../grounding.js";

interface PlaceItem {
  id?: string;
  displayName?: { text?: string };
}

export function parsePlacesSearch(json: unknown): Candidate[] {
  const places = (json as { places?: PlaceItem[] } | null)?.places ?? [];
  const out: Candidate[] = [];
  for (const p of places) {
    const name = p?.displayName?.text;
    if (!p?.id || !name) continue;
    out.push({ id: p.id, source: "places", name });
  }
  return out;
}

export interface PlacesDeps {
  fetchJson: (url: string, init: RequestInit) => Promise<unknown>;
  key: string;
}

export function createPlacesResolver(deps: PlacesDeps): KbResolver {
  if (!deps.key) {
    throw new Error("createPlacesResolver requires an API key (SKU discipline: never key-less)");
  }
  return {
    source: "places",
    handles: (type) => type === "place",
    async search(mention) {
      const locale = mention.hints?.locale;
      const textQuery = locale ? `${mention.surface}, ${locale}` : mention.surface;
      const json = await deps.fetchJson("https://places.googleapis.com/v1/places:searchText", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": deps.key,
          // The cost-control contract: ask for id + displayName ONLY. Widening this mask
          // silently moves the call into a more expensive SKU tier — do not.
          "X-Goog-FieldMask": "places.id,places.displayName",
        },
        body: JSON.stringify({ textQuery, pageSize: 5 }),
      });
      return parsePlacesSearch(json);
    },
  };
}
