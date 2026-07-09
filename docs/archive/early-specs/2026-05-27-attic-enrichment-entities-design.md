# Attic — Enrichment + Entity Presentation (Phase 1 sub-project)

```
Date:     2026-05-27
Status:   Design approved (founder pre-authorized) → spec for review
Author:   Salman Shaheen (with Claude)
Parent:   docs/archive/early-specs/2026-05-26-attic-extension-pivot-design.md  (§7, §11 sub-project #4)
Builds on: Phase 0 spike — results/0.8-spike-decision.md (🟢 PASS)
Repo:     /Users/s0shaheen/Dev/attic-extension
```

## 1. What this sub-project is

The product-value core of Attic v1: turn captured TikTok items into the enriched export schema, and present the result so a user can actually **find the thing they saved**. Two halves:

1. **Enrichment** — client-side, BYO-key Gemini. Text-tier (caption + hashtags + subtitles) on all items; visual-tier (video bytes → multimodal) opt-in/selective. Produces transcript, on-screen text, **entities**, takeaways, and (secondary) facets.
2. **Entity presentation** — an entity-aware Library + export. Browse saved content _by item_ or _by entity_ ("Restaurants", "Places", "Books"…), so retrieval is a filter, not a prayer.

Per CLAUDE.md priority order (classification → retrieval → response → UX), this is the highest-value sub-project even though build order front-loads the shell/scraper/storage. It is **independently buildable and testable against the real 1313-item capture fixture** the spike produced — enrichment does not block on a finished scraper.

**In scope:** enrichment tiers, media handling, entity extraction + normalization/dedupe, the enriched export schema, the entity-aware library views, exporters (JSON/CSV/Obsidian), and AI-independent `.mp4` export.
**Out of scope (per parent §3 non-goals):** entity _resolution_ (Maps/Spotify lookups), conversational agent, embeddings/semantic search, the hosted-credits proxy (BYO-key only here), Instagram, video-blob storage.

## 2. Enrichment: two tiers

A library has thousands of items; visual multimodal calls are ~10× the cost and latency of a text call. So tiering is the core design constraint (spike finding #4).

| Tier       | Input                                                 | Output                                                                                     | Default                | Cost/latency                            |
| ---------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------ | ---------------------- | --------------------------------------- |
| **Text**   | caption + hashtags + subtitle file (CORS-fetched)     | transcript, entities, takeaways, facets                                                    | **Runs on all items**  | cheap, fast (spike-proven, 19/20 valid) |
| **Visual** | video bytes (or slideshow images) → Gemini multimodal | on-screen text (OCR), visually-grounded entities, scene-grounded takeaways, refined facets | **Opt-in / selective** | slow + $$ — never auto-on-all           |

**Text tier** is the spike's 0.3 path: one Gemini text call per item, run as the default enrichment pass.

**Visual tier** is the "saw the restaurant on a sign" magic. The user runs it on a chosen subset, never the whole library by default. Selection surfaces:

- Explicit multi-select in the library ("enrich these 12 visually").
- A filtered run ("visually enrich all items with **no subtitles**" — the cases text-tier is weakest on).
- "Visually enrich all N" with a **mandatory upfront estimate** (item count, est. minutes, est. cost in the user's own Gemini spend) and confirm.

Visual results **merge into and upgrade** an item already text-enriched (add `on_screen_text`, add/merge entities, bump `enrichment.tier` to `"visual"`). Re-runs are idempotent.

## 3. Media handling (visual tier)

- **Acquire bytes** via the spike-proven path: content-script `fetch(playUrl, { credentials: "include", headers: { Range: "bytes=0-" } })` with the DNR rule injecting `Referer: https://www.tiktok.com/`. Never store the blob — fetch → send → discard.
- **Inline base64** for videos ≤ ~18 MB (covers the large majority of TikToks).
- **Gemini File API** (resumable upload from the browser) for larger videos. Untested in the spike; first task in the plan validates it on a real >18 MB item before relying on it.
- **Slideshows** (`imagePost`): no video to fetch — send the post's images as a multi-image prompt.
- **Failure is per-item and recorded**, never fatal to the batch: `video_fetch_failed`, `too_big_inline_uploading_via_file_api`, `gemini_429`, `parse_fail`. Failed items stay `pending`/`text`-tier and are retryable.

## 4. Entity extraction + normalization

Entities are the retrieval primitive. Both tiers emit them via the ported `observe_video.md` prompt (text variant + visual variant + slideshow variant). Per-entity shape (matches parent §7):

```jsonc
{
  "type": "restaurant",
  "name": "Lilia",
  "raw": "Lilia in Williamsburg",
  "specs": { "neighborhood": "Williamsburg, Brooklyn" },
}
```

Types come from the ported (thinned) ontology label sets: `place`, `restaurant`, `product`, `book`, `media` (film/show/song), `recipe`, `person`, `brand`, `link`, `other`. Extraction only — **no external resolution** in v1.

**Normalization + dedupe (pure, TDD'd):** the same restaurant saved across three videos must collapse to **one entity with three source items**, or the "by entity" view is noise. A `normalizeEntity()` produces a stable key from `(type, casefold/trimmed name)` with light alias handling; a cross-item index maps `entityKey → [itemId…]`. This index is what powers the entity-browse UI and the Obsidian per-entity notes. Kept deterministic and unit-tested against the real fixture.

## 5. Presentation — the usability payoff

The in-extension **Library** is entity-aware. Two top-level lenses over the same local data:

- **By item** — card grid: thumbnail, creator, caption, enrichment-status badge (`raw` / `text` / `visual`), duration. Click → item detail (transcript, on-screen text, linked entities, takeaways, `structured_content`, original link).
- **By entity** — entity-type collections ("Restaurants", "Places", "Books", "Products", "Recipes"…). Each lists its entities; clicking an entity (e.g. _Lilia_) shows the saved item(s) that mention it. This is the direct answer to the core use case: _"find the restaurant I saved"_ becomes a filter, not a search.

**Filter/search across both lenses:** by entity type, creator, hashtag, facet (topic/genre), enrichment status, and free-text over caption + transcript + entity names. Search is **local** (in-memory/IndexedDB scan over the user's library) — no embeddings, no server.

This Library is also where enrichment is _driven_ (select items → run text/visual) and where export is launched.

## 6. Export

The enriched export remains the portable product (paste into the user's own ChatGPT/Claude). Three formats, pure client-side serialization:

- **JSON** — full schema per item (parent §7), plus a top-level `entities` index (entityKey → item ids) so an LLM can navigate by entity directly.
- **CSV** — flattened, one row per item (entities/hashtags joined); optional companion `entities.csv` (one row per entity with its source item ids) for spreadsheet pivot.
- **Obsidian** — one `.md` per item (front-matter + transcript + takeaways; entities and hashtags as `[[wikilinks]]`/`#tags`) **plus one note per entity** that backlinks its source items → a navigable vault, not a dump.

**`.mp4` export** is a separate, AI-independent action (spike finding #2): select items → download the actual videos via the Path-2 fetch→blob mechanism. Belongs to the Pro export engine, available with zero enrichment.

## 7. Execution model

Enrichment runs in the **offscreen document** (parent §5: unlimited lifetime, owns the network + Gemini calls), driven by a resumable job queue (shared with the MV3-shell sub-project; for fixture-based development, a self-contained offscreen batch runner with the same interface):

- Batches of N, checkpoint progress to IndexedDB after each item → survives service-worker death and browser restart (resume from last checkpoint).
- Per-item status machine: `pending → text → visual` with terminal `failed{reason}`; idempotent re-runs; explicit pause/resume.
- **Gemini rate-limit hygiene:** respect RPM, exponential backoff on 429, bounded concurrency. Live progress (done/total, ETA, running cost estimate) surfaced to the Library.

## 8. Component boundaries (for isolation + testability)

| Unit                               | Responsibility                                                                                    | Depends on                  | Tested                               |
| ---------------------------------- | ------------------------------------------------------------------------------------------------- | --------------------------- | ------------------------------------ |
| `ontology.ts`                      | thin entity-type + facet label sets/definitions                                                   | —                           | snapshot                             |
| `prompts/`                         | `observe_video` text + visual + slideshow variants                                                | ontology                    | —                                    |
| `geminiClient.ts`                  | one enrichment call (inline / File API / multi-image); returns parsed result-object, never throws | secrets/BYO-key             | mocked unit + 1 live smoke (flagged) |
| `mediaFetch.ts`                    | acquire video bytes / slideshow images (Path-2 fetch)                                             | DNR rule                    | live smoke                           |
| `enrich.ts`                        | orchestrate tier per item, merge text→visual, status machine                                      | geminiClient, mediaFetch    | unit (mocked client)                 |
| `entities.ts`                      | `normalizeEntity`, dedupe, cross-item index                                                       | —                           | **TDD against fixture**              |
| `exporters/{json,csv,obsidian}.ts` | pure serialization                                                                                | entities                    | **TDD against fixture**              |
| `library/` (UI)                    | by-item / by-entity browse, filter, enrich-drivers, export panel                                  | enrich, entities, exporters | component/manual                     |

Pure transforms (`entities`, `exporters`, schema mapping) are TDD'd against the real 1313-item fixture. Gemini/media are mocked in units; one live smoke test per external boundary, behind a flag using the founder's key.

## 9. Open questions (resolved-by-default per founder pre-authorization; flag to revisit)

- **Facets in v1?** Ship perception-first (transcript/OCR/entities/takeaways); facets emitted when cheap but treated as secondary (parent §7). _Default: include as secondary, don't gate on them._
- **Free-tier + AI?** BYO-key only in this sub-project; tier/credit policy lives in the licensing sub-project. _Default: AI requires a key; no hosted credits here._
- **Entity alias aggressiveness?** Start conservative (casefold + trim + obvious `@`/`the` stripping); over-merging is worse than under-merging for trust. _Default: conservative, tunable._

## 10. Build order note

Enrichment + entity logic + exporters are buildable now against the spike fixture. The entity-aware Library UI assumes the MV3 shell + IndexedDB storage sub-projects; it can be developed against fixture-seeded IndexedDB and integrated when those land. The plan sequences accordingly.
