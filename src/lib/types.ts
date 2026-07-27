// Shapes shared across the analysis engine. These mirror the FROZEN contract in
// `schema/json/extractor-output.schema.json` (v1.0.0-rc.7) EXACTLY — field names are
// the schema's, not new inventions. CapturedItem matches the spike's normalizeItem output.

export interface CapturedItem {
  id: string;
  // Capture provenance: which tab(s) surfaced this item (favorites | likes | posts | reposts).
  // Emitted by the spike's normalizeItem and UNION-merged on dedupe by the library store — it is
  // capture metadata, NOT part of the frozen extractor-output schema.
  sources: string[];
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
  // OPTIONAL capture metadata — like `sources`, NOT part of the frozen extractor-output schema.
  // The moment a video was LIKED/FAVORITED by the user, as an ISO-8601 string. The live-scroll lane
  // cannot see this (the item_list API returns no per-save timestamp), so it is unset there. The
  // Download-your-data (DYD) import lane DOES carry it (the export's per-entry `Date`), so it is set
  // only for imported items. Distinct from `createTime` (when the VIDEO was posted, epoch seconds).
  savedAt?: string;
  // OPTIONAL cross-platform tag (XPLAT-01 seam). Which platform the item was saved on. ABSENT means
  // "tiktok" — the whole live-scroll lane + the DYD import lane predate this field, so every existing
  // item and fixture reads as TikTok with no migration. The Instagram import lane sets "instagram".
  // Threaded to the open-schema export's `origin.platform` (which is already an open string). Ids stay
  // per-platform and naturally disjoint (TikTok = 19-digit numeric, IG = base64url shortcode), so no
  // key-prefixing is needed for the store to keep them apart.
  platform?: "tiktok" | "instagram";
  // OPTIONAL collection membership — the named saved-collections/boards a user filed this item under
  // (e.g. Instagram's "Recipes"). Carried from the export's saved_collections; unset when the item is
  // in no collection. Threaded to the open-schema export's `saves[].collections`.
  collections?: string[];
}

// ── The frozen extractor contract (rc.6) ─────────────────────────────────────────
// The model emits typed MENTIONS, never external IDs (SPEC §13 iron rule). The five
// top-level arrays each carry per-element evidence with >=1 item.

export type NamedEntityType =
  | "music_recording"
  | "place"
  | "screen_work"
  | "book"
  | "person"
  | "product"
  | "brand_org"
  | "software_app"
  | "game";

export type Channel =
  | "VERBAL_AUDIO"
  | "VERBAL_TEXT"
  | "VISUAL_SCENE"
  | "VISUAL_TEXT"
  | "NONVERBAL_AUDIO"
  | "STRUCTURED_METADATA";

export type AssertionMode = "STATED" | "SHOWN" | "REPORTED" | "INFERRED";

export interface EvidenceOut {
  channel: Channel;
  assertion_mode: AssertionMode;
  confidence: number;
  source_role?: string;
  quote?: string;
  // rc.7: MM:SS video-time strings (e.g. "0:12"), the model's native form — not float seconds.
  t_start?: string;
  t_end?: string;
}

export interface MentionOut {
  surface: string;
  type: NamedEntityType;
  aliases?: string[];
  evidence: EvidenceOut[];
}

export interface ConceptOut {
  surface: string;
  evidence: EvidenceOut[];
}

export interface ClaimOut {
  statement: string;
  evidence: EvidenceOut[];
}

export interface StructuredOut {
  schemaOrgType: string;
  slots?: { name: string; value: string }[];
  steps?: { order: number; text: string }[];
  evidence: EvidenceOut[];
}

export type FacetName =
  | "affect"
  | "topic"
  | "genre"
  | "intent"
  | "creator_role"
  | "viewer_orientation"
  | "presentation"
  | "content_provenance"
  | "actionability";

// rc.6: facets are evidence-carrying assignments, not a flat object — facet labels
// carry REAL model-emitted provenance, never synthetic.
export interface FacetAssignmentOut {
  facet: FacetName;
  value: string;
  evidence: EvidenceOut[];
}

export interface ExtractorOutput {
  mentions: MentionOut[];
  concepts: ConceptOut[];
  facets: FacetAssignmentOut[];
  claims: ClaimOut[];
  structured: StructuredOut[];
}

// ── Engine-side wrappers (not model-facing) ──────────────────────────────────────

export interface Analysis {
  output: ExtractorOutput;
  lane: "managed" | "local";
  ingestion: "keyframes_vtt" | "native";
  model: string;
  promptVersion: string;
  analyzedAt: string;
  // true when the extraction was truncation-salvaged (a valid prefix, run cut short) — a persisted,
  // honest partial, never presented as complete. Absent ⇒ a complete extraction.
  partial?: boolean;
}

export interface AnalyzedItem extends CapturedItem {
  analysis: Analysis;
}

// Result-object convention (matches the parent codebase) — engine functions never
// throw for expected failures. Invalid extractor output is `{ok:false, error:"schema_invalid"}`.
// `partial:true` marks a truncation-salvaged extraction (finishReason MAX_TOKENS / unterminated JSON):
// the valid prefix was recovered and gated, but the run did not finish — persisted as partial, never
// presented as complete (honest incompleteness). Absent/false ⇒ a complete extraction.
export type ExtractorResult =
  | { ok: true; output: ExtractorOutput; partial?: boolean }
  | { ok: false; error: string };

// Cross-item mention index entry (replaces the old EntityIndexEntry).
export interface MentionIndexEntry {
  key: string; // `${type}:${normalizedSurface}`
  type: NamedEntityType;
  surface: string; // chosen display surface
  itemIds: string[]; // first-seen order, deduped
}
