// audit-dist.mjs — the NAMED key-exposure regression test (SPEC §25).
//
// SPEC §25 makes "secrets never in web_accessible_resources … the closed key-exposure bug class
// gets a named regression test" a standing constraint. This is that test, run against the BUILT
// dist/ (the exact bytes that go into the CWS zip), not against src/. It fails loudly — exit 1,
// naming the offending file — if any of three things are true:
//
//   (a) dist/manifest.json declares a `web_accessible_resources` key (the exposure vector);
//   (b) any file in dist/ contains a Google API key (AIza…), an OpenAI key (sk-…), or the
//       literal `secrets.js` (a leaked secrets module reference);
//   (c) dist/manifest.json requests a permission outside the shipped allowlist (scope creep the
//       CWS reviewer would flag).
//
// On success it prints `AUDIT PASS`. package-cws.mjs runs this first and refuses to zip if it fails.
//
// NOTE: this scans dist/ only, never scripts/ — so the detector patterns below can live in this
// source without the audit ever flagging itself. The regexes are patterns (prefixes + shapes),
// not real keys.

import { readFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve, relative } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const DIST = resolve(ROOT, "dist");

const PERMISSION_ALLOWLIST = [
  "storage",
  "downloads",
  "unlimitedStorage",
  "declarativeNetRequest",
  "offscreen",
  "alarms",
];

// Secret-shaped patterns. `[A-Za-z0-9_\-]` covers the base64url charset real Google keys use.
const SECRET_PATTERNS = [
  { name: "Google API key (AIza…)", re: /AIza[0-9A-Za-z_\-]{30,}/ },
  { name: "OpenAI key (sk-…)", re: /sk-[A-Za-z0-9]{20,}/ },
  { name: "literal secrets.js reference", re: /secrets\.js/ },
];

const failures = [];

function fail(msg) {
  failures.push(msg);
}

// Walk every file under dist/.
function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

let files;
try {
  files = walk(DIST);
} catch {
  console.error(`[audit] dist/ not found at ${DIST}. Run \`npm run build\` first.`);
  process.exit(1);
}

// (a) + (c): manifest checks.
const manifestPath = join(DIST, "manifest.json");
let manifest;
try {
  manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
} catch {
  fail(`dist/manifest.json missing or unparseable at ${manifestPath}`);
}

if (manifest) {
  if (Object.prototype.hasOwnProperty.call(manifest, "web_accessible_resources")) {
    fail(
      "dist/manifest.json declares `web_accessible_resources` — the key-exposure vector SPEC §25 forbids.",
    );
  }
  const requested = manifest.permissions ?? [];
  for (const perm of requested) {
    if (!PERMISSION_ALLOWLIST.includes(perm)) {
      fail(
        `dist/manifest.json requests permission "${perm}" not in the allowlist [${PERMISSION_ALLOWLIST.join(", ")}].`,
      );
    }
  }
}

// (b): secret-shaped strings in any dist file.
for (const file of files) {
  let text;
  try {
    text = readFileSync(file, "utf8");
  } catch {
    continue; // unreadable/binary — skip
  }
  const rel = relative(ROOT, file);
  for (const { name, re } of SECRET_PATTERNS) {
    if (re.test(text)) {
      fail(`${rel} contains a ${name}.`);
    }
  }
}

if (failures.length > 0) {
  console.error("AUDIT FAIL — key-exposure regression test (SPEC §25):");
  for (const f of failures) console.error(`  • ${f}`);
  process.exit(1);
}

console.log("AUDIT PASS");
