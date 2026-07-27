// The PURE monotonic merge (design.md → "Pure cores"). Enrichment fills only ABSENT fields and NEVER
// overwrites a present value with an absent one — the same freshness-guarded field-merge the store's
// upsert uses. So lanes compose safely: a poorer lane run after a richer one can only ADD, never erase,
// and re-running the same lane (a resumed job) is idempotent. Platform-agnostic (text-first).
//
// "Absent" per field: "" (or whitespace) for `desc`, `null` for the nullable scalars, `[]` for arrays,
// `null` for the `music` object; `stats` merges sub-field-wise (each null-filled). A filled `subtitleUrl`
// also flips `hasSubtitles` true. Identity/provenance (id, sources, platform, savedAt) is never touched.
//
// PURE: a deep-copied return, no clock/rng/IO — deterministic over its inputs.

import type { CapturedItem } from "../types.js";

/** Keep a present string; else take the incoming one if it has content; else keep (both absent). */
function fillStr(cur: string, next: string | undefined): string {
  if (cur.trim() !== "") return cur;
  return next != null && next.trim() !== "" ? next : cur;
}

/** Keep a present (non-null) value; else take the incoming one if present; else keep null. */
function fillNull<T>(cur: T | null, next: T | null | undefined): T | null {
  if (cur != null) return cur;
  return next != null ? next : cur;
}

/** Keep a non-empty array; else take a non-empty incoming one; else keep. */
function fillArr<T>(cur: T[], next: T[] | undefined): T[] {
  if (cur.length > 0) return cur;
  return next && next.length > 0 ? [...next] : cur;
}

type Stats = CapturedItem["stats"];

/** Merge stats sub-field-wise: each field filled only when currently absent (null). */
function mergeStats(cur: Stats, next: Partial<Stats> | undefined): Stats {
  const pick = (k: keyof Stats): number | null => fillNull(cur[k], next?.[k] ?? null);
  return {
    plays: pick("plays"),
    likes: pick("likes"),
    comments: pick("comments"),
    shares: pick("shares"),
    collects: pick("collects"),
  };
}

/**
 * Merge a lane's normalized partial into an item, monotonically. Returns a NEW item; the input is never
 * mutated. Present values win; absent values are backfilled from the partial.
 */
export function merge(item: CapturedItem, partial: Partial<CapturedItem>): CapturedItem {
  const subtitleUrl = fillNull(item.subtitleUrl, partial.subtitleUrl);
  const out: CapturedItem = {
    ...item,
    desc: fillStr(item.desc, partial.desc),
    createTime: fillNull(item.createTime, partial.createTime),
    author: fillNull(item.author, partial.author),
    authorName: fillNull(item.authorName, partial.authorName),
    url: fillNull(item.url, partial.url),
    playUrl: fillNull(item.playUrl, partial.playUrl),
    downloadUrl: fillNull(item.downloadUrl, partial.downloadUrl),
    cover: fillNull(item.cover, partial.cover),
    durationSec: fillNull(item.durationSec, partial.durationSec),
    subtitleUrl,
    // A subtitle URL (present either before or after the fill) means captions exist.
    hasSubtitles: item.hasSubtitles || subtitleUrl != null,
    music: fillNull(item.music, partial.music),
    hashtags: fillArr(item.hashtags, partial.hashtags),
    stats: mergeStats(item.stats, partial.stats),
  };
  return out;
}
