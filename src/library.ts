// The minimal library surface — glue only. It opens the canonical store, builds the pure in-memory
// search index once from `allRecords()`, and queries it on every keystroke. Every DECISION (what
// matches, how it ranks, which layers) lives in the PURE, unit-tested `lib/search/*`; this file just
// reads the store, paints ranked cards with provenance, and shows a detail view. Deliberately plain
// (legibility only) — the Paper & Proof design system is `library-ui`, behind the G2 gate.
//
// Invariants it must honor: search is fully LOCAL (no network — it only reads IndexedDB); every
// result shows which field matched + the item's provenance; a no-match is an explicit honest empty
// state, never a fabricated hit.

import { openStore, type LibraryRecord } from "./lib/store.js";
import {
  buildIndex,
  layerTexts,
  tokenize,
  FIELDS_BY_WEIGHT,
  type IndexableItem,
  type SearchField,
  type SearchIndex,
} from "./lib/search/index.js";
import { query, type SearchResult } from "./lib/search/query.js";

const $ = <T extends HTMLElement = HTMLElement>(id: string): T => {
  const el = document.getElementById(id);
  if (!el) throw new Error(`library: missing #${id}`);
  return el as T;
};

const MAX_RENDERED = 100; // cap painted cards per query — the index still ranks the whole library.

const FIELD_LABEL: Record<SearchField, string> = {
  entity: "entity",
  caption: "caption",
  onscreen: "on-screen text",
  transcript: "transcript",
  hashtag: "hashtag",
  author: "author",
};

// ── State: the store's records + the derived index, built once ─────────────────────────────────
let records = new Map<string, LibraryRecord>();
let indexables = new Map<string, IndexableItem>();
let index: SearchIndex | null = null;
let posterUrls: string[] = []; // object URLs for the current paint — revoked before the next.

// LibraryRecord nests the CapturedItem under `.item` with analysis at the record level; search wants
// the flat AnalyzedItem shape. (rec.id === rec.item.id.)
const toIndexable = (rec: LibraryRecord): IndexableItem => ({ ...rec.item, analysis: rec.analysis });

// ── Text helpers (highlighting is done by building DOM nodes, never innerHTML — no injection) ────
function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Append `text` to `el`, wrapping any occurrence of a query token (substring, case-fold) in <mark>. */
function highlightInto(el: HTMLElement, text: string, tokens: string[]): void {
  if (tokens.length === 0) {
    el.appendChild(document.createTextNode(text));
    return;
  }
  // Longer tokens first so "cathedral" wins over a bare "cat" substring at the same spot.
  const pattern = [...tokens].sort((a, b) => b.length - a.length).map(escapeRegExp).join("|");
  const re = new RegExp(pattern, "giu");
  let last = 0;
  for (let m = re.exec(text); m; m = re.exec(text)) {
    if (m.index > last) el.appendChild(document.createTextNode(text.slice(last, m.index)));
    const mark = document.createElement("mark");
    mark.textContent = m[0];
    el.appendChild(mark);
    last = m.index + m[0].length;
    if (m[0].length === 0) re.lastIndex++; // guard against zero-width matches
  }
  if (last < text.length) el.appendChild(document.createTextNode(text.slice(last)));
}

/** A windowed snippet of `field`'s text around the earliest query-token hit (for the "why it surfaced"). */
function snippetFor(item: IndexableItem, field: SearchField, tokens: string[]): string {
  const joined = layerTexts(item)[field].filter(Boolean).join(" · ");
  if (tokens.length === 0 || !joined) return joined;
  const hay = joined.toLowerCase();
  let pos = -1;
  for (const t of tokens) {
    const i = hay.indexOf(t);
    if (i >= 0 && (pos < 0 || i < pos)) pos = i;
  }
  if (pos < 0) return joined.slice(0, 180);
  const start = Math.max(0, pos - 50);
  const end = Math.min(joined.length, pos + 130);
  return (start > 0 ? "…" : "") + joined.slice(start, end) + (end < joined.length ? "…" : "");
}

function entitySurfaces(item: IndexableItem): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const m of item.analysis?.output?.mentions ?? []) {
    if (seen.has(m.surface)) continue;
    seen.add(m.surface);
    out.push(m.surface);
  }
  return out;
}

const platformLabel = (item: IndexableItem): string => (item.platform === "instagram" ? "Instagram" : "TikTok");

function revokePosters(): void {
  for (const url of posterUrls) URL.revokeObjectURL(url);
  posterUrls = [];
}

// Posters are captured bytes in the store; load them lazily and asynchronously (as a CSS background
// on the thumb div) so keystroke search stays instant. Best-effort — a missing poster just leaves
// the placeholder glyph.
async function attachPoster(el: HTMLElement, id: string, store: Awaited<ReturnType<typeof openStore>>): Promise<void> {
  try {
    const blob = await store.getPoster(id);
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    posterUrls.push(url);
    el.style.backgroundImage = `url("${url}")`;
    el.style.backgroundSize = "cover";
    el.style.backgroundPosition = "center";
    el.classList.remove("empty");
    el.textContent = "";
  } catch {
    /* leave placeholder */
  }
}

// ── Rendering ────────────────────────────────────────────────────────────────────────────────
function makeThumb(): HTMLElement {
  const el = document.createElement("div");
  el.className = "thumb empty";
  el.textContent = "▦";
  return el;
}

function card(result: SearchResult, tokens: string[], store: Awaited<ReturnType<typeof openStore>>): HTMLElement {
  const item = indexables.get(result.id)!;
  const li = document.createElement("li");
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "card";
  btn.addEventListener("click", () => showDetail(result, tokens, store));

  const thumb = makeThumb();
  void attachPoster(thumb, result.id, store);

  const body = document.createElement("div");
  body.className = "card-body";

  // Snippet: the earliest-matched field when there is a query, otherwise the caption.
  const snippet = document.createElement("div");
  snippet.className = "snippet";
  const field: SearchField | null = result.matchedFields[0] ?? null;
  const text = field ? snippetFor(item, field, tokens) : item.desc;
  if (text) highlightInto(snippet, text, tokens);
  else {
    const none = document.createElement("span");
    none.className = "none";
    none.textContent = "(no caption)";
    snippet.appendChild(none);
  }
  body.appendChild(snippet);

  // Resolved-entity chips (the moat surface — "receipts").
  const surfaces = entitySurfaces(item);
  if (surfaces.length) {
    const chips = document.createElement("div");
    chips.className = "chips";
    for (const s of surfaces.slice(0, 5)) {
      const c = document.createElement("span");
      c.className = "chip";
      c.textContent = s;
      chips.appendChild(c);
    }
    body.appendChild(chips);
  }

  // Provenance mark: which field(s) matched + platform.
  const prov = document.createElement("div");
  prov.className = "prov";
  if (result.matchedFields.length) {
    const strong = document.createElement("span");
    strong.className = "lbl";
    strong.textContent = "matched";
    prov.appendChild(strong);
    prov.appendChild(document.createTextNode(result.matchedFields.map((f) => FIELD_LABEL[f]).join(", ")));
  }
  const plat = document.createElement("span");
  plat.textContent = platformLabel(item);
  prov.appendChild(plat);
  body.appendChild(prov);

  btn.appendChild(thumb);
  btn.appendChild(body);
  li.appendChild(btn);
  return li;
}

function stripRow(k: string, valueNode: Node): HTMLElement {
  const row = document.createElement("div");
  row.className = "row";
  const key = document.createElement("div");
  key.className = "k";
  key.textContent = k;
  const val = document.createElement("div");
  val.className = "v";
  val.appendChild(valueNode);
  row.appendChild(key);
  row.appendChild(val);
  return row;
}
const textNode = (s: string): Node => document.createTextNode(s);

function showDetail(result: SearchResult, tokens: string[], store: Awaited<ReturnType<typeof openStore>>): void {
  const rec = records.get(result.id)!;
  const item = indexables.get(result.id)!;
  revokePosters();

  $("results").hidden = true;
  $("emptyState").hidden = true;
  const detail = $("detail");
  detail.hidden = false;
  detail.innerHTML = "";

  const back = document.createElement("button");
  back.className = "back";
  back.type = "button";
  back.textContent = "← Back to results";
  back.addEventListener("click", () => {
    detail.hidden = true;
    $("results").hidden = false;
    runSearch(($("search") as HTMLInputElement).value);
  });
  detail.appendChild(back);

  const wrap = document.createElement("div");
  wrap.className = "detail";
  const thumb = makeThumb();
  void attachPoster(thumb, result.id, store);
  wrap.appendChild(thumb);

  const dbody = document.createElement("div");
  dbody.className = "detail-body";

  const h = document.createElement("h2");
  h.textContent = item.desc || "(no caption)";
  dbody.appendChild(h);

  // The provenance strip — the signature component, in plain form here.
  const strip = document.createElement("div");
  strip.className = "strip";
  strip.appendChild(stripRow("platform", textNode(platformLabel(item))));
  if (item.sources?.length) strip.appendChild(stripRow("saved under", textNode(item.sources.join(", "))));
  if (item.author) {
    strip.appendChild(stripRow("creator", textNode(`@${item.author}${item.authorName ? ` (${item.authorName})` : ""}`)));
  }
  if (item.savedAt) strip.appendChild(stripRow("saved at", textNode(new Date(item.savedAt).toLocaleString())));
  if (item.createTime !== null) {
    strip.appendChild(stripRow("posted", textNode(new Date(item.createTime * 1000).toLocaleDateString())));
  }
  if (item.collections?.length) strip.appendChild(stripRow("collections", textNode(item.collections.join(", "))));
  if (item.url) {
    const a = document.createElement("a");
    a.href = item.url;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.textContent = item.url;
    strip.appendChild(stripRow("permalink", a));
  }
  strip.appendChild(
    stripRow(
      "analysis",
      textNode(rec.analysis ? `${rec.analysis.lane} · ${rec.analysis.model}` : "not analyzed yet"),
    ),
  );
  if (result.matchedFields.length) {
    strip.appendChild(stripRow("matched", textNode(result.matchedFields.map((f) => FIELD_LABEL[f]).join(", "))));
  }
  dbody.appendChild(strip);

  // The content layers themselves — so the user can SEE what's in the video (incl. the dark matter).
  const surfaces = entitySurfaces(item);
  if (surfaces.length) {
    const layer = document.createElement("div");
    layer.className = "layer";
    const t = document.createElement("h3");
    t.textContent = "entities";
    layer.appendChild(t);
    const chips = document.createElement("div");
    chips.className = "chips";
    for (const s of surfaces) {
      const c = document.createElement("span");
      c.className = "chip";
      c.textContent = s;
      chips.appendChild(c);
    }
    layer.appendChild(chips);
    dbody.appendChild(layer);
  }
  const texts = layerTexts(item);
  for (const field of FIELDS_BY_WEIGHT) {
    if (field === "entity" || field === "author" || field === "caption") continue;
    const joined = texts[field].filter(Boolean).join(field === "hashtag" ? "  " : " · ");
    if (!joined) continue;
    const layer = document.createElement("div");
    layer.className = "layer";
    const t = document.createElement("h3");
    t.textContent = FIELD_LABEL[field];
    layer.appendChild(t);
    const p = document.createElement("p");
    highlightInto(p, joined, tokens);
    layer.appendChild(p);
    dbody.appendChild(layer);
  }

  wrap.appendChild(dbody);
  detail.appendChild(wrap);
  window.scrollTo(0, 0);
}

function renderResults(results: SearchResult[], tokens: string[], store: Awaited<ReturnType<typeof openStore>>, isQuery: boolean): void {
  revokePosters();
  $("detail").hidden = true;
  const ul = $("results");
  ul.hidden = false;
  ul.innerHTML = "";
  const empty = $("emptyState");

  if (results.length === 0) {
    empty.hidden = false;
    empty.innerHTML = "";
    const big = document.createElement("div");
    big.className = "big";
    big.textContent = isQuery ? "No matches" : "Your library is empty";
    const sub = document.createElement("div");
    sub.textContent = isQuery
      ? "Nothing in your library matches that — captions, transcripts, on-screen text, and entities were all searched."
      : "Capture or import your saved videos, then search what's inside them here.";
    empty.appendChild(big);
    empty.appendChild(sub);
    return;
  }
  empty.hidden = true;

  const shown = results.slice(0, MAX_RENDERED);
  for (const r of shown) ul.appendChild(card(r, tokens, store));

  const meta = $("meta");
  if (isQuery) {
    meta.textContent =
      results.length > shown.length
        ? `${results.length} matches — showing top ${shown.length}`
        : `${results.length} ${results.length === 1 ? "match" : "matches"}`;
  } else {
    meta.textContent = `${records.size} items — most recent first`;
  }
}

let storeRef: Awaited<ReturnType<typeof openStore>> | null = null;
function runSearch(q: string): void {
  if (!index || !storeRef) return;
  const tokens = tokenize(q);
  const results = query(index, q);
  renderResults(results, tokens, storeRef, tokens.length > 0);
}

async function main(): Promise<void> {
  const store = await openStore();
  storeRef = store;
  const recs = await store.allRecords();
  records = new Map(recs.map((r) => [r.id, r]));
  indexables = new Map(recs.map((r) => [r.id, toIndexable(r)]));
  index = buildIndex([...indexables.values()]);

  const input = $<HTMLInputElement>("search");
  input.addEventListener("input", () => runSearch(input.value));

  // Initial paint: empty query → recent items.
  runSearch("");
}

main().catch((err) => {
  console.error("[commonplace] library init failed", err);
  const meta = document.getElementById("meta");
  if (meta) meta.textContent = "Couldn't open your library.";
});
