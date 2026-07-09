// Per-layer assertion #1: the extractor output conforms to the FROZEN extractor-output.schema.json.
// Ajv2020 (same runtime-Ajv pattern as src/lib/schemaConformance.test.ts). Schema-validity is a HARD
// gate, not a metric — this returns its OWN pass/fail (never blended with the grounding assert).
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const SCHEMA_PATH = join(HERE, "..", "..", "schema", "json", "extractor-output.schema.json");

const ajv = new Ajv2020({ strict: false, allErrors: true });
addFormats(ajv);
const validate = ajv.compile(JSON.parse(readFileSync(SCHEMA_PATH, "utf8")));

function parseOutput(output) {
  if (typeof output === "string") {
    try {
      return JSON.parse(output);
    } catch {
      return undefined;
    }
  }
  return output;
}

// promptfoo default-exports the assert function: (output, context) => GradingResult.
export default async function schemaValid(output, context) {
  const clipId = context?.vars?.clipId ?? "(unknown)";
  const parsed = parseOutput(output);
  if (parsed === undefined || parsed === null || typeof parsed !== "object") {
    return { pass: false, score: 0, reason: `schema-valid[${clipId}]: output is not a JSON object` };
  }

  const ok = validate(parsed);
  if (ok) {
    return { pass: true, score: 1, reason: `schema-valid[${clipId}]: conforms to extractor-output.schema.json` };
  }
  const errs = (validate.errors ?? [])
    .map((e) => `${e.instancePath || "/"} ${e.message}`)
    .join("; ");
  return { pass: false, score: 0, reason: `schema-valid[${clipId}]: FAILED — ${errs}` };
}
