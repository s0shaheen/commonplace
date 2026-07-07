# Block-0 Spike #1 — Instagram live saved-view interception

**Result: PASS — live-IG capture is viable and is PROMOTED to a v1 headline lane (G4 rule satisfied).**
Run 2026-07-07 in the founder's own logged-in session (`instagram.com/s0shaheen/saved/all-posts/`), read-only, via the Claude Chrome extension.

## The G4 rule
> *Promote live-IG to a headline iff the spike shows a stable interceptable XHR; otherwise ZIP stays primary and live ships as best-effort experimental.* (SPEC §7)

The spike shows exactly that. **Promoted.** ZIP import stays as the guaranteed fallback lane (offline / ban-scared / zero-scroll), but live interception is now a first-class v1 capture path for Instagram, matching TikTok.

## What was verified (live, with evidence)

1. **The saved view fires an interceptable request.** Scrolling the saved grid triggers the browser's native network panel to record:
   `GET https://www.instagram.com/api/v1/feed/saved/posts/?max_id=<opaque> → 200`
   Caught twice by the extension's native `read_network_requests`. This is the page's *own* authenticated request — precisely what a MAIN-world passive interceptor reads.

2. **Single JSON blob, not streamed.** Response is `application/json`, one object per page (not NDJSON / streamed JSON-lines). Top-level keys (captured via a `JSON.parse` hook on IG's own response — structural keys only, no user data pulled):
   `auto_load_more_enabled · items · more_available · next_max_id · num_results · status`
   `num_results` = 21 items/page on the observed call.

3. **Clean cursor pagination.** `more_available` (bool) + `next_max_id` (opaque cursor) — the same pagination *family* as TikTok's `item_list`. The existing interception + dedupe architecture handles this shape with an adapter, not a rewrite.

4. **Item shape is rich and enrichable.** Each item wraps as `{ media: {...} }`; the media object carries (presence confirmed, values not read):
   `pk · code · media_type · product_type · video_versions · image_versions2 · caption · user · clips_metadata · taken_at` (and `carousel_media` / `location` where applicable — absent on the first item of the observed page, present in the schema).
   → The live lane carries **media renditions** (the actual video) plus captions, music (`clips_metadata.music_info`), and creator — i.e. it is enrichable *end-to-end incl. the media-derived signals* (transcript/OCR/scene). The DYD ZIP (below) carries the text metadata but not the media, so live is the deeper lane.

5. **The passive-observe posture is the ONLY path — reconfirmed.** A *constructed* fetch to the same endpoint returns **400** (missing the page's own `x-ig-app-id`/signed headers); a credentialed construction was correctly blocked by the extension's own data-exfiltration guardrail. Constructing fails; observing the page's own already-signed response succeeds. "Stop trying to sign the request" — the TikTok lesson holds identically for IG.

## De-risking finding (better than the brief feared)

The brief carried a worry about IG **doc_id rotation** (the instaloader/instagrapi failure mode). **It does not apply to this path:** `/api/v1/feed/saved/posts/` is a REST-style private endpoint with an opaque `max_id` cursor — **not** a GraphQL `doc_id` hashed-query endpoint. There is no per-2-4-week doc_id to chase here. The real maintenance surface is ordinary response-**shape** drift (a bounded normalizer tax), the same as any adapter.

## Honest limits of this spike

- **One session, one day.** "Shape stability over weeks" is by definition unobservable in a single run; it becomes an ongoing adapter-health signal (SPEC §25 telemetry), not a launch blocker.
- **Values were never read.** Only structural keys/booleans/counts were extracted — the guardrail correctly fenced session data, and the spike didn't need it. Field-level normalization against a real capture is a Block-3 adapter task.
- **Interception timing.** A `window.fetch` override installed *after* page load did **not** catch IG's calls (IG closures its fetch reference early) — confirming the production interceptor must inject at `document_start` in the MAIN world (which the TikTok capture already does). The `JSON.parse` hook worked because parse is called fresh per response.

## Consequence for the plan
- SPEC §7 Instagram: **live lane promoted to headline**; ZIP remains the guaranteed fallback.
- Block-3 IG adapter targets `/api/v1/feed/saved/posts/`, `{media}` wrapper, `max_id` cursor.
- No GraphQL doc_id machinery needed for the saved lane.

---

# IG "Download Your Data" ZIP lane — schema verified (same day)

Verified against the founder's real export (`instagram-s0shaheen-2026-07-06-…zip`, gitignored). This is the **fallback lane**; live capture (above) is the headline.

**File:** `your_instagram_activity/saved/saved_posts.json` — a top-level **array** (197 entries here). Each entry:
```
{ timestamp: <unix>, media: [], fbid: "<id>",
  label_values: [ {label:"URL", value/href:<permalink>}, {label:"Caption", value:<text>},
                  {label:"Title", value:<text>}, {label:"Hashtags", value:<text>},
                  {label:"Owner", dict:[…creator profile + bio links (linktr.ee/beacons.ai)…]} ] }
```
**`your_instagram_activity/saved/saved_collections.json`** — array of collections (3 here); each holds nested `dict` arrays of member posts (same URL/Owner shape) under a collection `title`.

**Correction to SPEC §7 (upgrade):** the ZIP is **not discovery-only** — `saved_posts` carries **Caption + Title + Hashtags + Owner** per post, so the ZIP lane seeds real text metadata (caption/hashtag/owner search) immediately; it lacks only the *media-derived* signals (transcript, on-screen text, scene) that need the video the live lane fetches. All 197 posts carry an `instagram.com` permalink → the join key that lets the live lane later enrich a ZIP-imported item.

**Media note (spike #3):** the ZIP's only media (6 mp4 / 22 jpg) are the founder's **own posts** under `media/`, not saves — so the native-vs-VTT pipeline experiment still needs fresh media capture, not this export.

**Block-3 IG-DYD importer contract:** parse `saved_posts.json` array → per entry map `label_values` by `label` → emit open-schema `{post: {url, caption, title, hashtags, owner}, save: {saved_at: timestamp, source: "instagram_saved"}}`; parse `saved_collections.json` → collection membership keyed on the same permalink. Synthetic fixture: `fixtures/ig-saved-sample.json`.
