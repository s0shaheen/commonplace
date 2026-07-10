// devReload.ts — DEV-ONLY hot-reload client. NEVER SHIPS.
//
// This module is imported by background.ts ONLY inside `if (__DEV_RELOAD__) { … }`. In a production
// build esbuild defines `__DEV_RELOAD__ = false`, dead-code-eliminates that branch, and drops this
// module entirely — verified by scripts/audit-dist.mjs, which fails the build if the string
// "devReload" / "ws://localhost" / "__DEV_RELOAD__" ever appears in dist/.
//
// Behaviour: connect to the dev watcher's WebSocket (scripts/dev.mjs). On a "reload" message —
// reload any open TikTok/Instagram tabs (so freshly-built content scripts re-inject) then call
// chrome.runtime.reload() (swaps in the new background/offscreen/popup/options bundles). Reconnect
// on close with a small backoff so it re-attaches after BOTH the extension reload and dev-server
// restarts. Every failure path is swallowed — this must never throw into the service worker.

export {}; // mark this file as a module (it has side-effects only) so `import()` resolves it

const DEV_RELOAD_URL = "ws://localhost:9012";
const RECONNECT_MIN_MS = 500;
const RECONNECT_MAX_MS = 5000;

// Query the platform tabs whose content scripts need to re-inject after a rebuild, and reload them.
async function reloadContentTabs(): Promise<void> {
  try {
    const tabs = await chrome.tabs.query({
      url: ["*://*.tiktok.com/*", "*://*.instagram.com/*"],
    });
    await Promise.all(
      tabs.map((t) =>
        t.id != null ? chrome.tabs.reload(t.id).catch(() => {}) : Promise.resolve(),
      ),
    );
    console.log(`[dev-reload] reloaded ${tabs.length} content tab(s); reloading extension…`);
  } catch (e) {
    console.log("[dev-reload] tab reload failed (non-fatal):", (e as Error).message);
  }
}

function connect(backoff = RECONNECT_MIN_MS): void {
  let socket: WebSocket;
  try {
    socket = new WebSocket(DEV_RELOAD_URL);
  } catch {
    scheduleReconnect(backoff);
    return;
  }

  socket.addEventListener("open", () => {
    console.log(`[dev-reload] connected to ${DEV_RELOAD_URL} — save a file to hot-reload`);
  });

  socket.addEventListener("message", (ev) => {
    if (ev.data !== "reload") return;
    // Reload content tabs first, THEN reload the extension. chrome.runtime.reload() tears down this
    // service worker (and this socket), so it must be the last thing we do.
    void reloadContentTabs().finally(() => {
      try {
        chrome.runtime.reload();
      } catch {
        /* swallow — nothing we can do if reload itself fails */
      }
    });
  });

  socket.addEventListener("close", () => scheduleReconnect(backoff));
  // An 'error' is always followed by 'close'; swallow it so it never surfaces as an unhandled event.
  socket.addEventListener("error", () => {
    try {
      socket.close();
    } catch {
      /* ignore */
    }
  });
}

function scheduleReconnect(backoff: number): void {
  const next = Math.min(backoff * 2, RECONNECT_MAX_MS);
  setTimeout(() => connect(next), backoff);
}

connect();
