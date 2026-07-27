// The PURE search index — an in-memory inverted index over each item's weighted text layers.
//
// v1 is LOCAL tokenized retrieval, NOT vectors (design.md): understanding happens at analysis +
// MCP time; search itself is fast retrieval over the produced text. No embedding model, no vector
// store, no new dependency — just a token → postings map the popup's library surface queries on
// every keystroke.
//
// The five weighted layers (highest weight first): resolved entity/referent names, caption (`desc`),
// on-screen text, transcript, then hashtags + author. Entity names are the moat surface ("that
// restaurant", "that song"); transcript is the ~51% "dark matter" a title/tag search misses.

import type { Analysis, CapturedItem, EvidenceOut } from "../types.js";

// A library row reduced to what search needs: a captured item, optionally analyzed. `AnalyzedItem`
// (CapturedItem + a REQUIRED analysis) is assignable to this; a raw, not-yet-analyzed item is too.
export type IndexableItem = CapturedItem & { analysis?: Analysis };

// The weighted text layers, and the field key each token is filed under.
export type SearchField = "entity" | "caption" | "onscreen" | "transcript" | "hashtag" | "author";

// Field weights, highest first (design.md §Fields + ranking). An entity-name hit outranks a caption
// hit outranks a transcript hit. The gaps are wide enough that a partial (substring) match on a
// higher field still beats an exact match on a lower one at query time.
export const FIELD_WEIGHTS: Record<SearchField, number> = {
  entity: 5,
  caption: 4,
  onscreen: 3,
  transcript: 2,
  hashtag: 1.5,
  author: 1,
};

// Fields ordered strongest-first — used to present provenance ("which field matched") most-salient
// layer first.
export const FIELDS_BY_WEIGHT: SearchField[] = (Object.keys(FIELD_WEIGHTS) as SearchField[]).sort(
  (a, b) => FIELD_WEIGHTS[b] - FIELD_WEIGHTS[a],
);

/** One occurrence bucket: this token appears `count` times in `field` of item `id`. */
export interface Posting {
  id: string;
  field: SearchField;
  count: number;
}

/** Per-item metadata search needs: a recency key (for tiebreak / recent) and the input order. */
export interface IndexedItem {
  id: string;
  recency: number; // ms epoch; higher = more recent. Missing recency → -Infinity (sorts last).
  order: number; // input order — stable final tiebreak.
}

export interface SearchIndex {
  /** token → every posting for it, across items and fields. Insertion order is deterministic. */
  postings: Map<string, Posting[]>;
  /** id → recency/order metadata. Iteration order is the input order. */
  items: Map<string, IndexedItem>;
}

// ── Tokenization / normalization ───────────────────────────────────────────────────────────────
// Mirrors the eval matcher's normalization discipline (eval/.../normalize.py), adapted to free text:
// NFKC → casefold → drop intra-word apostrophes ("Joe's" → "joes") → every other non-letter/-digit
// char becomes a break → split on whitespace. Unicode-aware (\p{L}, \p{N}) so other-language content
// — a real chunk of the "dark matter" — tokenizes, not just ASCII. Deliberately NO article-stripping:
// the index and the query share this exact function, so "the office" matches "the office".
const INTRAWORD_APOSTROPHE = /(?<=\p{L})['’](?=\p{L})/gu;
const NON_WORD = /[^\p{L}\p{N}]+/gu;

export function tokenize(text: string | null | undefined): string[] {
  if (!text) return [];
  return text
    .normalize("NFKC")
    .toLowerCase()
    .replace(INTRAWORD_APOSTROPHE, "")
    .replace(NON_WORD, " ")
    .split(/\s+/u)
    .filter(Boolean);
}

// ── Text-layer extraction ────────────────────────────────────────────────────────────────────
// Gather every evidence quote across all extractions, bucketed by channel — VERBAL_AUDIO is the
// transcript, VISUAL_TEXT is the on-screen text. These are the raw text spans the model quoted.
function collectQuotes(analysis: Analysis | undefined): { transcript: string[]; onscreen: string[] } {
  const transcript: string[] = [];
  const onscreen: string[] = [];
  const out = analysis?.output;
  if (!out) return { transcript, onscreen };
  const push = (ev: EvidenceOut) => {
    if (!ev.quote) return;
    if (ev.channel === "VERBAL_AUDIO") transcript.push(ev.quote);
    else if (ev.channel === "VISUAL_TEXT") onscreen.push(ev.quote);
  };
  for (const m of out.mentions) m.evidence.forEach(push);
  for (const c of out.concepts) c.evidence.forEach(push);
  for (const c of out.claims) c.evidence.forEach(push);
  for (const s of out.structured) s.evidence.forEach(push);
  for (const f of out.facets) f.evidence.forEach(push);
  return { transcript, onscreen };
}

// The resolved entity/referent names of an item: each mention surface plus its aliases. This mirrors
// the cross-item MentionIndexEntry surface (buildMentionIndex), derived per-item straight off the
// analysis so buildIndex needs only the items themselves.
function entityNames(analysis: Analysis | undefined): string[] {
  const names: string[] = [];
  for (const m of analysis?.output?.mentions ?? []) {
    names.push(m.surface);
    for (const a of m.aliases ?? []) names.push(a);
  }
  return names;
}

/**
 * The weighted text layers of one item, keyed by field. The single source of truth for WHAT gets
 * indexed — buildIndex files each layer's tokens, and the library surface reuses it to pull the
 * matched-field snippet (so a result can show WHY it surfaced, e.g. the transcript line that hit).
 */
export function layerTexts(item: IndexableItem): Record<SearchField, string[]> {
  const analysis = item.analysis;
  const { transcript, onscreen } = collectQuotes(analysis);
  return {
    entity: entityNames(analysis),
    caption: [item.desc],
    onscreen,
    transcript,
    hashtag: item.hashtags,
    author: [item.author ?? "", item.authorName ?? ""],
  };
}

function recencyOf(item: CapturedItem): number {
  if (item.savedAt) {
    const t = Date.parse(item.savedAt);
    if (!Number.isNaN(t)) return t;
  }
  if (item.createTime !== null) return item.createTime * 1000;
  return -Infinity;
}

// ── Index build ────────────────────────────────────────────────────────────────────────────────

/** Build the in-memory inverted index over every item's weighted text layers. Pure + deterministic. */
export function buildIndex(items: IndexableItem[]): SearchIndex {
  const postings = new Map<string, Posting[]>();
  const meta = new Map<string, IndexedItem>();

  const add = (id: string, field: SearchField, texts: string[]): void => {
    // Count occurrences of each token WITHIN this field for this item, so density is honest.
    const counts = new Map<string, number>();
    for (const text of texts) {
      for (const tok of tokenize(text)) counts.set(tok, (counts.get(tok) ?? 0) + 1);
    }
    for (const [tok, count] of counts) {
      let list = postings.get(tok);
      if (!list) {
        list = [];
        postings.set(tok, list);
      }
      list.push({ id, field, count });
    }
  };

  items.forEach((item, order) => {
    const texts = layerTexts(item);
    for (const field of FIELDS_BY_WEIGHT) add(item.id, field, texts[field]);
    meta.set(item.id, { id: item.id, recency: recencyOf(item), order });
  });

  return { postings, items: meta };
}
