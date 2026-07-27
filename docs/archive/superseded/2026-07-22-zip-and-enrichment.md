# ZIP import and enrichment: closing the data gap without the scraper

```
Date:     2026-07-22
Status:   Argued technical direction + buildable-now sequence. Extends the
          2026-07-21 first-iteration decision (import lanes first-class) with the
          enrichment architecture the founder asked for. Governed by, and must
          obey, docs/specs/capture-resilience.md (the audit spec).
Verified: TikTok oEmbed tested live against a real corpus URL 2026-07-22 (result
          in §2). tikwm / Apify / oEmbed capabilities from vendor docs, same day.
Decides:  the enrichment ladder and the free-tier path. Does NOT reopen the spec,
          pricing (G3), or design (G2).
```

---

## 1. The real problem: the ZIP is an index, not content

The TikTok "Download your data" export gives you, per saved video, only four things: the id, the URL, the author handle, and the save date. Every content field the engine needs (description, transcript, poster, music, hashtags, stats) comes back empty. This is not a parser gap; it is what TikTok puts in the file. The DYD lane already built (`src/lib/capture/dydImport.ts`) confirms it in its own contract: "DYD carries only id/url/author/savedAt; every media/stat field the live lane fills is null/empty here."

Instagram's export is richer. `saved_posts.json` carries URL, caption, title, hashtags, owner, and the collection each post sits in. An IG-imported item is text-searchable the moment it lands. A TikTok-imported item is a skeleton the analysis engine has nothing to chew on.

So there are two separate data problems, and conflating them is what made this feel stuck:

- **The index** (what did I save?). The ZIP solves this completely, on every platform, including the saves the live scroller physically cannot reach. This is the answer to the fake-done shortfall from the audit: the export listed 5,989 likes, the scroll reached 5,191, and the ZIP is how you recover the missing 798 and know the true denominator. The ZIP is not a fallback for people who won't scroll. It is the completeness backstop.
- **The content** (what is in each item?). The TikTok ZIP has none of it. Closing that gap is the enrichment problem, and it has a ladder of options with different cost, speed, trust, and completeness tradeoffs.

The clean architecture: **ZIP index, unioned with live-captured content for the reachable head, unioned with enrichment-filled content for the rest, to whatever depth you are willing to pay for in time or money.** The ZIP gives the denominator; capture fills the head richly; enrichment fills the tail.

---

## 2. The enrichment ladder (verified 2026-07-22)

Every row was checked against vendor docs this session; the oEmbed row was tested live against a real video from the founder's corpus.

| Lane | Gets you | Cost | 3rd party sees URLs | Speed | ToS / ban posture |
|---|---|---|---|---|---|
| **TikTok oEmbed** (official) | caption+hashtags (the `title`), author name+handle, 720×1280 poster, video id | free | TikTok (its own official endpoint) | medium; intermittent 400s need retry; undocumented rate cap | cleanest available; official API |
| **Own-session permalink open** (the founder's idea) | the full real envelope: desc, author, music, stats, duration, **subtitleUrl (transcript)**, signed media | free | nobody | slow; one page load per item | own-session read (same as the scraper), but a sequential permalink sweep is a bot-shaped traffic pattern → carries the shadow-ban risk the audit found |
| **tikwm.com** | rich metadata + no-watermark media, ~27 fields | free ≤5,000/day, 1/sec (paid tiers via RapidAPI) | yes (tikwm) | fast | third-party gray service; can disappear; ToS-adjacent |
| **Apify** (clockworks/apidojo/funny_ground actors) | 27 fields + optional MP4/cover; survives redesigns; callable as an MCP tool | ~$0.30–1.70 per 1,000 | yes (Apify) | fast | commercial scraper; the ToS risk sits with Apify, not us |
| **Media + Whisper/OCR** (the engine already has this) | transcript + on-screen text, from any lane that yields a media URL | local compute or managed | depends on lane | slow per item | derived from whatever fetched the media |

**The oEmbed proof (live, 2026-07-22).** Against `https://www.tiktok.com/@agentmaxxing/video/7625746323354029326` from the corpus, oEmbed returned `title` equal to the exact caption with hashtags, `author_name`, `author_unique_id`, `embed_product_id`, and a real signed 720×1280 `thumbnail_url`. That is enough to turn a bare DYD skeleton into a text-searchable, poster-having, author-attributed item, for free, through TikTok's own endpoint. The one caveat: the thumbnail URL is signed and expires (an `x-expires` param), so posters must be fetched eagerly, which is already a capture invariant.

What each lane cannot do:
- oEmbed does not return transcript, stats, or the media file. It gets you the caption, which is most of the searchable text (94% of the live corpus has a real description), but not the 53%-of-corpus transcript depth.
- Transcript only comes from the real envelope's `subtitleUrl` (own-session open, or already captured live) or from downloading media and running Whisper (any lane that yields a media URL).

---

## 3. Recommendation: a tiered enrichment lane, free by default

Build one enricher with a worklist and a tier policy, not four separate integrations. It takes any skeletal item (from a ZIP, or a live capture that missed fields) and fills it to the depth the tier allows.

**Tier 0 — oEmbed, free, official, runs for everyone.** Turns every imported TikTok item into a searchable item (caption, hashtags, author, poster). This is the default and it ships in the free product. It is the reason the product is not gated on the scraper: ZIP plus oEmbed is a usable library on its own.

**Tier 1 — own-session permalink open, free, opt-in, the depth lane.** For items that need the full envelope (transcript, stats, music, signed media), navigate the user's authenticated session to the permalink and intercept TikTok's own signed response, exactly the moat posture (read-only, own session, no forged requests). This gets everything the live scroll lane gets. It is slow and it carries the shadow-ban risk the audit exposed, so it runs through the capture control plane at a conservative pace, as an overnight job over the delta, never a brute-force sweep of all 6,000 at once. Prioritize it: enrich the reachable head from live capture, use oEmbed for the bulk text, and spend the slow own-session lane only on the items that actually need transcript-level depth.

**Tier 2 — managed fast enrichment, paid, optional.** tikwm (free under 5k/day) or Apify (~$10 to richly enrich a 6,000-item library, one time) for users who want speed and will accept a third party touching their public saved URLs. This is the natural home for the paid tier's "you pay for our compute" line, and Apify is callable as an MCP tool, which fits the surface.

For the founder's own pilot corpus right now, the pragmatic path is Tier 2 once (tikwm free over two days, or ~$10 of Apify) to get a fully enriched 6k set fast for the gold-set labeling, while Tier 0 and Tier 1 are what ship in the product.

**Answer to "can we just open each one from the login?"** Yes. It is the richest free lane and it is the only free lane that gets transcript. It is also the same machinery as capture, so it is not a new subsystem. The honest catch is exactly the one the audit already found: a sequential sweep of thousands of permalinks looks more like a bot than scrolling does, so it must be paced, resumable, and challenge-aware, which means it runs on the control plane below, not as a naive loop. Slow but safe, as the depth lane, not the bulk lane.

---

## 4. This is where the audit work pays off, not where it gets lost

The enrichment lane is a new consumer of the exact control plane the 2026-07-10 audit specified (`docs/specs/capture-resilience.md`). It must obey the same invariants (§5 of that spec): pure decision core behind thin glue, network-is-truth, honest incompleteness (a partially-enriched library says so), no bot-hammering, the account-safety kill-switch, and self-verification at every boundary. The own-session lane in particular is the control plane pointed at a permalink worklist instead of a scroll feed: same sensors, same observed-state classification, same single recovery spine, same challenge-pause-and-resume, same ban-detection halt. Without the audit's control plane, "just open each one" would get a user shadow-banned within the hour. With it, it is a paced overnight job that degrades honestly. The audit is the foundation that makes the founder's enrichment idea safe to ship.

Concretely, the enrichment lane reuses: the resumable, checkpointed offscreen job queue; the conservative pacing with full-jitter backoff and session breaks; the typed transport signal and the challenge/empty-200 recovery ladder; the eager signed-URL fetch; and the completeness accounting (captured-plus-enriched versus the ZIP denominator, surfaced honestly).

---

## 5. The buildable-now sequence (nothing here waits on design)

Design (G2) gates only the full Paper & Proof library. Everything below can be built now, in this order, and it is most of Milestone 1.

1. **Capture control plane** (the audit spec, already ratified, in flight). The foundation, and the safety layer the own-session enricher depends on. Build it per `docs/plans/2026-07-10-capture-resilience-plan.md`.
2. **IG ZIP importer.** A pure parser for `saved_posts.json` and `saved_collections` (caption, title, hashtags, owner, collection, timestamp), in the same idiom as `dydImport.ts`. IG items land text-searchable with no enrichment. The founder's own IG export is already in the repo as the first fixture. Straightforward, no design gate.
3. **The ZIP upload surface.** An onboarding/options file drop that accepts the platform export (decide: accept the raw `.zip` via a small dependency like fflate or the browser-native DecompressionStream, versus the current extracted-JSON-only path, which is fine for devs but too fiddly for a consumer), routes to the right parser by platform, shows a reconciliation result (imported versus the ZIP's own declared counts), and kicks Tier-0 enrichment. Plain UI, no design gate.
4. **The tiered enrichment lane** (§3). Pure core (tier decision, field-merge with the monotonic freshness tiebreaker from the audit) plus thin glue (oEmbed fetch, own-session navigate-and-intercept, optional managed adapter). Reuses the control plane. This is the piece that de-gates the product from the scraper.
5. **Pilot gold set plus engine tuning.** Needs the corpus, which now comes from capture or ZIP-plus-enrichment. Founder gate (the spot-check).
6. **MCP plus a minimal inspection UI.** After the library is populated.
7. **Full Paper & Proof library.** Waits on G2.

Steps 1 through 4 are a lot of runway that never touches design. If the founder wants to keep momentum while the design sprint sits, this is the work.

---

## 6. Open decisions and honest risks

| Item | Note |
|---|---|
| ZIP handling dependency | Accept raw `.zip` (needs fflate/DecompressionStream) versus extracted-JSON-only. Recommend raw-zip for the consumer path; it is the difference between "drop the file TikTok gave you" and "unzip it first, find the json, then drop it." |
| oEmbed rate limits | Undocumented and it 400s intermittently; needs retry-with-backoff and conservative pacing. Fine for a background lane, not for a synchronous "enrich 6k now" click. |
| Own-session sweep risk | The audit proved TikTok silently truncates at volume/velocity. The enricher must inherit the ban-detection halt and run slow. Do not let it brute-force the full library in one pass. |
| Transcript coverage on ZIP-only items | oEmbed does not give transcript. Full depth on a DYD-only corpus needs Tier 1 (own-session) or a media-plus-Whisper pass. Set expectations in copy: import gives you a searchable library immediately; transcript-level depth fills in over time or on the paid lane. |
| Third-party privacy line | tikwm and Apify see the user's saved public URLs. Keep them opt-in and off the free/default path, consistent with the "we cannot read your library" posture. |
| Founder's own pilot | Fastest path to a fully enriched 6k set for labeling is one Tier-2 pass (tikwm free over ~2 days, or ~$10 Apify). Separate from what ships. |
```
