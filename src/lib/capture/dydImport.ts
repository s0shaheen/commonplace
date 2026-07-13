// Pure importer for TikTok's official "Download your data" (DYD) export — the SECOND capture lane,
// alongside (NOT a fallback to) the live trusted-scroll lane. JSON in, normalized CapturedItem[] out.
// No scraping, no scroll, no bot risk: the user requests JSON from TikTok, extracts user_data.json,
// and drops it into the options page. These items land in the SAME IndexedDB store as scraped ones
// and flow through the SAME analysis/grounding pipeline (they're CapturedItems). No engine changes.
//
// ── CONFIRMED DYD JSON SCHEMA (verified 2026-07, VALIDATION-PENDING against a real founder export) ──
//
// TikTok's JSON export (Settings → Account → Download your data → JSON) is a ZIP whose root is
// `user_data.json` (older) or `user_data_tiktok.json` (newer). This module parses the DECOMPRESSED
// JSON object (we deliberately add NO zip dependency — see the task's dep-minimalism constraint; the
// options-page glue accepts the extracted .json). Liked and favorited videos live at:
//
//   LIKES  (videos the user tapped ♥):
//     Activity → "Like List" → "ItemFavoriteList"  → [ { "Date", "Link" }, … ]
//   FAVORITES (videos the user bookmarked / added to Favorites):
//     Activity → "Favorite Videos" → "FavoriteVideoList" → [ { "Date", "Link" }, … ]
//
// TikTok has shipped THREE container layouts over time; TikTok also renamed sections when it moved
// from .txt to .json, so we try every known nesting (first-present wins). Confirmed against real
// parsers that handle multiple export vintages:
//   (1) Activity → "Like List"/"Favorite Videos"                          (common)
//   (2) Activity → "Your Activity" → "Like List"/"Favorite Videos"        (newer nesting)
//   (3) "Likes and Favorites" → "Like List"/"Favorite Videos"            (newest top-level split)
//   (4) root IS the Activity node (a passed-in sub-tree) — defensive.
// The list keys are stable: "ItemFavoriteList" (likes) and "FavoriteVideoList" (favorites).
//
// Per-entry fields carry a save timestamp and a video URL. Casing/naming VARIES across export
// vintages (one real parser reads lowercase `link` for Like List but `Link` for Favorites; another
// falls back across link/shareURL/videoURL), so both are read defensively across every plausible key.
//   Date:  "Date" (primary) | "date"                              e.g. "2025-01-01 12:34:56" (UTC)
//   Link:  "Link" (primary) | "link" | "VideoLink" | "videoLink" | "Url"/"url" | "shareURL"/"videoURL"
//          e.g. "https://www.tiktok.com/@username/video/1234567890"
//
// SOURCES (per real parser source, cross-checked):
//   • d3i-infra/dd-education   packages/python/port/platforms/tiktok.py  — the multi-layout paths + Date/Link
//   • CoreParadox/TikTok_Archive src/utils/data_parser.py               — list_key map + link/Link/shareURL/videoURL fallbacks
//   • Izaan17/TikTock          extractors.py                            — Favorite Videos→FavoriteVideoList→Link, Like List→ItemFavoriteList→link
//   • TikTok Data Portability API docs / TikTok help "Download your data"
//
// PURITY (invariant §5.1): no Date.now/Math.random/DOM/console here — every function is deterministic
// over its inputs. Skip counts are RETURNED (parseTikTokDydResult), never logged; the options-page
// glue owns the logging + UI. `parseTikTokDyd` is the thin `json → CapturedItem[]` façade.

import type { CapturedItem } from "../types.js";

/** Which saved-list an imported item came from — the `sources` tag, matching the live lane's tabs. */
export type DydSource = "favorites" | "likes";

export interface DydParseResult {
  items: CapturedItem[];
  /** Entries found under the Favorite Videos list (before URL-parse skipping). */
  favoritesSeen: number;
  /** Entries found under the Like List (before URL-parse skipping). */
  likesSeen: number;
  /** Entries dropped because no video/photo id could be parsed from their link. */
  skipped: number;
}

// ── Defensive readers ───────────────────────────────────────────────────────────────────────────

const LINK_KEYS = [
  "Link", "link",
  "VideoLink", "videoLink",
  "Url", "url", "URL",
  "shareURL", "ShareURL", "shareUrl",
  "videoURL", "VideoURL", "videoUrl",
] as const;

const DATE_KEYS = ["Date", "date", "DateTime", "date_time"] as const;

/** First-present-key wins; returns a trimmed string or null. Handles the casing drift across vintages. */
function readStr(entry: Record<string, unknown>, keys: readonly string[]): string | null {
  for (const k of keys) {
    const v = entry[k];
    if (typeof v === "string" && v.trim() !== "") return v.trim();
  }
  return null;
}

function isObj(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

/** Navigate a nested object by a path of keys; returns the node or undefined if any hop misses. */
function dig(root: unknown, path: readonly string[]): unknown {
  let node: unknown = root;
  for (const key of path) {
    if (!isObj(node)) return undefined;
    node = node[key];
  }
  return node;
}

/** First candidate path that resolves to an ARRAY wins (the DYD list). Empty otherwise. */
function firstArray(root: unknown, paths: readonly (readonly string[])[]): unknown[] {
  for (const path of paths) {
    const node = dig(root, path);
    if (Array.isArray(node)) return node;
  }
  return [];
}

// Every known container path to each list, across the export vintages documented above.
const FAVORITES_PATHS = [
  ["Activity", "Favorite Videos", "FavoriteVideoList"],
  ["Activity", "Your Activity", "Favorite Videos", "FavoriteVideoList"],
  ["Likes and Favorites", "Favorite Videos", "FavoriteVideoList"],
  ["Favorite Videos", "FavoriteVideoList"], // root IS the Activity node
] as const;

const LIKES_PATHS = [
  ["Activity", "Like List", "ItemFavoriteList"],
  ["Activity", "Your Activity", "Like List", "ItemFavoriteList"],
  ["Likes and Favorites", "Like List", "ItemFavoriteList"],
  ["Like List", "ItemFavoriteList"], // root IS the Activity node
] as const;

// ── URL / id / date normalization ─────────────────────────────────────────────────────────────────

/**
 * Extract the 19-digit numeric video id from a TikTok link. Canonical DYD links look like
 * `https://www.tiktok.com/@handle/video/1234567890`; photo/slideshow posts use `/photo/<id>`;
 * some vintages emit `https://www.tiktokv.com/share/video/<id>/`. We match the id after
 * video|photo|share/…, else fall back to the last long (>=10) digit run in the URL. Kept as a STRING
 * (19-digit ids overflow JS number precision — same discipline as capture.js's normalizeItem).
 */
function parseVideoId(link: string): string | null {
  const m = link.match(/\/(?:video|photo)\/(\d{6,})/) ?? link.match(/\/share\/(?:video|photo)\/(\d{6,})/);
  if (m?.[1]) return m[1];
  // Fallback: a trailing/standalone long digit run (defensive for share/shortened forms).
  const runs = link.match(/\d{10,}/g);
  return runs && runs.length ? runs[runs.length - 1]! : null;
}

/** Whether the link is a photo/slideshow post (vs a video) — sets isSlideshow honestly. */
function isPhotoLink(link: string): boolean {
  return /\/photo\/\d/.test(link);
}

/** Extract the author handle from `…/@handle/…` (letters, digits, `.`, `_`). Null if absent. */
function parseAuthor(link: string): string | null {
  const m = link.match(/\/@([A-Za-z0-9._]+)/);
  return m?.[1] ?? null;
}

/**
 * Normalize the DYD save-`Date` to an ISO-8601 string WITHOUT a timezone misparse. TikTok emits
 * `"YYYY-MM-DD HH:MM:SS"` in UTC; JS `new Date("YYYY-MM-DD HH:MM:SS")` parses that as LOCAL time
 * (a silent off-by-hours bug), so we convert by STRING SHAPE instead: space→`T`, append `Z`. An
 * already-ISO value is kept; an unrecognized value is preserved verbatim (never dropped).
 */
function normalizeSavedAt(date: string | null): string | undefined {
  if (!date) return undefined;
  const s = date.trim();
  if (/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}$/.test(s)) {
    return s.replace(" ", "T") + "Z";
  }
  return s; // already ISO (with offset), or an unknown shape — preserve as-is
}

/** Build a fully-shaped CapturedItem from a DYD entry. DYD carries only id/url/author/savedAt; every
 * media/stat field the live lane fills is null/empty here (defaults mirror capture.js's normalizeItem). */
function toCapturedItem(id: string, link: string, savedAt: string | undefined, source: DydSource): CapturedItem {
  const author = parseAuthor(link);
  const url = author ? `https://www.tiktok.com/@${author}/video/${id}` : link;
  return {
    id,
    sources: [source],
    desc: "",
    createTime: null,
    author,
    authorName: null,
    url,
    playUrl: null,
    downloadUrl: null,
    cover: null,
    durationSec: null,
    hasSubtitles: false,
    subtitleUrl: null,
    isSlideshow: isPhotoLink(link),
    music: null,
    hashtags: [],
    stats: { plays: null, likes: null, comments: null, shares: null, collects: null },
    ...(savedAt ? { savedAt } : {}),
  };
}

// ── Parse ───────────────────────────────────────────────────────────────────────────────────────

/**
 * Parse one DYD list into CapturedItems, tagging the source. Accumulates into `byId` so a video that
 * appears in BOTH lists (liked AND favorited) is deduped with its `sources` UNIONed — mirroring the
 * store's upsert + capture.js's mergeDedupe. Returns the count of entries dropped for an unparseable
 * link. Freshest scalar fields win on a same-id collision; earliest savedAt is kept (the first save).
 */
function ingestList(
  list: unknown[],
  source: DydSource,
  byId: Map<string, CapturedItem>,
): number {
  let skipped = 0;
  for (const entry of list) {
    if (!isObj(entry)) {
      skipped++;
      continue;
    }
    const link = readStr(entry, LINK_KEYS);
    const id = link ? parseVideoId(link) : null;
    if (!link || !id) {
      skipped++;
      continue;
    }
    const savedAt = normalizeSavedAt(readStr(entry, DATE_KEYS));
    const item = toCapturedItem(id, link, savedAt, source);
    const prev = byId.get(id);
    if (prev) {
      // Same video under both lists: UNION sources, keep a savedAt if either has one (prefer existing).
      const sources = [...new Set([...prev.sources, ...item.sources])];
      byId.set(id, { ...prev, sources, savedAt: prev.savedAt ?? item.savedAt });
    } else {
      byId.set(id, item);
    }
  }
  return skipped;
}

/**
 * Full DYD parse with provenance counts (PURE — counts returned, nothing logged). Reads Favorites
 * then Likes so a shared video's `sources` reads `["favorites","likes"]` (SOURCES order). The glue
 * (options.ts) surfaces `skipped`/`favoritesSeen`/`likesSeen` in the result line + console.
 */
export function parseTikTokDydResult(json: unknown): DydParseResult {
  const favList = firstArray(json, FAVORITES_PATHS);
  const likeList = firstArray(json, LIKES_PATHS);
  const byId = new Map<string, CapturedItem>();
  let skipped = 0;
  skipped += ingestList(favList, "favorites", byId);
  skipped += ingestList(likeList, "likes", byId);
  return {
    items: [...byId.values()],
    favoritesSeen: favList.length,
    likesSeen: likeList.length,
    skipped,
  };
}

/**
 * The required façade: TikTok DYD JSON → normalized CapturedItem[]. Pure. Entries with no parseable
 * video URL are skipped (see parseTikTokDydResult for the skip count the glue logs). Favorites and
 * likes are tagged via `sources` (["favorites"] / ["likes"]); a video in both is deduped + unioned.
 */
export function parseTikTokDyd(json: unknown): CapturedItem[] {
  return parseTikTokDydResult(json).items;
}
