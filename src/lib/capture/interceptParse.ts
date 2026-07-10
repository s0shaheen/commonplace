// Pure parser for a TikTok `item_list` response envelope. It reuses capture.js's normalizer for the
// items (NO fork — extractItems is the single source of truth for record shape) and adds the two
// paging signals the old scroller threw away: `hasMore` and `cursor`.
//
// It also owns the TRANSPORT-SIGNAL classifier (INJ-02/COMPL-01/SESS-01, spec §6.5): the interceptor
// used to `res.clone().json()` with no `res.ok`/content-type, so every non-2xx, HTML interstitial,
// offline drop, empty-200, or challenge collapsed into one generic stall. `classifyTransport` takes the
// cheap transport-level facts the glue can gather and returns a TYPED signal the reducer/recovery can
// branch on. A flagged-session empty-200 (`empty_ok`) is a distinct signal here, NEVER a swallowed
// parse-skip that reads as a benign stall.
//
// No Date.now/Math.random/DOM reads here — every function is pure over its inputs (response facts are
// passed in), so the defensive coercion below is a deterministic unit test rather than a live-run gamble.

import { extractItems, type SpikeItem } from "../../capture.js";

/** A normalized item, identical to capture.js's `normalizeItem` output (we do NOT redefine it). */
export type RawItem = SpikeItem;

export interface ItemListEnvelope {
  items: RawItem[];
  /** Completion signal. `false` is the ONLY honest "no more pages"; see coerceHasMore for the default. */
  hasMore: boolean;
  cursor: string | null;
}

/**
 * Coerce TikTok's `hasMore` (shape UNVERIFIED in recon — recon/0.1-findings.md:8 copied only the
 * `itemList` subtree, so the on-wire encoding of hasMore/cursor is unconfirmed). TikTok's item_list
 * conventionally returns a top-level boolean or 0/1, but we treat that as a hypothesis and parse
 * every plausible encoding.
 *
 * DEFAULT-TO-TRUE ON A MISSING/UNKNOWN SIGNAL. This is the load-bearing decision of the whole task:
 * a false "done" is the founder's #1 complaint (§2.1 — "it won't be done scrolling … and ends up
 * saving/stopping"). If we cannot read the signal, the safe reading is "more may exist" — capture
 * keeps going, and the ONLY thing that ends it is either an explicit hasMore:false OR scrollState's
 * bounded-backoff `giveup` (a reported incomplete). A guessed `false` here would silently resurrect
 * the exact bug, so it is forbidden.
 */
export function coerceHasMore(v: unknown): boolean {
  if (v === true || v === 1 || v === "1" || v === "true") return true;
  if (v === false || v === 0 || v === "0" || v === "false") return false;
  return true; // absent / unrecognizable → more-may-exist (never false — that is the bug we kill)
}

/**
 * Read `hasMore` from ALL plausible keys, first-defined-wins. The camelCase `hasMore` is the observed
 * post/item_list shape (live fixture); `has_more` is the snake_case convention; `HasMoreAfter`/`HasMore`
 * are the PascalCase story/story-list variant (confirmed live — the story envelope pascal-cases its
 * paging keys). An unknown/absent signal falls through coerceHasMore to `true` (more-may-exist).
 */
const HAS_MORE_KEYS = ["hasMore", "has_more", "HasMoreAfter", "HasMore"] as const;
function readHasMore(obj: Record<string, unknown>): boolean {
  for (const k of HAS_MORE_KEYS) {
    if (obj[k] !== undefined) return coerceHasMore(obj[k]);
  }
  return true; // no paging key present at all → more-may-exist (never the false-done bug)
}

/**
 * Read the pagination cursor from every plausible key (first non-null wins), coerced to a string —
 * cursors, like ids, stay strings to dodge JS number-precision loss. `cursor` is the observed
 * post/item_list key; `maxCursor`/`max_cursor` cover the camel/snake variants; `MaxCursor`/`minCursor`/
 * `MinCursor` cover the PascalCase story variant. The live-confirmed terminal sentinel is `"-1"`.
 */
const CURSOR_KEYS = ["cursor", "maxCursor", "max_cursor", "MaxCursor", "minCursor", "MinCursor"] as const;
function readCursor(obj: Record<string, unknown>): string | null {
  for (const k of CURSOR_KEYS) {
    const v = obj[k];
    if (v != null) return String(v);
  }
  return null;
}

export function parseItemListEnvelope(json: unknown, source: string | null = null): ItemListEnvelope {
  const obj = (json && typeof json === "object" ? json : {}) as Record<string, unknown>;
  return {
    items: extractItems(json, source),
    hasMore: readHasMore(obj),
    cursor: readCursor(obj),
  };
}

// ───────────────────────────── Transport-signal classification (§6.5) ─────────────────────────────

/**
 * The typed transport signal the glue forwards instead of a swallowed `.json()`. Each is a distinct
 * branch the reducer/recovery can act on rather than one generic "stall":
 *  - `ok`         — healthy 2xx TikTok JSON, envelope status 0.
 *  - `empty_ok`   — a 2xx with an EMPTY/whitespace body (SESS-01, flagged session). NEVER benign.
 *  - `http_error` — 429 / 5xx / other non-2xx the glue may retry or wait on.
 *  - `challenge`  — 401/403, a login redirect, or a captcha/verify HTML page (auth/soft-block wall).
 *  - `api_error`  — 2xx but not TikTok JSON (captive-portal/interstitial HTML) or an envelope error code.
 *  - `offline`    — navigator was offline at read time (a dropped connection, not a TikTok signal).
 */
export type TransportSignal = "ok" | "empty_ok" | "http_error" | "challenge" | "api_error" | "offline";

export interface TransportFacts {
  /** res.ok */
  ok: boolean;
  /** HTTP status */
  status: number;
  /** res.headers content-type (lowercased by the glue is fine — we lowercase defensively too) */
  contentType: string;
  /** the raw response text (may be "") */
  bodyText: string;
  /** navigator.onLine at read time (glue passes it — this module never reads a global) */
  online: boolean;
}

/** Read the envelope-level API status: `statusCode ?? status_code` (0 = API-ok). null if unreadable. */
export function parseEnvelopeStatus(json: unknown): number | null {
  if (!json || typeof json !== "object") return null;
  const obj = json as Record<string, unknown>;
  const raw = obj["statusCode"] ?? obj["status_code"];
  if (raw == null) return null;
  const n = typeof raw === "number" ? raw : Number(raw);
  return Number.isNaN(n) ? null : n;
}

function tryParseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

/** An OK response that is HTML (or non-JSON markup), not TikTok JSON — a captive portal / interstitial. */
function isHtmlResponse(contentType: string, bodyText: string): boolean {
  const ct = contentType.toLowerCase();
  if (ct.includes("text/html") || ct.includes("application/xhtml")) return true;
  if (ct.includes("json")) return false;
  const head = bodyText.slice(0, 256).trimStart().toLowerCase();
  return head.startsWith("<!doctype html") || head.startsWith("<html") || head.startsWith("<head");
}

/** Does an HTML body look like a captcha / verify / login wall (challenge) vs a benign interstitial? */
function looksLikeChallengePage(bodyText: string): boolean {
  const s = bodyText.slice(0, 4096).toLowerCase();
  return /captcha|verif(y|ication)|are you (a )?human|log\s?in|sign\s?in|security check|challenge|robot check|unusual traffic|access denied/.test(
    s,
  );
}

/**
 * Classify the transport-level facts into a typed signal. Order matters: offline beats everything,
 * then auth/redirect walls, then server errors, then the OK-body branches (empty → HTML → JSON).
 */
export function classifyTransport(facts: TransportFacts): TransportSignal {
  // 1. Offline beats everything — a dropped connection is not a TikTok signal.
  if (facts.online === false) return "offline";

  // 2. Auth wall / session expiry: 401/403, or a redirect-to-login shape (a 3xx surfacing on an API
  //    call is a login/consent redirect). Both are "solve the wall", not "done" and not a plain retry.
  if (facts.status === 401 || facts.status === 403) return "challenge";
  if (facts.status >= 300 && facts.status < 400) return "challenge";

  // 3. Server / rate errors — the glue decides retry vs wait; we only classify.
  if (facts.status === 429 || facts.status >= 500) return "http_error";

  // 4. Any other non-2xx (400/404/…) → generic http_error (never a false ok).
  if (!facts.ok) return "http_error";

  // From here facts.ok === true (a 2xx).

  // 5. Empty 200 body — SESS-01, the flagged-session tell. NEVER a benign parse-skip.
  if (facts.bodyText.trim() === "") return "empty_ok";

  // 6. HTML on a 2xx — captive-portal / interstitial ("not TikTok JSON"); a captcha/login page is a challenge.
  if (isHtmlResponse(facts.contentType, facts.bodyText)) {
    return looksLikeChallengePage(facts.bodyText) ? "challenge" : "api_error";
  }

  // 7. JSON path: parse and read the envelope status.
  const json = tryParseJson(facts.bodyText);
  if (json === undefined) return "api_error"; // 2xx + non-HTML + unparseable → not TikTok JSON
  const status = parseEnvelopeStatus(json);
  if (status != null && status !== 0) return "api_error"; // envelope-level API error code

  return "ok";
}

/**
 * Is this a GENUINE terminal page (safe to hand `scrollState` a real `done`)? Conservative by design —
 * completion counts only on a HEALTHY transport (invariant 3; the COMPL-01 fix: an error/challenge
 * envelope whose hasMore coerced to false must NEVER read as done). Two positive terminals:
 *  (1) a POSITIVE `hasMore:false` — present-and-false, never the coerceHasMore default-true; the honest
 *      primary signal, honored even if the final page still carried items (the live fixture's shape), and
 *  (2) the secondary `"-1"` cursor sentinel on an EMPTY next page (live-confirmed final-page cursor).
 * Anything else (defaulted-true hasMore, a "-1" cursor on a still-populated or unhealthy page) is NOT done.
 */
export function isTerminalPage(env: ItemListEnvelope, transport: TransportSignal): boolean {
  if (transport !== "ok") return false; // healthy 2xx JSON only — never conclude "done" off a wall/error
  if (env.hasMore === false) return true; // POSITIVE explicit stop (default is true, so false is real)
  if (env.cursor === "-1" && env.items.length === 0) return true; // secondary conservative sentinel
  return false;
}
