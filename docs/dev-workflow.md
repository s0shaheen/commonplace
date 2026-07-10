# Dev workflow: hot-reload + persistent dev browser

Two terminals, one save→reload loop. Terminal A rebuilds and pushes a reload; terminal B is a Chrome
that already has the extension loaded and stays logged into TikTok/Instagram.

## Two-terminal flow

**Terminal A — watcher + reload server**

```
npm run dev
```

Runs the esbuild build in watch mode and starts a WebSocket reload server on
`ws://localhost:9012`. On every successful rebuild it broadcasts `"reload"`. This produces a **DEV
dist/** — it contains the hot-reload client. Do not package this dist for the store (see safety
below).

**Terminal B — persistent dev browser**

```
npm run dev:browser
```

Launches your system Chrome with:

- `--user-data-dir=<repo>/.dev-profile` — a dedicated, gitignored profile. **Never your real Chrome
  profile.** This is what keeps your logins.
- `--load-extension=<repo>/dist` — the extension is auto-loaded (no manual "Load unpacked").
- `--remote-debugging-port=9222` — CDP endpoint for automation (`http://localhost:9222`).
- Opens `tiktok.com` and `instagram.com` in tabs.

It refuses to launch if `dist/` doesn't exist (run `npm run dev` or `npm run build` first) and errors
clearly if Chrome isn't at the standard macOS path (set `CHROME_PATH` to override). Use
`npm run dev:browser -- --print` to print the exact command line without launching.

## One-time login

On the **first** `npm run dev:browser`, log into TikTok and Instagram once in that window. The
`.dev-profile` directory persists the session, so every future launch is already logged in. The
profile is gitignored and completely separate from your everyday Chrome.

## How reload works

1. You save a source file. `npm run dev` rebuilds `dist/` and broadcasts `"reload"` over the
   WebSocket.
2. `src/devReload.ts` (running inside the loaded extension's service worker) receives it, reloads any
   open TikTok/Instagram tabs so freshly-built content scripts re-inject, then calls
   `chrome.runtime.reload()` to swap in the new background/offscreen/popup/options bundles.
3. The client reconnects on close with backoff, so it re-attaches after both the extension reload and
   any dev-server restart.

## Production-safety guard (why this can never ship)

The reload client is gated behind an esbuild `define`, `__DEV_RELOAD__`:

- `npm run dev` sets `__DEV_RELOAD__ = "true"` → `src/devReload.ts` is compiled into `dist/`.
- `npm run build` sets `__DEV_RELOAD__ = "false"` → esbuild dead-code-eliminates the
  `if (__DEV_RELOAD__) { import("./devReload.js") }` branch in `src/background.ts`, dropping the
  client (and its dynamic import) entirely.

`npm run audit` (`scripts/audit-dist.mjs`) enforces this: it fails the build (exit 1, naming the
file) if any file in a production `dist/` contains `devReload`, `ws://localhost`, or
`__DEV_RELOAD__`. `npm run package` runs the audit first and refuses to zip a dist that fails. So the
production path is: `npm run build && npm run audit` → clean dist, `AUDIT PASS`.

## Letting Claude drive TikTok/Instagram (persistent auth)

The question was: can Claude test capture on TikTok/IG using logins that persist, ideally reusing the
real logged-in browser. Three approaches — the recommendation is the **persistent dev profile above**,
not cookie extraction.

**A. Persistent dev profile (recommended, and already built).** `npm run dev:browser` gives a Chrome
that (1) has the extension auto-loaded, (2) keeps its TikTok/IG login across restarts via
`.dev-profile`, and (3) exposes CDP on `http://localhost:9222`. You log in **once**; from then on the
session is native to that browser — a real, normally-established login, which is the *least*
bot-flagged state. Claude drives it by attaching over CDP (`:9222`) — no credential handling, no
copying, and it survives restarts. This is the durable "logins are already ready" setup you asked for.

**B. Claude-in-Chrome against your everyday Chrome (fastest to start).** Your real Chrome is already
logged into both platforms. If the extension is loaded there (or in the dev profile) and the Claude
Chrome extension is connected, Claude can drive that live session directly. Best for a quick
supervised test *today*; it's your foreground session, so it's not unattended and not isolated.

**C. Copying cookies out of your real Chrome — NOT recommended (and I won't set this up).** It's the
tempting "just take my cookies" path, and it's the wrong tool:
- **It's brittle by design now.** Since ~Chrome 127 (2024) macOS uses App-Bound Encryption; cookies
  are Keychain-gated and the scheme changes across Chrome updates. Extraction needs Keychain access
  and breaks on upgrades. (When I probed the encryption scheme during setup, the environment's own
  safety layer *blocked* the read — a fair signal that programmatically handling your auth material is
  exactly what tooling is built to prevent.)
- **It gets your account flagged.** TikTok and Instagram fingerprint the device/session; a cookie
  lifted into a different browser (different UA/TLS/canvas fingerprint) is routinely challenged,
  silently rate-limited, or flagged — putting your *real* account at risk to save a one-time login.
- **It's your most sensitive material.** Extracting and storing live session cookies is a standing
  liability for zero durable benefit over (A), which yields the same "already logged in" result
  safely.

**Bottom line:** log in once in the dev profile (A). It is the same outcome as "reuse my cookies"
without the fragility or the account risk, and it persists across every future browser launch and
automation run.
