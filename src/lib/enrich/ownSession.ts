// Tier-1 free DEPTH lane: open the saved permalink in the user's OWN logged-in session and intercept
// the platform's own already-signed item-detail response (incl the transcript). No forged requests —
// the moat posture. A sequential permalink sweep carries the same shadow-ban risk as scrolling, so it
// is driven THROUGH the capture control plane (the captureState classifier + recoverySpine): paced,
// resumable, and HALTING on any ban/challenge signal. This module is the classifier/spine pointed at a
// permalink worklist rather than a scroll feed — it REUSES banGuard's halt rule (does not reimplement
// resilience). The live driving (open the tab + intercept) is founder/pilot-time glue; here we own the
// two PURE pieces: the worklist reducer and the item-detail normalizer.
//
// PURE: no clock/rng/IO — the worklist is a value reducer and the normalizer is a total function.

import type { CapturedItem } from "../types.js";
import type { EnrichResult } from "./types.js";
import { shouldHaltForBlock, BAN_HALT_REASON, type BanFacts } from "../capture/banGuard.js";
import { extractItems } from "../../capture.js";

// ── The permalink worklist (one item at a time, deduped, ban-halt-obeying) ─────────────────────────

export interface OwnSessionWorklist {
  /** Permalinks awaiting a control-plane-driven open, in FIFO order. */
  pending: string[];
  /** Permalinks already resolved this run (dedupe target). */
  done: string[];
}

export type NextPermalink =
  | { kind: "halt"; reason: string } // the ban-halt tripped — never hand out a permalink (no bot-hammering)
  | { kind: "item"; url: string } // drive THIS permalink next (one at a time)
  | { kind: "idle" }; // nothing pending

export function emptyWorklist(): OwnSessionWorklist {
  return { pending: [], done: [] };
}

/** Add a permalink unless it is already pending or already done. Returns a NEW worklist. */
export function enqueuePermalink(wl: OwnSessionWorklist, url: string): OwnSessionWorklist {
  if (wl.pending.includes(url) || wl.done.includes(url)) return wl;
  return { ...wl, pending: [...wl.pending, url] };
}

/** Move a resolved permalink from pending → done (idempotent). Returns a NEW worklist. */
export function markDone(wl: OwnSessionWorklist, url: string): OwnSessionWorklist {
  return {
    pending: wl.pending.filter((u) => u !== url),
    done: wl.done.includes(url) ? wl.done : [...wl.done, url],
  };
}

/**
 * What to drive next. The ban-halt WINS over everything: once banGuard says halt, we return `halt` and
 * hand out no permalink — the account-safety invariant, identical to the scroll lane. Otherwise the FIFO
 * head, or `idle` when the worklist is drained.
 */
export function nextPermalink(wl: OwnSessionWorklist, ban: BanFacts): NextPermalink {
  if (shouldHaltForBlock(ban)) return { kind: "halt", reason: BAN_HALT_REASON };
  if (wl.pending.length === 0) return { kind: "idle" };
  return { kind: "item", url: wl.pending[0]! };
}

// ── The item-detail normalizer (reuses capture.js's extractItems — no fork) ────────────────────────

function isObj(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object";
}

/**
 * Normalize the intercepted item-detail envelope to a partial. The itemStruct is the SAME per-item
 * shape as an item_list element, so we wrap it into `{ itemList: [struct] }` and hand it to capture.js's
 * extractItems (the single source of truth for record shape). Missing/garbage → {}.
 */
export function normalizeItemDetail(payload: unknown): Partial<CapturedItem> {
  const struct = isObj(payload)
    ? ((payload["itemInfo"] as Record<string, unknown> | undefined)?.["itemStruct"] ?? payload["itemStruct"])
    : null;
  if (!isObj(struct)) return {};
  const it = extractItems({ itemList: [struct] })[0];
  if (!it) return {};
  const s = it.stats;
  return {
    desc: it.desc,
    createTime: it.createTime,
    author: it.author,
    authorName: it.authorName,
    playUrl: it.playUrl,
    downloadUrl: it.downloadUrl,
    cover: it.cover,
    durationSec: it.durationSec,
    hasSubtitles: it.hasSubtitles,
    subtitleUrl: it.subtitleUrl,
    isSlideshow: it.isSlideshow,
    music: it.music,
    hashtags: it.hashtags,
    stats: {
      plays: s.plays ?? null,
      likes: s.likes ?? null,
      comments: s.comments ?? null,
      shares: s.shares ?? null,
      collects: s.collects ?? null,
    },
  };
}

// ── The thin lane ──────────────────────────────────────────────────────────────────────────────────

export interface OwnSessionDeps {
  /** Persist the permalink onto the control-plane worklist (the SW/offscreen owns the store write). */
  enqueue(url: string): Promise<void> | void;
  /**
   * OPTIONAL: an already-intercepted item-detail envelope for this permalink (present only when the
   * control plane has driven it live). In the build/test env this is absent, so the lane DEFERS: it
   * enqueues the permalink and reports a clean non-fatal "deferred" — the live open is the pilot gate.
   */
  resolve?(item: CapturedItem): Promise<unknown | null>;
}

/**
 * Enqueue the item's permalink for the control plane and, if a live envelope is already available,
 * normalize it. Otherwise a clean typed "deferred" failure (not a hard error) — the worklist carries
 * the permalink forward for a paced, ban-halt-obeying open in the user's session.
 */
export async function fetchOwnSession(item: CapturedItem, deps: OwnSessionDeps): Promise<EnrichResult> {
  if (!item.url) return { ok: false, error: "no_permalink" };
  await deps.enqueue(item.url);
  if (!deps.resolve) return { ok: false, error: "own_session_deferred" };
  try {
    const envelope = await deps.resolve(item);
    if (!envelope) return { ok: false, error: "own_session_deferred" };
    const value = normalizeItemDetail(envelope);
    if (Object.keys(value).length === 0) return { ok: false, error: "own_session_empty" };
    return { ok: true, value };
  } catch (e) {
    return { ok: false, error: (e as Error)?.message ?? "own_session_error" };
  }
}
