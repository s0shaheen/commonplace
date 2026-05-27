// Shapes shared across the enrichment engine. CapturedItem matches the spike's normalizeItem output.

export interface CapturedItem {
  id: string;
  desc: string;
  createTime: number | null;
  author: string | null;
  authorName: string | null;
  url: string | null;
  playUrl: string | null;
  downloadUrl: string | null;
  cover: string | null;
  durationSec: number | null;
  hasSubtitles: boolean;
  subtitleUrl: string | null;
  isSlideshow: boolean;
  music: { name: string | null; author: string | null } | null;
  hashtags: string[];
  stats: {
    plays: number | null;
    likes: number | null;
    comments: number | null;
    shares: number | null;
    collects: number | null;
  };
}

export type EntityType =
  | "place"
  | "restaurant"
  | "product"
  | "book"
  | "media"
  | "recipe"
  | "person"
  | "brand"
  | "link"
  | "other";

export interface Entity {
  type: EntityType;
  name: string;
  raw: string;
  specs?: Record<string, string>;
}

export type EnrichmentTier = "raw" | "text" | "visual";

export interface Enrichment {
  tier: EnrichmentTier;
  transcript?: string;
  on_screen_text?: string[];
  entities: Entity[];
  takeaways: string[];
  structured_content?: Record<string, unknown>;
  facets?: { topic?: string; genre?: string; affect?: string };
  error?: string;
}

export interface EnrichedItem extends CapturedItem {
  enrichment: Enrichment;
}

export interface EntityIndexEntry {
  key: string; // `${type}:${normalizedName}`
  type: EntityType;
  name: string; // chosen display name
  itemIds: string[]; // first-seen order, deduped
}

// Result-object convention (matches the parent codebase) — engine functions never throw for expected failures.
export type GeminiResult =
  | { ok: true; enrichment: Omit<Enrichment, "tier"> }
  | { ok: false; error: string };
