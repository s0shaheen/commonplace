// Pure importer for Instagram's official "Download Your Data" (DYD) saved-posts export — the
// cross-platform sibling of dydImport.ts (the TikTok DYD lane). JSON in, normalized CapturedItem[] out.
// No scraping, no scroll, no bot risk: the user requests their data from Instagram, and drops the
// export (raw .zip, or the extracted saved_posts.json) into the options page. These items land in the
// SAME IndexedDB store as scraped/TikTok ones and flow through the SAME analysis/grounding pipeline
// (they're CapturedItems). No engine changes.
//
// Unlike TikTok's export (which carries NO content — just links + dates), Instagram's saved export is
// content-rich: URL, Caption, Title, Hashtags, and Owner per post. So imported IG items are
// text-searchable IMMEDIATELY, before any enrichment.
//
// ── IG saved_posts.json SHAPE (structure-faithful reference: fixtures/ig-saved-sample.json) ──
//
// your_instagram_activity/saved/saved_posts.json:
//   { "saved_posts": [ { "timestamp": <epoch seconds>, "label_values": [ {label,value,href,dict}, … ] }, … ] }
// Older/alternate vintages nest the list under `saved_saved_media`, or the root IS the array — read
// defensively (first-present array wins), mirroring dydImport's multi-layout discipline.
//
// Each entry's `label_values[]` is read BY `label`:
//   URL      → the permalink (also `href`)                e.g. https://www.instagram.com/reel/<code>/
//   Caption  → the item description (desc)
//   Title    → an optional short title (may be empty)
//   Hashtags → a space-separated "#a #b #c" string → hashtags[]
//   Owner    → a NESTED dict tree whose leaf {label:"Username", value} is the author handle
// The entry's `timestamp` (epoch SECONDS, unlike TikTok's date string) → savedAt.
//
// saved_collections.json (optional): each entry has a "Name" label + a "Posts" sub-tree of post URLs.
// We map post-URL → collection-name(s) and attach membership to the matching item (by shortcode).
//
// PURITY (invariant §5.1): no Date.now/Math.random/DOM/console — deterministic over inputs. Skip counts
// are RETURNED, never logged; the options-page glue owns logging + UI. Dedup by id, union sources +
// collections, earliest savedAt wins — the same discipline as dydImport.ingestList.

import type { CapturedItem } from "../types.js";

export interface IgParseResult {
  items: CapturedItem[];
  /** Entries found under saved_posts (before shortcode-parse skipping). */
  savedSeen: number;
  /** Entries dropped because no shortcode could be parsed from their URL. */
  skipped: number;
}

// ── Defensive readers (mirrors dydImport) ─────────────────────────────────────────────────────────

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

// Container paths to the saved-posts list, across export vintages (first that resolves to an array wins).
const SAVED_POSTS_PATHS = [["saved_posts"], ["saved_saved_media"]] as const;

/** The saved-posts array: a named container key, or the root itself when it IS the list. */
function savedPostsArray(root: unknown): unknown[] {
  if (Array.isArray(root)) return root;
  for (const path of SAVED_POSTS_PATHS) {
    const node = dig(root, path);
    if (Array.isArray(node)) return node;
  }
  return [];
}

/** The `label_values` array of an entry, or [] if absent/malformed. */
function labelValues(entry: Record<string, unknown>): Record<string, unknown>[] {
  const lv = entry["label_values"];
  return Array.isArray(lv) ? lv.filter(isObj) : [];
}

/** First `label_values[]` whose `label` matches; its trimmed string `value`, else null. */
function readLabel(lvs: Record<string, unknown>[], label: string): string | null {
  for (const lv of lvs) {
    if (lv["label"] === label) {
      const v = lv["value"];
      if (typeof v === "string" && v.trim() !== "") return v.trim();
    }
  }
  return null;
}

/** The permalink for an entry: the URL label's `value`, falling back to its `href`. */
function readUrl(lvs: Record<string, unknown>[]): string | null {
  for (const lv of lvs) {
    if (lv["label"] === "URL") {
      const v = lv["value"];
      if (typeof v === "string" && v.trim() !== "") return v.trim();
      const h = lv["href"];
      if (typeof h === "string" && h.trim() !== "") return h.trim();
    }
  }
  return null;
}

/**
 * Recursively search a label_value node's nested `dict` tree for the first `{label:target, value}`
 * leaf and return its value. Instagram nests the owner as Owner→dict[]→(Profile)→dict[]→Username, so
 * a flat read misses it; this walks any depth. Pure, bounded by the tree the export supplied.
 */
function findNestedValue(node: unknown, target: string): string | null {
  if (Array.isArray(node)) {
    for (const child of node) {
      const r = findNestedValue(child, target);
      if (r !== null) return r;
    }
    return null;
  }
  if (isObj(node)) {
    if (node["label"] === target && typeof node["value"] === "string" && node["value"].trim() !== "") {
      return (node["value"] as string).trim();
    }
    const nested = node["dict"];
    if (Array.isArray(nested)) return findNestedValue(nested, target);
  }
  return null;
}

// ── URL / id / hashtag / timestamp normalization ────────────────────────────────────────────────

/**
 * Extract the base64url shortcode from an Instagram permalink — `/reel/<code>/`, `/reels/<code>/`,
 * `/p/<code>/`, or `/tv/<code>/`. Shortcodes are `[A-Za-z0-9_-]+`. Returns null for a URL with no
 * post shortcode (e.g. a bare profile or /explore/ link) so the entry is skipped honestly.
 */
function parseShortcode(url: string): string | null {
  const m = url.match(/\/(?:reels?|p|tv)\/([A-Za-z0-9_-]+)/);
  return m?.[1] ?? null;
}

/** "#pasta #weeknightdinner" → ["pasta","weeknightdinner"]. Splits on whitespace, strips a leading #. */
function parseHashtags(raw: string | null): string[] {
  if (!raw) return [];
  return raw
    .split(/\s+/)
    .map((t) => t.replace(/^#/, "").trim())
    .filter((t) => t !== "");
}

/**
 * IG's `timestamp` is epoch SECONDS (unlike TikTok's date string). Normalize to an ISO-8601 UTC string.
 * A non-finite / non-positive value yields undefined (savedAt stays unset rather than a bogus 1970).
 */
function normalizeSavedAt(timestamp: unknown): string | undefined {
  if (typeof timestamp !== "number" || !Number.isFinite(timestamp) || timestamp <= 0) return undefined;
  return new Date(timestamp * 1000).toISOString();
}

/** Build a fully-shaped CapturedItem from an IG saved-post. Media/stat fields null (enrichment fills). */
function toCapturedItem(
  id: string,
  permalink: string,
  lvs: Record<string, unknown>[],
  savedAt: string | undefined,
  collections: string[] | undefined,
): CapturedItem {
  const caption = readLabel(lvs, "Caption");
  const owner = findNestedValue(lvs.find((lv) => lv["label"] === "Owner") ?? null, "Username");
  const hashtags = parseHashtags(readLabel(lvs, "Hashtags"));
  return {
    id,
    platform: "instagram",
    sources: ["saved"],
    desc: caption ?? "",
    createTime: null,
    author: owner,
    authorName: null,
    url: permalink, // the permalink IS the join key for later capture/enrichment
    playUrl: null,
    downloadUrl: null,
    cover: null,
    durationSec: null,
    hasSubtitles: false,
    subtitleUrl: null,
    isSlideshow: false,
    music: null,
    hashtags,
    stats: { plays: null, likes: null, comments: null, shares: null, collects: null },
    ...(savedAt ? { savedAt } : {}),
    ...(collections && collections.length ? { collections } : {}),
  };
}

// ── Collections ─────────────────────────────────────────────────────────────────────────────────

/**
 * Build a shortcode → collection-name[] map from `saved_collections`. Each collection entry carries a
 * "Name" label and a "Posts" sub-tree; every post URL under it maps its shortcode to that collection
 * name. A post in multiple collections accumulates all names.
 */
function buildCollectionMap(collectionsJson: unknown): Map<string, string[]> {
  const byShortcode = new Map<string, string[]>();
  const list = (() => {
    if (Array.isArray(collectionsJson)) return collectionsJson;
    const node = dig(collectionsJson, ["saved_collections"]);
    return Array.isArray(node) ? node : [];
  })();
  for (const entry of list) {
    if (!isObj(entry)) continue;
    const lvs = labelValues(entry);
    const name = readLabel(lvs, "Name");
    if (!name) continue;
    // Collect every URL anywhere in the entry's nested tree, then map each shortcode to this name.
    for (const url of collectUrls(entry)) {
      const code = parseShortcode(url);
      if (!code) continue;
      const prev = byShortcode.get(code) ?? [];
      if (!prev.includes(name)) prev.push(name);
      byShortcode.set(code, prev);
    }
  }
  return byShortcode;
}

/** Recursively collect every `{label:"URL", value}` string in a node's nested dict tree. */
function collectUrls(node: unknown, out: string[] = []): string[] {
  if (Array.isArray(node)) {
    for (const child of node) collectUrls(child, out);
    return out;
  }
  if (isObj(node)) {
    if (node["label"] === "URL" && typeof node["value"] === "string" && node["value"].trim() !== "") {
      out.push((node["value"] as string).trim());
    }
    for (const key of ["dict", "label_values"]) {
      if (Array.isArray(node[key])) collectUrls(node[key], out);
    }
  }
  return out;
}

// ── Parse ──────────────────────────────────────────────────────────────────────────────────────

/**
 * Parse Instagram's saved-posts export into normalized CapturedItems (PURE — counts returned, nothing
 * logged). Optionally attaches collection membership from `saved_collections` (pass the collections
 * JSON, or the same root object that carries both). Dedup is by shortcode id: a repeated post UNIONs
 * its sources + collections and keeps the EARLIEST savedAt — the same discipline as dydImport.
 */
export function parseInstagramSaved(savedPostsJson: unknown, collectionsJson?: unknown): IgParseResult {
  const list = savedPostsArray(savedPostsJson);
  const collectionMap = collectionsJson !== undefined ? buildCollectionMap(collectionsJson) : new Map<string, string[]>();
  const byId = new Map<string, CapturedItem>();
  let skipped = 0;

  for (const entry of list) {
    if (!isObj(entry)) {
      skipped++;
      continue;
    }
    const lvs = labelValues(entry);
    const permalink = readUrl(lvs);
    const id = permalink ? parseShortcode(permalink) : null;
    if (!permalink || !id) {
      skipped++;
      continue;
    }
    const savedAt = normalizeSavedAt(entry["timestamp"]);
    const collections = collectionMap.get(id);
    const item = toCapturedItem(id, permalink, lvs, savedAt, collections);
    const prev = byId.get(id);
    if (prev) {
      // Same post seen twice: UNION sources + collections, keep the EARLIEST savedAt (first save).
      const sources = [...new Set([...prev.sources, ...item.sources])];
      const mergedCollections = [...new Set([...(prev.collections ?? []), ...(item.collections ?? [])])];
      const earliestSavedAt =
        prev.savedAt && item.savedAt ? (prev.savedAt <= item.savedAt ? prev.savedAt : item.savedAt) : (prev.savedAt ?? item.savedAt);
      byId.set(id, {
        ...prev,
        sources,
        ...(earliestSavedAt ? { savedAt: earliestSavedAt } : {}),
        ...(mergedCollections.length ? { collections: mergedCollections } : {}),
      });
    } else {
      byId.set(id, item);
    }
  }

  return { items: [...byId.values()], savedSeen: list.length, skipped };
}
