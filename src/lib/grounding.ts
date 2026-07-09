// Grounding module — resolve extracted entity MENTIONS to durable external IDs.
// Design (docs/research/2026-07-02-engine-groundup-analysis.md): the model emits typed mentions;
// this module does candidate-generation (KB search endpoints ARE the candidate generator,
// no local index) -> disambiguation (injected selector; an LLM "select" in production) ->
// confidence gate + NIL abstention + provenance. Model-agnostic. This is the moat.

import type { NamedEntityType } from "./types.js";

// SPEC §14: TMDB's API is never called (screen_work grounds to a Wikidata QID that
// carries TMDB/IMDb/Letterboxd IDs as link-out properties), so `tmdb` is not a KB source.
export type KbSource = "musicbrainz" | "wikidata" | "places";

export interface Mention {
  surface: string;
  type: NamedEntityType;
  /** Disambiguation context, e.g. { artist: "berlioz" } or { year: "2024" }. */
  hints?: Record<string, string>;
}

export interface Candidate {
  id: string; // durable external ID (MBID / QID / place_id)
  source: KbSource;
  name: string;
  score?: number; // KB-provided match score, if any
  meta?: Record<string, unknown>;
}

export interface GroundedEntity {
  mention: Mention;
  resolved: boolean; // false = NIL abstention (a confidently-wrong ID is worse than none)
  id: string | null;
  source: KbSource | null;
  name: string | null;
  confidence: number; // 0..1; recorded even when we abstain, for calibration (ECE)
  provenance: {
    source: KbSource | null;
    query: string;
    candidateCount: number;
    selectedIndex: number | null; // null = abstained
  };
}

/** Candidate generation for one KB. `handles` routes a mention type to the right KB. */
export interface KbResolver {
  source: KbSource;
  handles(type: NamedEntityType): boolean;
  search(mention: Mention): Promise<Candidate[]>;
}

/** Disambiguation: pick a candidate + confidence, or null to abstain. LLM "select" in prod. */
export type Selector = (
  mention: Mention,
  candidates: Candidate[],
) => Promise<{ index: number; confidence: number } | null>;

export interface GroundingDeps {
  resolvers: KbResolver[];
  select: Selector;
  minConfidence?: number; // confidence gate; below this we abstain
}

const DEFAULT_MIN_CONFIDENCE = 0.5;

function abstain(
  mention: Mention,
  source: KbSource | null,
  candidateCount: number,
  confidence = 0,
): GroundedEntity {
  return {
    mention,
    resolved: false,
    id: null,
    source: null,
    name: null,
    confidence,
    provenance: { source, query: mention.surface, candidateCount, selectedIndex: null },
  };
}

export async function groundMention(mention: Mention, deps: GroundingDeps): Promise<GroundedEntity> {
  const minConfidence = deps.minConfidence ?? DEFAULT_MIN_CONFIDENCE;

  const resolver = deps.resolvers.find((r) => r.handles(mention.type));
  if (!resolver) return abstain(mention, null, 0);

  const candidates = await resolver.search(mention);
  if (candidates.length === 0) return abstain(mention, resolver.source, 0);

  const choice = await deps.select(mention, candidates);
  if (!choice) return abstain(mention, resolver.source, candidates.length);

  const picked = candidates[choice.index];
  if (!picked || choice.confidence < minConfidence) {
    return abstain(mention, resolver.source, candidates.length, choice.confidence);
  }

  return {
    mention,
    resolved: true,
    id: picked.id,
    source: picked.source,
    name: picked.name,
    confidence: choice.confidence,
    provenance: {
      source: resolver.source,
      query: mention.surface,
      candidateCount: candidates.length,
      selectedIndex: choice.index,
    },
  };
}
