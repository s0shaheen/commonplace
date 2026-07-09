// Per-layer assertion #2: replay the REAL `groundItemMentions` over the frozen clip and assert
// grounding-ID EXACT MATCH + NIL accuracy against the fixture's `expectedGrounding`.
//
// This is the moat under test. We do NOT reimplement grounding here — we import the actual TS engine
// bundled by `build-bundle.mjs` (see that file for why). The extractor output (mentions) comes from
// the replay provider; the frozen KB candidate sets + expected grounding come from the fixture and
// represent RESOLVER output (the iron rule: external IDs never live in extractor output).
//
// Fakes wired into the engine's deps:
//   • a candidate-generation resolver per mention type, returning the fixture's frozen candidates
//     (an EMPTY set ⇒ the resolver looked and found nothing ⇒ honest NIL — categorically different
//     from an ABSENT resolver, which would defer to reground-pending);
//   • a deterministic top-candidate selector (index 0, confidence 1) — no LLM, no network;
//   • a no-op in-memory cache.
// Returns its OWN pass/fail with per-mention reasons — never blended with the schema assert.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { groundItemMentions } from "../.bundle/grounding.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const FROZEN_DIR = join(HERE, "..", "frozen");

// music_recording→musicbrainz, place→places, everything else→wikidata (SPEC §14: TMDB is not a KB).
function sourceForType(type) {
  if (type === "music_recording") return "musicbrainz";
  if (type === "place") return "places";
  return "wikidata";
}

// Build one candidate-generation resolver per mention type present. Each resolver `handles` its type
// and returns the frozen candidate list keyed by `${type}:${surface}` (empty ⇒ honest NIL).
function buildResolvers(mentions, candidatesByKey) {
  const types = [...new Set(mentions.map((m) => m.type))];
  return types.map((type) => ({
    source: sourceForType(type),
    handles: (t) => t === type,
    search: async (mention) => {
      const key = `${mention.type}:${mention.surface}`;
      return candidatesByKey[key] ?? [];
    },
  }));
}

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

export default async function groundingExact(output, context) {
  const clipId = context?.vars?.clipId ?? "(unknown)";
  const parsed = parseOutput(output);
  if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.mentions)) {
    return { pass: false, score: 0, reason: `grounding-exact[${clipId}]: output has no mentions array` };
  }

  const frozen = JSON.parse(readFileSync(join(FROZEN_DIR, `${clipId}.json`), "utf8"));
  const expected = frozen.expectedGrounding ?? [];
  const candidatesByKey = frozen.candidates ?? {};

  const mentions = parsed.mentions;
  const item = { id: clipId, sources: [], desc: "", music: null, hashtags: [] };
  const store = new Map();
  const deps = {
    resolvers: buildResolvers(mentions, candidatesByKey),
    select: async (_mention, candidates) => (candidates.length ? { index: 0, confidence: 1 } : null),
    cacheGet: async (k) => store.get(k),
    cachePut: async (k, g) => {
      store.set(k, g);
    },
  };

  const { groundings } = await groundItemMentions(item, mentions, deps);

  // Index actual groundings by `${type}:${surface}` for exact lookup against expectations.
  const actualByKey = new Map();
  for (const g of groundings) actualByKey.set(`${g.mention.type}:${g.mention.surface}`, g);

  const reasons = [];
  let pass = true;

  // Vacuous pass: no mentions ⇒ no expectations ⇒ the schema assert carries the clip.
  if (expected.length === 0 && groundings.length === 0) {
    return { pass: true, score: 1, reason: `grounding-exact[${clipId}]: vacuous — 0 mentions, 0 groundings` };
  }

  if (groundings.length !== expected.length) {
    pass = false;
    reasons.push(`count mismatch: ${groundings.length} grounded vs ${expected.length} expected`);
  }

  for (const exp of expected) {
    const key = `${exp.type}:${exp.surface}`;
    const g = actualByKey.get(key);
    if (!g) {
      pass = false;
      reasons.push(`${key}: MISSING — mention was not grounded`);
      continue;
    }
    const problems = [];
    const expectedResolved = !exp.nil;
    if (g.resolved !== expectedResolved) problems.push(`resolved=${g.resolved} expected=${expectedResolved}`);
    if (g.id !== exp.externalId) {
      problems.push(`externalId=${JSON.stringify(g.id)} expected=${JSON.stringify(exp.externalId)}`);
    }
    // Grounding invariant: nil=false ⇒ externalId non-null; nil=true ⇒ externalId null.
    if (exp.nil && g.id !== null) problems.push("invariant break — nil expected but externalId non-null");
    if (!exp.nil && g.id === null) problems.push("invariant break — non-nil expected but externalId null");

    if (problems.length) {
      pass = false;
      reasons.push(`${key}: ${problems.join(", ")}`);
    } else {
      reasons.push(`${key}: OK (${exp.nil ? "NIL" : `id=${g.id}`})`);
    }
  }

  return {
    pass,
    score: pass ? 1 : 0,
    reason: `grounding-exact[${clipId}]: ${pass ? "PASS" : "FAIL"} — ${reasons.join(" | ")}`,
  };
}
