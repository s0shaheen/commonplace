# TikTok Hidden (Unofficial) Web API — Endpoint & Parameter Reference

> Source: traktok (GPL-3.0) R package, read for endpoint facts only. Endpoint
> URLs/params are facts, not copyrightable; no GPL code was copied.
>
> Repo: https://github.com/JBGruber/traktok — files read: `R/api_hidden.r`,
> `R/auth_hidden.r`, `R/parse_hidden.r`, `R/utils.R`, `R/shorthands.r`,
> `R/auth_check.r`, `R/last_.r`. Captured 2026-05-26 (`main` branch).

## TL;DR for a browser-extension developer

- traktok's **hidden API path does NOT sign requests.** There is no X-Bogus,
  `_signature`, X-Gnarly, or msToken generation/computation anywhere in the
  hidden code. It relies entirely on **logged-in cookies** copied from the
  browser (via the `cookiemonster` package), and lets the browser/TikTok's own
  `set-cookie` (incl. `msToken`) ride along in the cookie jar. A browser
  extension running in-page already has all of this for free.
- Only **one real JSON API endpoint** is hit by the hidden path:
  `GET https://www.tiktok.com/api/user/list/` (followers / following).
- Everything else (single-video metadata, a user's whole video list, search) is
  obtained by **scraping the rendered HTML page** and reading TikTok's embedded
  hydration JSON blob (`#__UNIVERSAL_DATA_FOR_REHYDRATION__`, legacy
  `#SIGI_STATE`), or by driving a headless Chromium and scrolling.
- **There is NO hidden endpoint for Saved/Favorites/bookmarks, and none for
  Liked or Comments.** Those exist in traktok only on the official Research API
  path (`tt_user_liked_videos_api`, `tt_comments_api`). See the "Favorites"
  section at the bottom for what the web app actually uses.

---

## 1. Single video / photo metadata — HTML scrape (no JSON API call)

`R/api_hidden.r` → `tt_request_hidden()` / `tt_videos_hidden()` / `get_video()`;
parsed in `R/parse_hidden.r` → `parse_video()`.

|                |                                                                                                                                                                                                                                                                                                                                        |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| URL            | `https://www.tiktok.com/@<user>/video/<id>` or `.../photo/<id>` (the public watch page). IDs are normalized to `https://www.tiktok.com/@/video/<id>` by `id2url()` in `utils.R`.                                                                                                                                                       |
| Method         | `GET`                                                                                                                                                                                                                                                                                                                                  |
| Query params   | none — it requests the HTML page itself                                                                                                                                                                                                                                                                                                |
| Headers (sent) | `Accept-Encoding: gzip, deflate, sdch`; `Accept-Language: en-US,en;q=0.8`; `Upgrade-Insecure-Requests: 1`; `User-Agent: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/56.0.2924.87 Safari/537.36`; `Accept: text/html,application/xhtml+xml,...`; `Cache-Control: max-age=0`; `Connection: keep-alive` |
| Cookies        | full `www.tiktok.com` cookie string passed via curl `cookie` option. Warns if empty (likely to fail without login).                                                                                                                                                                                                                    |
| Signing        | **None.**                                                                                                                                                                                                                                                                                                                              |
| Response       | HTML. traktok extracts the text of `#SIGI_STATE` **or** `#__UNIVERSAL_DATA_FOR_REHYDRATION__` (CSS selector `"#SIGI_STATE,#__UNIVERSAL_DATA_FOR_REHYDRATION__"`) and parses that JSON.                                                                                                                                                 |

**JSON shape the parser reads** (two layouts handled, `parse_video()`):

- Legacy `SIGI_STATE`: video object at `ItemModule[<video_id>]`; author at
  `UserModule.users[1]`.
- Current `__UNIVERSAL_DATA_FOR_REHYDRATION__`: video object at
  `__DEFAULT_SCOPE__["webapp.video-detail"].itemInfo.itemStruct`.
- Status fields at `__DEFAULT_SCOPE__["webapp.video-detail"].statusCode` /
  `.statusMsg` (`statusCode == 0` means OK).
- Useful leaf fields under the item struct: `createTime`, `desc`,
  `video.duration`, `video.downloadAddr`, `video.playAddr`,
  `imagePost.images[].imageURL.urlList` (for photo slideshows), `stats.diggCount`
  / `shareCount` / `commentCount` / `playCount`, `author.id`, `author.secUid`,
  `author.uniqueId`, `author.nickname`, `music`, `challenges`.

On HTTP >= 400 it fabricates a stub JSON
`{"__DEFAULT_SCOPE__":{"webapp.video-detail":{"statusCode":"<code>","statusMsg":"html_error"}}}`.

**Video file download:** `save_video()` downloads `video.downloadAddr` (falls
back to `playAddr`) with `curl`, sending the same cookie string and
`Referer: https://www.tiktok.com/`. The download URL is session-bound and
expires; on failure it re-fetches the page to get a fresh URL.

---

## 2. Followers — JSON API ✅ (the only real hidden JSON endpoint)

`R/api_hidden.r` → `tt_get_follower_hidden()`. Response parsed by
`parse_followers()` in `parse_hidden.r`.

|              |                                                                 |
| ------------ | --------------------------------------------------------------- |
| URL          | `https://www.tiktok.com/api/user/list/`                         |
| Method       | `GET`                                                           |
| Query params | `count=30`, `minCursor=<cursor>`, `scene=67`, `secUid=<secUid>` |
| Cookies      | full `tiktok.com` cookie string (curl `cookie` option)          |
| Headers      | none beyond curl defaults                                       |
| Signing      | **None** (no msToken/X-Bogus added)                             |

- `secUid` is the user's opaque stable ID, obtained from
  `tt_user_info_hidden()` (see §5) — **not** the @username.
- `scene=67` = **followers** list.

## 3. Following — JSON API ✅

`R/api_hidden.r` → `tt_get_following_hidden()`. Identical to §2 except:

|              |                                                                 |
| ------------ | --------------------------------------------------------------- |
| URL          | `https://www.tiktok.com/api/user/list/`                         |
| Query params | `count=30`, `minCursor=<cursor>`, `scene=21`, `secUid=<secUid>` |

- `scene=21` = **following** list. (So `scene` selects which relationship list:
  `67`=followers, `21`=following.)

**Pagination (both §2 and §3):**

- Loop while `hasMore == TRUE` in the response.
- Send the previous response's `minCursor` back as the next request's
  `minCursor` query param (starts at `0`).
- Item list lives at response key `userList` (array). Each element has `user`
  and `stats` sub-objects (parser does `bind_cols(f$user, f$stats)`).
- Response top-level keys used: `userList`, `hasMore`, `minCursor`, `total`.
- Hard cap noted in docs: ~5,000 accounts max.
- Rate limiting: `wait(sleep_pool)` between pages (see §7).

---

## 4. A user's full video list — headless browser scroll (no JSON API call)

`R/api_hidden.r` → `tt_user_videos_hidden()`.

|             |                                                                                                                                                            |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| URL         | `https://www.tiktok.com/@<username>` (profile page)                                                                                                        |
| Method      | rendered via `rvest::read_html_live()` (headless Chromium / chromote)                                                                                      |
| Mechanism   | repeatedly `scroll_to(top = 1e5)` until scroll position stops growing or `scroll` time budget elapses; then harvest anchor hrefs                           |
| URL harvest | `extract_urls_sess()` in `utils.R`: CSS `[id*='grid-item-container'] a, [id*='column-item-video-container'] a`, keep hrefs matching `/video/` or `/photo/` |
| Output      | the discovered video URLs are then fed back through `tt_videos_hidden()` (§1) to get per-video metadata                                                    |
| Captcha     | `solve_captcha()` watches for `#captcha-verify-image` / `.captcha-verify-container`; can open the browser for manual solving                               |
| Signing     | **None.** Pure browser automation + the logged-in session cookies.                                                                                         |

No cursor/JSON pagination — pagination is literally infinite-scroll of the DOM.

## 4b. Search — headless browser scroll (no JSON API call)

`R/api_hidden.r` → `tt_search_hidden()`.

|           |                                                                                                                                |
| --------- | ------------------------------------------------------------------------------------------------------------------------------ |
| URL       | `https://www.tiktok.com/search?q=<query>`                                                                                      |
| Method    | headless Chromium via `read_html_live`; cookies injected with `sess$session$Network$setCookies(...)`                           |
| Mechanism | same scroll-until-stable loop + captcha handling as §4; harvest `/video/` & `/photo/` hrefs, then pass to `tt_videos_hidden()` |
| Notes     | needs logged-in cookies to get more than ~6 results                                                                            |

**Dead/legacy JSON search endpoint:** `parse_hidden.r` still contains
`parse_search()`, which expects a JSON response with item list at `data[]`
(each `item` has `author.uniqueId`, `id`, `createTime`, `stats.*`), cursor at
top-level `cursor`, `has_more`, and `log_pb.impr_id` (search id). **It is not
called anywhere in the current code** — the JSON search endpoint stopped
returning results (repo issue #14), so search was rewritten as browser
scrolling. The `data[] / cursor / has_more / log_pb.impr_id` shape is the
artifact of TikTok's old `/api/search/...` JSON response, useful as a hint for
what an extension would see if hitting search JSON directly.

---

## 5. User info — headless browser scrape (no JSON API call)

`R/api_hidden.r` → `tt_user_info_hidden()`; parsed by `parse_user()`.

|          |                                                                                                                                                                                                                  |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| URL      | `https://www.tiktok.com/@<username>`                                                                                                                                                                             |
| Method   | `rvest::read_html_live()` then read `#__UNIVERSAL_DATA_FOR_REHYDRATION__` text                                                                                                                                   |
| Response | user object at `__DEFAULT_SCOPE__["webapp.user-detail"].userInfo`, with `user` and `stats` sub-objects. `secUid` (renamed from `sec_uid`) comes from here — this is how you obtain the `secUid` needed by §2/§3. |
| Signing  | **None.**                                                                                                                                                                                                        |

---

## 6. Authentication model (`auth_hidden.r`, `auth_check.r`)

- Auth = **cookies only.** `auth_hidden()` either ingests a Netscape-format
  `cookies.txt` (`cookiemonster::add_cookies(cookiefile)`) or drives a live
  Chromium login (`read_html_live("https://www.tiktok.com/")`, click
  `#header-login-button`, wait until `#loginContainer` disappears, then capture
  the session cookies).
- All hidden calls fetch the cookie jar with
  `cookiemonster::get_cookies("^(www.)*tiktok.com", as = "string" | "list")`.
- No token exchange, no signature secret, no msToken minting. msToken (if
  present) is just another cookie carried in the jar; TikTok itself sets/rotates
  it via `set-cookie` (traktok stashes the response's `set-cookie` header on the
  returned object but does nothing else with it).

**Implication for a browser extension:** running in the page origin you inherit
the same cookies (including `msToken`, `tt_chain_token`, `sessionid`, etc.). To
call `/api/user/list/` you still need to supply the params TikTok's own JS
normally signs (`X-Bogus`/`X-Gnarly`/`msToken` query params + `aid=1988`,
`app_name=tiktok_web`, `device_id`, `webId`, etc.). traktok gets away **without**
those signed params on `/api/user/list/`, which suggests that endpoint is
lenient when a valid logged-in cookie is present — but this is environment- and
time-dependent and TikTok may tighten it.

---

## 7. Rate limiting / delay logic

`R/utils.R` → `wait()`:

```r
sleep <- stats::runif(1) * sample(sleep_pool, 1L)
Sys.sleep(sleep)
```

- `sleep_pool` defaults to `1:10` (seconds). Each delay = `runif(1)` (a random
  fraction in [0,1)) × one randomly sampled integer from the pool → an
  irregular sub-10s pause.
- Applied between videos in `tt_videos_hidden()` (skipped for cached/last item),
  and between pages in `tt_get_follower_hidden` / `tt_get_following_hidden`
  (`if (hasMore) wait(sleep_pool)`).
- Browser-scroll functions (§4, §4b) instead sleep `timeout * runif(1, 1, 3)`
  between scrolls (`timeout` default 5s → 5–15s per scroll).
- HTTP retries via httr2 `req_retry(max_tries = 5L)`; per-request timeout 60s;
  errors swallowed (`req_error(is_error = function(x) FALSE)`) so failed rows
  become NAs rather than throwing.

---

## 8. Saved / Favorites / Bookmarks — explicitly NOT covered by traktok

**Answer: No.** traktok's hidden path hits **no** endpoint for a user's
saved/favorites/bookmarked collection. It also has **no hidden endpoint for
Liked videos or Comments**:

- `tt_get_liked` is just an alias for `tt_user_liked_videos_api` (Research API).
- `tt_comments` is an alias for `tt_comments_api` (Research API).
- `R/shorthands.r` confirms these aliases; `grep` across all hidden-path files
  found zero references to `liked`, `collection`, `favorite`, `bookmark`,
  `item_list`, or `item/list`.

The only relationship-list endpoint hit is `/api/user/list/` (followers/
following), and the only "your content" access is via profile-page scrolling
(public posts only).

**What the Favorites tab WOULD use** (inference from the patterns above and
TikTok's public web app; not from traktok code): the web client's Favorites/
collections tab is served by the same `post/item_list`-style JSON family that
backs profile video lists. The relevant endpoints (verify live before relying on
them) are typically:

- `GET https://www.tiktok.com/api/user/collection/item_list/` — items inside a
  named collection (params include `collectionId`, `cursor`, `count`).
- `GET https://www.tiktok.com/api/user/collection/list/` — the list of a user's
  collections.
- `GET https://www.tiktok.com/api/favorite/item_list/` — the legacy "Favorites"
  feed for a `secUid` (params `secUid`, `cursor`, `count`).
- `GET https://www.tiktok.com/api/post/item_list/` — a user's own posts (the
  JSON sibling of the profile scroll), params `secUid`, `cursor`, `count`.

All of these follow the same web-API param/pagination convention seen on
`/api/user/list/` and in the dead `parse_search`: common params `aid=1988`,
`app_name=tiktok_web`, `device_id`/`webId`, `secUid`, `cursor` (or `minCursor`),
`count`, plus signed `msToken` / `X-Bogus` (or newer `X-Gnarly`) that TikTok's
in-page JS computes. Pagination is `cursor` in → response `cursor` + `hasMore`;
item array under `itemList` (newer) or `items`. An in-page browser extension can
either (a) read the same hydration JSON traktok scrapes, or (b) call these JSON
endpoints reusing the page's existing signed-request machinery rather than
re-implementing the signature.
