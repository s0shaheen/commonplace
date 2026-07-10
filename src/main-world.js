// Runs in the page's MAIN world. Skims TikTok's OWN already-signed item_list responses.
// Matches every *_list variant: collect (Favorites), favorite (Likes), post (Posts), repost — confirmed via recon.
import { parseItemListEnvelope } from "./lib/capture/interceptParse.js";

(() => {
  const TARGET = /\/api\/[^?]*item_list/i;

  // Map the endpoint's discriminating path segment to a human-readable capture source,
  // so Likes and Favorites (and Posts/Reposts) stay distinguishable in the merged corpus.
  function sourceFromUrl(url) {
    const seg = ((/\/([a-z_]+)\/item_list/i.exec(url || "") || [])[1] || "").toLowerCase();
    return { collect: "favorites", favorite: "likes", post: "posts", repost: "reposts" }[seg] || seg || "other";
  }

  function emit(url, json) {
    try {
      // §2.3 fix: parse + NORMALIZE here, in the MAIN world, and post only the SLIM items — never the
      // heavy raw envelope (which used to be structured-cloned to content.js and re-serialized to the
      // SW, a full-payload copy on the page thread every page, forever). parseItemListEnvelope reuses
      // capture.js's extractItems (single source of truth for record shape) and drops the bulky
      // `raw`/`video` sub-objects on the way out; it also reads TikTok's paging signals — `hasMore`
      // coerced defensively (missing → more-may-exist, never a false "done") and a String()-safe
      // `cursor` (cursor→maxCursor→max_cursor). Passing `source` in means items arrive already
      // source-tagged (sources:[source]), so the SW no longer re-normalizes — see interceptParse.ts.
      const source = sourceFromUrl(url);
      const { items, hasMore, cursor } = parseItemListEnvelope(json, source);
      window.postMessage({ __attic: true, kind: "item_list", url, source, items, hasMore, cursor }, "*");
    } catch (_) {}
  }

  const origFetch = window.fetch;
  window.fetch = async function (...args) {
    const res = await origFetch.apply(this, args);
    try {
      const url = typeof args[0] === "string" ? args[0] : args[0]?.url;
      if (url && TARGET.test(url)) {
        res
          .clone()
          .json()
          .then((json) => emit(url, json))
          .catch(() => {});
      }
    } catch (_) {}
    return res;
  };

  const origOpen = XMLHttpRequest.prototype.open;
  const origSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function (method, url, ...rest) {
    this.__atticUrl = url;
    return origOpen.call(this, method, url, ...rest);
  };
  XMLHttpRequest.prototype.send = function (...a) {
    this.addEventListener("load", function () {
      try {
        if (this.__atticUrl && TARGET.test(this.__atticUrl)) {
          emit(this.__atticUrl, JSON.parse(this.responseText));
        }
      } catch (_) {}
    });
    return origSend.apply(this, a);
  };

  console.log("[attic-spike] MAIN-world interceptor installed");
})();
