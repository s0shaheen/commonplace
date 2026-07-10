// Pure parser for a TikTok `item_list` response envelope. It reuses capture.js's normalizer for the
// items (NO fork — extractItems is the single source of truth for record shape) and adds the two
// paging signals the old scroller threw away: `hasMore` and `cursor`.
//
// No Date.now/Math.random/DOM reads here — this is a pure function over the response JSON, so the
// defensive coercion below is a deterministic unit test rather than a live-run gamble.

import { extractItems, type SpikeItem } from "../../capture.js";

/** A normalized item, identical to capture.js's `normalizeItem` output (we do NOT redefine it). */
export type RawItem = SpikeItem;

export interface ItemListEnvelope {
  items: RawItem[];
  /** Completion signal. `false` is the ONLY honest "no more pages"; see coerceHasMore for the default. */
  hasMore: boolean;
  cursor: string | null;
}

/**
 * Coerce TikTok's `hasMore` (shape UNVERIFIED in recon — recon/0.1-findings.md:8 copied only the
 * `itemList` subtree, so the on-wire encoding of hasMore/cursor is unconfirmed). TikTok's item_list
 * conventionally returns a top-level boolean or 0/1, but we treat that as a hypothesis and parse
 * every plausible encoding.
 *
 * DEFAULT-TO-TRUE ON A MISSING/UNKNOWN SIGNAL. This is the load-bearing decision of the whole task:
 * a false "done" is the founder's #1 complaint (§2.1 — "it won't be done scrolling … and ends up
 * saving/stopping"). If we cannot read the signal, the safe reading is "more may exist" — capture
 * keeps going, and the ONLY thing that ends it is either an explicit hasMore:false OR scrollState's
 * bounded-backoff `giveup` (a reported incomplete). A guessed `false` here would silently resurrect
 * the exact bug, so it is forbidden.
 */
export function coerceHasMore(v: unknown): boolean {
  if (v === true || v === 1 || v === "1" || v === "true") return true;
  if (v === false || v === 0 || v === "0" || v === "false") return false;
  return true; // absent / unrecognizable → more-may-exist (never false — that is the bug we kill)
}

function readCursor(obj: Record<string, unknown>): string | null {
  const c = obj["cursor"] ?? obj["maxCursor"] ?? obj["max_cursor"];
  if (c == null) return null;
  return String(c); // cursors, like ids, stay strings — never risk number-precision loss
}

export function parseItemListEnvelope(json: unknown, source: string | null = null): ItemListEnvelope {
  const obj = (json && typeof json === "object" ? json : {}) as Record<string, unknown>;
  return {
    items: extractItems(json, source),
    hasMore: coerceHasMore(obj["hasMore"]),
    cursor: readCursor(obj),
  };
}
