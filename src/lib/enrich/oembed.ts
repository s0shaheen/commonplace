// Tier-0 adapter: TikTok's OFFICIAL oEmbed endpoint (https://www.tiktok.com/oembed?url=…). The free
// default — no key, no third party, no cost. Turns a skeleton into a searchable, poster-having item:
// caption (the `title`, with hashtags parsed out of it), author name + handle, poster (`thumbnail_url`).
// It has no transcript and no stats, so it only ever fills those four aspects (see fixtures/tiktok-oembed-sample.json).
//
// `normalizeOembed` is PURE and TOTAL (payload → Partial<CapturedItem>): a malformed/empty payload
// yields an empty partial rather than throwing. The `fetchOembed` glue is thin — it builds the URL,
// calls an injected fetcher, and hands the JSON to the normalizer.

import type { CapturedItem } from "../types.js";
import type { EnrichResult } from "./types.js";
import { parseHashtags } from "./hashtags.js";

function str(v: unknown): string | null {
  return typeof v === "string" && v.trim() !== "" ? v : null;
}

/** Map the official oEmbed response to a partial. Absent/garbage fields are simply omitted. */
export function normalizeOembed(payload: unknown): Partial<CapturedItem> {
  if (!payload || typeof payload !== "object") return {};
  const p = payload as Record<string, unknown>;
  const out: Partial<CapturedItem> = {};
  const title = str(p["title"]);
  if (title) {
    out.desc = title;
    out.hashtags = parseHashtags(title);
  }
  const handle = str(p["author_unique_id"]);
  if (handle) out.author = handle;
  const name = str(p["author_name"]);
  if (name) out.authorName = name;
  const thumb = str(p["thumbnail_url"]);
  if (thumb) out.cover = thumb;
  return out;
}

/** Build the official oEmbed URL for a saved video permalink. */
export function oembedUrl(permalink: string): string {
  return `https://www.tiktok.com/oembed?url=${encodeURIComponent(permalink)}`;
}

export interface OembedDeps {
  /** Injected fetcher — resolves the oEmbed JSON, or throws/returns null on a transport failure. */
  fetchJson(url: string): Promise<unknown>;
}

/**
 * Thin lane glue: GET the official endpoint for the item's permalink and normalize it. A transport
 * throw (oEmbed 400s intermittently) or a payload with nothing usable is a clean typed failure — never
 * a throw out of this function.
 */
export async function fetchOembed(item: CapturedItem, deps: OembedDeps): Promise<EnrichResult> {
  if (!item.url) return { ok: false, error: "no_permalink" };
  try {
    const json = await deps.fetchJson(oembedUrl(item.url));
    const value = normalizeOembed(json);
    if (Object.keys(value).length === 0) return { ok: false, error: "oembed_empty" };
    return { ok: true, value };
  } catch (e) {
    return { ok: false, error: (e as Error)?.message ?? "oembed_error" };
  }
}
