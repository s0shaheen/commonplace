# Proposal — enrichment-lane

## Why

An imported TikTok item is a skeleton: `dydImport.ts` fills only id/url/author/savedAt; `desc` is `""` and `cover`/`subtitleUrl`/`music`/`stats`/`durationSec` are null. The pipeline enqueues every `raw` record for analysis (`queue.ts` `enqueuePending`), but the engine has nothing to analyze on a skeleton — no caption, no transcript. So without enrichment, ZIP import gives you a searchable-by-nothing library. Enrichment fills the content fields so imported items become first-class (searchable, analyzable, groundable) — this is what de-gates the product from the live scraper. Instagram imports arrive with a caption already (searchable), but still want poster/transcript depth.

## What changes

Add a tiered enrichment stage between `raw` and `analyzing`, run only for items that need it (a skeleton / flagged import); live-captured items already carry desc/cover/subtitle and skip it.

- **Tier 0 — oEmbed (free, official, default).** `https://www.tiktok.com/oembed?url=…` → caption (the `title`), author name+handle, poster (`thumbnail_url`), hashtags parsed from the title. Verified live: turns a skeleton into a searchable, poster-having item at zero cost, no third party. No transcript/stats.
- **Tier 1 — own-session permalink open (free, opt-in, depth).** Navigate the user's logged-in session to the permalink; the platform's own signed response is intercepted (the moat posture — no forged requests). Yields the full envelope incl `subtitleUrl` (transcript). Runs through the **capture control plane** (paced, resumable, ban-halt) because a sequential permalink sweep carries the same shadow-ban risk as scrolling — depth lane over the delta, never a brute-force pass.
- **Tier 2 — paid fast (opt-in).** **tikwm PRIMARY** (free tier ~5k/day, 1 req/s), **Apify BACKUP** (fallback on tikwm error/quota). Rich metadata + no-watermark media in one call. Third-party — off the free/default path.

Pure cores: a `tierPolicy` decision (which lane, given what's missing + the user's setting + quota state) and a `merge` (fill fields, freshness-guarded). Lane adapters are thin network glue. Provider fallback (tikwm→Apify) and rate/quota + ban-safety reuse `banGuard`/`pacing`.

Non-goals: no new analysis/grounding logic (enrichment feeds the existing engine); no change to live capture; enrichment never overwrites present data with absent.

## Capabilities

- **New capability**: `enrichment` — how a content-poor item is filled to analysis-ready, across tiers, with provider fallback and honest partial results.

## Impact

- New: `src/lib/enrich/` — `tierPolicy.ts` (pure), `merge.ts` (pure), lane adapters `oembed.ts` / `tikwm.ts` / `apify.ts` / `ownSession.ts` (glue), all with tests for the pure cores + adapter parsers against fixtures.
- Modified: the pipeline (`queue.ts`/`background.ts`) gains a pre-analyze enrich hook for needy items; `config.ts` gains an enrichment-tier setting + optional Apify token; `mediaFetch.ts` reused for poster/subtitle bytes; the control plane reused for the own-session lane.
- Invariants: free path uses only the official oEmbed + the user's own session; paid lanes are opt-in and send only public saved URLs to the third party; signed poster/media URLs fetched eagerly; partial enrichment is an honest state, never a fake-complete.
