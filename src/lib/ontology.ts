// Thinned port of the ontology — the entity types the prompt may emit and the secondary facet vocab.
import type { EntityType } from "./types.js";

export const ENTITY_TYPES: readonly EntityType[] = [
  "place",
  "restaurant",
  "product",
  "book",
  "media",
  "recipe",
  "person",
  "brand",
  "link",
  "other",
] as const;

export const FACET_TOPICS = [
  "food",
  "travel",
  "fitness",
  "fashion",
  "tech",
  "finance",
  "home",
  "entertainment",
  "education",
  "other",
] as const;

export function isEntityType(value: string): value is EntityType {
  return (ENTITY_TYPES as readonly string[]).includes(value);
}
