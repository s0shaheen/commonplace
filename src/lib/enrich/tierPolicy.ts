// The PURE tier-policy decision core (design.md → "Pure cores"). Given what content is still missing,
// the user's setting, and the quota/failover state, it returns the ONE lane to run next — or a terminal
// `skip` (nothing left worth doing) / `exhausted` (still missing, but every eligible lane is spent).
//
// The ladder is CUMULATIVE and cost-ordered: the free oEmbed base runs first whenever caption/poster is
// missing; depth adds the user's own session for a transcript; paid adds tikwm PRIMARY then, only on a
// tikwm error/quota signal, Apify BACKUP. Paid lanes are off the free/default path by construction —
// they appear in the ladder only for `setting === "paid"`.
//
// PURE: a total function of its inputs (no clock, no rng, no IO), so every transition is a unit test.

import type { EnrichTier, Lane, MissingFields, EnrichQuota } from "./types.js";

/** Any analysis-gating field still missing? Terminal-state discriminator (skip when clean vs exhausted). */
function anyMissing(m: MissingFields): boolean {
  return m.caption || m.poster || m.transcript;
}

/** The eligible lanes for a setting, in cost order (cheapest/free first). `off` enriches nothing. */
function ladder(setting: EnrichTier): Lane[] {
  switch (setting) {
    case "off":
      return [];
    case "free":
      return ["oembed"];
    case "depth":
      return ["oembed", "own_session"];
    case "paid":
      return ["oembed", "tikwm", "apify"];
  }
}

/** Can this lane fill at least one still-missing field? Encodes each provider's capability envelope. */
function laneFills(lane: Lane, m: MissingFields): boolean {
  switch (lane) {
    case "oembed":
      // Official oEmbed returns caption/author/poster/hashtags — NOT transcript or stats.
      return m.caption || m.poster;
    case "own_session":
    case "tikwm":
    case "apify":
      // The full envelope: caption/poster AND the depth fields (transcript/stats/music).
      return m.caption || m.poster || m.transcript;
  }
}

/** Is `lane` reachable given what has been spent + the failover state? (Independent of `missing`.) */
function eligible(lane: Lane, quota: EnrichQuota): boolean {
  if (quota.spent.includes(lane)) return false; // never re-call a lane
  if (lane === "tikwm") return quota.tikwmFailed !== true; // a failed tikwm yields to apify
  if (lane === "apify") return quota.tikwmFailed === true && quota.apifyAvailable === true; // failover only
  return true; // oembed / own_session
}

/**
 * Pick the next lane, or a terminal verdict. Walks the setting's cost-ordered ladder and returns the
 * first lane that is both eligible (unspent, failover-consistent) and useful (fills something missing).
 * When no such lane exists: `skip` if nothing is missing (a clean, content-rich stop), else `exhausted`
 * (an honest partial — every eligible lane is spent but the item is still content-poor).
 */
export function tierPolicy(missing: MissingFields, setting: EnrichTier, quota: EnrichQuota): Lane | "skip" | "exhausted" {
  if (setting === "off") return "skip";
  for (const lane of ladder(setting)) {
    if (eligible(lane, quota) && laneFills(lane, missing)) return lane;
  }
  return anyMissing(missing) ? "exhausted" : "skip";
}
