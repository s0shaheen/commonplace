// The PURE ranked query over a SearchIndex. Deterministic → fully unit-tested.
//
// Tokenize + normalize the query the SAME way the index was built (shared `tokenize`), match each
// query token across fields by PREFIX + SUBSTRING (a query token matches an index token that
// contains it), and rank by a field-weighted score. Multi-token queries are AND: every token must
// match somewhere. An empty query returns the recent items (newest first) — the honest default so
// the library never opens blank; a query that matches nothing returns [] (never a fabricated hit).

import {
  FIELDS_BY_WEIGHT,
  FIELD_WEIGHTS,
  tokenize,
  type SearchField,
  type SearchIndex,
} from "./index.js";

export interface SearchResult {
  id: string;
  /** Which layers matched, strongest first — for snippet highlighting + provenance ("why it surfaced"). */
  matchedFields: SearchField[];
  /** The field-weighted relevance score (higher = better). 0 for the empty-query recent list. */
  score: number;
}

// A partial (prefix/substring) match earns a fraction of the field weight, so an exact hit outranks
// an incidental substring hit — but the field-weight gaps still dominate (a partial entity match at
// 5×0.5 = 2.5 still beats an exact transcript match at 2×1). Tunable, deliberately simple.
const PARTIAL = 0.5;

interface Accum {
  best: number; // best single-field weight this token earned on this item
  density: number; // total occurrences (for the density tiebreak)
  fields: Set<SearchField>;
}

/** Rank items in `index` by relevance to `q`. See module header for the scoring model. */
export function query(index: SearchIndex, q: string): SearchResult[] {
  const tokens = tokenize(q);

  // Empty (or punctuation-only) query → recent items, newest first. Honest non-blank default.
  if (tokens.length === 0) {
    return [...index.items.values()]
      .sort((a, b) => b.recency - a.recency || a.order - b.order)
      .map((m) => ({ id: m.id, matchedFields: [], score: 0 }));
  }

  // Per query token, the per-item match: best field weight earned, total density, and the set of
  // fields that matched. Prefix+substring is `indexToken.includes(queryToken)`.
  const perToken: Map<string, Accum>[] = tokens.map((t) => {
    const m = new Map<string, Accum>();
    for (const [vocab, postings] of index.postings) {
      if (!vocab.includes(t)) continue;
      const quality = vocab === t ? 1 : PARTIAL;
      for (const p of postings) {
        const weight = FIELD_WEIGHTS[p.field] * quality;
        let e = m.get(p.id);
        if (!e) {
          e = { best: 0, density: 0, fields: new Set() };
          m.set(p.id, e);
        }
        if (weight > e.best) e.best = weight;
        e.density += p.count;
        e.fields.add(p.field);
      }
    }
    return m;
  });

  // AND across tokens: keep only ids that matched EVERY token (intersect the smallest map first).
  const smallest = perToken.reduce((a, b) => (a.size <= b.size ? a : b));
  const candidates: string[] = [];
  for (const id of smallest.keys()) {
    if (perToken.every((m) => m.has(id))) candidates.push(id);
  }

  // Aggregate: score = Σ per-token best-field weight (each token contributes its single strongest
  // field, so a transcript stuffed with the term can't out-stack a real entity hit); density = Σ
  // occurrences across all matched tokens.
  const scored = candidates.map((id) => {
    let score = 0;
    let density = 0;
    const fields = new Set<SearchField>();
    for (const m of perToken) {
      const e = m.get(id)!;
      score += e.best;
      density += e.density;
      for (const f of e.fields) fields.add(f);
    }
    const meta = index.items.get(id)!;
    return {
      id,
      score,
      density,
      recency: meta.recency,
      order: meta.order,
      matchedFields: FIELDS_BY_WEIGHT.filter((f) => fields.has(f)),
    };
  });

  // Rank lexicographically: score → density → recency → input order. Density can never cross a
  // score boundary, so the field-weight ordering (entity > caption > transcript) is a hard guarantee.
  scored.sort(
    (a, b) => b.score - a.score || b.density - a.density || b.recency - a.recency || a.order - b.order,
  );

  return scored.map(({ id, matchedFields, score }) => ({ id, matchedFields, score }));
}
