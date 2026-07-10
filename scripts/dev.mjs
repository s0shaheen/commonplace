// dev.mjs — the hot-reload dev entrypoint (`npm run dev`).
//
// It does three things:
//   1. Runs the SAME esbuild build as scripts/build.mjs, but in CONTEXT/watch mode (imported
//      esmOptions/iifeOptions — one source of truth, no duplicated config), with `__DEV_RELOAD__`
//      defined TRUE so the dev-only reload client (src/devReload.ts) is compiled INTO dist/.
//   2. Runs a tiny WebSocket server on ws://localhost:9012.
//   3. On every successful rebuild, broadcasts a "reload" message. The reload client in the loaded
//      extension receives it, reloads any open TikTok/Instagram tabs, then calls chrome.runtime.reload().
//
// This dist/ is a DEV dist (it contains the reload client) — never package it for the store. The prod
// path (`npm run build` → `npm run audit`) strips the client and the audit guard fails if it leaks.

import * as esbuild from "esbuild";
import { mkdirSync, rmSync } from "node:fs";
import { WebSocketServer } from "ws";
import { esmOptions, iifeOptions, copyStatics, DIST } from "./build.mjs";
import { buildValidators } from "./build-validators.mjs";

const PORT = 9012;

// ── WebSocket reload server ───────────────────────────────────────────────────────────────────
const wss = new WebSocketServer({ port: PORT, host: "127.0.0.1" });
wss.on("listening", () => {
  console.log(`[dev] watching + reload server on ws://localhost:${PORT}`);
});
wss.on("error", (err) => {
  if (err && err.code === "EADDRINUSE") {
    console.error(`[dev] port ${PORT} already in use — is another \`npm run dev\` running? Exiting.`);
    process.exit(1);
  }
  console.error("[dev] websocket server error:", err);
});
wss.on("connection", (sock) => {
  console.log(`[dev] extension connected (${wss.clients.size} client${wss.clients.size === 1 ? "" : "s"})`);
  sock.on("close", () => console.log(`[dev] extension disconnected (${wss.clients.size} client${wss.clients.size === 1 ? "" : "s"})`));
});

function broadcastReload() {
  // An incremental rebuild only rewrites the changed bundle's JS. The OTHER bundle's outputs and the
  // static assets (manifest.json, *.html, rules.json, prompts/) are NOT re-emitted — and a prior
  // wipe/incremental-rebuild can leave dist/ missing them, which surfaces as Chrome's
  // "Manifest file is missing or unreadable". So re-copy statics on EVERY rebuild to keep dist/ a
  // complete, loadable extension at all times.
  try {
    copyStatics();
  } catch (e) {
    console.error("[dev] copyStatics failed — dist/ may be incomplete:", e.message);
  }
  let n = 0;
  for (const client of wss.clients) {
    if (client.readyState === 1 /* OPEN */) {
      client.send("reload");
      n++;
    }
  }
  console.log(`[dev] rebuild → statics refreshed, broadcast "reload" to ${n} client${n === 1 ? "" : "s"}` + (n === 0 ? " (none connected yet)" : ""));
}

// Both the ESM and IIFE contexts fire onEnd on every rebuild; debounce so one save = one broadcast.
let debounce = null;
function scheduleBroadcast() {
  clearTimeout(debounce);
  debounce = setTimeout(broadcastReload, 120);
}

const reloadNotifyPlugin = {
  name: "cp-dev-reload-notify",
  setup(build) {
    build.onEnd((result) => {
      if (result.errors.length > 0) {
        console.error(`[dev] build failed with ${result.errors.length} error(s) — not reloading`);
        return;
      }
      scheduleBroadcast();
    });
  },
};

// Dev overrides: compile the reload client IN (__DEV_RELOAD__ = "true") + inline sourcemaps.
const withDev = (opts) => ({
  ...opts,
  define: { ...opts.define, __DEV_RELOAD__: "true" },
  sourcemap: "inline",
  plugins: [...(opts.plugins ?? []), reloadNotifyPlugin],
});

async function main() {
  buildValidators();
  rmSync(DIST, { recursive: true, force: true });
  mkdirSync(DIST, { recursive: true });

  const [esmCtx, iifeCtx] = await Promise.all([
    esbuild.context(withDev(esmOptions)),
    esbuild.context(withDev(iifeOptions)),
  ]);
  await Promise.all([esmCtx.watch(), iifeCtx.watch()]);
  copyStatics(); // static assets copied once; re-run dev to refresh them
  console.log("[dev] initial build done → dist/ (DEV build, includes hot-reload client)");
  console.log("[dev] pair with:  npm run dev:browser   (launches Chrome with dist/ auto-loaded)");

  const shutdown = async () => {
    console.log("\n[dev] shutting down…");
    await Promise.all([esmCtx.dispose(), iifeCtx.dispose()]);
    wss.close();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
