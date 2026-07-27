# Design — enrichment-lane

## Pipeline placement

Today: `raw` → `enqueuePending` → `analyzing` → grounded. New: `raw` → **`needsEnrichment?`** → `enriching` → `raw`(filled) → `analyzing`. A record needs enrichment when its content fields are empty in a way that blocks analysis (e.g. `desc===""` AND `subtitleUrl==null` AND `cover==null` — the DYD-skeleton signature) or a persisted `enrichPending` marker set by the importer. A live-captured item (desc/cover present) skips straight to analyze. Enrichment is idempotent and resumable like every other queue stage (checkpoint before the network call, per DEC-024).

## Pure cores

- `tierPolicy(missingFields, setting, quota) → Lane | "skip" | "exhausted"` where `Lane ∈ oembed | own_session | tikwm | apify`. Deterministic. Encodes: free default = oembed; if the user enabled depth and transcript is still missing = own_session; if the user enabled the paid lane = tikwm, and on tikwm error/quota = apify. Returns `skip` when nothing is missing, `exhausted` when every eligible lane is spent (→ honest partial).
- `merge(item, laneResult) → item` — fills only absent fields; NEVER overwrites a present value with an absent one (freshness-guarded, monotonic like the store's field-merge). Normalizes each provider's payload into the `CapturedItem` shape first (a per-adapter `normalize()`).

## Lane adapters (thin glue over a common `EnrichResult`)

- `oembed.ts` — GET the official endpoint; map `title→desc`+hashtags, `author_name`/`author_unique_id`, `thumbnail_url→cover`. Conservative pacing + retry (it 400s intermittently). No key.
- `tikwm.ts` (PRIMARY paid) — GET `https://www.tikwm.com/api/?url=…`; map desc/author/music/stats/cover/play/duration (+ subtitle when present). Rate-limit 1 req/s, stop at the daily cap → signal quota so the policy fails over.
- `apify.ts` (BACKUP paid) — run a TikTok actor (token from config), map the same fields. Used only when tikwm errors or is quota-exhausted. (For the founder's own pilot corpus, the same enrichment can be driven once via the Apify MCP tool — a prep action, not product code.)
- `ownSession.ts` (free depth) — enqueue the permalink into a worklist the **capture control plane** drives: open in the user's session, intercept the signed item-detail response (incl `subtitleUrl`), one item at a time, paced, ban-halt honored, resumable. This is the classifier+spine pointed at a permalink worklist rather than a scroll feed — no new resilience machinery.

All signed URLs (poster, media, subtitle) are fetched to bytes eagerly via `mediaFetch.ts` at enrichment time, since they expire.

## Provider fallback

The paid lane is a chain, not a choice: `tikwm` first; on HTTP error, empty result, or quota signal, `tierPolicy` returns `apify` for the same item. Both failing → the item keeps whatever oembed gave it and is marked enriched-partial (honest), still analyzable on its caption.

## Reuse, not rebuild

- Rate/quota + ban safety: `banGuard` + `pacing` (full-jitter), same as capture.
- Own-session resilience: the `captureState` classifier + `recoverySpine` from capture-control-plane.
- Poster/subtitle bytes + VTT parse: `mediaFetch.ts` (`parseVtt`).

## Testing (TDD)

- `tierPolicy` — every transition: oembed default; own_session only when depth enabled + transcript missing; tikwm→apify failover on error/quota; skip when nothing missing; exhausted path.
- `merge` — absent never overwrites present; a later rich lane fills gaps a poorer lane left; platform-agnostic.
- Adapter `normalize()` parsers — oembed against a captured fixture (caption/author/poster), tikwm/apify against response fixtures; a 400/empty is a clean failure, not a throw.
- Skip path — a content-rich (live-captured) item is classified `skip` and never hits the network.
- `npm test` + `npm run typecheck` green; existing tests unaffected.
