// Runs in the page's MAIN world. Skims TikTok's OWN already-signed item_list responses.
// Matches every *_list variant: collect (Favorites), favorite (Likes), post (Posts), repost — confirmed via recon.
import { parseItemListEnvelope, classifyTransport } from "./lib/capture/interceptParse.js";

(() => {
  const TARGET = /\/api\/[^?]*item_list/i;

  // Map the endpoint's discriminating path segment to a human-readable capture source,
  // so Likes and Favorites (and Posts/Reposts) stay distinguishable in the merged corpus.
  function sourceFromUrl(url) {
    const seg = ((/\/([a-z_]+)\/item_list/i.exec(url || "") || [])[1] || "").toLowerCase();
    return { collect: "favorites", favorite: "likes", post: "posts", repost: "reposts" }[seg] || seg || "other";
  }

  // scrollMotion's decisive discriminator (§6.1 §A4): a MONOTONIC count of item_list requests
  // INITIATED. content.js reads this to tell a self-inflicted lazy-load stall (no request even fired ⇒
  // retrigger) from genuine server backpressure (a request fired, came back empty/429 ⇒ backoff). We
  // bump the instant a matching request STARTS — around the fetch await, and in the XHR send path —
  // not when it resolves, so "did we even ask?" is answered independently of whether an answer came.
  let requestsIssued = 0;
  function bumpRequestIssued() {
    requestsIssued++;
    try {
      window.postMessage({ __attic: true, kind: "request_issued", count: requestsIssued }, "*");
    } catch (_) {}
  }

  // Forward a TYPED transport signal + (only on a healthy page) parsed items. INJ-02/COMPL-01/SESS-01
  // (§6.5): the old code did `res.clone().json()` and swallowed every non-2xx / empty-200 / HTML /
  // offline into a dropped promise, so content.js saw them as a generic "scrolling stopped." Now we
  // ALWAYS post an item_list message carrying `transport`, so the reducer/recovery can branch:
  //   - transport "ok"  → parse the envelope (items + paging signals) as before.
  //   - otherwise       → items:[], hasMore:true (NEVER a false done), cursor:null — the signal alone
  //                       is what content.js needs (empty_ok → flagged-session ladder, challenge →
  //                       pause+notify, http_error → scrollState backoff).
  function emit(url, transport, text) {
    const source = sourceFromUrl(url);
    let items = [];
    let hasMore = true; // never a false "done" off a non-ok transport
    let cursor = null;
    if (transport === "ok") {
      try {
        const parsed = parseItemListEnvelope(JSON.parse(text), source);
        items = parsed.items;
        hasMore = parsed.hasMore;
        cursor = parsed.cursor;
      } catch (_) {
        // A classified-ok body that still won't parse: forward the signal with safe defaults rather
        // than dropping it (a dropped message would read as silence, not "more may exist").
      }
    }
    try {
      window.postMessage({ __attic: true, kind: "item_list", url, source, items, hasMore, cursor, transport }, "*");
    } catch (_) {}
  }

  // Read the transport-level facts the pure classifier needs, then emit. `res.clone().text()` (not
  // .json()) so an empty/HTML/error body survives to be classified instead of rejecting a .json().
  async function forwardFetch(url, res) {
    let text = "";
    try {
      text = await res.clone().text();
    } catch (_) {}
    let contentType = "";
    try {
      contentType = res.headers.get("content-type") || "";
    } catch (_) {}
    const transport = classifyTransport({
      ok: res.ok,
      status: res.status,
      contentType,
      bodyText: text,
      online: navigator.onLine,
    });
    emit(url, transport, text);
  }

  const origFetch = window.fetch;
  window.fetch = async function (...args) {
    let matchedUrl = null;
    try {
      const u = typeof args[0] === "string" ? args[0] : args[0]?.url;
      if (u && TARGET.test(u)) {
        matchedUrl = u;
        bumpRequestIssued(); // INITIATED — bump before the await so "did we ask?" is answered now
      }
    } catch (_) {}
    const res = await origFetch.apply(this, args);
    if (matchedUrl) {
      void forwardFetch(matchedUrl, res);
    }
    return res;
  };

  const origOpen = XMLHttpRequest.prototype.open;
  const origSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function (method, url, ...rest) {
    this.__atticUrl = url;
    return origOpen.call(this, method, url, ...rest);
  };
  XMLHttpRequest.prototype.send = function (...a) {
    if (this.__atticUrl && TARGET.test(this.__atticUrl)) bumpRequestIssued(); // INITIATED
    // Bind the `load` listener ONCE per XHR object. A reused XHR (open→send more than once) would
    // otherwise attach a fresh listener on every send and double-emit each response; a single
    // listener re-reads `this.__atticUrl`/`this.status` at fire time, so it stays correct across
    // reuse (open() refreshes __atticUrl) while emitting exactly once per completed request.
    if (!this.__atticBound) {
      this.__atticBound = true;
      this.addEventListener("load", function () {
        try {
          if (this.__atticUrl && TARGET.test(this.__atticUrl)) {
            const text = this.responseText || "";
            let contentType = "";
            try {
              contentType = this.getResponseHeader("content-type") || "";
            } catch (_) {}
            const transport = classifyTransport({
              ok: this.status >= 200 && this.status < 300,
              status: this.status,
              contentType,
              bodyText: text,
              online: navigator.onLine,
            });
            emit(this.__atticUrl, transport, text);
          }
        } catch (_) {}
      });
    }
    return origSend.apply(this, a);
  };
})();
