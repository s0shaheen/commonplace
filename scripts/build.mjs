// esbuild toolchain: compile the TS engine + shell into a self-contained, MV3-loadable dist/.
//
// The extension is loaded from dist/ (everything it needs is copied in), so manifest paths are
// dist-root-relative (bare filenames), not "dist/"-prefixed — see manifest.json.
//
// Two builds:
//   • ESM (service worker + document contexts): background / offscreen / options.
//   • IIFE (content scripts run in page worlds, no module loader): content / main-world / capture.
// Validators are regenerated first (idempotent) so a bare `node scripts/build.mjs` is self-sufficient.

import * as esbuild from "esbuild";
import { copyFileSync, mkdirSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { buildValidators } from "./build-validators.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const DIST = resolve(ROOT, "dist");
const watch = process.argv.includes("--watch");

const common = {
  bundle: true,
  target: "chrome120",
  outdir: DIST,
  logLevel: "info",
  sourcemap: watch ? "inline" : false,
};

// ESM: service worker (type:module) + offscreen document + options page.
const esmOptions = {
  ...common,
  format: "esm",
  entryPoints: {
    background: resolve(ROOT, "src/background.ts"),
    offscreen: resolve(ROOT, "src/offscreen.ts"),
    options: resolve(ROOT, "src/options.ts"),
    popup: resolve(ROOT, "src/popup.ts"),
  },
};

// IIFE: content scripts execute in page worlds with no module loader.
const iifeOptions = {
  ...common,
  format: "iife",
  entryPoints: {
    content: resolve(ROOT, "src/content.js"),
    "main-world": resolve(ROOT, "src/main-world.js"),
    capture: resolve(ROOT, "src/capture.js"),
  },
};

function copyStatics() {
  mkdirSync(resolve(DIST, "prompts"), { recursive: true });
  const copies = [
    ["manifest.json", "manifest.json"],
    ["rules.json", "rules.json"],
    ["src/options.html", "options.html"],
    ["src/popup.html", "popup.html"],
    ["src/offscreen.html", "offscreen.html"],
    ["prompts/extract_v1.md", "prompts/extract_v1.md"],
  ];
  for (const [from, to] of copies) {
    copyFileSync(resolve(ROOT, from), resolve(DIST, to));
  }
  console.log(`[build] copied ${copies.length} static assets → dist/`);
}

async function main() {
  buildValidators(); // emit src/lib/generated/validators.js before bundling
  rmSync(DIST, { recursive: true, force: true });
  mkdirSync(DIST, { recursive: true });

  if (watch) {
    const [esmCtx, iifeCtx] = await Promise.all([esbuild.context(esmOptions), esbuild.context(iifeOptions)]);
    await Promise.all([esmCtx.watch(), iifeCtx.watch()]);
    copyStatics();
    console.log("[build] watching for changes… (static assets copied once; re-run to refresh them)");
  } else {
    await Promise.all([esbuild.build(esmOptions), esbuild.build(iifeOptions)]);
    copyStatics();
    console.log("[build] done → dist/");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
