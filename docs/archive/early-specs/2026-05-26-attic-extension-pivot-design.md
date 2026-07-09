# Attic Pivot — Browser-Extension Product Design

```
Date:     2026-05-26
Status:   Design approved → spec for review
Author:   Salman Shaheen (with Claude)
Mode:     Scope-to-decide with kill gates
Supersedes: hosted-SaaS direction (docs/ALPHA_TRACKER.md, ATTIC_STATUS.md)
Sources:  2026-05-26_Attic_Pivot_to_Lite.md (Claude/Grok pivot convos),
          ATTIC_STATUS.md (codebase SoT), 4 Opus research agents (2026-05-26)
```

## 1. What this is

A pivot of **Attic** from a hosted SaaS (Next.js + FastAPI + Supabase + AWS Lambda/SQS, Apify enrichment, Gemini classification, Claude agent) to a **Manifest V3 browser extension** that:

1. Exports a user's **own** saved TikTok content (Favorites) — and Instagram saves as fast-follow — via their logged-in browser session.
2. Stores it **locally** (IndexedDB), never on our servers.
3. Optionally **enriches** it with cloud Gemini (transcript, on-screen text, named entities, takeaways, structured content).
4. Produces a **rich structured export** (JSON / CSV / Obsidian) the user pipes into their own ChatGPT/Claude.

**No conversational agent.** The enriched export _is_ the product. Users already pay for ChatGPT/Claude/Gemini — the moat closed in 2024-2025.

**The wedge (research-confirmed):** rxliuli owns IG-saves export and the $19.99-lifetime model but has **no TikTok product and no AI enrichment anywhere**. Albo/Sorti do AI-organizing but are _subscription mobile apps_ that don't truly export/archive. The open white space is the intersection: **browser-native, lifetime-priced, TikTok+IG saved-library export _with_ AI enrichment, local-first.**

## 2. Locked decisions

| Decision     | Choice                                                                               | Rationale                                                                                                                                                                 |
| ------------ | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Commitment   | **Scope-to-decide with kill gates**                                                  | Core scrape feasibility is proven-in-the-wild but unproven for our accounts; spike first.                                                                                 |
| AI model     | **Cloud Gemini: BYO-key + thin credits/licensing proxy. Local mode deferred to v2.** | Local Whisper transcription at library scale is the #1 timeline/UX/stability risk (Agent C). Cloud reuses existing prompts, is cheap (Flash-Lite), one multimodal call.   |
| MVP cut      | **TikTok-first + AI; Instagram fast-follow**                                         | Owns the confirmed white space first; IG scrape is the easy/proven one to bolt on later.                                                                                  |
| Brand / repo | **Keep "Attic", new repo**                                                           | ~80% of code is dead plumbing with zero runtime overlap (Python/SaaS → TS/MV3). "Attic" still fits the archive metaphor and avoids the spyware-flagged word "downloader". |

## 3. Goals / Non-goals

**Goals:** speed of delivery, stability, great design & UX, structurally-true privacy. Ship a v1 a solo founder can maintain. Validate before building the full thing.

**Non-goals (v1):** conversational agent; semantic-search/embeddings/pgvector; entity _resolution_ (Maps/Spotify lookups); local in-browser AI; Notion export; Firefox/Safari; video-blob storage; subscriptions.

## 4. Two-phase structure

The kill-gate framing means only **Phase 0** is committed now. Phase 1 is scoped here but not planned-in-detail until Phase 0 passes.

### Phase 0 — Kill-gate spike (committed; ~1 week, throwaway code)

Answers the two questions the research narrowed but couldn't prove for the founder's accounts.

| Step | What                                                                                                                                               | Proves                                                                             | ~Effort  |
| ---- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- | -------- |
| 0.1  | DevTools-only: log into TikTok + IG, confirm the Favorites/`saved` endpoints fire with session cookies                                             | Endpoints are queryable at all                                                     | 2 hrs    |
| 0.2  | Minimal MV3 ext: MAIN-world `fetch` monkeypatch, auto-scroll Favorites, capture every `item_list` response → JSON. **Count captured vs. visible.** | The hard TikTok scrape captures _completely_ (virtualized list doesn't drop items) | 1-2 days |
| 0.3  | Port `observe_video.md` + Gemini call; feed ~20 scraped videos' bytes from the browser into Gemini → rich JSON                                     | The **hardest porting risk**: session-scraped video → Gemini from an extension     | 1-2 days |
| 0.4  | Hand 5 people the enriched export vs. raw-export-pasted-into-ChatGPT; watch them find a saved restaurant/recipe                                    | The enriched export is _10× better_, not just nicer                                | 1 day    |

**Kill criteria (decided before building):**

- ❌ Kill if 0.2 can't capture ≥~95% of a real Favorites set without a soft-block in one run.
- ❌ Kill if 0.3 can't reliably get video into Gemini from the browser (fallback: thumbnail+caption-only enrichment — weaker; reassess).
- ❌ Kill/pivot if 0.4 shows raw+ChatGPT is "good enough" (no AI moat → ship pure exporter or stop).
- ✅ Proceed to Phase 1 only if all three clear.

Phase 0 reuses the founder's own Gemini key and existing prompts — zero new infra.

### Phase 1 — v1 MVP (scoped; planned only if Phase 0 passes)

## 5. Architecture (Phase 1)

All evidence-backed by the MV3 architecture research.

```
┌──────────────────────── BROWSER (WXT, MV3) ────────────────────────┐
│ Content Script (tiktok.com)                                          │
│   MAIN-world fetch/XHR monkeypatch → skim TikTok's OWN signed        │
│   item_list responses while auto-scrolling Favorites (throttled).    │
│   Never forges signatures.                                           │
│         │ chrome.runtime msg                                         │
│ Service Worker (disposable orchestrator)                             │
│   chrome.alarms (30s) watchdog; spawns/revives Offscreen Doc;        │
│   resumes from IndexedDB cursor. No long work here.                  │
│         │ long-lived port                                            │
│ Offscreen Document (workhorse, unlimited lifetime, non-audio reason) │
│   Resumable job-queue runner (batches of N, checkpoints);            │
│   thumbnail fetch+downscale (≤60KB WebP); enrichment client.         │
│                                                                      │
│ STORAGE: IndexedDB (url+metadata+thumbnail; NO video blobs);         │
│   chrome.storage.local settings; Ed25519-signed license JWT.         │
│ EXPORT: JSON / CSV / Obsidian — pure client-side serialization.      │
└──────────────────────────────────────────────────────────────────┘
        │ HTTPS (metadata+thumbnail only; logs counts/errors, never content)
        ▼
┌──── Cloudflare Worker (credits + BYO-key proxy + licensing) ────┐
│ Verifies Ed25519 license token; meters credits (KV/D1);          │
│ rate-limits per token/IP; proxies → Gemini Flash-Lite (key in    │
│ Secrets); signs license JWT on activation; zero content logged.  │
└──────────────────────────────────────────────────────────────┘
        ▼  Google Gemini API (vision + OCR + entity extraction + classify)
```

**Tech per layer:** WXT (build/cross-browser, Chrome+Edge in v1) · content-script XHR capture · SW + `chrome.alarms` + Offscreen Document · IndexedDB · Gemini Flash-Lite via Cloudflare Worker proxy (default) or BYO-key direct · Lemon Squeezy + offline Ed25519 JWT licensing · client-side exporters.

**Why this scrape approach:** We never crack TikTok's signing (X-Bogus/msToken/etc.). We inject into the page's MAIN world and skim TikTok's own already-signed responses — the only reliable MV3 pattern (non-blocking `webRequest` can't read bodies; `declarativeNetRequest` is declarative-only). Proven in the wild by myfaveTT (100k users). traktok (the R cookie-replay approach) is the _counter-example_: server-side replay can't reach own-Favorites because it can't sign — which is exactly why we go in-browser. **The Favorites endpoint cannot be cribbed from any existing tool** (traktok recon confirmed it hits no favorites endpoint and never signs), so spike step 0.1's live DevTools recon is load-bearing, not a formality.

## 6. Ingestion modes

- **Mode A — Live session scrape (primary).** MAIN-world capture as above. The differentiator; also the highest-maintenance and the store/ToS-risk surface.
- **Mode B — Official data-export import (secondary / fast-follow).** User uploads TikTok's/Instagram's own "Download Your Data" archive; we parse + enrich it. **Unimpeachable on store policy and ToS** (no scraping), reuses the dead-but-documented ZIP-parser knowledge, and serves users who already exported. Downsides: native exports are painful to obtain and slideshow image URLs expire (~30 days). Captured here as a deliberate de-risking path; sequence after Mode A is validated, or pull forward if Mode A hits store-policy trouble. traktok-style tooling is relevant to this segment.

## 7. The export schema (the core product spec)

Per item (illustrative; finalized in the AI-enrichment sub-project):

```jsonc
{
  "id": "7234567890",
  "platform": "tiktok",
  "url": "https://...",
  "saved_at": "2025-03-12T14:23:00Z",
  "creator": "@foodietravels",
  "caption": "best pasta in brooklyn 🍝",
  "hashtags": ["pasta", "brooklyn", "foodie"],
  "music": { "name": "...", "author": "..." },
  "counts": { "likes": 0, "comments": 0, "shares": 0, "plays": 0 },
  "thumbnail": "<local ref, ≤60KB>", // no video blob stored
  "enrichment": {
    // Gemini, opt-in
    "transcript": "...",
    "on_screen_text": ["LILIA", "WILLIAMSBURG, BROOKLYN"],
    "entities": [
      {
        "type": "restaurant",
        "name": "Lilia",
        "raw": "Lilia in Williamsburg",
        "specs": { "neighborhood": "Williamsburg, Brooklyn" },
      },
    ],
    "takeaways": ["..."],
    "structured_content": {
      /* recipe | workout | list, when present */
    },
    "facets": {
      "topic": "travel",
      "genre": "compilation",
      "affect": "informative",
    }, // secondary/optional
  },
}
```

**Priority within enrichment:** perception (transcript / OCR / entities / takeaways) is the product; the 8-facet classification is secondary (users can ask their own LLM to classify). Ship perception first. **Export formats:** JSON + CSV + Obsidian markdown. (Notion deferred — needs OAuth.)

## 8. Pricing

- **Free:** export engine, capped ~500-1,000 items, no AI. Real (rxliuli-style) try-before-buy.
- **Pro — $19.99 lifetime:** unlimited export, full engine, all export formats, BYO-key AI enrichment. Matches the proven anchor; undercuts generic scrapers ($49-60).
- **AI credits (optional, pay-as-you-go):** convenience path for non-technical users; hosted proxy, your margin. **Never bundled into the one-time fee** (avoids "ran out → 1-star" resentment).
- **No subscription** for the core engine. (That's where Albo is differentiable-_against_.)

Credit margin math anchors on the measured Gemini cost: ~$0.0043/video-item (perceive+classify, Flash-preview, N=106) — Flash-Lite is cheaper.

## 9. UX surfaces

Onboarding (BYO-key walkthrough with per-step screenshots) · capture-progress view (per-item status, pause/resume, ETA) · local library browse + filter · export panel · settings/license. **Brand:** reuse `design-tokens.ts` (Parchment + Ink), DM Sans / DM Mono, borders-over-shadows, Cinnamon stays marketing-only.

## 10. Store-policy & trust hygiene (mandatory)

The category is tainted by a 2025 spyware wave (12+ fake "TikTok downloader" extensions, 130k users). To avoid being lumped in:

- Minimal host-permissions (`tiktok.com` / `instagram.com` only); justify each permission.
- **Zero remote code** (bundle everything; the exact pattern that got the spyware pulled).
- Radical transparency: "all processing happens locally"; disclose precisely what leaves the browser; gate any hosted-AI behind explicit opt-in. BYO-key is the cleanest posture.
- Single-purpose framing: "export and archive _your own_ saved content." **Never the word "downloader"** in name/keywords.
- OSS the export engine; link the repo as the privacy policy.
- **Fallback channels:** Edge (same Chromium build) as primary insurance; own-store + license keys as the nuclear backup so a delisting doesn't kill revenue. Firefox is a fast-follow.

ToS exposure is **low** for a personal-use, own-data export tool (rxliuli runs this model across 5 platforms). The real ongoing cost is **operational fragility** (platform UI/endpoint changes), not legal.

## 11. Decomposition into sub-projects (each gets its own spec → plan → build, post-spike)

1. **Scraper** — TikTok MAIN-world capture + resilience _(hardest-maintenance; HIGH risk)_
2. **MV3 shell + resumable job queue** — SW + alarms + offscreen + checkpointing _(hardest engineering; MED risk)_
3. **Local storage + export serializers** — IndexedDB schema, JSON/CSV/Obsidian
4. **AI enrichment + Cloudflare proxy** — port `observe_video.md`/`classify`, BYO-key + credits + metering
5. **Licensing + billing** — Lemon Squeezy + Ed25519 offline JWT
6. **UX / onboarding / library**

## 12. Fast-follow (v1.1+)

Instagram (Mode A + B) · Official-data-export import (Mode B) · Notion export · local "private mode" (Transformers.js + Tesseract.js, WebGPU→WASM) · Firefox/Safari · entity _resolution_ (Maps/Books/TMDB/Spotify) behind the proxy.

## 13. Salvage from the old repo (port, don't import — it's Python→TS)

| Asset                                                       | Fate                                    | Note                                                                          |
| ----------------------------------------------------------- | --------------------------------------- | ----------------------------------------------------------------------------- |
| `prompts/perception/v2/observe_video.md`                    | **Port first**                          | The crown jewel; defines the enriched export. Validated N=106, ~$0.0024/item. |
| `prompts/classify/v2/tier2.md`, perception slideshow/image  | Port                                    | Secondary (browse facets) + slideshow/carousel coverage.                      |
| `ontology.py` label sets + definitions                      | Port to TS                              | Thin version (skip strict validation — no DB/agent).                          |
| Gemini perceive/classify call logic, `entity_resolvers.py`  | **Becomes the Cloudflare/Python proxy** | Not throwaway — reborn server-side.                                           |
| `design-tokens.ts`, BRAND.md                                | Transfer as-is                          | Only true drop-in runtime artifact.                                           |
| UNIT_ECONOMICS.md, workbench Exp 01-07, golden set          | Transfer as knowledge                   | Pricing + test corpus.                                                        |
| TikTok/IG ZIP parsers, data-shape knowledge                 | Reference for Mode B                    | Code dies; knowledge informs the export-import path.                          |
| Everything else (AWS/Supabase/Apify/Next.js/agent/pgvector) | **Dies**                                | ~80% of LOC, but it was all flagged-low-value plumbing.                       |

Old repo: tag + archive; becomes "what I learned" blog-post material and optional OSS reference.

## 14. Risks & mitigations

| Risk                                       | Severity | Mitigation                                                                            |
| ------------------------------------------ | -------- | ------------------------------------------------------------------------------------- |
| TikTok scrape incompleteness / breakage    | HIGH     | Skim page's own requests (not DOM); spike proves capture; expect 1-3mo patch cadence. |
| Chrome Web Store removal                   | HIGH     | Policy hygiene (§10); Edge + own-store fallback; OSS engine.                          |
| Account soft-block from scraping           | MED      | Human-like pacing, single-session, detect+pause+resume; spike measures threshold.     |
| Resumable queue correctness at 5-20k items | MED      | Checkpoint every N; alarms watchdog; offscreen-doc revival.                           |
| Video→Gemini from browser fails            | MED      | Spike 0.3 tests it day one; fallback to thumbnail+caption enrichment.                 |
| Solo-founder maintenance burden            | MED      | Lifetime fee funds it; keep surface small; Mode B as low-maintenance alternative.     |

## 15. Open questions (for downstream sub-project specs)

- Exact TikTok Favorites endpoint shape + cursor mechanics (→ recon sheet: `refs/2026-05-26-tiktok-hidden-api-endpoints.md`).
- Free-tier cap (500 vs 1,000) and whether AI is ever in the free tier.
- Whether to ship classification facets in v1 or perception-only.
- Credit-pack sizing + exact Flash-Lite margin.
- Mode B sequencing (fast-follow vs pulled-forward if store risk materializes).

## Phase 0 spike — 🟢 PASS / PROCEED (2026-05-27)

All gates clear. 0.1–0.3 cleared empirically on the founder's real account; **0.4 was resolved by founder decision** — rather than run the 5-person comparison, the founder committed to the enriched-export thesis and declared **visual analysis + entity extraction** in-scope for v1. Decision record: `results/0.8-spike-decision.md`. Spike repo: `/Users/s0shaheen/Dev/attic-extension`. **Next: Phase 1 sub-project specs, starting with Enrichment + Entity Presentation** (`docs/archive/early-specs/2026-05-27-attic-enrichment-entities-design.md`).

- **0.1 endpoint (PASS):** `GET /api/user/collect/item_list/`, items under `itemList`, `id` is a string. Captured via MAIN-world `fetch`/XHR interception — never signed.
- **0.2 capture (PASS):** manual scroll captured **1313** of 1463 listed favorites; the ~150 gap is deleted items TikTok won't serve to anyone (matches Exp 01's ~14% deletion rate). Passive interception is complete. **Caveat → Phase 1 task:** automated fast scroll deterministically trips a TikTok soft throttle at ~360 items (3 runs all stopped at 359); human-paced scrolling does not. The scraper must pace scrolling like a human (slow, incremental, jittered) and/or offer a manual-assist "scroll yourself, we capture" mode. Not a feasibility blocker — the core interception works at full scale.
- **0.3 enrichment (PASS):** Text enrichment works fully locally — bundled **subtitle files are CORS-fetchable** and the Gemini API is callable from the browser, so caption + hashtags + subtitles → Gemini text call → transcript + entities + takeaways (19/20 items valid JSON). Maximally private, ~$0 infra.
- **Video bytes ARE readable client-side (PASS) — overturns the earlier "needs a proxy" assumption.** A naive `fetch` 403s, but **mirroring the page's own video request** — credentialed CORS (`credentials: "include"`) + a `Range` header + a DNR-injected `Referer` — succeeds for _any_ creator's video (the CDN already returns proper per-origin CORS headers). Proven live. Consequences:
  - **Video download** (export the actual `.mp4`s) works **fully client-side, no proxy** — fetch → blob → save. Ships as part of the Pro export engine, **AI-independent** (a first-class feature, not just an AI input).
  - **Visual enrichment can also run locally** (read bytes → Gemini, BYO-key), so the Example-A "saw the restaurant on screen" magic does **not** require a server. _Caveat:_ inline base64 covers videos up to ~18 MB; larger ones need the Gemini File API resumable upload from the browser (untested, expected to work). Bulk visual enrichment is slow/$$ → selective/opt-in, not auto-on-all.

**Net spec revision:** v1 can be **fully local / BYO-key for everything** — capture, text+subtitle enrichment, video download, and even visual enrichment — with **no server at all**. The Cloudflare Worker proxy (§5) is therefore **not a technical requirement**; its only remaining purpose is the optional _hosted-credits convenience tier_ for non-technical users who won't bring a Gemini key — a pure business/UX choice, deferred. **New first-class feature surfaced by the spike: video (.mp4) export, independent of AI.**

## Appendix — Research provenance (2026-05-26)

Four Opus agents: (A) scrape feasibility — IG 🟢 / TikTok 🟡-proven (myfaveTT 100k users; MAIN-world interception); (B) competitive + store policy — wedge confirmed, store risk MED, $19.99 anchor; (C) MV3 architecture + local AI — WXT, offscreen-doc resumable queue, cloud-Gemini-not-local for v1, brute-force vectors if ever needed; (D) codebase salvage — new repo, ~80% dies (plumbing), prompts are the IP. Plus traktok review: not usable (R, server-side, can't sign, doesn't reach Favorites) but useful as endpoint recon + relevant to Mode B.
