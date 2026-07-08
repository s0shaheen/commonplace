// Precompile the frozen JSON Schemas to STANDALONE validator modules.
//
// MV3's CSP bans `eval` / `new Function`, so Ajv's default runtime compilation cannot run
// inside the extension. Ajv's standalone codegen emits plain JS validator functions ahead of
// time — no eval, no Function() — which is the whole point of this step. Output lands in
// src/lib/generated/ (gitignored) as CommonJS so `require()` works on any Node and esbuild
// interops it cleanly when the engine (Task 3+) imports it.
//
// Formats: ajv-formats is used at compile time (so Ajv knows `uri` / `date-time`), and the
// documented standalone recipe wires the runtime formats reference via `code.formats` so the
// generated code says `require("ajv-formats/dist/formats").fullFormats` instead of inlining
// unserializable functions.

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import standaloneCode from "ajv/dist/standalone/index.js";
import { _ } from "ajv/dist/compile/codegen/index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const SCHEMA_DIR = resolve(ROOT, "schema/json");
const OUT_DIR = resolve(ROOT, "src/lib/generated");

const readSchema = (name) => JSON.parse(readFileSync(resolve(SCHEMA_DIR, name), "utf8"));

export function buildValidators() {
  const extraction = readSchema("extraction.schema.json"); // item.schema.json $refs this by relative id
  const item = readSchema("item.schema.json");
  const extractorOutput = readSchema("extractor-output.schema.json");

  const ajv = new Ajv2020({
    strict: false, // schemas carry description/title metadata; don't hard-fail codegen on those
    allErrors: true,
    code: {
      source: true,
      esm: false, // CommonJS output — see header
      formats: _`require("ajv-formats/dist/formats").fullFormats`,
    },
  });
  addFormats(ajv);

  // Pre-register the referenced schema so item's relative `$ref: extraction.schema.json`
  // resolves against its `$id` base (https://commonplace.app/schema/...).
  ajv.addSchema(extraction);
  ajv.addSchema(item);
  ajv.addSchema(extractorOutput);

  const code = standaloneCode(ajv, {
    validateItem: item.$id,
    validateExtractorOutput: extractorOutput.$id,
  });

  if (/\beval\s*\(|new\s+Function\s*\(/.test(code)) {
    throw new Error("[build-validators] generated code contains eval/new Function — MV3 CSP would reject it");
  }

  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(resolve(OUT_DIR, "validators.js"), code);
  // Local package.json pins this generated dir to CommonJS despite the root's "type":"module",
  // so `require('./validators.js')` works and esbuild treats it as CJS.
  writeFileSync(resolve(OUT_DIR, "package.json"), JSON.stringify({ type: "commonjs" }, null, 2) + "\n");

  console.log(`[build-validators] wrote src/lib/generated/validators.js (${code.length} bytes) — no eval`);
  return code.length;
}

// Run when invoked directly (`node scripts/build-validators.mjs`).
if (import.meta.url === `file://${process.argv[1]}`) {
  buildValidators();
}
