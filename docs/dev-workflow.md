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
