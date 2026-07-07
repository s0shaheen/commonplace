// Block-0 Spike #3 — the deciding experiment (SPEC §13/§15):
//   Path A  native video → Gemini (one call, full video+audio)
//   Path B  [VTT transcript + N keyframes + OCR-via-vision] → Gemini (no native-video ingestion)
// Question: does the cheap Path B recover the same entities as Path A? If it ties, we are NOT
// locked to native-video vendors and the cost floor drops. Both paths use the SAME model + the
// SAME typed-mention schema, so the only variable is the ingestion path.
//
// Env: reads GEMINI_KEY from ../../src/secrets.js. Arg: N items (default 16), stratified by VTT.
// Run: node spikes/pipeline/experiment.mjs [N]

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";

const MODEL = "gemini-2.5-flash-lite"; // 3.1-flash-lite not GA yet (verified 2026-07-07); pinned
const KEY = (await import("../../src/secrets.js")).GEMINI_KEY.trim();
const API = "https://generativelanguage.googleapis.com";
const MEDIA = new URL("./media/", import.meta.url).pathname;
const N = parseInt(process.argv[2] || "16", 10);

const PROMPT = `You are a precise entity extractor for a personal media library. From this short-form video, extract every REAL-WORLD entity a user might later search for or act on: songs, artists, films/shows, books, places/restaurants, products/brands, apps/tools, people (named), recipes/dishes. Return STRICT JSON only:
{"entities":[{"name":"specific proper name, never generic","type":"song|artist|movie_or_show|book|place|restaurant|product|brand|app_or_tool|person|recipe|dish|other"}]}
Rules: only entities actually present (spoken, on-screen text, or clearly shown). Specific names only ("Lilia", not "a restaurant"). No duplicates. If none, {"entities":[]}. Output JSON only, no prose.`;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const norm = (e) => `${(e.type || "other").toLowerCase().trim()}::${(e.name || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()}`;
function parseEntities(txt) {
  try { const m = txt.match(/\{[\s\S]*\}/); return (JSON.parse(m ? m[0] : txt).entities || []).filter((e) => e && e.name); }
  catch { return null; }
}
async function gen(parts) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const r = await fetch(`${API}/v1beta/models/${MODEL}:generateContent?key=${KEY}`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts }], generationConfig: { temperature: 0, responseMimeType: "application/json" } }),
    });
    if (r.status === 429 || r.status >= 500) { await sleep(2000 * (attempt + 1)); continue; }
    const j = await r.json();
    const usage = j.usageMetadata || {};
    const txt = j.candidates?.[0]?.content?.parts?.map((p) => p.text).join("") || "";
    return { txt, tokens: (usage.promptTokenCount || 0) + (usage.candidatesTokenCount || 0), err: j.error?.message };
  }
  return { txt: "", tokens: 0, err: "retries exhausted" };
}

// Path A: upload video via File API, poll ACTIVE, generate
async function pathA(mp4) {
  const bytes = readFileSync(mp4);
  const up = await fetch(`${API}/upload/v1beta/files?key=${KEY}`, {
    method: "POST",
    headers: { "X-Goog-Upload-Protocol": "raw", "X-Goog-Upload-File-Name": "clip.mp4", "Content-Type": "video/mp4" },
    body: bytes,
  });
  const uj = await up.json();
  if (!uj.file?.uri) return { entities: null, tokens: 0, err: "upload failed: " + (uj.error?.message || up.status) };
  let file = uj.file;
  for (let i = 0; i < 30 && file.state !== "ACTIVE"; i++) { await sleep(1500); file = await (await fetch(`${API}/v1beta/${file.name}?key=${KEY}`)).json(); if (file.state === "FAILED") return { entities: null, tokens: 0, err: "file processing FAILED" }; }
  if (file.state !== "ACTIVE") return { entities: null, tokens: 0, err: "file not ACTIVE" };
  const { txt, tokens, err } = await gen([{ text: PROMPT }, { fileData: { mimeType: "video/mp4", fileUri: file.uri } }]);
  return { entities: parseEntities(txt), tokens, err };
}

// Path B: N keyframes (jpeg, inline) + VTT transcript text, NO native video
function keyframes(mp4, n = 5) {
  const dur = parseFloat(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", mp4]).toString().trim()) || 20;
  const frames = [];
  for (let i = 0; i < n; i++) {
    const t = (dur * (i + 0.5)) / n;
    const out = join(tmpdir(), `kf_${process.pid}_${i}.jpg`);
    try { execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-ss", t.toFixed(2), "-i", mp4, "-frames:v", "1", "-vf", "scale=512:-1", "-q:v", "5", out]); frames.push(readFileSync(out).toString("base64")); } catch {}
  }
  return frames;
}
function vttText(id) {
  const f = readdirSync(MEDIA).find((n) => n.startsWith(id) && n.endsWith(".vtt"));
  if (!f) return "";
  return readFileSync(join(MEDIA, f), "utf8").replace(/WEBVTT[\s\S]*?\n\n/, "").replace(/\d\d:\d\d[\d:.]*\s*-->.*/g, "").replace(/<[^>]+>/g, "").replace(/\n{2,}/g, "\n").trim().slice(0, 4000);
}
async function pathB(mp4, id) {
  const frames = keyframes(mp4);
  const vtt = vttText(id);
  const parts = [{ text: PROMPT + (vtt ? `\n\nTRANSCRIPT (VTT):\n${vtt}` : "\n\n(no transcript available)") + `\n\nKeyframes follow (OCR the on-screen text too):` }];
  for (const b64 of frames) parts.push({ inlineData: { mimeType: "image/jpeg", data: b64 } });
  const { txt, tokens, err } = await gen(parts);
  return { entities: parseEntities(txt), tokens, err, frames: frames.length, hadVtt: !!vtt };
}

// select N items stratified by VTT presence
const ids = [...new Set(readdirSync(MEDIA).filter((f) => f.endsWith(".mp4")).map((f) => f.replace(".mp4", "")))];
const withVtt = ids.filter((id) => readdirSync(MEDIA).some((n) => n.startsWith(id) && n.endsWith(".vtt")));
const noVtt = ids.filter((id) => !withVtt.includes(id));
const pick = [...withVtt.slice(0, Math.ceil(N / 2)), ...noVtt.slice(0, Math.floor(N / 2))];
console.log(`experiment: ${pick.length} items (${Math.min(withVtt.length, Math.ceil(N/2))} vtt / ${Math.min(noVtt.length, Math.floor(N/2))} no-vtt), model=${MODEL}\n`);

const rows = [];
for (const id of pick) {
  const mp4 = join(MEDIA, `${id}.mp4`);
  if (!existsSync(mp4)) continue;
  const a = await pathA(mp4);
  const b = await pathB(mp4, id);
  if (!a.entities || !b.entities) { console.log(`${id}: SKIP (A:${a.err || "ok"} B:${b.err || "ok"})`); continue; }
  const setA = new Set(a.entities.map(norm)), setB = new Set(b.entities.map(norm));
  const inter = [...setA].filter((x) => setB.has(x)).length;
  const union = new Set([...setA, ...setB]).size;
  const jaccard = union ? inter / union : 1;                    // symmetric agreement (neither treated as truth)
  const bOfA = setA.size ? inter / setA.size : 1;               // fraction of A's entities B also found
  const aOfB = setB.size ? inter / setB.size : 1;               // fraction of B's entities A also found
  rows.push({ id, hadVtt: b.hadVtt, nA: setA.size, nB: setB.size, inter, union, jaccard, bOfA, aOfB, aOnly: setA.size - inter, bOnly: setB.size - inter, tokA: a.tokens, tokB: b.tokens });
  console.log(`${id} ${b.hadVtt ? "vtt" : "   "}: A=${setA.size} B=${setB.size} shared=${inter} jaccard=${(jaccard*100).toFixed(0)}% A-only=${setA.size-inter} B-only=${setB.size-inter}`);
  await sleep(500);
}

// aggregate + cost. 2.5-flash-lite: $0.10/1M in, $0.40/1M out (approx); use blended ~$0.15/1M for a rough clip cost.
const agg = (f, rs = rows) => rs.reduce((s, r) => s + f(r), 0) / (rs.length || 1);
const vttRows = rows.filter((r) => r.hadVtt), novttRows = rows.filter((r) => !r.hadVtt);
const PRICE = 0.15 / 1e6;
const block = (label, rs) => rs.length ? `${label} (n=${rs.length}): jaccard=${(agg((r)=>r.jaccard,rs)*100).toFixed(0)}%  B-recall-of-A=${(agg((r)=>r.bOfA,rs)*100).toFixed(0)}%  A-recall-of-B=${(agg((r)=>r.aOfB,rs)*100).toFixed(0)}%` : `${label}: n/a`;
console.log(`
=========== RESULT (${rows.length} items) — native-video (A) vs VTT+keyframes (B) ===========
Agreement (jaccard = neither treated as truth; recall-of = fraction the other also found):
  ${block("overall     ", rows)}
  ${block("WITH vtt    ", vttRows)}
  ${block("WITHOUT vtt ", novttRows)}
Complementarity: A-only ${agg((r)=>r.aOnly).toFixed(1)}/item (native catches, B misses — mostly audio)
                 B-only ${agg((r)=>r.bOnly).toFixed(1)}/item (B catches, native misses — mostly on-screen text)
                 union  ${agg((r)=>r.union).toFixed(1)}/item vs A-alone ${agg((r)=>r.nA).toFixed(1)}  → running BOTH finds ${(agg((r)=>r.union)/Math.max(agg((r)=>r.nA),0.01)*100-100).toFixed(0)}% more than native alone
Cost:  A=${Math.round(agg((r)=>r.tokA))} tok ($${(agg((r)=>r.tokA)*PRICE).toFixed(5)}/clip)   B=${Math.round(agg((r)=>r.tokB))} tok ($${(agg((r)=>r.tokB)*PRICE).toFixed(5)}/clip)   → B is ${(agg((r)=>r.tokA)/Math.max(agg((r)=>r.tokB),1)).toFixed(1)}x cheaper
==================================================================================
Decision frame: HIGH jaccard (esp. WITH vtt) → B ties native, drop the native-video lock, cost floor falls.
LOW jaccard + high complementarity → the paths see different things; the win is a HYBRID (cheap B default,
escalate to native A where audio is load-bearing) — which is exactly SPEC §13's confidence-routed cascade.`);
