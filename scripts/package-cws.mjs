// package-cws.mjs — build the submit-ready Chrome Web Store zip from dist/.
//
// CWS requires manifest.json at the ZIP ROOT (not nested under a dist/ folder), so we zip the
// CONTENTS of dist/ with dist/ as the working directory. The version in the filename comes from
// manifest.json's "version" → commonplace-cws-v<version>.zip.
//
// Guardrail: the key-exposure audit (scripts/audit-dist.mjs, SPEC §25) runs FIRST and this script
// refuses to package if it fails. A zip is a build artifact — it is .gitignore'd, never committed.

import { execFileSync } from "node:child_process";
import { readFileSync, rmSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const DIST = resolve(ROOT, "dist");

if (!existsSync(DIST)) {
  console.error(`[package] dist/ not found at ${DIST}. Run \`npm run build\` first.`);
  process.exit(1);
}

// 1. Audit gate — refuse to package a dist that fails the key-exposure regression test.
try {
  execFileSync("node", [resolve(__dirname, "audit-dist.mjs")], { stdio: "inherit" });
} catch {
  console.error("[package] Audit failed — refusing to package. Fix the findings above and rebuild.");
  process.exit(1);
}

// 2. Version → filename.
const manifest = JSON.parse(readFileSync(join(DIST, "manifest.json"), "utf8"));
const version = manifest.version;
if (!version) {
  console.error("[package] dist/manifest.json has no version field.");
  process.exit(1);
}
const zipName = `commonplace-cws-v${version}.zip`;
const zipPath = resolve(ROOT, zipName);

// 3. Zip the CONTENTS of dist/ (manifest at the ZIP ROOT). Overwrite any stale zip.
rmSync(zipPath, { force: true });
execFileSync("zip", ["-r", "-X", zipPath, "."], { cwd: DIST, stdio: "inherit" });

console.log(`\n[package] wrote ${zipName} (manifest at zip root, ready for CWS upload).`);
console.log(`[package] verify layout with:  unzip -l ${zipName}`);
