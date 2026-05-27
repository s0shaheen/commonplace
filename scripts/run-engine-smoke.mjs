import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { GEMINI_KEY } from "../src/secrets.js";
import { buildTextPrompt } from "../src/lib/prompts.ts";
import { buildTextBody, parseGeminiResponse } from "../src/lib/geminiClient.ts";
import { dedupeEntities } from "../src/lib/entities.ts";
import { toJsonBundle } from "../src/lib/exporters/json.ts";
import { toItemsCsv, toEntitiesCsv } from "../src/lib/exporters/csv.ts";
import { toObsidianVault } from "../src/lib/exporters/obsidian.ts";

const MODEL = "gemini-2.5-flash";
const TEXT_PROMPT = readFileSync(new URL("../prompts/observe_video.text.md", import.meta.url), "utf8");
const INPUT = process.argv[2] ?? new URL("../fixtures/sample-items.json", import.meta.url);
const items = JSON.parse(readFileSync(INPUT, "utf8")).slice(0, 30);

async function callGemini(body) {
  const r = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${GEMINI_KEY}`,
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) },
  );
  return parseGeminiResponse(await r.json());
}

const enriched = [];
for (const item of items) {
  const prompt = buildTextPrompt(TEXT_PROMPT, item, ""); // subtitles browser-only; text-from-caption here
  const res = await callGemini(buildTextBody(prompt));
  enriched.push(
    res.ok
      ? { ...item, enrichment: { ...res.enrichment, entities: dedupeEntities(res.enrichment.entities), tier: "text" } }
      : { ...item, enrichment: { tier: "raw", entities: [], takeaways: [], error: res.error } },
  );
  process.stdout.write(res.ok ? "." : "x");
  await new Promise((r) => setTimeout(r, 800));
}

mkdirSync("results/vault", { recursive: true });
writeFileSync("results/engine-export.json", toJsonBundle(enriched));
writeFileSync("results/engine-items.csv", toItemsCsv(enriched));
writeFileSync("results/engine-entities.csv", toEntitiesCsv(enriched));
for (const f of toObsidianVault(enriched)) {
  mkdirSync(`results/vault/${f.path.split("/").slice(0, -1).join("/")}`, { recursive: true });
  writeFileSync(`results/vault/${f.path}`, f.content);
}
const ok = enriched.filter((x) => x.enrichment.tier !== "raw").length;
console.log(`\n${ok}/${enriched.length} enriched; exports written to results/`);
