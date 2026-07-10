// dev-browser.mjs — launch a PERSISTENT dev browser (`npm run dev:browser`).
//
// Opens a browser on a dedicated, gitignored profile (.dev-profile) that KEEPS your TikTok/Instagram
// logins across restarts, with the CDP port open for automation. Pair it with `npm run dev` (the
// hot-reload watcher) for a save→auto-reload loop.
//
//   • --user-data-dir=<repo>/.dev-profile   dedicated profile — NEVER your real Chrome profile
//   • --remote-debugging-port=9222          CDP endpoint for automation
//   • opens tiktok.com + instagram.com (+ chrome://extensions on first launch)
//
// LOADING THE EXTENSION: stable Google Chrome (M137+, 2025) NO LONGER honors the `--load-extension`
// CLI flag (Google disabled it to curb malware). So on stable Chrome you Load Unpacked ONCE:
//   chrome://extensions → enable "Developer mode" → "Load unpacked" → select the dist/ folder.
// That's a ONE-TIME step — the unpacked extension PERSISTS in .dev-profile, and `npm run dev`'s
// hot-reload updates it on every code change (no reload dance). We still pass --load-extension because
// it IS honored by Chrome for Testing / Chromium: set CHROME_PATH to one of those for zero-touch
// auto-loading (you'd log into TikTok/IG once in that binary's profile).
//
// Pass --print (or --dry-run) to print the exact command line WITHOUT launching.

import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const DIST = resolve(ROOT, "dist");
const PROFILE = resolve(ROOT, ".dev-profile");
const CDP_PORT = 9222;
const DRY_RUN = process.argv.includes("--print") || process.argv.includes("--dry-run");

// Locate the Chrome binary. Standard macOS location first, then common fallbacks.
const CHROME_CANDIDATES = [
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Google Chrome Beta.app/Contents/MacOS/Google Chrome Beta",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
  process.env.CHROME_PATH || "",
].filter(Boolean);

function findChrome() {
  for (const p of CHROME_CANDIDATES) {
    if (existsSync(p)) return p;
  }
  return null;
}

const chromePath = findChrome();
if (!chromePath) {
  console.error(
    "[dev:browser] Could not find Google Chrome at the standard macOS location:\n" +
      "  /Applications/Google Chrome.app/Contents/MacOS/Google Chrome\n" +
      "Install Chrome, or set CHROME_PATH=/path/to/chrome and re-run.",
  );
  process.exit(1);
}

// dist/ must exist — the extension is loaded from it.
if (!existsSync(DIST)) {
  console.error(
    `[dev:browser] dist/ not found at ${DIST}.\n` +
      "Build it first:  npm run dev   (hot-reload watcher)  — or  npm run build  (one-shot).",
  );
  process.exit(1);
}

const firstLaunch = !existsSync(PROFILE);
const args = [
  `--user-data-dir=${PROFILE}`,
  `--load-extension=${DIST}`, // honored by Chrome-for-Testing/Chromium; silently ignored by stable Chrome M137+
  `--remote-debugging-port=${CDP_PORT}`,
  "--no-first-run",
  "--no-default-browser-check",
  // On first launch, open chrome://extensions so the one-time Load-Unpacked step is right there.
  ...(firstLaunch ? ["chrome://extensions"] : []),
  "https://www.tiktok.com",
  "https://www.instagram.com",
];

// Print the exact command line (shell-quoted) so it's copy-pasteable.
const quoted = [chromePath, ...args].map((a) => (/[\s]/.test(a) ? `"${a}"` : a)).join(" ");
console.log(`[dev:browser] command:\n  ${quoted}\n`);

if (DRY_RUN) {
  console.log("[dev:browser] --print/--dry-run: not launching Chrome.");
  process.exit(0);
}

if (firstLaunch) {
  console.log(
    "[dev:browser] FIRST LAUNCH:\n" +
      "  1. Log into TikTok + Instagram once (the gitignored .dev-profile keeps you logged in after).\n" +
      "  2. On the chrome://extensions tab: enable 'Developer mode' → 'Load unpacked' → select:\n" +
      `       ${DIST}\n` +
      "     (One-time. Stable Chrome ignores --load-extension; the unpacked extension then PERSISTS,\n" +
      "      and `npm run dev` hot-reloads it on every code change.)",
  );
}
console.log(`[dev:browser] extension dist:  ${DIST}   (Load Unpacked this folder once on chrome://extensions)`);
console.log(`[dev:browser] CDP endpoint:    http://localhost:${CDP_PORT}  (attach automation here)`);
console.log(`[dev:browser] profile:         ${PROFILE}`);

// Detached so the terminal stays free; Chrome owns its own lifecycle.
const child = spawn(chromePath, args, { stdio: "inherit", detached: false });
child.on("error", (err) => {
  console.error("[dev:browser] failed to launch Chrome:", err.message);
  process.exit(1);
});
child.on("exit", (code) => {
  console.log(`[dev:browser] Chrome exited (code ${code ?? 0}).`);
  process.exit(code ?? 0);
});
