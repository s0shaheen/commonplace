// Shared shapes for the enrichment lane. Kept dependency-free (only CapturedItem) so the pure cores
// (tierPolicy, merge, the adapter normalizers) import from here without pulling in any IO.

import type { CapturedItem } from "../types.js";

/** The user's enrichment tier (config.enrichTier). A LADDER of the maximum lane a run may reach:
 *  off  — no enrichment at all.
 *  free — the official oEmbed base only (caption/author/poster/hashtags), zero cost, no third party.
 *  depth— oEmbed + the user's OWN logged-in session (adds transcript via the capture control plane).
 *  paid — oEmbed + tikwm PRIMARY, Apify BACKUP on tikwm error/quota (third-party, opt-in). */
export type EnrichTier = "off" | "free" | "depth" | "paid";

/** The enrichment lanes, richest-context-per-call aside. `own_session` and the paid pair are opt-in. */
export type Lane = "oembed" | "own_session" | "tikwm" | "apify";

/** The content aspects that gate analysis. `missingFields(item)` derives these; tierPolicy reads them
 *  to pick a lane that can actually fill something still-missing (and to decide skip vs exhausted). */
export interface MissingFields {
  /** No caption/description — the item is not text-searchable yet. */
  caption: boolean;
  /** No poster/cover — no still for keyframe fallback / thumbnail. */
  poster: boolean;
  /** No transcript (no subtitleUrl) — the depth signal the own-session / paid lanes chase. */
  transcript: boolean;
}

/** The failover/spend state threaded across a single item's enrichment. PURE data — the glue mutates a
 *  copy between lanes (marks each attempted lane spent, sets tikwmFailed on a tikwm error/quota signal). */
export interface EnrichQuota {
  /** Lanes already ATTEMPTED for THIS item this run (so a lane is never re-called, and the ladder advances). */
  spent: Lane[];
  /** tikwm returned an error or a daily-cap/quota signal → the policy fails over to Apify. */
  tikwmFailed?: boolean;
  /** An Apify token is configured — apify is only reachable as a failover when this is true. */
  apifyAvailable?: boolean;
}

/** The common lane result: a normalized partial on success, or a clean typed failure (never a throw).
 *  `quota:true` on a failure marks a tikwm daily-cap/quota signal (vs a plain error) — both fail over. */
export type EnrichResult =
  | { ok: true; value: Partial<CapturedItem> }
  | { ok: false; error: string; quota?: boolean };
