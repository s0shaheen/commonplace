// Prebundle step for the grounding replay assert (Task 8, controller ruling #1).
//
// `asserts/grounding-exact.mjs` must replay the REAL TypeScript `groundItemMentions` — duplicating
// that logic in JS would fork the implementation under test. Node cannot `import` a `.ts` file from
// an `.mjs`, and relying on promptfoo's internal TS loader being active inside the assert's module
// graph is fragile across its worker/child processes. So we esbuild-bundle the actual TS engine
// (`src/lib/groundItem.ts` + its imports) into a single self-contained ESM file that the assert
// imports. Single source of truth, zero fork, no runtime TS-loader dependency.
//
// Wired into the `eval:promptfoo` npm script so it runs before every promptfoo eval. The output is a
// build artifact (gitignored).
import * as esbuild from "esbuild";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..");

await esbuild.build({
  entryPoints: [resolve(ROOT, "src/lib/groundItem.ts")],
  bundle: true,
  format: "esm",
  platform: "node",
  target: "node20",
  outfile: resolve(HERE, ".bundle/grounding.mjs"),
  logLevel: "warning",
});

console.log("[eval-promptfoo] bundled src/lib/groundItem.ts → eval-promptfoo/.bundle/grounding.mjs");
