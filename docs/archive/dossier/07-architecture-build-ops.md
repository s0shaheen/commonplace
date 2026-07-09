# 07 — Architecture, Build System & Ops

**A Technical Design Document (argued)**

*Status: Proposed (for review/consensus, IETF-RFC stance). Author: founder/solo. Reviewers: —. Supersedes: nothing; extends the Phase-0 kill-gate spike.*
*Format: Google design-doc body (context/scope → goals/non-goals → proposed design → alternatives → cross-cutting concerns → rollout), with each architecturally-significant choice rendered as a Nygard ADR (Title / Status / Context / Decision / Consequences).*

---

## 0. Thesis — a thin, local-first shell, proven at the retrieval moment, is all the already-built engine still needs

*Situation.* The understanding engine is built, tested (61 Vitest cases, strict TS), and the TikTok capture spike is proven; what surrounds the engine is still an explicitly throwaway Phase-0 kill-gate spike.
*Complication.* The platforms are adversarial suppliers — signed media URLs rot within hours, payload shapes drift with every deprecation — and the person maintaining all of this is one founder with ~10–20 hr/wk and no hard deadline.
*Question.* Given a durable engine and a disposable shell, what shell durably wraps it?

And the customer framing that decides *durable for what*: the value of this product is realized at the **retrieval decision moment** — "find the ramen place I saved months ago faster than re-Googling" — not at the moment of capture, so the whole design must work backward from that job (JTBD research; doc 01).

The answer, and the one claim to agree or disagree with:

**The durable architecture is a thin, adversarial, local-first capture-and-storage substrate wrapped around the already-built pure-functional understanding engine.** Every platform's messiness is quarantined in swappable adapters. Every expensive or legally-radioactive dependency — the inference model, GPL/AGPL prior art, the platforms themselves — is held at arm's length behind a substitution boundary. The build system that keeps a solo founder shipping is not a CI cathedral: it is *strict TypeScript + Vitest as a machine-checkable contract that lets Claude Code write most of the code safely*, plus a two-environment split where "deploy is one command." If you disagree with anything here, disagree with this: **we are optimizing for durability and trust under solo constraints, not for throughput or scale** — and that single ordering decides every trade-off below.

This is the technical expression of the guiding policy in the Product Strategy Memo (doc 01) — "trust-first, local-first, zero remote code, open-core, one engine at two depths." It inherits the competitive read from doc 03 that our only durable moats are *verifiable grounding, open-core, and extension-only eager capture*, none of which a fast follower gets for free.

---

## 1. The engine is already production-shaped; only the shell needs durable design

### 1.1 What exists today (objective facts, not aspirations)

The repository is honestly named `attic-extension-spike` — a "throwaway Phase-0 kill-gate spike." That framing matters: the *engine* is production-shaped, the *shell around it* is a proof, and this document's job is to specify the durable shell without discarding what the spike proved.

Built and verified:

- **A pure-functional understanding engine** in `src/lib/` — `types.ts`, `ontology.ts`, `capture.js` (normalize/dedupe), `geminiClient.ts`, `prompts.ts`, `entities.ts`, `enrich.ts`, `mediaFetch.ts`, and four exporters (`json`, `csv`, `obsidian`, and the JSON bundle). It is strict TypeScript (`strict`, `noUncheckedIndexedAccess`, `isolatedModules`) with **61 Vitest cases across 9 test files** (the digest's "54" has since grown), all `environment: node`, no DOM, no network — the engine is deterministic and dependency-light by construction.
- **A proven MV3 capture spike for TikTok**: a MAIN-world interceptor (`main-world.js`) that skims TikTok's *own already-signed* `/api/*item_list*` responses, an ISOLATED-world relay (`content.js`), a module service worker (`background.js`) that dedupes and persists to `chrome.storage.local`, and a `declarativeNetRequest` rule (`rules.json`) that injects a `Referer` header so CDN media fetches return 200 instead of 403.
- **A real corpus**: `attic-favorites.json` (~43 MB, the digest's 1,313-item capture), `fixtures/sample-items.json`, and `results/` outputs (enriched JSON, CSVs, an Obsidian vault) from `scripts/run-engine-smoke.mjs` — a single-command engine run against fixtures using the live Gemini key at `src/secrets.js` (gitignored).

### 1.2 System-context diagram

```
        ┌─────────────────────── Chrome (user's machine) ───────────────────────┐
        │                                                                        │
 TikTok/IG page  ──signed JSON──►  MAIN-world interceptor  ──postMessage──►  ISOLATED relay
   (platform)     ──signed media──►  (never forges sigs)                          │
        ▲              ▲                                                    chrome.runtime
        │              │ Referer via DNR                                          │
        │         eager poster/media fetch  ◄──────────────────────────────  Service Worker (MV3)
        │                                                                    ├─ capture adapters (per-platform → core)
        │                                                                    ├─ resumable capture queue
        │                                                                    ├─ storage (IndexedDB: items/media/index)
        │                                                                    └─ pure engine (src/lib, unchanged)
        │                                                                          │
        │                                                             enrichment: metered inference
        │                                                             ├─ Gemini Flash-Lite (BYO key)  ──┐
        │                                                             └─ OSS fallback (Ollama/vLLM)     │  ← substitution boundary
        │                                                                          │                    │
   Grounding APIs (Places IDs / TMDB / MusicBrainz / Open Library)  ◄──────────────┘
        │
   Local retrieval (search/browse) + open-schema export  ──►  user  /  (later) API·MCP for agency tier
```

Everything inside the Chrome box runs on the user's machine with **zero remote code** — the trust boundary the whole product stakes its differentiation on (doc 03's top-right "actionable + verifiable/open" quadrant). The only outbound calls are to the inference model (behind a swap boundary) and to free/cheap grounding authorities.

### 1.3 Scope of *this* document

In: the MV3 architecture; capture adapters, resumable queue, eager posters, resilience/telemetry; storage and local retrieval; the solo-founder build system (env/secrets, two environments, deploy-as-a-command, Claude-Code-as-OS); the open-core plan and its licensing boundaries. Out (owned elsewhere): the multi-stage pipeline design and model choices (Engine & Pipeline doc, 04); the ontology/taxonomy governance (Data Model & Taxonomy doc, 05 — summarized here only where it constrains *storage schema versioning*); the six-axis eval (Eval & Measurement doc, 06); pricing and the agency API/MCP business case (Business Model doc, 08); SEO/AEO doorways (GTM doc, 09).

---

## 2. We optimize for durability and trust under solo constraints — and deliberately refuse scale, breadth, and a feed

**Goals.**

1. **Durability over platform churn.** Signed media URLs expire in hours; `itemStruct`/Graph/v2 shapes drift with every deprecation. The core model must outlive them.
2. **Trust as architecture, not tagline.** Local-first, zero remote code, data portable in an open schema by default — turning Dewey's *paid* export into our *default* (doc 03).
3. **Resilience under adversarial suppliers.** Capture must survive ~360-item scroll throttles, service-worker death, and deliberate platform breakage, and degrade gracefully rather than crash.
4. **Solo maintainability.** One person, ~10–20 hr/wk: the build must let Claude Code do the typing while the type system and tests do the reviewing; deploy must be one command.
5. **Two depths, one engine, one storage substrate.** The consumer v1 and the later agency API/MCP tier are *pipeline configs over the same core*, not two codebases (doc 01).
6. **Open-core-ready licensing hygiene** from day one, so nothing in the core is contaminated by GPL/AGPL prior art we study.

**Non-goals (deliberately excluded, Google-style — these could be goals; we refuse them).**

- **Horizontal platform breadth now.** TikTok + Instagram deep beats 14 platforms shallow (doc 03's "reduce breadth-racing"). X/Reddit/YouTube are *adapter slots*, not v1 work.
- **A server-side scraping backend.** No hosted capture, no proxy farm, no signature forging — a non-goal on both legal-risk and trust grounds (see ADR-001).
- **Scale/throughput engineering.** No horizontal workers, no queue infra, no multi-tenant DB in v1. The `<~$50/mo` envelope (doc 01) forbids it and the JTBD research (vitamin risk) forbids over-building before validation.
- **A social/discovery feed.** Explicitly eliminated (doc 03 Four-Actions) — an engagement arms race a solo founder cannot win and that dilutes the trust promise.
- **Real-time freshness.** Human-paced, resumable, multi-session capture is a *feature*, not a limitation (§5.2).
- **ACID transactional guarantees across devices.** Local-first single-device store; cross-device sync is a deferred bet (§10 open questions).

---

## 3. The requirements bind hardest at retrieval, not capture — so that is what the design must protect

*The key words MUST, MUST NOT, SHOULD, SHOULD NOT, and MAY in this section are to be interpreted as described in RFC 2119 / RFC 8174, and only when shown in uppercase.*

**Functional.**
- **F1:** the extension MUST passively capture the user's *own* saved items from TikTok (proven) and Instagram (next), and MUST normalize each into one core item shape.
- **F2:** the extension MUST fetch and store a durable poster/thumbnail at capture time, before signed URLs rot; it SHOULD opportunistically fetch full media bytes; it MAY defer oversized media to a resumable path.
- **F3:** capture MUST resume a partial run across sessions without producing duplicates.
- **F4:** enrichment MUST tolerate per-item failure — a single bad item MUST NOT abort a run.
- **F5:** the engine SHOULD ground extracted entities to durable external IDs; where no core type fits, it MAY fall back to a linked-data URI rather than a free-text tag.
- **F6:** the product MUST provide offline local retrieval — search and browse — over the user's corpus.
- **F7:** the product MUST export the full corpus in an open, documented schema.

**Non-functional.**
- **NF1 *trust*:** the system MUST NOT execute remote code, and MUST NOT let user data leave the device except for (a) metered inference calls the user has consented to and (b) grounding lookups.
- **NF2 *resilience*:** no single item, network blip, or SW restart MUST abort a run; the system MUST degrade gracefully instead of crashing.
- **NF3 *cost*:** steady-state infra MUST stay `<~$50/mo`; inference SHOULD be metered and batchable (−50%).
- **NF4 *portability*:** the inference model MUST be swappable behind an interface; storage backends SHOULD be swappable too.
- **NF5 *maintainability*:** `npm run typecheck` and `npm test` MUST gate every change; release MUST be a single command.
- **NF6 *observability*:** the system MUST capture enough local telemetry to run the doc-06 eval and the doc-"users-validation" retrieval test (task success, time-to-find); it MUST NOT phone that telemetry home in v1.

**Critical user journey the design must protect (the CUJ).** From the JTBD research: *value lives at the decision moment, not the archive.* The load-bearing journey is therefore **F6 retrieval**, not F1 capture — "find the ramen place I saved months ago, faster and more trustably than re-searching Google." Architecture that optimizes capture at retrieval's expense optimizes the wrong thing. This deliberately reorders our own instincts, since all the *mechanics* live in capture (Job A) while all the *value* lives in retrieval (Job B).

---

## 4. The design is concentric rings ordered by rate of change, so outer churn never forces inner change

The design is four concentric rings, ordered by rate of change: an **immutable pure engine** (changes rarely), a **core item model** (versioned, changes slowly), **capture adapters** (one per platform, change often), and the **MV3 shell + queue + storage** (Chrome-imposed, changes on Chrome's schedule). The whole point of the ring structure is that the fast-changing outer rings never force a change in the slow-changing inner ones.

### 4.1 The core item model adopts the standards' consensus rather than reinventing it

The single most consequential artifact is the shape that sits between capture and everything downstream (per the engine-platform-model research: "the data model is the contract between capture and everything downstream"). We do **not** invent it from first principles, because five battle-tested standards have independently converged on the same shape. Activity Streams 2.0 / ActivityPub give the **actor–activity–object–target quad** ("a user *saved* a *TikTok* into a *collection*"). schema.org supplies the type spine (`CreativeWork → MediaObject → VideoObject`), and — decisively — `SocialMediaPosting.sharedContent`, the vendor-neutral way to model an item that *wraps* another (quote-tweet, crosspost). oEmbed contributes the ruthlessly minimal **four-type projection** (`photo/video/rich/link`) that is almost exactly the right top-level `mediaKind` enum. MRSS's `media:group` gives us "one logical asset, many renditions" — precisely TikTok's `playAddr`/`downloadAddr`/`bitRateList` tiers of the *same* video. And Mastodon's ActivityPub serialization already bakes in a `blurhash` perceptual placeholder, which **validates our ThumbHash/eager-poster plan as standard practice, not a hack.**

The convergence *is* the signal: an object with a type, a canonical URL/id, an actor, a timestamp, a text body, a set of attached media renditions, optionally wrapping another object, optionally inside an ordered collection. That is our base entity, and it is the intersection of five standards rather than one founder's guess.

The current `CapturedItem` (`src/lib/types.ts`) is a good, honest *TikTok-flattened* version of this — and its comments already show the right instincts (id kept as a 19-digit *string* to dodge JS number precision; the bulky `raw` object deliberately dropped after it "blew chrome.storage's 10 MB quota"). The durable move is to **generalize `CapturedItem` toward the AS2/schema.org shape** while keeping it flat enough to stay ergonomic, and to add the one structural distinction the naive model gets wrong (next).

### 4.2 Separating the durable referent from the post from the save is what makes dedup and grounding correct (FRBR/LRM)

FRBR/LRM's WEMI hierarchy contributes the distinction every competitor's dedup and grounding gets wrong. When a user saves a TikTok *about* a restaurant, there are (at least) three distinct entities: the **referent** (the restaurant — grounds to a Google Place ID, *stable across the fifty different TikToks that feature it*), the **post/manifestation** (this specific TikTok, its caption, its signed media), and the **save/item** (the user's saved instance, with collection membership and save-date). Collapsing "the TikTok" and "the restaurant it depicts" into one object — which the current flat `CapturedItem` does — is exactly what makes competitors' grounding brittle.

Modeling the **grounded referent as a first-class node distinct from the post and the save** is what lets fifty saves collapse to one Place, lets the doc-06 golden set annotate "the referent" independently of "the post" (they are scored by *different* axes — grounding P/R/F1 vs. classification accuracy), and gives the agency tier a clean entity graph to query. YouTube already ships this exact separation in the wild: a `playlistItem` is a thin wrapper (with its own `position` and user `note`) pointing at a `video` — membership-vs-content, built for us to copy. This is ADR-004.

### 4.3 Capture adapters quarantine each platform's mess so the core stays clean

Every platform violates the consensus shape in its own way, and the design principle is **localize each violation in an adapter, keep the core clean.** The evidence, from the research and confirmed against our own recon:

- **TikTok**: one `itemStruct` is *either* a video *or* a slideshow, discriminated by `imagePost` (our `capture.js` already sets `isSlideshow: !!it.imagePost`); `music` is a first-class licensed entity with a stable id (a direct MusicBrainz/Spotify grounding hook); `subtitleInfos` sometimes gives platform-authored captions to **prefer over WhisperX** to save cost (our `normalizeItem` already extracts the English `subtitleUrl`).
- **Instagram (Graph)**: `media_type ∈ {IMAGE, VIDEO, CAROUSEL_ALBUM}`; carousel *children* have media but **no permalink and no metrics** — a naive peer-model produces phantom nulls. The adapter must model a carousel as a parent-with-identity + child-media-without-identity.
- **X (v2)**: `referenced_tweets[]` unifies repost/quote/reply into one `{type,id}` edge — the strongest argument for our *reference-typed edge* (§4.2's `sharedContent`).
- **Reddit**: the `Listing` envelope + `t1_/t2_/t3_/t5_` fullname prefixes and the five sub-shapes of a single `t3` (self/link/gallery/video/crosspost) make it the stress-test outlier that proves the adapter boundary must be real.

Mechanically, an adapter is a pure function `(rawSignedPayload) → CoreItem[]` — exactly what `capture.js`'s `normalizeItem`/`extractItems` already are for TikTok. This is the canonical treatment of the adapter layer for the whole document; the *interception mechanism* that feeds these adapters is treated separately in §5.1. Adding Instagram is adding `adapters/instagram.ts` implementing the same interface; the engine, queue, and storage never learn a new platform exists. This is the Dublin-Core *application-profile* idea (doc 05) applied to capture: one core, many profiles, never a fork.

### 4.4 MV3's three hard constraints force stateless-SW, two-world, and no-Blob patterns — all already handled in the spike

Manifest V3 is a given, and it imposes three hard facts the design must absorb rather than fight:

1. **The service worker dies after ~30 s idle.** `background.js` already handles this correctly — it re-hydrates `items` from `chrome.storage.local` on every cold start. The durable design makes this pattern *mandatory* for all shell state: **the SW holds no authoritative in-memory state; storage is the source of truth**, and every message handler is written to be safe across a restart mid-run.
2. **The MAIN world is the only place to see the platform's signed traffic; the ISOLATED world is the only place with `chrome.*`.** Hence the two-script split (`main-world.js` monkey-patches `fetch`/`XHR` and `postMessage`s out; `content.js` relays to the SW). This is not incidental — it is the *entire* capture strategy, and it is extension-only (mobile apps like Albo/Sorti structurally cannot do it — a moat per doc 03).
3. **MV3 SWs lack `FileReader`/`URL.createObjectURL`.** `background.js` already works around this by building a base64 `data:` URL for JSON export. The eager-media path (§5.3) inherits the same constraint and resolves it with `blobToBase64` (already in `mediaFetch.ts`) plus a File-API resumable-upload path for oversized media (currently a `TODO` in the code).

### 4.5 Authoritative storage moves to IndexedDB so retrieval — the CUJ — stays offline and instant

**Trade-off decision: move authoritative storage off `chrome.storage.local` onto IndexedDB, keep `chrome.storage.local` only for small hot state (counts, cursors, settings).** The spike already hit `chrome.storage.local`'s ~10 MB quota (the dropped-`raw` comment in `capture.js`); a 1,313-item corpus with eager posters and enrichments is tens of MB and growing. IndexedDB (with `unlimitedStorage`, already requested in the manifest) is the only local store that fits, and it gives us indexable object stores for the three WEMI node types: **`items`** (saves), **`referents`** (grounded entities, the dedup target), and **`media`** (poster/byte blobs).

Local retrieval (the CUJ) is built on top: a client-side inverted index over transcript + on-screen-text + entities + facets (the fields `enrich.ts`/`geminiClient.ts` already produce), plus the `buildEntityIndex` grouping in `entities.ts` (entity → itemIds) for browse-by-entity. The taxonomy research is explicit that *"taxonomies alone are too rigid and text search alone too weak — you need both"*; so retrieval pairs the controlled facets (browse) with full-text/embedding search (find). Embeddings are **computed once and reused** (digest / Twelve Labs Indexing-3.0 principle) and stored beside the item, so retrieval is offline and instant — which is what makes us faster-than-re-searching-Google, the only way to beat the dominant "just search again" habit (JTBD).

**Schema versioning** follows the Data Model & Taxonomy doc (05): every stored item carries a `schemaVersion`; the core spine is stable with mutable *labels but immutable IDs*; taxonomy concepts are **never deleted, only deprecated with a replacement pointer** (SNOMED/GO discipline). This is what keeps the doc-06 golden set valid and the open-schema export stable for downstream adopters across years.

### 4.6 Dependency injection already makes the inference model a swappable supplier

The engine is already correctly shaped: `enrich.ts` takes an `EnrichDeps` object (`callGemini`, `fetchSubtitles`, `fetchMedia`, `basePrompts`) — **dependency injection that makes the model a swappable supplier.** This is the architectural expression of doc 03's supplier-power analysis: because the inference model is behind an interface, Gemini Flash-Lite (BYO key today), an OSS local model (Ollama/vLLM), or a burst host (Fal/Modal/Replicate) are all drop-in `callGemini` implementations — keeping supplier power at "moderate (3/5)" instead of "high (5/5)." The tiering (`raw`/`text`/`visual`) is already in `types.ts`/`enrich.ts`; the multi-stage pipeline that sits above it (scene-detect → transcript → VLM+OCR → synthesis → grounding → verification) is doc 04's territory. Batch mode (−50%, mandatory per digest) is a property of the `callGemini` impl, not the orchestrator.

---

## 5. Capture survives adversarial platforms because it observes, paces, and persists — never forges

### 5.1 Passive interception, never forging (the canonical capture mechanism)

`main-world.js` skims TikTok's *own* signed `item_list` responses — it never constructs a request or signs anything. This is the proven, defensible capture method (digest; ADR-001): the browser and the logged-in user do the authentication; we observe. It is legally lighter (the user is accessing their own data through the real app) and technically robust (we ride whatever signature scheme the platform uses without reverse-engineering it).

Crucially, this *mechanism* is platform-agnostic — a URL regex plus a `postMessage` relay. Only the *normalization* of the skimmed payload is per-platform, and that normalization is the adapter layer, treated canonically in §4.3 rather than restated here. Adding Instagram is therefore one adapter file plus one `content_scripts` match entry — no new interception machinery.

### 5.2 The resumable, human-paced capture queue

The ~360-item auto-scroll throttle (digest) and the JTBD-irrelevance of freshness make **human-paced, resumable, multi-session capture a design choice, not a workaround.** The spike's `autoScroll` in `content.js` already embodies the seed of it: randomized 2–3.5 s delays (human-paced, anti-detection), a 15-idle-poll patience window, and — critically — it decides "done" by watching the *deduped count in storage*, not the DOM, so it is inherently restart-safe.

The durable design promotes this to an explicit, persisted **capture cursor**: `{platform, collection, lastSeenId, capturedIds:Set, status}` in `chrome.storage.local`. Because `mergeDedupe` (`capture.js`) is idempotent by `id`, a session that stops at item 350 and resumes next week simply re-skims and no-ops the overlap, advancing the cursor. Resumability is thus a free consequence of *idempotent merge + persisted cursor + storage-as-truth* — no queue infrastructure, no server, honoring the `<$50/mo` non-goal. (Clean-room study only: `gallery-dl` for TikTok/IG saved-item pagination *behavior*, `twitter-web-exporter` for the X 800-bookmark-cap workaround — see §8 licensing.)

### 5.3 Eager poster (and opportunistic media) capture

Signed media/poster URLs "expire in hours" (digest); a save captured today is a dead thumbnail tomorrow. Therefore **capture the poster at capture-time**, synchronously with normalization — an extension-only capability (moat, doc 03) that pure prior-art and mobile apps lack. The mechanism is already proven end-to-end in the spike: `content.js`'s `downloadViaFetch` demonstrates credentialed `Range: bytes=0-` fetches succeed *because* the DNR rule (`rules.json`) injects the `Referer` and the CDN echoes ACAO for the origin; `mediaFetch.ts`'s `fetchVideoBytes` is the productized version (18 MB inline ceiling, base64 for the SW's missing Blob APIs).

The durable design narrows the default to the **poster/`cover`** (small, cheap, always fetched eagerly and stored as a `media` blob + a ThumbHash for instant placeholder rendering — the Mastodon-`blurhash` pattern), and makes full **byte** capture opportunistic/deferred. The code already flags the honest gap: `fetchVideoBytes` conflates "too big" with "failed" (a documented `TODO(file-api)`); the fix is the resumable File-API upload path, which is the *one* known piece of net-new capture engineering.

### 5.4 Resilience — the result-object convention, already load-bearing

The engine's resilience posture is codified and tested: **engine functions never throw for expected failures; they return a `GeminiResult` discriminated union or a `raw`-tier item carrying an `error` string** (`types.ts`, `enrich.ts`). A subtitle fetch failure degrades to caption-only enrichment; a media fetch failure yields `media_fetch_failed` and a `raw` item rather than aborting the batch; a Gemini throw yields `gemini_threw`. Coercion is defensive throughout `geminiClient.ts` (`coerceEntities`/`coerceStringArray`/`stripFences` tolerate malformed LLM JSON). This is exactly the resilience NF2 requires, and it is *already implemented and unit-tested* — the durable design's job is to extend the same convention to the capture/queue layer (a throttled or broken interception marks the cursor `stalled`, never crashes the SW).

### 5.5 Telemetry — the minimum that makes validation possible

Telemetry is not analytics-for-growth; per the users-validation research it is the **instrument that turns the built engine into a commitment-extraction probe**: local session logging of *task success* and *time-to-find* for the 5–10-user retrieval test, and the wiring for the Sean-Ellis 40% survey at two weeks. Architecturally this is a local, append-only `events` object store (never phoned home in v1 — trust boundary), surfaced to the founder via export. It doubles as the substrate for the doc-06 eval (feeding VidFactScore/coverage runs). Keeping telemetry *local-first* is itself the trust differentiator (ARCHV's "no analytics" positioning, doc 03) — we get the measurement without breaking the promise.

---

## 6. Every rejected alternative breaks trust, cost, or the solo constraint

**A. Server-side capture/scraping backend (rejected).** A hosted scraper (proxies, `yt-dlp`/`gallery-dl` on a box) would enable cross-device sync and background refresh. Rejected on three grounds: it *breaks the zero-remote-code trust promise* that is our entire top-right-quadrant position (doc 03); it forces signature-handling/forging we've ruled out (ADR-001); and it blows the `<$50/mo` envelope with proxy costs. Extension-only eager capture is *also* a moat mobile competitors can't copy — so the constraint is an asset.

**B. Model raw platform payloads verbatim, unify later (rejected).** Tempting for a solo builder, but the raw payloads are exactly the assets that rot fastest (signed URLs, drifting `itemStruct`/Graph shapes). Deferring unification inherits every platform's mistakes into the golden set, the grounding stage, and the API. The consensus-standard core model (§4.1) is the antidote. The spike already learned a milder version of this lesson the hard way — the dropped `raw` object that "blew chrome.storage's 10 MB quota."

**C. `chrome.storage.local` as primary store (rejected).** Simple, but the ~10 MB quota is already exceeded by the corpus (proven in-code). IndexedDB with `unlimitedStorage` is the only local option that scales to eager posters + enrichments + embeddings. Retain `chrome.storage.local` only for small hot state.

**D. A heavyweight bundler/framework build (React SPA, webpack/rollup) now (deferred).** The retrieval UI will need a real front-end (doc 03's design bar: Apple Photos/Raycast/Linear-grade). But the *capture/engine* layer deliberately ships as raw ES modules loaded directly by the manifest — no build step, fewer moving parts, faster Claude-Code iteration. The bundler enters only when the UI does (§9 rollout), and it is scoped to `src/ui/`, never to the engine.

**E. A managed vector DB / hosted retrieval (rejected for v1).** Contradicts local-first and the cost envelope; local IndexedDB + client-side index/embeddings is sufficient at single-user corpus sizes and is *the* trust differentiator. Revisit only for the agency tier (doc 08).

**F. One codebase per depth (consumer app vs agency service) (rejected).** Violates doc 01's "same engine, different pipeline config." The DI boundary in `enrich.ts` + the adapter pattern already make "deeper/higher-volume" a config, not a fork.

---

## 7. Nine ADRs commit the load-bearing choices, each already proven or explicitly scoped

**ADR-001 — Passive MAIN-world interception; never forge signatures.**
*Status: Accepted (proven in spike).* **Context:** we need the user's own saved items; platforms sign their APIs and expire media URLs; forging signatures is brittle and legally hostile. **Decision:** we will passively observe the platform's own already-signed `fetch`/`XHR` responses in the MAIN world and relay them out; we will never construct or sign a platform request. **Consequences:** (+) robust to signature-scheme changes, legally lighter, trust-consistent; (+) extension-only ⇒ a moat; (−) capture is bounded to what the user's session actually loads (hence the queue, ADR-005); (−) platforms can deliberately break interception (mitigated by adapters isolating the blast radius).

**ADR-002 — Local-first storage, zero remote code.**
*Status: Accepted.* **Context:** our differentiation (doc 03) and guiding policy (doc 01) are trust; competitors monetize lock-in and analytics. **Decision:** all user data lives on-device (IndexedDB); the only outbound calls are consented metered inference and free grounding lookups; no telemetry is phoned home in v1. **Consequences:** (+) strongest possible trust position, "export is the default," ARCHV-grade privacy; (−) no cross-device sync in v1 (deferred, §10); (−) we lose server-side usage analytics — accepted, replaced by local, exportable telemetry (§5.5).

**ADR-003 — Per-platform capture adapters over a standards-derived core model.**
*Status: Accepted.* **Context:** platforms diverge violently (§4.3); the core must stay clean. **Decision:** each platform gets a pure `(payload)→CoreItem[]` adapter; the core item shape is the AS2/schema.org/oEmbed/MRSS consensus. **Consequences:** (+) new platforms are one file; engine/queue/storage never learn platforms; (+) core aligns to grounding vocabulary (schema.org) so grounding is a projection, not a translation; (−) adapter maintenance as platforms drift (bounded, localized).

**ADR-004 — Model the durable referent separately from the post and the save (WEMI).**
*Status: Accepted.* **Context:** naive models conflate "the TikTok" with "the restaurant it depicts," breaking dedup and grounding. **Decision:** three node types — `items` (saves), `referents` (grounded entities), `media` — with the referent as the stable grounding/dedup target. **Consequences:** (+) fifty saves collapse to one Place; golden set annotates referent vs. post independently; clean entity graph for the agency tier; (−) more schema complexity than a flat record (paid down by the dedup/grounding correctness it buys).

**ADR-005 — Idempotent, cursor-based, human-paced resumable capture.**
*Status: Accepted (seed proven in spike).* **Context:** ~360-item throttle, MV3 SW death, freshness is a non-goal. **Decision:** persist a capture cursor; make merge idempotent by id (done); pace scrolls randomly; treat storage as the source of truth and the SW as stateless. **Consequences:** (+) multi-session capture is free, restart-safe, anti-detection; (−) no real-time freshness (a deliberate non-goal).

**ADR-006 — Eager poster capture at capture-time; ThumbHash placeholders.**
*Status: Accepted (mechanism proven; File-API path pending).* **Context:** signed media/poster URLs expire in hours. **Decision:** fetch and store the poster synchronously at capture; store a ThumbHash; defer/opportunistic full-byte capture via a resumable File-API upload. **Consequences:** (+) durable thumbnails, instant render, extension-only moat; (−) capture-time cost/latency per item (bounded to a small poster); (−) one net-new engineering piece (File-API path) — the known `TODO`.

**ADR-007 — Result-object convention: no throwing for expected failures.**
*Status: Accepted (implemented + tested).* **Context:** LLM output is malformed sometimes; per-item failures must not abort batches. **Decision:** engine functions return discriminated unions / `raw`-tier items with `error` codes; coerce defensively. **Consequences:** (+) resilient batches, machine-auditable failure modes feeding eval; (−) callers must check `ok` (enforced by strict TS).

**ADR-008 — Metered, bring-your-own-key inference behind a swap boundary; OSS fallback.**
*Status: Accepted.* **Context:** supplier power (doc 03); cost envelope; open-core ethos. **Decision:** `callGemini` is injected; Gemini Flash-Lite (BYO key) is the default, batch-mode mandatory (−50%); Ollama/vLLM/burst hosts are drop-in alternatives. **Consequences:** (+) supplier power held at moderate; user pays their own inference in v1 (cost stays near-zero for us); (−) BYO-key adds onboarding friction (mitigated in UI; revisit a managed tier for doc 08).

**ADR-009 — MIT/Apache open-core; clean-room boundary against GPL/AGPL prior art.**
*Status: Accepted.* **Context:** open-core is a strategic moat and career artifact (doc 01/03); the best capture prior art is copyleft (`gallery-dl` GPL, `cobalt` AGPL). **Decision:** the open core (engine + ontology + schema + eval) is permissively licensed; GPL/AGPL projects are *studied for behavior and cleaned-room reimplemented*, never copied or linked. See §8. **Consequences:** (+) permissive core maximizes adoption/SEO/trust and is safe for the agency tier to build on; (−) we forgo copy-pasting proven scraper code, paying reimplementation cost for licensing safety.

---

## 8. A near-zero attack and cost surface falls out of the no-server, local-first design

**Security.** Attack surface is deliberately tiny: no server, no auth, no user accounts (v1). The MAIN-world interceptor is the highest-risk component — it monkey-patches `fetch`/`XHR`, so it is scoped by a narrow URL regex and only ever *reads/clones* responses, never mutates them, and only `postMessage`s to same-origin (`e.source !== window` guard in `content.js`). Host permissions are minimized to the platforms + the Gemini endpoint (manifest already does this). The Gemini key lives in gitignored `src/secrets.js` (never committed; `secrets.example.js` is the template) and, in production, in the user's own settings (BYO key), never in the shipped bundle. DNR rules are the minimal `Referer` set needed for CDN 200s. No `eval`, no remote script, no `web_accessible_resources` beyond the prompt/engine files the page needs.

**Privacy.** This is the product, not a checkbox (ADR-002). All corpus data and telemetry stay on-device; nothing is analytics-exfiltrated. The only data leaving the machine is (a) the item content sent to the user-consented inference model and (b) grounding queries to public authorities (Places IDs-only/free, TMDB, MusicBrainz — we prefer MusicBrainz precisely because it's open/durable). Export is one command and in an open schema — the anti-lock-in default that turns Dewey's paid export into our giveaway.

**Observability.** Local-only (§5.5): an append-only `events` store for task-success/time-to-find and eval inputs, plus the spike's existing `console.log` breadcrumbs promoted to a structured, exportable local log. This is the instrument for both the users-validation retrieval test and the doc-06 six-axis scorecard.

**Licensing / open-core boundary (the concern that most needs discipline).** The open core — `src/lib/` engine, the ontology/SKOS schema, the eval harness and golden set — ships permissive (MIT or Apache-2.0). The capture prior art we lean on is copyleft and must be handled by license:
- `gallery-dl` (GPL) and `cobalt` (AGPL) and `yt-dlp` (Unlicense/permissive but we still don't vendor it) are **studied for behavior only** — pagination semantics, header/Referer tricks, the X 800-bookmark cap workaround (`twitter-web-exporter`) — and **clean-room reimplemented** in our own permissive code. AGPL (`cobalt`) is especially radioactive for anything that could be construed as a network-served derivative (relevant to the future agency API), so it is reference-for-UX-only, never code.
- Practically: no copyleft code is copied, linked, or vendored into the core; any studied algorithm is described in the editorial/decision log (doc 05 discipline) and reimplemented from the spec/behavior, so the provenance is auditable. This keeps the open-core credible and the agency tier legally clean.

**Cost.** Steady-state stays `<$50/mo` because there is *no steady-state server* — capture/storage/retrieval run on the user's machine; inference is BYO-key/metered (batch −50%); grounding hits free tiers. Our only recurring costs are the CWS developer account and a domain — comfortably inside the envelope.

---

## 9. Strict types plus tests as a contract make "smoke it, then release it" the entire ops story

### 9.1 The build system: strict types + tests as the review that lets Claude Code write the code

The maintainability strategy is explicit and already in place: **`strict` TypeScript with `noUncheckedIndexedAccess`/`isolatedModules` plus 61 node-environment Vitest cases are the machine-checkable contract.** For a solo, ~10–20 hr/wk founder using Claude Code as the primary author (the "Claude-Code OS" of the digest's design method), this is the load-bearing safety system: the type checker and the pure-function test suite are the reviewer that never sleeps, letting an LLM write most of the diff while `npm run typecheck && npm test` gates every change. The engine's purity (no DOM, no network in `src/lib`) is what makes those tests fast and deterministic — a deliberate architectural investment in *testability as a solo-productivity multiplier*, not just correctness.

`npm run typecheck && npm test` is the pre-commit gate. Both run in seconds. This is the whole CI story for v1 — no cloud CI needed until there are collaborators; a git pre-push hook (or a single GitHub Action mirroring the two commands) suffices.

### 9.2 Two environments, and "deploy is a command"

- **Dev:** unpacked extension loaded in Chrome + `secrets.js` with the founder's Gemini key + `scripts/run-engine-smoke.mjs` for headless engine runs against `fixtures/` (already a one-command loop: `node scripts/run-engine-smoke.mjs`). This is the tight inner loop — change engine, run smoke, inspect `results/`.
- **Prod:** the packed, versioned CWS listing, with **no bundled key** (BYO key in settings).

Today there is no packaging step (raw modules load directly), which is fine for the spike but not for a listing. The durable addition is **one release command** — `npm run release` = `typecheck` → `test` → build (bundle only when the UI lands, §6-D) → zip → `chrome-webstore-upload-cli` publish — so shipping is a single, repeatable, reviewable action (the "deploy-is-a-command" principle). Version bump is the manifest + `package.json` in lockstep. This keeps ops boring: the only two verbs are *smoke it locally* and *release it*.

### 9.3 Testing strategy (mapped to the eval)

Three layers, cheapest first: (1) **unit** — the existing Vitest suite over pure functions (capture normalization, dedup, coercion, exporters, enrich orchestration with injected fakes); (2) **engine smoke** — `run-engine-smoke.mjs` against fixtures + live model, the integration check; (3) **the six-axis eval** (doc 06) over the version-locked golden set (~106 labeled seed → 100–500) — the *quality* gate, run on every taxonomy/prompt release, with the LLM-judge kappa-validated (never trusted raw; GO's ~20–30% expert-label error is the reason). Capture-layer resilience gets its own tests as the queue lands (SW-restart-mid-run, throttle → `stalled`, idempotent re-merge).

### 9.4 Sequenced rollout (fits 10–20 hrs/wk, no hard deadline)

1. **Harden the core model + storage** (generalize `CapturedItem` toward §4.1; add WEMI referent node; migrate to IndexedDB) — inner-ring work, fully unit-testable, no UI.
2. **Instagram adapter** — proves the adapter boundary; TikTok + IG deep (doc 03).
3. **Resumable queue + eager posters** (promote the spike's `autoScroll`/`downloadViaFetch` to cursor-based queue + poster store + File-API path).
4. **Local retrieval UI** (the CUJ; bundler enters here; design per doc 03).
5. **Instrument + validate**: telemetry, then the 5–10-user retrieval test and Sean-Ellis gate (users-validation doc). *Decide out loud against pre-declared kill criteria* before scaling.
6. **Open-core cut**: extract engine+ontology+schema+eval under a permissive license; publish. This is also the portfolio/SEO artifact.
7. **Agency depth (architected-now, built-later)**: the same engine behind an API/MCP via a deeper pipeline config — no new codebase, validated build-then-show against founder contacts (doc 08).

---

## 10. The open questions are all deferred bets, not gaps in the core

**Open questions.**
- **Cross-device sync** (deferred): local-first is ADR-002, but users will eventually want their corpus on phone + laptop. An end-to-end-encrypted sync that preserves zero-knowledge is the only trust-consistent option — deferred, not designed.
- **Oversized-media path**: the File-API resumable upload (the `TODO(file-api)` in `mediaFetch.ts`) needs building; until then, >18 MB clips get poster-only enrichment (acceptable, since poster + caption + transcript already carry most signal cheaply).
- **Instagram capture durability**: IG's MAIN-world signals are less studied than TikTok's `item_list`; the adapter spike must confirm the interception target survives their countermeasures (mitigation: `gallery-dl`'s IG-saved-via-cookies behavior as clean-room reference; Apify MCP as a *fallback*, never the primary path).
- **Agency-tier data residency**: the moment the engine serves other people's clips over a network, AGPL exposure and privacy posture change — must be revisited before any hosted API (doc 08).

**Appendix — file → responsibility map (as-built).**
`src/main-world.js` MAIN-world interceptor · `src/content.js` relay + queue seed (auto-scroll/export/enrich hotkeys) · `src/background.js` stateless SW: dedup/persist/export · `src/capture.js` TikTok adapter (`normalizeItem`/`extractItems`/`mergeDedupe`) · `rules.json` DNR Referer injection · `src/lib/types.ts` core shapes + result-object convention · `src/lib/ontology.ts` entity/facet vocab (→ SKOS in doc 05) · `src/lib/geminiClient.ts` model I/O + defensive coercion · `src/lib/prompts.ts` prompt builders · `src/lib/enrich.ts` DI orchestrator (swap boundary) · `src/lib/entities.ts` dedup + entity index · `src/lib/mediaFetch.ts` eager media/subtitle fetch + VTT parse · `src/lib/exporters/*` open-schema export · `scripts/run-engine-smoke.mjs` one-command dev run · `fixtures/`, `results/`, `attic-favorites.json` corpus + golden-set seed.

**The through-line.** Every choice above serves one ordering — *durability and trust under solo constraints first, everything else second*. The engine is already the durable, tested, career-defining core; this architecture is the minimal, adversarial, honest shell that keeps it that way: platforms quarantined behind adapters, models and copyleft prior art held behind substitution boundaries, storage local and portable by default, and a build system whose entire ceremony is "smoke it, then release it."