// Open-schema export — turn the engine's `LibraryRecord`s into objects that validate against the
// FROZEN cross-platform contract (`schema/json/item.schema.json`, which $refs extraction.schema.json).
// This is the Phase-3 boundary where the internal engine shapes meet the published, versioned data
// format the user can take anywhere.
//
// Load-bearing invariants (violations are contract breaks, not style):
//   • The IRON RULE — the model never emits external IDs. Every `grounding.externalId` here comes
//     ONLY from `rec.groundings`, matched to a mention by `mentionKey`.
//   • The GROUNDING INVARIANT (extraction.schema.json) — nil=false ⇒ externalId is a non-null string;
//     nil=true ⇒ externalId is null. A mention whose type sits in `regroundPending` gets NO
//     `grounding` key at all — never a fabricated NIL (unavailable ≠ abstained).
//   • NO SYNTHETIC PROVENANCE — facet/mention evidence carries the REAL model-emitted evidence; the
//     only field the pipeline stamps is `extractor_ref` (schema places it on Evidence, not the model).

import type { LibraryRecord } from "../store.js";
import type {
  EvidenceOut,
  MentionOut,
  ConceptOut,
  ClaimOut,
  StructuredOut,
  FacetAssignmentOut,
  AssertionMode,
} from "../types.js";
import type { GroundedEntity } from "../grounding.js";
import { typeToAuthority } from "../ontology.js";
import { mentionKey } from "../entities.js";

export interface ExtractorRef {
  model: string;
  version: string;
  prompt: string;
  run: string;
}

export interface ExportDeps {
  nowIso: string;
  extractorRef: ExtractorRef;
}

export const OPEN_SCHEMA_VERSION = "1.0.0-rc.6";

// Save-source vocab bridge: capture-provenance tab names → the frozen Save.sources[].kind enum.
function saveKind(source: string): string {
  switch (source) {
    case "favorites":
      return "favorites";
    case "likes":
      return "likes";
    case "posts":
      return "upload";
    case "reposts":
      return "repost";
    case "saved": // Instagram's single saved surface → the frozen `bookmark` kind
      return "bookmark";
    default:
      return "other";
  }
}

// rc.7: evidence timestamps arrive as MM:SS strings (the model's native video-time form). Parse to
// integer seconds for the W3C Media-Fragments selector (`t=<start>,<end>`). TOTAL + tolerant: any
// non-`^\d{1,2}:\d{2}$` input returns null so the caller omits the selector (honest degradation)
// rather than emitting a corrupt fragment. Pure — unit-tested.
export function mmssToSeconds(v: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(v);
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

// Strongest assertion mode wins (STATED > SHOWN > REPORTED > INFERRED); confidence is the max.
const MODE_RANK: Record<AssertionMode, number> = { STATED: 0, SHOWN: 1, REPORTED: 2, INFERRED: 3 };

function rollup(evidence: EvidenceOut[]): { assertion_mode: AssertionMode; confidence: number } {
  let mode = evidence[0]!.assertion_mode;
  let confidence = evidence[0]!.confidence;
  for (const e of evidence) {
    if (MODE_RANK[e.assertion_mode] < MODE_RANK[mode]) mode = e.assertion_mode;
    if (e.confidence > confidence) confidence = e.confidence;
  }
  return { assertion_mode: mode, confidence };
}

// One EvidenceOut → one frozen Evidence object. Copies the model-emitted axes verbatim, converts a
// t_start/t_end span into a Media-Fragments selector, and stamps the pipeline's extractor_ref (the
// ONLY field the model does not own). Optional fields are OMITTED (never set to undefined) so the
// object survives `additionalProperties:false`.
function mapEvidence(ev: EvidenceOut, deps: ExportDeps): Record<string, unknown> {
  const out: Record<string, unknown> = {
    channel: ev.channel,
    assertion_mode: ev.assertion_mode,
    confidence: ev.confidence,
    extractor_ref: { ...deps.extractorRef },
  };
  if (ev.source_role !== undefined) out.source_role = ev.source_role;
  if (ev.quote !== undefined) out.quote = ev.quote;
  if (ev.t_start !== undefined && ev.t_end !== undefined) {
    // rc.7: MM:SS strings → seconds. A malformed span (parse null) omits the selector, never a corrupt one.
    const start = mmssToSeconds(ev.t_start);
    const end = mmssToSeconds(ev.t_end);
    if (start !== null && end !== null) {
      out.selector = {
        type: "FragmentSelector",
        value: `t=${start},${end}`,
        conformsTo: "http://www.w3.org/TR/media-frags/",
      };
    }
  }
  return out;
}

const mapEvidenceList = (list: EvidenceOut[], deps: ExportDeps) => list.map((e) => mapEvidence(e, deps));

// ── Extraction builders (one per Referent kind + facet) ──────────────────────────────────────

function namedEntityExtraction(
  m: MentionOut,
  deps: ExportDeps,
  byKey: Map<string, GroundedEntity>,
  pending: Set<string>,
): Record<string, unknown> {
  const ext: Record<string, unknown> = {
    kind: "named_entity",
    surface: m.surface,
    type: m.type,
    evidence: mapEvidenceList(m.evidence, deps),
    rollup: rollup(m.evidence),
  };
  if (m.aliases && m.aliases.length) ext.aliases = [...m.aliases];

  // The IRON RULE + the grounding invariant. A type deferred to regroundPending gets NO grounding
  // key (unavailable ≠ NIL). Otherwise, an ID comes ONLY from a matched GroundedEntity.
  if (!pending.has(m.type)) {
    const g = byKey.get(mentionKey(m));
    if (g) {
      const authority = typeToAuthority(m.type);
      ext.grounding = g.resolved
        ? { authority, externalId: g.id, nil: false, grounding_confidence: g.confidence }
        : { authority, externalId: null, nil: true, grounding_confidence: g.confidence };
    }
  }
  return ext;
}

const conceptExtraction = (c: ConceptOut, deps: ExportDeps) => ({
  kind: "concept",
  surface: c.surface,
  evidence: mapEvidenceList(c.evidence, deps),
});

const claimExtraction = (c: ClaimOut, deps: ExportDeps) => ({
  kind: "claim",
  statement: c.statement,
  evidence: mapEvidenceList(c.evidence, deps),
});

function structuredExtraction(s: StructuredOut, deps: ExportDeps): Record<string, unknown> {
  const ext: Record<string, unknown> = {
    kind: "structured_content",
    schemaOrgType: s.schemaOrgType,
    evidence: mapEvidenceList(s.evidence, deps),
  };
  // A slot value is a volatile Observation — a value without a `when` is future misinformation.
  if (s.slots) ext.slots = s.slots.map((sl) => ({ name: sl.name, value: { value: sl.value, observedAt: deps.nowIso } }));
  if (s.steps) ext.steps = s.steps.map((st) => ({ order: st.order, text: st.text }));
  return ext;
}

const facetExtraction = (f: FacetAssignmentOut, deps: ExportDeps) => ({
  kind: "facet",
  facet: f.facet,
  value: f.value,
  evidence: mapEvidenceList(f.evidence, deps), // REAL model-emitted evidence (rc.6) — never stamped
});

// Every evidence span must be stamped with the extractor that ACTUALLY produced this record — the
// model/prompt recorded at analysis time — not the config in force at export time. A library
// analyzed on managed but exported while set to local would otherwise mislabel every span. The
// export-time `deps.extractorRef` supplies only the `run` stamp (an export-run identity) plus the
// whole fallback for records that carry no analysis of their own.
function recordExtractorRef(rec: LibraryRecord, deps: ExportDeps): ExtractorRef {
  const a = rec.analysis;
  if (!a) return deps.extractorRef;
  return {
    model: a.model,
    version: a.promptVersion,
    prompt: a.promptVersion,
    run: deps.extractorRef.run,
  };
}

function buildExtractions(rec: LibraryRecord, deps: ExportDeps): Record<string, unknown>[] {
  const out = rec.analysis?.output;
  if (!out) return [];
  const byKey = new Map<string, GroundedEntity>();
  for (const g of rec.groundings ?? []) byKey.set(mentionKey(g.mention), g);
  const pending = new Set<string>(rec.regroundPending ?? []);

  // Derive the per-record extractor_ref once, then thread it through every builder via a deps
  // clone (nowIso is unchanged — it is an export-time value, correctly).
  const recDeps: ExportDeps = { nowIso: deps.nowIso, extractorRef: recordExtractorRef(rec, deps) };

  return [
    ...out.mentions.map((m) => namedEntityExtraction(m, recDeps, byKey, pending)),
    ...out.concepts.map((c) => conceptExtraction(c, recDeps)),
    ...out.claims.map((c) => claimExtraction(c, recDeps)),
    ...out.structured.map((s) => structuredExtraction(s, recDeps)),
    ...out.facets.map((f) => facetExtraction(f, recDeps)),
  ];
}

// ── Top-level container mapping ───────────────────────────────────────────────────────────────

function buildAssets(rec: LibraryRecord): Record<string, unknown>[] {
  const item = rec.item;
  const assets: Record<string, unknown>[] = [];
  if (item.playUrl) assets.push({ url: item.playUrl, declaredMime: "video/mp4", role: "rendition" });
  if (item.subtitleUrl) assets.push({ url: item.subtitleUrl, declaredMime: "text/vtt", role: "sidecar" });
  // A poster blobRef documents that the captured poster bytes ship separately in a later phase.
  if (rec.posterRef) assets.push({ blobRef: rec.posterRef, declaredMime: "image/jpeg", role: "rendition" });
  return assets;
}

function buildMetrics(rec: LibraryRecord, deps: ExportDeps): Record<string, unknown> {
  const s = rec.item.stats;
  const m: Record<string, unknown> = { observedAt: deps.nowIso };
  if (s.likes !== null) m.likes = s.likes;
  if (s.shares !== null) m.shares = s.shares;
  if (s.comments !== null) m.comments = s.comments;
  if (s.plays !== null) m.views = s.plays; // TikTok "plays" is the frozen `views`
  return m;
}

/** Map one LibraryRecord onto a single item.schema.json-valid object. */
export function toOpenSchemaItem(rec: LibraryRecord, deps: ExportDeps): object {
  const item = rec.item;

  // identity: canonicalId is always a sufficient handle; the permalink is added when the item has a URL.
  const identity: Record<string, unknown> = { status: "platform_verified", canonicalId: item.id };
  if (item.url) {
    identity.permalink = item.url;
    identity.permalinkStatus = "live";
  }

  // XPLAT-01: carry the item's platform tag through to the frozen `origin.platform` (an open string).
  // Absent ⇒ "tiktok" — every pre-XPLAT item and fixture reads as TikTok with no migration.
  const platform = item.platform ?? "tiktok";
  // The save carries the honest capture `at` we have (platform save-times are not in item_list) plus,
  // for imported items, any named collection membership (`saves[].collections` is a frozen field).
  const save: Record<string, unknown> = {
    sources: item.sources.map((src) => ({ kind: saveKind(src), at: deps.nowIso })),
  };
  if (item.collections && item.collections.length) save.collections = [...item.collections];

  const out: Record<string, unknown> = {
    identity,
    origin: { platform, profile: `${platform}/1.0` },
    saves: [save],
    capturedAt: { value: rec.updatedAt, source: "inferred", confidence: 0.9 },
    mediaKind: item.isSlideshow ? "photo" : "video",
    platformExtras: {
      musicName: item.music?.name ?? null,
      musicAuthor: item.music?.author ?? null,
      hashtags: item.hashtags,
    },
    metrics: [buildMetrics(rec, deps)],
    extractions: buildExtractions(rec, deps),
  };

  // creator: a handle+name, or the frozen "UNKNOWN" sentinel when the author is missing.
  out.creator = item.author === null
    ? "UNKNOWN"
    : (item.authorName !== null ? { handle: `@${item.author}`, name: item.authorName } : { handle: `@${item.author}` });

  if (item.createTime !== null) {
    out.createdAt = { value: new Date(item.createTime * 1000).toISOString(), source: "platform", confidence: 1 };
  }
  // TikTok has no title; `body` is the caption (omitted when empty).
  if (item.desc !== "") out.body = item.desc;

  const assets = buildAssets(rec);
  if (assets.length) out.assets = assets;

  return out;
}

/** Serialize a library to the open-schema bundle: { schemaVersion, exportedAt, items[] }. */
export function toOpenSchemaExport(recs: LibraryRecord[], deps: ExportDeps): string {
  return JSON.stringify(
    {
      schemaVersion: OPEN_SCHEMA_VERSION,
      exportedAt: deps.nowIso,
      items: recs.map((r) => toOpenSchemaItem(r, deps)),
    },
    null,
    2,
  );
}
