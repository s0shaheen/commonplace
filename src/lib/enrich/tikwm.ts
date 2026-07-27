// Tier-2 PRIMARY paid adapter: tikwm.com (free tier ~5k/day, 1 req/s). One call returns rich metadata
// + a no-watermark media URL: caption, author, music, stats, cover, play URL, duration (+ subtitle when
// present). Third-party and opt-in — off the free/default path (it sends the public saved URL to tikwm).
//
// `normalizeTikwm` is PURE + TOTAL (payload → Partial<CapturedItem>); a `code != 0` / empty payload maps
// to an empty partial rather than throwing. `tikwmSignal` classifies the envelope into ok / error /
// QUOTA — a daily-cap or rate-limit message is a quota signal the policy fails over to Apify on.
// Rate-limiting (1 req/s) is applied by the CALLER's injected fetcher (createRateLimiter(1000)).
// See fixtures/tikwm-sample.json (representative-from-docs).

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
  return !!v && typeof v === "object";
}

/** Map the tikwm `data` payload (when `code === 0`) to a partial. Non-ok / missing data → {}. */
export function normalizeTikwm(payload: unknown): Partial<CapturedItem> {
  if (!isObj(payload)) return {};
  if (payload["code"] !== 0 && payload["code"] !== undefined) return {};
  const data = payload["data"];
  if (!isObj(data)) return {};
  const out: Partial<CapturedItem> = {};

  const title = str(data["title"]);
  if (title) {
    out.desc = title;
    out.hashtags = parseHashtags(title);
  }
  const author = isObj(data["author"]) ? (data["author"] as Record<string, unknown>) : null;
  if (author) {
    const handle = str(author["unique_id"]);
    if (handle) out.author = handle;
    const nick = str(author["nickname"]);
    if (nick) out.authorName = nick;
  }
  const cover = str(data["cover"]);
  if (cover) out.cover = cover;
  const play = str(data["play"]);
  if (play) out.playUrl = play;
  const wm = str(data["wmplay"]);
  if (wm) out.downloadUrl = wm;
  const dur = num(data["duration"]);
  if (dur != null) out.durationSec = dur;
  const sub = str(data["subtitle"]);
  if (sub) out.subtitleUrl = sub;

  const music = isObj(data["music_info"]) ? (data["music_info"] as Record<string, unknown>) : null;
  if (music) out.music = { name: str(music["title"]), author: str(music["author"]) };

  // Stats: only attach when at least one count is present, and fill each field independently.
  const stats = {
    plays: num(data["play_count"]),
    likes: num(data["digg_count"]),
    comments: num(data["comment_count"]),
    shares: num(data["share_count"]),
    collects: num(data["collect_count"]),
  };
  if (Object.values(stats).some((v) => v != null)) out.stats = stats;

  return out;
}

/** Classify the envelope: ok (code 0 + usable), plain error, or a QUOTA signal (daily-cap/rate-limit). */
export function tikwmSignal(payload: unknown): { ok: boolean; quota: boolean } {
  if (!isObj(payload)) return { ok: false, quota: false };
  if (payload["code"] === 0 && isObj(payload["data"])) return { ok: true, quota: false };
  const msg = String(payload["msg"] ?? "").toLowerCase();
  const quota = /limit|quota|too many|rate/.test(msg);
  return { ok: false, quota };
}

/** Build the tikwm API URL for a saved video permalink (`hd=1` requests the higher-bitrate media). */
export function tikwmUrl(permalink: string): string {
  return `https://www.tikwm.com/api/?hd=1&url=${encodeURIComponent(permalink)}`;
}

export interface TikwmDeps {
  /** Injected fetcher — SHOULD be rate-limited to 1 req/s by the caller. Resolves the tikwm JSON. */
  fetchJson(url: string): Promise<unknown>;
}

/**
 * Thin lane glue: GET tikwm for the item's permalink, classify, and normalize. A transport throw or a
 * non-ok envelope is a clean typed failure; a daily-cap/rate-limit envelope sets `quota` so tierPolicy
 * fails over to Apify. Never throws.
 */
export async function fetchTikwm(item: CapturedItem, deps: TikwmDeps): Promise<EnrichResult> {
  if (!item.url) return { ok: false, error: "no_permalink" };
  try {
    const json = await deps.fetchJson(tikwmUrl(item.url));
    const sig = tikwmSignal(json);
    if (!sig.ok) return { ok: false, error: sig.quota ? "tikwm_quota" : "tikwm_error", quota: sig.quota };
    const value = normalizeTikwm(json);
    if (Object.keys(value).length === 0) return { ok: false, error: "tikwm_empty" };
    return { ok: true, value };
  } catch (e) {
    return { ok: false, error: (e as Error)?.message ?? "tikwm_error" };
  }
}
