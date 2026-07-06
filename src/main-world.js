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
      window.postMessage({ __attic: true, kind: "item_list", url, source: sourceFromUrl(url), json }, "*");
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
