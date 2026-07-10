// dev-browser.mjs — launch a PERSISTENT dev browser (`npm run dev:browser`).
//
// Opens the system Chrome with the built extension already loaded and a dedicated, gitignored
// profile (.dev-profile) that KEEPS your TikTok/Instagram logins across restarts. Pair it with
// `npm run dev` (the hot-reload watcher) for a save→auto-reload loop.
//
//   • --user-data-dir=<repo>/.dev-profile   dedicated profile — NEVER your real Chrome profile
//   • --load-extension=<repo>/dist          extension auto-loaded (no manual "Load unpacked")
//   • --remote-debugging-port=9222          CDP endpoint for automation
//   • opens tiktok.com + instagram.com on first launch
//
// Pass --print (or --dry-run) to print the exact command line WITHOUT launching Chrome.

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

const args = [
  `--user-data-dir=${PROFILE}`,
  `--load-extension=${DIST}`,
  `--remote-debugging-port=${CDP_PORT}`,
  "--no-first-run",
  "--no-default-browser-check",
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

const firstLaunch = !existsSync(PROFILE);
if (firstLaunch) {
  console.log(
    "[dev:browser] FIRST LAUNCH — log into TikTok + Instagram once in this window. The .dev-profile\n" +
      "              keeps you logged in for every future launch (it's gitignored — your real Chrome\n" +
      "              profile is never touched).",
  );
}
console.log(`[dev:browser] CDP endpoint:  http://localhost:${CDP_PORT}  (attach automation here)`);
console.log(`[dev:browser] profile:       ${PROFILE}`);
console.log(`[dev:browser] extension:     ${DIST}`);

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
