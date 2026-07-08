import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { GEMINI_KEY } from "../src/secrets.js";
import { buildExtractorPrompt, PROMPT_VERSION } from "../src/lib/prompts.ts";
import { buildTextBody, parseExtractorResponse } from "../src/lib/geminiClient.ts";
import { dedupeMentions } from "../src/lib/entities.ts";
import { toJsonBundle } from "../src/lib/exporters/json.ts";
import { toItemsCsv, toMentionsCsv } from "../src/lib/exporters/csv.ts";
import { toObsidianVault } from "../src/lib/exporters/obsidian.ts";

const MODEL = "gemini-2.5-flash";
// Phase 3: the frozen five-key extractor prompt replaces the observe_video prompts.
const EXTRACT_PROMPT = readFileSync(new URL("../prompts/extract_v1.md", import.meta.url), "utf8");
const INPUT = process.argv[2] ?? new URL("../fixtures/sample-items.json", import.meta.url);
const items = JSON.parse(readFileSync(INPUT, "utf8")).slice(0, 30);

async function callGemini(body) {
  const r = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${GEMINI_KEY}`,
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) },
  );
  return parseExtractorResponse(await r.json());
}

const analyzed = [];
for (const item of items) {
  const prompt = buildExtractorPrompt(EXTRACT_PROMPT, item, ""); // subtitles browser-only; text-from-caption here
  const res = await callGemini(buildTextBody(prompt));
  if (res.ok) {
    const output = { ...res.output, mentions: dedupeMentions(res.output.mentions) };
    analyzed.push({
      ...item,
      analysis: {
        output,
        lane: "managed",
        ingestion: "keyframes_vtt",
        model: MODEL,
        promptVersion: PROMPT_VERSION,
        analyzedAt: new Date().toISOString(),
      },
    });
  }
  process.stdout.write(res.ok ? "." : "x");
  await new Promise((r) => setTimeout(r, 800));
}

mkdirSync("results/vault", { recursive: true });
writeFileSync("results/engine-export.json", toJsonBundle(analyzed));
writeFileSync("results/engine-items.csv", toItemsCsv(analyzed));
writeFileSync("results/engine-mentions.csv", toMentionsCsv(analyzed));
for (const f of toObsidianVault(analyzed)) {
  mkdirSync(`results/vault/${f.path.split("/").slice(0, -1).join("/")}`, { recursive: true });
  writeFileSync(`results/vault/${f.path}`, f.content);
}
console.log(`\n${analyzed.length}/${items.length} analyzed (schema-valid); exports written to results/`);
