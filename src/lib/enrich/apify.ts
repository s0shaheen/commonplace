// Tier-2 BACKUP paid adapter: an Apify TikTok actor, used ONLY on tikwm error/quota failover. Same
// target fields as tikwm. Third-party and opt-in; the token comes from config (never source). We call
// Apify's REST API directly with `fetch` (run-sync-get-dataset-items) — NO apify-client dependency.
//
// `normalizeApify` is PURE + TOTAL (a dataset item, or a single-element dataset array, → a partial); a
// malformed/empty payload yields {}. See fixtures/apify-tiktok-sample.json (representative-from-docs).

import type { CapturedItem } from "../types.js";
import type { EnrichResult } from "./types.js";
import { parseHashtags } from "./hashtags.js";

function str(v: unknown): string | null {
  return typeof v === "string" && v.trim() !== "" ? v : null;
}
function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}
function isObj(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

/** Pick the English subtitle track's download link from `videoMeta.subtitleLinks`, else any first one. */
function pickSubtitle(videoMeta: Record<string, unknown>): string | null {
  const links = videoMeta["subtitleLinks"];
  if (!Array.isArray(links) || links.length === 0) return null;
  const eng = links.find((l) => isObj(l) && typeof l["language"] === "string" && /^en|eng/i.test(l["language"]));
  const chosen = (eng ?? links[0]) as Record<string, unknown>;
  return str(chosen["downloadLink"]);
}

/** Map an Apify TikTok actor dataset item (or a single-element dataset array) to a partial. */
export function normalizeApify(payload: unknown): Partial<CapturedItem> {
  const item = Array.isArray(payload) ? payload[0] : payload;
  if (!isObj(item)) return {};
  const out: Partial<CapturedItem> = {};

  const text = str(item["text"]);
  if (text) {
    out.desc = text;
    out.hashtags = parseHashtags(text);
  }
  const authorMeta = isObj(item["authorMeta"]) ? (item["authorMeta"] as Record<string, unknown>) : null;
  if (authorMeta) {
    const handle = str(authorMeta["name"]);
    if (handle) out.author = handle;
    const nick = str(authorMeta["nickName"]);
    if (nick) out.authorName = nick;
  }
  const music = isObj(item["musicMeta"]) ? (item["musicMeta"] as Record<string, unknown>) : null;
  if (music) out.music = { name: str(music["musicName"]), author: str(music["musicAuthor"]) };

  const play = str(item["videoUrl"]);
  if (play) out.playUrl = play;

  const videoMeta = isObj(item["videoMeta"]) ? (item["videoMeta"] as Record<string, unknown>) : null;
  if (videoMeta) {
    const cover = str(videoMeta["coverUrl"]);
    if (cover) out.cover = cover;
    const dur = num(videoMeta["duration"]);
    if (dur != null) out.durationSec = dur;
    const sub = pickSubtitle(videoMeta);
    if (sub) out.subtitleUrl = sub;
  }

  const stats = {
    plays: num(item["playCount"]),
    likes: num(item["diggCount"]),
    comments: num(item["commentCount"]),
    shares: num(item["shareCount"]),
    collects: num(item["collectCount"]),
  };
  if (Object.values(stats).some((v) => v != null)) out.stats = stats;

  return out;
}

/** The default Apify TikTok actor slug used for the failover run (clockworks' TikTok scraper). */
export const APIFY_TIKTOK_ACTOR = "clockworks~tiktok-scraper";

export interface ApifyDeps {
  /** The Apify API token (config.apifyToken). Absent → the lane is not available (policy won't reach it). */
  token: string;
  /** Injected POST-JSON fetcher (url, init) → parsed JSON. */
  fetchJson(url: string, init: RequestInit): Promise<unknown>;
  /** The actor slug to run (defaults to APIFY_TIKTOK_ACTOR). */
  actor?: string;
}

/**
 * Thin lane glue: run the actor synchronously for the single saved permalink and normalize the first
 * dataset item. `run-sync-get-dataset-items` returns the dataset array directly. Never throws — a
 * transport failure or an empty dataset is a clean typed failure.
 */
export async function fetchApify(item: CapturedItem, deps: ApifyDeps): Promise<EnrichResult> {
  if (!item.url) return { ok: false, error: "no_permalink" };
  if (!deps.token) return { ok: false, error: "no_apify_token" };
  const actor = deps.actor ?? APIFY_TIKTOK_ACTOR;
  const url = `https://api.apify.com/v2/acts/${actor}/run-sync-get-dataset-items?token=${encodeURIComponent(deps.token)}`;
  try {
    const json = await deps.fetchJson(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ postURLs: [item.url], shouldDownloadVideos: false, resultsPerPage: 1 }),
    });
    const value = normalizeApify(json);
    if (Object.keys(value).length === 0) return { ok: false, error: "apify_empty" };
    return { ok: true, value };
  } catch (e) {
    return { ok: false, error: (e as Error)?.message ?? "apify_error" };
  }
}
