// Runs in the page's MAIN world. Skims TikTok's OWN already-signed item_list responses.
// Matches every *_list variant: collect (Favorites), favorite (Likes), post (Posts), repost — confirmed via recon.
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
      // Forward TikTok's own paging signals RAW alongside the payload (Task 1). We do NOT coerce
      // here — the page world stays dumb transport; the defensive coercion (missing → more-may-exist)
      // lives in the tested pure module `coerceHasMore`, which content.js applies. `cursor` falls
      // back through maxCursor/max_cursor. Shape is UNVERIFIED in recon (recon/0.1-findings.md:8) —
      // hence raw pass-through so the parser, not this glue, owns the interpretation.
      const hasMore = json && typeof json === "object" ? json.hasMore : undefined;
      const cursor =
        json && typeof json === "object" ? json.cursor ?? json.maxCursor ?? json.max_cursor ?? null : null;
      window.postMessage(
        { __attic: true, kind: "item_list", url, source: sourceFromUrl(url), json, hasMore, cursor },
        "*"
      );
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
