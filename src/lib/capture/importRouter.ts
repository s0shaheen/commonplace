// Pure import router — the front-door decision the ZIP lane needs: given a decompressed export (its
// entry paths + a reader that yields the parsed JSON for a path) OR a bare extracted .json, decide the
// platform and run the matching parser. PURE given a pure reader; the unzip + byte-decode + JSON.parse
// glue lives in options.ts. This is where a TikTok `user_data*.json` and an Instagram
// `.../saved/saved_posts.json` fork to their respective parsers.

import { parseTikTokDydResult } from "./dydImport.js";
import { parseInstagramSaved } from "./igImport.js";
import type { CapturedItem } from "../types.js";

export interface RoutedImport {
  platform: "tiktok" | "instagram";
  items: CapturedItem[];
  /** The export's declared index size — raw entries seen before dedup/skip (the fake-done ground truth). */
  declared: number;
  /** Entries dropped for an unparseable link/URL. */
  skipped: number;
}

// Entry-path matchers. Anchored to a path segment so `user_data.json` matches whether at the zip root
// or nested under a folder, but a stray `my_user_data.json` does not.
const TIKTOK_ENTRY = /(?:^|\/)user_data(?:_tiktok)?\.json$/i;
const IG_SAVED_POSTS = /(?:^|\/)saved_posts\.json$/i;
const IG_SAVED_COLLECTIONS = /(?:^|\/)saved_collections\.json$/i;

function isObj(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

const tiktokRoute = (json: unknown): RoutedImport => {
  const r = parseTikTokDydResult(json);
  return { platform: "tiktok", items: r.items, declared: r.favoritesSeen + r.likesSeen, skipped: r.skipped };
};

const instagramRoute = (postsJson: unknown, collectionsJson: unknown): RoutedImport => {
  const r = parseInstagramSaved(postsJson, collectionsJson);
  return { platform: "instagram", items: r.items, declared: r.savedSeen, skipped: r.skipped };
};

/**
 * Route a decompressed export by entry path. `paths` is every entry in the zip; `readJson(path)`
 * returns the PARSED JSON for a path (the glue decodes bytes + JSON.parses). TikTok's `user_data*.json`
 * wins first; otherwise Instagram's `.../saved/saved_posts.json` (with an optional `saved_collections.json`
 * sibling). Returns null when no recognized entry is present.
 */
export function routeZipImport(paths: string[], readJson: (path: string) => unknown): RoutedImport | null {
  const tiktokPath = paths.find((p) => TIKTOK_ENTRY.test(p));
  if (tiktokPath) return tiktokRoute(readJson(tiktokPath));

  const postsPath = paths.find((p) => IG_SAVED_POSTS.test(p));
  if (postsPath) {
    const collPath = paths.find((p) => IG_SAVED_COLLECTIONS.test(p));
    return instagramRoute(readJson(postsPath), collPath ? readJson(collPath) : undefined);
  }
  return null;
}

/** Whether a bare (already-parsed) JSON looks like an Instagram saved export vs a TikTok DYD export. */
function looksLikeInstagram(json: unknown): boolean {
  if (Array.isArray(json)) return isObj(json[0]) && Array.isArray((json[0] as Record<string, unknown>)["label_values"]);
  if (isObj(json)) return Array.isArray(json["saved_posts"]) || Array.isArray(json["saved_saved_media"]);
  return false;
}

/**
 * Route a bare extracted `.json` (already JSON.parsed) by SHAPE. Instagram is detected by its
 * distinctive `saved_posts`/`label_values` structure; everything else falls back to the TikTok DYD
 * parser — preserving the pre-existing extracted-`user_data.json` path exactly (including the
 * zero-items case, which the glue surfaces with the favorites/likes-seen counts).
 */
export function routeBareJson(json: unknown): RoutedImport {
  return looksLikeInstagram(json) ? instagramRoute(json, json) : tiktokRoute(json);
}
