// esbuild toolchain: compile the TS engine + shell into a self-contained, MV3-loadable dist/.
//
// The extension is loaded from dist/ (everything it needs is copied in), so manifest paths are
// dist-root-relative (bare filenames), not "dist/"-prefixed — see manifest.json.
//
// Two builds:
//   • ESM (service worker + document contexts): background / offscreen / options.
//   • IIFE (content scripts run in page worlds, no module loader): content / main-world / capture.
// Validators are regenerated first (idempotent) so a bare `node scripts/build.mjs` is self-sufficient.
//
// The esbuild option objects + copyStatics are EXPORTED so the dev watcher (scripts/dev.mjs) reuses
// the exact same build config — no duplication, one source of truth. `main()` only runs when this
// file is executed directly (not when imported), so `npm run build` is unchanged.

import * as esbuild from "esbuild";
import { copyFileSync, mkdirSync, rmSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, resolve } from "node:path";
import { buildValidators } from "./build-validators.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
export const ROOT = resolve(__dirname, "..");
export const DIST = resolve(ROOT, "dist");
const watch = process.argv.includes("--watch");

const common = {
  bundle: true,
  target: "chrome120",
  outdir: DIST,
  logLevel: "info",
  sourcemap: watch ? "inline" : false,
  // PRODUCTION SAFETY: the dev-only hot-reload client is behind `if (__DEV_RELOAD__)`, and the dev-only
  // diagnostics client (src/devDiag.ts) behind `if (__DEV_DIAG__)`. Defining BOTH `false` here makes
  // esbuild dead-code-eliminate those branches (and the reload client's dynamic import()), so neither
  // the reload client nor the diagnostics stream can reach a production dist/. scripts/dev.mjs overrides
  // both to "true". Enforced by scripts/audit-dist.mjs.
  define: { __DEV_RELOAD__: "false", __DEV_DIAG__: "false" },
};

// ESM: service worker (type:module) + offscreen document + options page.
export const esmOptions = {
  ...common,
  format: "esm",
  entryPoints: {
    background: resolve(ROOT, "src/background.ts"),
    offscreen: resolve(ROOT, "src/offscreen.ts"),
    options: resolve(ROOT, "src/options.ts"),
    popup: resolve(ROOT, "src/popup.ts"),
    library: resolve(ROOT, "src/library.ts"),
  },
};

// IIFE: content scripts execute in page worlds with no module loader.
export const iifeOptions = {
  ...common,
  format: "iife",
  entryPoints: {
    content: resolve(ROOT, "src/content.js"),
    "main-world": resolve(ROOT, "src/main-world.js"),
    capture: resolve(ROOT, "src/capture.js"),
  },
};

export function copyStatics() {
  mkdirSync(resolve(DIST, "prompts"), { recursive: true });
  const copies = [
    ["manifest.json", "manifest.json"],
    ["rules.json", "rules.json"],
    ["src/options.html", "options.html"],
    ["src/popup.html", "popup.html"],
    ["src/library.html", "library.html"],
    ["src/offscreen.html", "offscreen.html"],
    ["prompts/extract_v1.md", "prompts/extract_v1.md"], // kept bundled for rollback
    ["prompts/extract_v2.md", "prompts/extract_v2.md"], // the shipped extractor prompt
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

// Only run the build when executed directly (`node scripts/build.mjs`), NOT when imported by dev.mjs.
const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
