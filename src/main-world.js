// Runs in the page's MAIN world. Skims TikTok's OWN already-signed item_list responses.
// Matches /api/user/collect/item_list/ (Favorites) plus post/favorite variants — confirmed via recon.
(() => {
  const TARGET = /\/api\/[^?]*item_list/i;

  function emit(url, json) {
    try {
      window.postMessage({ __attic: true, kind: "item_list", url, json }, "*");
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
