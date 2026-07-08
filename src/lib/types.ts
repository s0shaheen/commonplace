// Shapes shared across the analysis engine. These mirror the FROZEN contract in
// `schema/json/extractor-output.schema.json` (v1.0.0-rc.6) EXACTLY — field names are
// the schema's, not new inventions. CapturedItem matches the spike's normalizeItem output.

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
  t_start?: number;
  t_end?: number;
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
}

export interface AnalyzedItem extends CapturedItem {
  analysis: Analysis;
}

// Result-object convention (matches the parent codebase) — engine functions never
// throw for expected failures. Invalid extractor output is `{ok:false, error:"schema_invalid"}`.
export type ExtractorResult =
  | { ok: true; output: ExtractorOutput }
  | { ok: false; error: string };

// Cross-item mention index entry (replaces the old EntityIndexEntry).
export interface MentionIndexEntry {
  key: string; // `${type}:${normalizedSurface}`
  type: NamedEntityType;
  surface: string; // chosen display surface
  itemIds: string[]; // first-seen order, deduped
}
