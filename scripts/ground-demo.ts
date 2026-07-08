// Live proof of the grounding module against REAL corpus data + the REAL MusicBrainz API.
// Zero Gemini budget, no video media required. Run: npx tsx scripts/ground-demo.ts
//
// Uses the corpus `music: {name, author}` fields (present on real items) as typed mentions,
// the real MusicBrainz resolver (free, no key), and a heuristic score-threshold selector
// (the LLM "select" step is the production upgrade). Demonstrates: real durable IDs (MBIDs),
// confidence + NIL abstention + provenance — the moat, working on the founder's own data.

import fs from "node:fs";
import { groundMention, type Mention, type Selector } from "../src/lib/grounding.js";
import { createMusicBrainzResolver } from "../src/lib/resolvers/musicbrainz.js";

const CORPUS = "/Users/s0shaheen/Dev/attic-extension/attic-favorites.json";

interface CorpusItem {
  music?: { name?: string | null; author?: string | null } | null;
}

const items = JSON.parse(fs.readFileSync(CORPUS, "utf8")) as CorpusItem[];

const resolver = createMusicBrainzResolver({
  fetchJson: async (url, headers) => {
    const res = await fetch(url, { headers });
    if (!res.ok) throw new Error(`MusicBrainz HTTP ${res.status}`);
    return res.json();
  },
});

// Heuristic disambiguation: highest KB match-score wins; confidence = score/100.
// This is the deterministic baseline; an LLM "select" over the candidate set is the upgrade.
const select: Selector = async (_mention, candidates) => {
  let best = 0;
  for (let i = 1; i < candidates.length; i++) {
    if ((candidates[i]!.score ?? 0) > (candidates[best]!.score ?? 0)) best = i;
  }
  const top = candidates[best];
  if (!top) return null;
  return { index: best, confidence: Math.min(1, (top.score ?? 0) / 100) };
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const withMusic = items
  .filter((it) => it?.music?.name && it?.music?.author)
  .slice(0, 8);

console.log(`Grounding ${withMusic.length} real corpus songs → MusicBrainz durable IDs\n`);

let resolved = 0;
let nil = 0;
for (const it of withMusic) {
  const mention: Mention = {
    surface: it.music!.name!,
    type: "music_recording",
    hints: { artist: it.music!.author! },
  };
  try {
    const g = await groundMention(mention, { resolvers: [resolver], select, minConfidence: 0.5 });
    if (g.resolved) {
      resolved++;
      console.log(
        `✓ RESOLVED  "${mention.surface}" — ${mention.hints!.artist}\n` +
          `            → MBID ${g.id}  (conf ${g.confidence.toFixed(2)}, ${g.provenance.candidateCount} candidates)`,
      );
    } else {
      nil++;
      console.log(
        `∅ NIL       "${mention.surface}" — ${mention.hints!.artist}` +
          `  (conf ${g.confidence.toFixed(2)}, ${g.provenance.candidateCount} candidates)`,
      );
    }
  } catch (e) {
    console.log(`⚠ ERROR     "${mention.surface}" — ${(e as Error).message}`);
  }
  await sleep(1100); // MusicBrainz rate limit: ~1 req/s
}

console.log(`\nDone: ${resolved} resolved to durable IDs, ${nil} abstained (NIL).`);
