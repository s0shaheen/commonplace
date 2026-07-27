// The enrichment ORCHESTRATION core: loop the pure tierPolicy over an item, run the lane it picks,
// merge the result monotonically, and repeat until the policy says skip (done) or exhausted (honest
// partial). Lane IO is INJECTED (a runner per lane), so this stays a deterministic reducer over the
// real policy + merge — the failover chain and the skip path are unit tests, not live-run gambles.
//
// Durability: `persist` is called after EACH successful lane so a resumed run (queue revive → retry)
// sees the already-filled fields and re-derives the next lane from what is STILL missing — idempotent
// by construction (merge never clobbers, spent lanes are re-derived from the persisted state on retry).

import type { CapturedItem } from "../types.js";
import type { EnrichTier, Lane, EnrichQuota, EnrichResult } from "./types.js";
import { tierPolicy } from "./tierPolicy.js";
import { missingFields, needsEnrichment } from "./missing.js";
import { merge } from "./merge.js";

/** A lane's IO, injected. Never throws — returns a clean EnrichResult (the adapters guarantee this). */
export type LaneRunner = (item: CapturedItem) => Promise<EnrichResult>;

export interface EnrichItemDeps {
  /** The user's enrichment tier (config.enrichTier). */
  setting: EnrichTier;
  /** The wired lane runners. A lane the policy can pick but that is unwired is treated as spent. */
  lanes: Partial<Record<Lane, LaneRunner>>;
  /** Whether an Apify token is configured — gates the tikwm→apify failover lane. Default false. */
  apifyAvailable?: boolean;
  /** Checkpoint hook: persist the (partially) enriched item after each successful lane. */
  persist?: (item: CapturedItem) => Promise<void> | void;
}

export interface EnrichOutcome {
  /** The enriched item (monotonically merged; the input is never mutated). */
  item: CapturedItem;
  /** Lanes attempted, in order. */
  lanesTried: Lane[];
  /** Lanes that returned a usable result. */
  filled: Lane[];
  /** skipped = no lane ran (content-rich / off); enriched = fully filled; partial = still content-poor. */
  status: "skipped" | "enriched" | "partial";
}

/**
 * Enrich one item across the tier ladder with provider failover. Deterministic given the injected
 * runners: each iteration asks tierPolicy for the next lane over what is STILL missing + the spend
 * state, runs it, and merges. A tikwm failure (error OR quota) flips `tikwmFailed`, which is exactly
 * what makes the next policy call return `apify`. Terminates because every iteration either returns a
 * terminal verdict or marks one more lane spent (the ladder is finite).
 */
export async function enrichItem(item: CapturedItem, deps: EnrichItemDeps): Promise<EnrichOutcome> {
  // COARSE gate (the spec's skip rule): a content-rich item (caption + poster) never touches the
  // network, even if it has no transcript. Only content-poor items enter the policy loop.
  if (!needsEnrichment(item)) {
    return { item, lanesTried: [], filled: [], status: "skipped" };
  }

  let cur = item;
  let quota: EnrichQuota = { spent: [], apifyAvailable: deps.apifyAvailable === true };
  const lanesTried: Lane[] = [];
  const filled: Lane[] = [];

  for (;;) {
    const decision = tierPolicy(missingFields(cur), deps.setting, quota);
    if (decision === "skip") {
      return { item: cur, lanesTried, filled, status: lanesTried.length === 0 ? "skipped" : "enriched" };
    }
    if (decision === "exhausted") {
      return { item: cur, lanesTried, filled, status: "partial" };
    }

    const runner = deps.lanes[decision];
    lanesTried.push(decision);
    const spent = [...quota.spent, decision];

    // A lane the policy picked but that is not wired: treat as a (failed) attempt so the ladder advances
    // — a tikwm gap still fails over to apify, never an infinite loop.
    const result: EnrichResult = runner ? await runner(cur) : { ok: false, error: `${decision}_unwired` };

    if (result.ok) {
      cur = merge(cur, result.value);
      filled.push(decision);
      if (deps.persist) await deps.persist(cur);
      quota = { ...quota, spent };
    } else {
      quota = { ...quota, spent, tikwmFailed: decision === "tikwm" ? true : quota.tikwmFailed };
    }
  }
}
