// Pure import-reconciliation reducer. A platform data-export ZIP is the completeness backstop: it lists
// EVERY saved item, including the tail the live scroller could not reach (the fake-done shortfall). This
// reducer reconciles a parsed export against the current library so the user can SEE what the ZIP
// recovered — and against the export's own declared index size, so the recovered gap is visible.
//
// PURE + honest (invariant): it reads only `.id` off each parsed item and a set of the library's
// existing ids. It NEVER claims more imported than were parsed — `added + merged === parsed`, and
// `parsed <= declaredInZip`. Glue owns the store write + the UI line; this owns the arithmetic.

import type { CapturedItem } from "../types.js";

export interface ImportReconciliation {
  /** Parsed items whose id is NOT already in the library — net-new (the recovered tail). */
  added: number;
  /** Parsed items whose id IS already in the library — the store will union/refresh them. */
  merged: number;
  /** How many items the library already held BEFORE this import (its prior size). */
  alreadyPresent: number;
  /** Unique parsed items (deduped by id) — what we actually import. `added + merged`. */
  parsed: number;
  /** The raw parsed-list length handed in — the export's declared index size (the fake-done ground truth). */
  declaredInZip: number;
}

/**
 * Reconcile a parsed export against the library. `parsedItems` is the list the parser produced (its
 * length is the export's declared index size); `existingIds` is the set of ids already in the store.
 */
export function reconcile(parsedItems: CapturedItem[], existingIds: Iterable<string>): ImportReconciliation {
  const declaredInZip = parsedItems.length;
  const existing = existingIds instanceof Set ? existingIds : new Set(existingIds);
  const uniqueIds = new Set(parsedItems.map((i) => i.id));

  let added = 0;
  for (const id of uniqueIds) if (!existing.has(id)) added++;
  const parsed = uniqueIds.size;
  const merged = parsed - added;

  return { added, merged, alreadyPresent: existing.size, parsed, declaredInZip };
}
