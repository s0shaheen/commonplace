// SPEC §15 zero-cost replay harness — a promptfoo custom provider that NEVER calls a live model.
// It ignores the rendered prompt entirely and returns the FROZEN extractor output for
// `context.vars.clipId`, read from `eval-promptfoo/frozen/<clipId>.json`. Deterministic, keyless,
// $0, runs on every commit. The model id `gemini-2.5-flash-lite` is a display label only — the
// replay never reaches it, so CI needs no secrets.
//
// promptfoo loads a file:// JS provider as `new (module.default)({ ...options, id })`, so this must
// be a class exposing `id()` and `callApi(prompt, context)` (see providers registry in the
// installed promptfoo). Returns { output: <ExtractorOutput> } — the extractor output under test.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const FROZEN_DIR = join(HERE, "frozen");

export function loadFrozen(clipId) {
  return JSON.parse(readFileSync(join(FROZEN_DIR, `${clipId}.json`), "utf8"));
}

export default class FrozenReplayProvider {
  constructor(options = {}) {
    this.providerId = options.id || "gemini-2.5-flash-lite";
    this.config = options.config || {};
  }

  id() {
    return this.providerId;
  }

  // eslint-disable-next-line no-unused-vars
  async callApi(_prompt, context) {
    const clipId = context?.vars?.clipId;
    if (!clipId) {
      return { error: "replay-provider: missing context.vars.clipId" };
    }
    try {
      const frozen = loadFrozen(clipId);
      // The provider surfaces ONLY the extractor output (the thing under test). Grounding
      // expectations + frozen KB candidate sets live in the fixture and are read directly by the
      // grounding assert — they represent resolver output and must never leak into extractor output.
      return { output: frozen.extractorOutput };
    } catch (err) {
      return { error: `replay-provider: could not load frozen clip '${clipId}': ${err.message}` };
    }
  }
}
