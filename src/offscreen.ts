// Offscreen document (MV3) — the ENGINE RUNTIME. It lives here, not in the service worker, because
// the pipeline needs two things the SW lacks: a DOM (decode a <video> + capture <canvas> keyframes)
// and a long-lived credentialed fetch context. This file is deliberately THIN glue: every decision
// of consequence lives in a tested pure module —
//   • queue.ts        the resumable state machine (checkpoint → revive → drain, memory-bounded)
//   • lanes.ts        lane selection + ingestion routing + the hard schema gate
//   • groundItem.ts   per-item mention → GroundedEntity, with the availability/NIL discipline
//   • resolvers/*, selector.ts, rateLimiter.ts   candidate generation + disambiguation
// — so the untested surface is only orchestration (wire real chrome/DOM/fetch to those functions).
//
// Trigger: background sends `{kind:"queue_run"}` after it has ensured this document exists (only the
// SW can create offscreen docs, so the wake path is content/alarm → background → here). A `running`
// guard makes a second wake a no-op, so two drains never double-dispatch the same job.

import { openStore, type CpStore } from "./lib/store.js";
import { loadConfig, type CpConfig } from "./lib/config.js";
import {
  createGeminiLane,
  createOllamaLane,
  analyzeItem,
  routeIngestion,
  type EngineLane,
  type LaneId,
  type AnalyzeInput,
} from "./lib/lanes.js";
import { fetchVideoBytes, fetchSubtitles, fetchPosterFrames } from "./lib/mediaFetch.js";
import { extractKeyframes, keyframeTimes } from "./lib/ingest.js";
import { groundItemMentions } from "./lib/groundItem.js";
import { createLlmSelector } from "./lib/selector.js";
import { createRateLimiter } from "./lib/rateLimiter.js";
import { createMusicBrainzResolver } from "./lib/resolvers/musicbrainz.js";
import { createWikidataResolver } from "./lib/resolvers/wikidata.js";
import { createPlacesResolver } from "./lib/resolvers/places.js";
import { reviveJobs, enqueueMissing, runQueue, type QueueDeps } from "./lib/queue.js";
import { PROMPT_VERSION } from "./lib/prompts.js";
import type { CapturedItem, Analysis } from "./lib/types.js";
import type { MediaPart } from "./lib/geminiClient.js";
import type { GroundedEntity, KbResolver } from "./lib/grounding.js";

// Attach an HTTP status to a thrown fetch failure so the queue can tell a 429 (retry with backoff)
// apart from a hard error (fail after 5 attempts).
function httpError(status: number, url: string): Error & { status: number } {
  const e = new Error(`http_${status}`) as Error & { status: number };
  e.status = status;
  void url;
  return e;
}

async function getJson(url: string, headers?: Record<string, string>): Promise<unknown> {
  const res = await fetch(url, headers ? { headers } : undefined);
  if (!res.ok) throw httpError(res.status, url);
  return res.json();
}

async function postJson(url: string, init: RequestInit): Promise<unknown> {
  const res = await fetch(url, init);
  if (!res.ok) throw httpError(res.status, url);
  return res.json();
}

// ── Wiring builders (config → lanes / resolvers / selector) ─────────────────────────

function buildLanes(cfg: CpConfig, basePrompt: string): Record<LaneId, EngineLane> {
  return {
    managed: createGeminiLane({
      fetchJson: (url, init) => postJson(url, init),
      key: cfg.geminiKey ?? "",
      model: cfg.managedModel,
      basePrompt,
    }),
    local: createOllamaLane({
      fetchJson: (url, init) => postJson(url, init),
      endpoint: cfg.localEndpoint,
      model: cfg.localModel,
      basePrompt,
    }),
  };
}

// Task-5 carry-forward: EVERY resolver fetch routes through a rate limiter. The intervals are the
// KB courtesy budgets the USER's IP owns — MusicBrainz is a hard 1 req/s (1000 ms); Wikidata and
// Places are ~5 req/s (200 ms). MusicBrainz + Wikidata are ALWAYS present; Places only when it is
// both enabled AND keyed (an ABSENT resolver is what defers a `place` mention to regroundPending —
// categorically not a NIL).
function buildResolvers(cfg: CpConfig): KbResolver[] {
  const mbLimiter = createRateLimiter(1000);
  const wdLimiter = createRateLimiter(200);
  const placesLimiter = createRateLimiter(200);

  const resolvers: KbResolver[] = [
    createMusicBrainzResolver({ fetchJson: (url, headers) => mbLimiter(() => getJson(url, headers)) }),
    createWikidataResolver({ fetchJson: (url, headers) => wdLimiter(() => getJson(url, headers)) }),
  ];
  if (cfg.placesEnabled && cfg.placesKey) {
    resolvers.push(
      createPlacesResolver({
        key: cfg.placesKey,
        fetchJson: (url, init) => placesLimiter(() => postJson(url, init)),
      }),
    );
  }
  return resolvers;
}

// The selector's `callModel` is a RAW text generation on the active lane — NOT the constrained
// extractor call. Gemini: a plain generateContent (no responseSchema); Ollama: /api/chat. It
// returns the model's text; selector.ts parses `{index, confidence}` out of it and abstains on junk.
function buildCallModel(cfg: CpConfig): (prompt: string) => Promise<string> {
  if (cfg.engineLane === "local") {
    return async (prompt) => {
      const json = (await postJson(`${cfg.localEndpoint}/api/chat`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ model: cfg.localModel, stream: false, messages: [{ role: "user", content: prompt }] }),
      })) as { message?: { content?: string } };
      return json?.message?.content ?? "";
    };
  }
  return async (prompt) => {
    const json = (await postJson(
      `https://generativelanguage.googleapis.com/v1beta/models/${cfg.managedModel}:generateContent`,
      {
        method: "POST",
        headers: { "content-type": "application/json", "x-goog-api-key": cfg.geminiKey ?? "" },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
      },
    )) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
    return json?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  };
}

async function loadBasePrompt(): Promise<string> {
  const res = await fetch(chrome.runtime.getURL("prompts/extract_v1.md"));
  return res.text();
}

// Fire-and-forget broadcast that never rejects — if the SW is momentarily asleep there is no
// receiver, and an unhandled "Receiving end does not exist" would just spam the console.
function notify(message: unknown): void {
  void chrome.runtime.sendMessage(message).catch(() => {});
}

// keyframes_vtt media: decode the video and sample N keyframes (offscreen DOM). Slideshows / missing
// or undecodable video fall back to the post's cover as a single still. [] only when we truly have
// no pixels — analyzeItem then records media_fetch_failed.
async function collectKeyframes(item: CapturedItem): Promise<MediaPart[]> {
  if (item.isSlideshow || !item.playUrl) return fetchPosterFrames(item);
  try {
    const res = await fetch(item.playUrl, { credentials: "include", headers: { Range: "bytes=0-" } });
    if (!res.ok && res.status !== 206) return fetchPosterFrames(item);
    const blob = await res.blob();
    const frames = await extractKeyframes(blob, keyframeTimes(item.durationSec), document);
    return frames.length ? frames : fetchPosterFrames(item);
  } catch {
    return fetchPosterFrames(item);
  }
}

interface EngineCtx {
  store: CpStore;
  cfg: CpConfig;
  lanes: Record<LaneId, EngineLane>;
  resolvers: KbResolver[];
  select: ReturnType<typeof createLlmSelector>;
}

// The per-item unit of work, injected into runQueue as `processItem`. capture → analyze → ground.
// Throws bubble up to runEngine's wrapper, which classifies 429 → rateLimited (retry) vs hard error.
async function processItemLive(
  itemId: string,
  ctx: EngineCtx,
): Promise<{ ok: true } | { ok: false; error: string; rateLimited?: boolean }> {
  const rec = await ctx.store.getRecord(itemId);
  if (!rec) return { ok: false, error: "record_missing" };
  const item = rec.item;

  const ingestion = routeIngestion(item, ctx.cfg);
  let keyframes: MediaPart[] = [];
  let videoBytes: MediaPart | null = null;
  let transcript = "";
  if (ingestion === "native") {
    videoBytes = (await fetchVideoBytes(item))[0] ?? null;
  } else {
    if (item.subtitleUrl) transcript = await fetchSubtitles(item.subtitleUrl);
    keyframes = await collectKeyframes(item);
  }

  const input: AnalyzeInput = { item, transcript, keyframes, videoBytes };
  const { result, lane, ingestion: usedIngestion } = await analyzeItem(input, ctx.cfg, ctx.lanes);
  if (!result.ok) return { ok: false, error: result.error };

  const analysis: Analysis = {
    output: result.output,
    lane,
    ingestion: usedIngestion,
    model: lane === "managed" ? ctx.cfg.managedModel : ctx.cfg.localModel,
    promptVersion: PROMPT_VERSION,
    analyzedAt: new Date().toISOString(),
  };
  await ctx.store.saveAnalysis(itemId, analysis);

  const { groundings, regroundPending } = await groundItemMentions(item, result.output.mentions, {
    resolvers: ctx.resolvers,
    select: ctx.select,
    cacheGet: (key) => ctx.store.getMeta<GroundedEntity>(`grounding:${key}`),
    cachePut: (key, g) => ctx.store.setMeta(`grounding:${key}`, g),
  });
  await ctx.store.saveGroundings(itemId, groundings, regroundPending);
  return { ok: true };
}

// ── The runtime entry point ─────────────────────────────────────────────────────────

let running = false;

async function runEngine(): Promise<void> {
  if (running) return; // one drain at a time — never double-dispatch a job
  running = true;
  try {
    const cfg = await loadConfig(chrome.storage.local);
    // The managed lane cannot run without a Gemini key — surface it and stop (don't burn jobs).
    if (cfg.engineLane === "managed" && !cfg.geminiKey) {
      notify({ kind: "queue_blocked", reason: "no_key" });
      return;
    }

    const store = await openStore();
    const [basePrompt] = await Promise.all([loadBasePrompt()]);
    const ctx: EngineCtx = {
      store,
      cfg,
      lanes: buildLanes(cfg, basePrompt),
      resolvers: buildResolvers(cfg),
      select: createLlmSelector(buildCallModel(cfg)),
    };

    // Recover anything left mid-flight by a previous (killed) run, then enqueue any new raw items.
    await reviveJobs(store, Date.now());
    await enqueueMissing(store, Date.now());

    const startJobs = await store.getJobs();
    const total = startJobs.length;
    let progressDone = startJobs.filter((j) => j.status === "done").length;
    notify({ kind: "queue_progress", done: progressDone, total });

    const deps: QueueDeps = {
      store,
      now: () => Date.now(),
      jitter: () => Math.random(),
      concurrency: cfg.concurrency,
      processItem: async (itemId) => {
        try {
          const r = await processItemLive(itemId, ctx);
          if (r.ok) {
            progressDone++;
            notify({ kind: "queue_progress", done: progressDone, total });
          }
          return r;
        } catch (e) {
          const err = e as { message?: string; status?: number };
          const rateLimited = err.status === 429 || /\b429\b|rate.?limit/i.test(err.message ?? "");
          return { ok: false, error: err.message ?? "process_error", rateLimited };
        }
      },
    };

    const res = await runQueue(deps);
    console.log(`[commonplace] engine drain complete — done ${res.done}, failed ${res.failed}`);
  } finally {
    running = false;
  }
}

chrome.runtime.onMessage.addListener((msg: { kind?: string } | undefined) => {
  if (msg?.kind === "queue_run") {
    runEngine().catch((e) => console.log("[commonplace] engine run failed:", (e as Error).message));
  }
  return false; // results are broadcast as queue_progress/queue_blocked, not returned on this channel
});

console.log("[commonplace] offscreen engine ready");
