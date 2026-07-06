# Dossier Document 05 — Product & UX

*The surfaces, the information architecture, the library experience, and the design method for the content-understanding engine (working name: Attic; rebrand pending — see §7.4).*

**Situation.** Attic is one content-understanding engine, projected across four surfaces — extension, web, API, MCP.
**Complication.** That engine delivers its value at the wrong place and moment. It pays off in the archive, at the instant of saving — which is exactly where the user already feels the job is done and feels no residual pain.
**Answer.** Relocate the payoff from the archive to the *decision moment* — grounded, verifiable resolution surfaced when the user actually has to act (cook tonight, eat now, watch tonight).
Every surface, IA, and flow choice below follows from that one move. Reject the relocation and you should reject this doc. The move is a *bet*, not a proven fact — §11's kill metrics are built to test it.

```
Status:     Proposed → for review (supersedes the FORM/behavior split of the May 2026 UX spec
            and visual brief; carries their durable parts forward, overturns two of their premises)
Author:     Product/UX (with Claude), 2026-07-02
Reviewers:  Founder; Engine Tech Design owner (Doc 04); GTM owner (Doc 07); Pricing owner (Doc 06)
Doc type:   Technical/Product Design Document (Google design-doc spine; Nygard ADRs embedded;
            RFC "proposed-for-consensus" stance)
Prior art in-repo: docs/superpowers/specs/2026-05-27-attic-ux-requirements-flows.md (behavior, mostly still true)
                   docs/design/2026-05-27-attic-visual-design-brief.md (form brief, method still true)
                   docs/superpowers/specs/2026-05-26-attic-extension-pivot-design.md (IA origin)
Cross-refs: Doc 01 Strategy · Doc 02 Market/Competitive · Doc 03 PRD · Doc 04 Engine Technical Design
            · Doc 06 Pricing · Doc 07 GTM
```

**Normative keywords.** On the load-bearing contracts — the §4 topology table, the §5.5 interfaces, the §6.2 stack — MUST / SHOULD / MAY follow RFC 2119. **MUST** = required, a violation breaks the thesis. **SHOULD** = strongly recommended; deviation needs a written reason. **MAY** = optional.

**Sourcing conventions.** Two citation kinds are kept distinct. *Internal dossier research* (the sibling analyses for this rebuild) is tagged inline as **[Internal: JTBD / Validation / Competitive / Platform-model / Taxonomy / Prior digest]**. *External primary evidence* — and any soft figure a skeptic should be able to audit — is in numbered footnotes that name the origin and flag confidence where the number is a vendor estimate rather than peer-reviewed data.

---

## 1. The one decision that governs this doc: relocate the payoff to the decision moment

The four surfaces — extension, web, API, MCP — are not four products. They are one engine's output, projected at different depths and, decisively, at different *moments*.

The single most important decision is to move where value is delivered: away from the archive we already built (a suspected *vitamin*), toward grounded, verifiable resolution surfaced *at the decision moment* — the only place the job plausibly becomes a *painkiller* [Internal: JTBD]. Everything below is downstream of that move.

---

## 2. Only the extension can capture expiring signed media, so the extension must anchor the system

### 2.1 A built engine and a proven capture spike already exist — ground truth, not a wish list

- A grounded multi-stage engine is **built and tested** in `src/lib` (strict TS, 54 Vitest): `geminiClient`, `enrich`, `entities`, `mediaFetch`, `prompts`, `ontology`, `types`, `exporters/`. It is the durable core and the founder's portfolio artifact; internals owned by Doc 04.
- A **TikTok capture spike is proven** — MAIN-world passive interception of TikTok's own signed `item_list` responses (`src/main-world.js`, `content.js`, `capture.js`); it never forges signatures.
- A **real 1,313-item corpus** (`attic-favorites.json`), `fixtures/`, and ~106 labeled items exist: golden-set seed and demo fuel for the public web surface.
- Two canonical design docs exist (May UX spec, visual brief). Their behavior model, entitlement-as-config pattern, and local-first trust posture carry forward. Two of their premises do not (§2.3).

### 2.2 The system-context diagram shows why capture forces the extension to the center

```
                         PLATFORMS (adversarial suppliers)
                    TikTok · Instagram · (X/Reddit/YT later)
                    signed media URLs expire in HOURS
                              │  (MAIN-world passive interception;
                              │   eager poster/media capture at save-time)
                              ▼
   ┌───────────────────────────────────────────────────────────────────┐
   │  SURFACE 1 — EXTENSION  (the privileged CAPTURE + PRESERVATION client)│
   │  popup (remote control) · Library (workspace) · onboarding          │
   │  local-first store = the user's durable, portable item library      │
   └───────────────┬───────────────────────────────────────────────────┘
                   │ same engine (src/lib) runs client-side, BYO-key
                   ▼
        ┌────────────────────┐        deterministic grounding
        │  THE ENGINE (Doc 04)│──────► Google Places · TMDB/Trakt ·
        │ classify→extract→   │        MusicBrainz/Spotify · Open Library
        │ ground→verify       │        (durable external IDs, "show your work")
        └─────────┬──────────┘
                  │ same engine, different deployment + depth
      ┌───────────┼───────────────────────────┐
      ▼           ▼                             ▼
 SURFACE 2      SURFACE 3                   SURFACE 4
 WEB           API                          MCP
 (stateless    (agency tier;               (the same engine as a tool
  live-resolve  server/burst;               your OWN agent can call)
  SEO doorways  build-then-show)           → Doc 07 GTM, Doc 06 pricing
```

The diagram carries the topology; §4 proves the constraint behind it. Capture and durable preservation can happen *only* in the extension, so the extension anchors the system; the web is a stateless projection with no user library; API and MCP are the same engine deployed server-side at greater depth.

### 2.3 Two premises from the May docs are now wrong, and this doc overturns them

**Overturned premise #1 — "the browsable library *is* the product."** The May north star was "turn the pile into a searchable, organized, exportable library." The evidence suggests that framing is a category error. The save/organize/remember job is *already discharged the instant the user taps save* — "the moment something is saved, the mind relaxes."

The external spine for that claim, not just an internal assertion: read-later apps see only a **5–10% read-through rate** as a category, and **60–80% of browser bookmarks are never re-clicked**;[^readthrough] a 75-user study found Instagram Saved "functions more like a digital junk drawer than an actionable space."[^junkdrawer] Across every read-later app the graveyard is the norm, which is why a better-organized shoebox is a vitamin the market has repeatedly declined: **Pocket, Instapaper, Raindrop, and Instagram Collections** each promised it and none broke out [Internal: JTBD]. (mymind is a partial exception — profitable but niche; §6.1 reconciles it.)

This is the doc's **central hypothesis, not a settled fact.** It is externally corroborated above, but it is falsifiable: if the §11 retrieval test shows users *do* return and re-find in the archive, the relocation is wrong and we persevere with the library-as-product framing. Pending that test, we design as if the hypothesis holds: **re-center the library on the decision moment and grounded resolution; demote archive-browse to a fallback.** This is the biggest single change from May.

**Overturned premise #2 — "TikTok-only, extension-only, export-to-notes, no external grounding."** The founder-decided frame (2026-07-02) is bigger: one engine, two depths; TikTok **and Instagram**; resolution to **real external surfaces** (Maps / Letterboxd / TMDB / Spotify); web, API, MCP surfaces; open-core; a rebrand. The May docs remain excellent prior art for behavior and trust, but are not the ceiling (per MEMORY: "bottom-up, not bound by past").

### 2.4 This doc owns the surfaces and the library; it defers pipeline, pricing, GTM

**In scope:** surface topology and division of labor; the extension-only signed-media constraint; IA and core flows updated for grounding and the decision moment; the Apple-Photos-grade library UX; the multi-tool design/brand method with its anti-slop bar and humanized copy.
**Out of scope:** pipeline internals, taxonomy mechanics, eval (Doc 04); pricing numbers (Doc 06); ICP, doorways, launch sequencing (Doc 07); the concierge/LOI agency motion (Doc 01 + validation research).

---

## 3. The goals chase the decision moment and visible grounding; the non-goals refuse the feed, the chatbot, and breadth-racing

**Goals**

- **G1.** Make the *decision moment*, not the library home, the surface where value lands — recipes to the stove, restaurants to the map, films to a watch-tonight shortlist, in the painkiller order JTBD ranks them [Internal: JTBD].
- **G2.** Make **grounding visible** — every resolved entity shows its external ID, its source (frame + transcript line), a confidence, and a "correct-me" affordance. The top-right quadrant no consumer competitor occupies [Internal: Competitive].
- **G3.** Deliver an **Apple-Photos-grade** library that stays calm at multi-thousand-item density and makes *retrieval* the fast path.
- **G4.** Resolve the four surfaces into **one coherent system** off one engine, honestly labeled.
- **G5.** Make **openness and portability the default** — open schema, clean export — as trust/moat, not a paywall (reconciles with Doc 06).
- **G6.** Ship a design system via a **multi-tool iterative method** with an explicit **anti-slop bar** and **humanized copy**.

**Non-goals** (deliberate; Cagan "pick your battles"; Blue Ocean *Eliminate*)

- **NG1. No social/discovery feed.** An engagement arms race a solo founder cannot win, and it dilutes trust [Internal: Competitive]. Its absence is a positioning asset.
- **NG2. No chat agent in-product.** Library + resolution is the product. We expose the engine over MCP so the user's *own* agent can query it — the inverse of embedding a bot (§5.5).
- **NG3. No mobile-native app at v1.** Mobile cannot eager-capture expiring signed media (§4). Mobile is a later read/decision companion.
- **NG4. No agency GTM in consumer v1.** API/MCP is architected-now, built-and-validated-later, via build-then-show to warm agency contacts [Internal: Validation].
- **NG5. Not breadth-racing platforms.** TikTok + Instagram *demonstrably deeper* beats 14 platforms shallowly [Internal: Competitive].

---

## 4. The expiring-signed-media constraint is a moat to lean into, not an obstacle to route around

**The constraint.** Platform media URLs are signed and expire in hours [Internal: Platform-model]. A tool that resolves *lazily* — days later, on a web page or a mobile app fetching a stored URL — hits dead links a meaningful fraction of the time[^deadlinks] and cannot rebuild a durable, offline library. Only a client *present at the save moment, inside the platform's authenticated context* can grab the poster, a ThumbHash placeholder, and (optionally) the mp4 bytes before they rot.

**Why decisive.** The Competitive analysis names "eager capture at capture-time" as sustainable advantage #3 — an extension-only capability pure mobile apps (Albo, Sorti, most of Rung 3) structurally cannot replicate [Internal: Competitive]. The constraint *is* the moat. So we make the extension the privileged capture-and-preservation client and design every other surface around the fact that only it holds durable media.

**The resolution — a topology, expressed as three honest contracts:**

| Surface | Holds a user library? | Media strategy | Trust contract |
|---|---|---|---|
| **Extension** | **Yes — source of truth**, local-first | **MUST eager-capture at save-time**: poster + ThumbHash, optional mp4, via MAIN-world interception of the platform's own signed responses. **MUST NOT** forge signatures. | Local-first: nothing to our servers; only the user's own model calls leave the browser. |
| **Web** | **No — stateless** | **MUST live-resolve only** (pasted link or seeded demo, resolved on the spot). **MUST NOT** store durable media. | Public, no account, no data at rest — survives Google's 2026 thin-page deindex, keeps the trust story clean.[^facade] |
| **API** | Agency's own corpus, server-side | Server/burst enrichment on the agency's supplied media. Agency **MUST** own capture and rights. | A B2B contract; a different tier. |
| **MCP** | Reads local library (consumer) or API corpus (agency) | Same as its host surface. | The user's own agent, on the user's terms. |

No surface pretends to a capability it lacks. That honesty is precisely what the trust-poisoned category (the 2025 spyware wave) rewards.

One open engineering question gates how invisible enrichment can be: **can a background/extension fetch with host-permissions carry platform cookies without a foreground tab?** If yes, enrichment loses its tab requirement; if no, we design for a quietly-managed tab, surfaced honestly ("using a TikTok tab to fetch video data"). Flagged in §12, owned by Doc 04.

---

## 5. One engine projected at four surfaces, with the payoff and the IA relocated to the decision moment

### 5.1 Five surfaces run off two build efforts because the extension and web share one component library

The May spec's three in-extension surfaces (popup / Library / onboarding) are kept; this doc adds two.

- **Popup — the remote control.** Status and quick actions on a platform tab (capture state, counts, key status, in-progress job with pause/resume). Never a workspace. The May ~6 popup states hold.
- **Library — the workspace, re-centered.** Still home, but its center of gravity moves from the item-grid pile to retrieval and decision surfaces (§5.3). Most-changed surface.
- **Onboarding — confidence plus setup.** Kept, plus one addition: it must *demonstrate a resolution* during setup (one saved item resolved to a real Maps/TMDB entry). Seeing the painkiller once overcomes the "anxiety + habit" of adopting yet another app [Internal: JTBD].
- **Web — public live-resolve Facade + portfolio.** New. Per-platform × intent doorways (Doc 07) that actually resolve a few items live, plus the open-core showcase (published six-axis scorecard, the ontology). Holds no user library.
- **API + MCP — the engine as a callable.** New. The agency tier (API, server-side, high-volume), and the consumer "export to my own AI" reconceived as **MCP** so the user's Claude/agent queries *their* grounded library directly — the strategically correct form of "export to ChatGPT," and of NG2.

**Trade-off.** Five surfaces is a lot for a solo founder at 10–20 hrs/wk. We resolve it by sequencing and shared substrate: the extension Library and the web surface **share one React component library and one design system** (§7), differing only in data source (local store vs live-resolve); API and MCP are the *same engine* with a thin transport. So it is five surfaces but roughly two build efforts plus two thin adapters — and API/MCP are deferred (NG4).

### 5.2 The IA is lenses over one deduped library, with the grounded referent as a first-class citizen

The May IA — one deduped library browsed through **lenses** (by item / entity / collection / imports) — is kept, with two upgrades from the cross-domain research.

**Upgrade A — model the durable referent separately from the post and the save.** Fifty saved TikToks about the same restaurant are fifty posts pointing at *one real-world entity* — the restaurant, which grounds to one Google Place ID. (This is the library-cataloging habit of separating the enduring work from the copy in hand — FRBR/LRM's "WEMI"; the mechanics live in Doc 04 [Internal: Platform-model; Taxonomy].) Collapsing "the TikTok" and "the restaurant it depicts" into one object is what makes competitors' dedup and grounding brittle. So the IA has three node types:

- **Referent** — the grounded real-world entity (Place, Movie/TMDB, MusicRecording/MBID, Recipe): the durable, dedupe-able target every decision surface is built on.
- **Post** — the captured item (caption, creator, on-screen text, transcript, poster/ThumbHash).
- **Save** — the user's instance (collection membership, save-date, provenance).

This is *why* the entity lens can honestly say "Lilia — saved 3 times, resolved to Google Place ID X," and why the golden set can annotate the referent independently of the post (evaluated by different axes; Doc 04).

**Upgrade B — a faceted, controlled-core-plus-open-tag taxonomy drives the lenses.** The lens set is *faceted classification*: describe each item along several independent axes rather than forcing it into one bucket — the **core entity type** (restaurant/place, film/show, recipe, product, book, music, workout, "look") crossed with orthogonal facets (intent, cuisine/genre, space, time/trend, an actionability/confidence facet). A closed controlled core plus an open model/user tag layer catches the emergent — "girl dinner" the day it trends, with zero governance latency [Internal: Taxonomy]. The UI expresses this as stable core lenses plus free-text/tag search for the long tail; both are needed, because taxonomies alone are too rigid and text search alone too weak.

The **lens order changes** to enact the thesis: decision lenses first, the pile last.

```
LIBRARY IA (revised)
├─ DECIDE  (new, default landing when actionable items exist)
│    ├─ Eat now        → restaurants, resolved to Maps, "open now / near me"
│    ├─ Cook tonight   → recipes, exact quantities extracted, "what's for dinner"
│    └─ Watch tonight  → films/TV shortlist, resolved to TMDB/Letterboxd/JustWatch
├─ ENTITIES (the "find the restaurant I saved" payoff — referent lens)
│    Restaurants · Places · Recipes · Films · Products · Books · Music
├─ SEARCH  (command-palette-first; over caption+transcript+on-screen text+entity names)
├─ COLLECTIONS (the user's own platform groupings, preserved as a lens)
├─ ALL ITEMS (the grid — the fallback pile, NOT the hero)
└─ IMPORTS (read-only capture history; audit + re-export)
```

May opened the Library on the item grid; we move the grid to the bottom and make **DECIDE** the landing (or, when nothing actionable is captured yet, ENTITIES/SEARCH). The pile is demoted precisely because the research says the pile is the vitamin [Internal: JTBD].

### 5.3 The whole surface is optimized to win one stopwatch: resolve faster than re-searching

The critical user journey is a struggling moment with a forcing function:

> **"It's 6pm. I decided to cook something I saw last month. Get me to the stove with the exact ingredient quantities — faster and more trustworthy than re-searching TikTok or giving up and ordering DoorDash."**

Every choice is judged against this CUJ and its sibling ("I'm hungry near a place I saved — is it open, where is it, take me there"). The competitor is re-search and nonconsumption, not Stasht [Internal: JTBD]. The win condition is *time-to-resolved-answer beating re-search* — the §11 retrieval-test metric: ≥~70% task success at meaningfully lower time-to-find than the native baseline, across 5–10 users.[^nng]

### 5.4 The May flows mostly hold; grounding and the decision moment are what change

- **Capture (Flow B).** Kept wholesale (paced auto-scroll, MAIN-world interception, ground-truth count, stall-nudge, manual-assist, ~360-item throttle handling, resumable, deduped). **Added:** eager poster + ThumbHash + optional mp4 *at this moment* (§4) — the one thing that can happen nowhere else.
- **Enrich → Enrich + Ground (Flow C).** The two-tier (text/visual) model is kept; the payoff step becomes grounding. After extraction, deterministic grounding resolves entities to external IDs and agentic verification escalates low-confidence cases (Doc 04). A third state joins raw/text/visual: **grounded** (badge: resolved-to-external-ID, with confidence). The visual-tier cost-confirm modal is kept.
- **Browse & find → Decide & resolve (Flow D).** Rebuilt around §5.2's DECIDE lenses and §5.3's CUJ. Item detail keeps the context-preserving overlay/drawer and adds the show-your-work panel (§5.6).
- **Export → Portability-by-default (Flow E).** May mechanics kept (JSON/CSV/Obsidian/mp4, scope, gates), but the principle inverts: **open-schema JSON export is a free default, not a Pro wall** (ADR-05), because portability-as-default turns Dewey's paid Export-Pass into our baseline [Internal: Competitive].[^dewey] We monetize depth, volume, and polish — never the right to leave. Numbers → Doc 06.
- **Resolve-on-web (new).** Public doorway: user pastes a link (or lands on a seeded demo), the engine resolves live, we show the grounded card with external links and a CTA. A live Facade, not a thin SEO page [Internal: Validation; Doc 07].
- **Ask-my-library-via-MCP (new).** The user connects their agent, which queries the local grounded library. No bot in our UI (NG2); the engine is the tool.

### 5.5 The interfaces adopt a cross-standard consensus object so adding a platform touches an adapter, not the UI

The Platform-model research is emphatic that the data model is load-bearing, not a schema chore — "the raw payloads are exactly the assets that rot fastest" [Internal: Platform-model]. So the durable core MUST be an abstraction over the platforms, with the raw payload demoted to a captured, versioned artifact. Five independent web-content description standards — Activity Streams 2.0 (the social-feed format), schema.org, Open Graph, oEmbed (how sites render an embedded link preview), and Media RSS — converge on one base object; we adopt that consensus rather than inventing our own.

**The unified item (base object).** The core object MUST carry: `type · canonical URL/id · actor/creator · timestamp · text body · attached media renditions` (the logical asset kept separate from its file versions, the way Media RSS groups them) · an optional `refers-to` another item · optional collection membership. Per-platform reality — TikTok `itemStruct` (slideshows, first-class licensed music); Instagram carousel parent-with-metrics + child-media-without-identity; X reference-typed edges; Reddit's `Listing`/fullname zoo — MUST be localized in per-platform adapters and MUST NOT leak into the core. Full schema owned by Doc 04. The UX contract: the item card and entity lens MUST read the abstraction, so adding Instagram changes an adapter, not the UI.

**Presentation projection.** The card SHOULD degrade to a simple embedded-preview view — the four kinds a link can be (`photo/video/rich/link`) are the right top-level `mediaKind` and the ideal fallback when a platform gives us little. The ThumbHash SHOULD be the blurred placeholder (standard practice — Mastodon ships `blurhash` as a first-class field).

**API (deferred-but-architected).** SHOULD be REST/JSON and batch-oriented (Batch −50% where available). MUST be `responseSchema`-driven; every record MUST carry grounded IDs, confidence, provenance. Positioned as VidContext's "give your AI agent eyes," but open and eval-transparent [Internal: Competitive]. Not built for v1.

**MCP (both tiers).** The engine SHOULD expose tools — `search_library`, `get_entity`, `resolve_item`, `list_by_type` — so any agent consumes grounded output natively. The one-product-many-doorways principle extended to the agent ecosystem, and the honest replacement for a built-in chatbot.

### 5.6 Making grounding visible is the one pattern that earns trust, feeds the golden set, and sells to agencies

This is G2 and the empty top-right quadrant. No Rung-3 competitor shows its work — none says "this resolved to Google Place ID X, here's the frame and transcript line it came from, correct me if wrong" [Internal: Competitive]. It is also the anxiety-and-habit reducer JTBD identifies as the only way to beat re-search: visible grounding is what lets the user trust the answer enough to skip re-searching Google [Internal: JTBD].

Every resolved card and the item-detail overlay carry a **provenance strip**:

- the resolved external entity and its durable ID (Place ID / TMDB / MBID) as a live, clickable external link;
- a **confidence signal** — graded, from the agentic verification stage, an orthogonal facet rather than baked into the type;
- the **evidence** — the specific frame plus the transcript or on-screen-text line the extraction came from;
- a **"not right? correct it"** affordance, which also produces free golden-set labels (the flywheel).

One pattern, three payoffs: it makes the consumer product trustworthy enough to change behavior; it *is* the sales artifact for skeptical agency buyers (measurable faithfulness converts them); and it doubles as the open-core credibility signal.

---

## 6. Craft the library to an exceptional bar, but organize it around retrieval, not browsing

If the archive is a suspected vitamin, why build an Apple-Photos-grade library at all? Because the market rewards taste and trust at least as much as technical depth. Cosmos raised substantial venture capital and mymind is profitable, both without solving authenticated capture or actionable resolution.[^cosmos] But note the reconciliation this forces: **mymind's profitability is real yet small-scale and niche — it is not the mass pull we need, and it too leaves the actionable-resolution quadrant empty.** So mymind is not a counterexample to the vitamin verdict; it is proof that taste and trust alone can sustain a *niche* — a different, smaller prize. The resolution: build the library to an exceptional bar, but organize it around retrieval and decision (the painkiller), not browsing the pile (the vitamin). Craft in service of the stopwatch, not as decoration.

### 6.1 "Grade" means Apple-Photos density with mymind's taste and Raycast's retrieval speed

- **Apple Photos** — justified aspect-preserving grid, fast scrubber over thousands, shared-element zoom to detail. The density-and-calm target.
- **mymind** — taste, trust, and auto-typing (article/product/book/recipe), no feed/ads/tracking. The **tonal north star** (and, per §6, a niche proof — not a mass-market template).
- **Raycast** — command-palette-first retrieval; "find, don't scroll" made literal.
- **Linear** — keyboard-first, latency-obsessed, visibly crafted.
- **Family / Emil Kowalski** — motion craft; restraint over confetti.
- **Guidelines as gates.** Rauno's Web Interface Guidelines and Emil Kowalski's animation principles are review checklists, not inspiration [Internal: Prior digest].

### 6.2 The technical stack is chosen so craft goes to the distinctive 20%, not a re-implemented drawer

- **TanStack Virtual** — the grid **MUST** be virtualized so it stays 60fps at multi-thousand items. Non-optional.
- **react-photo-album** — layout **SHOULD** use a justified/masonry algorithm preserving platform aspect ratios (9:16 TikTok, IG square/portrait) — the Apple-Photos look.
- **ThumbHash** — the wall **SHOULD** paint from sub-kilobyte placeholders captured at save-time (§4) so it renders instantly and offline.
- **Motion (`layoutId`)** — grid→detail SHOULD be a shared-element reveal.
- **cmdk** — a command palette SHOULD make SEARCH the fast path, winnable from the keyboard.
- **Vaul** — item-detail SHOULD open as a context-preserving drawer.
- **Sonner** — capture/enrich/export progress SHOULD use a calm, non-modal toast channel.

These are canon choices (cmdk/Sonner/Vaul named in the digest [Internal: Prior digest]) so craft goes to the distinctive 20%, not to re-implementing a drawer.

### 6.3 Density, calm, and the absence of a feed are themselves the trust feature

Three views (May brief): the thumbnail wall (dense, content-is-the-color), the entity collection (referent-first, provenance-visible), the focused detail (calm, evidence-rich). Content is the color; chrome frames the user's thumbnails and never competes. And there is no feed (NG1): the library is *yours* — private, calm, the opposite of the infinite scroll it rescues you from. The trust-poisoned category will feel that absence.

---

## 7. A distinctive, trust-signaling design comes only from a multi-tool diverge-converge-implement-QA loop, never a one-shot

The May visual brief is a good handoff. This section fixes the *method* around it: iterative, multi-tool, never one-shot [Internal: Prior digest].

### 7.1 Diverge across tools, converge in Figma, implement in a shared kit, QA every state

1. **Diverge (breadth).** Generate multiple distinct directions in parallel across Claude Design + Vercel v0 + Figma Make from the same brief, each fed the anti-slop bar (§7.2) and the three candidate moods (quiet-archive/editorial · modern-utility/crisp · warm-collected/tactile). Pick one; do not blend.
2. **Converge (Figma = source of truth).** Reconcile the winner into one Figma system: tokens (semantic color light+dark, type pairing, spacing, radii, elevation, motion); the component kit (buttons, API-key field with validation states, item card, entity card, chips, the four enrich/ground badges, progress, drawer, empty states, toasts, upgrade prompt); and one signature element.
3. **Implement (Claude Code).** Build to the Figma kit as the shared React library used by both extension Library and web (§5.1). Motion via Motion; layout via react-photo-album + TanStack Virtual.
4. **QA (Claude-in-Chrome).** Drive the real extension/web to verify the load-bearing *states*: empty; capturing-with-throttle-nudge; enrich/ground-in-progress; no-key block; visual-enrich cost-confirm; export-capped-upgrade; no-search-results; the provenance strip. Audit against Rauno WIG and Emil Kowalski.

This maps onto the DesignSync/Figma tooling here and the Fable orchestration plan in-repo (`docs/superpowers/plans/2026-07-02-fable-orchestration-plan.md`).

### 7.2 The anti-slop bar is a hard rejection gate, not a preference

- **No Inter / Roboto / system-font defaults.** A distinctive display voice and refined body face; a mono face **MAY** carry data (counts, IDs, durations).
- **No AI-purple gradient-on-white.** A confident, restrained chrome palette; content brings the saturation.
- **No cookie-cutter SaaS dashboard.** It must read as a private personal archive — and explicitly not a sketchy grabber/downloader (the 2025 spyware wave poisoned the category).
- **Restraint in motion.** One orchestrated reveal beats scattered micro-interactions.

### 7.3 Copy is a trust surface, so it reframes limits as care and states privacy plainly

Voice: calm, plain, honest, never alarmist or salesy. Keep the correct May examples.

- **Reframe limits as care.** Rate-limit → *"Slowing down to respect your Gemini limits."* Throttle → *"TikTok paused us — give the page a scroll to continue."*
- **State privacy plainly, as a centerpiece.** *"Nothing goes to our servers. When you enrich, only your own AI calls leave your browser."*
- **Value-frame every gate.** *"Exporting the first 500 of 1,313 — upgrade for all,"* never "out of credits."
- **Provenance copy is humble.** *"We think this is Lilia (Brooklyn) — resolved from the caption at 0:14. Not right?"*
- **Empty states invite, not scold.**

### 7.4 The rebrand must read trustworthy and archival, never "downloader"

The frame mandates a rebrand. This doc fixes constraints, not the name (an output of §7.1's divergence): it must read *trustworthy, personal, archival, technically-serious*; must not evoke "downloader/grabber"; must support open-core/portfolio positioning. Naming/mark are an explicit design deliverable (§12; GoDaddy domain-check tooling available).

---

## 8. Every rejected alternative either forfeits the eager-capture moat or chases an unwinnable engagement race

Each rejected option maps to the ADR (§9) that records its full reasoning; the one-liner is the pointer.

- **A1 — Keep archive-browse as the product (May premise).** Rejected → **ADR-02**. Bets against the vitamin hypothesis (§2.3).
- **A2 — Build a chat agent over the library.** Rejected (NG2) → **ADR-07**. MCP is cheaper and makes the *user's* agent the interface, not us.
- **A3 — Cloud-first / account-based consumer product.** Rejected → **ADR-01**. Forfeits the local-first trust moat and the eager-capture advantage.
- **A4 — Mobile-native as the primary surface.** Rejected → NG3 / §4. Mobile cannot eager-capture expiring signed media.
- **A5 — Per-platform data models, unify later.** Rejected → **ADR-04**. Raw payloads rot fastest and poison downstream stages.
- **A6 — Add a social/discovery feed.** Rejected (NG1) → **ADR-07**. Unwinnable solo, dilutes trust, off-thesis.
- **A7 — One-shot the visual design.** Rejected → **ADR-06**. One-shot converges on slop.
- **A8 — Thin programmatic SEO doorways.** Rejected → §4 / Doc 07. Google's 2026 deindex kills them; use live Facades.

---

## 9. Seven decisions carry the design, each recorded as an ADR that can be overturned on its own terms

**ADR-01 — Extension is the privileged capture-and-preservation client; web is stateless; API/MCP are server-side.**
*Accepted.* *Context:* signed media expires in hours; only an in-context client can eager-capture; local-first is a trust moat, yet web/API still need data. *Decision:* extension is the sole durable capture client (eager poster/ThumbHash/mp4); web is stateless live-resolve; API/MCP run the same engine server-side on supplied corpora. *Consequences:* (+) capability honesty, trust preserved, eager-capture moat exploited, web survives deindex; (−) no single uniform backend; mobile deferred (NG3).

**ADR-02 — Relocate the payoff from archive-browse to grounded resolution at the decision moment.**
*Accepted (supersedes May "library is the product").* *Context:* the vitamin hypothesis (§2.3), externally corroborated but falsifiable. *Decision:* land the Library on DECIDE/ENTITIES/SEARCH, demote the pile, optimize for the CUJ stopwatch. *Consequences:* (+) targets the only monetizable painkiller pockets (recipes, restaurants); (−) requires reliable grounding before it is valuable (dep. Doc 04); narrows v1 from horizontal to acute (correct, per JTBD); reversible if §11 falsifies the hypothesis.

**ADR-03 — Show your work: provenance + confidence + evidence + correct-me as a first-class pattern.**
*Accepted.* *Context:* no consumer competitor shows its work; grounding-trust is the habit-breaker vs re-search; agencies buy on measurable faithfulness. *Decision:* every resolved entity surfaces external ID, confidence, source frame/line, and a correction affordance. *Consequences:* (+) occupies the empty top-right quadrant; corrections feed the golden set; doubles as the B2B sales artifact; (−) more UI + engine plumbing per item.

**ADR-04 — Model referent / post / save as three distinct nodes; adopt the cross-standard consensus base object with per-platform adapters.**
*Accepted.* *Context:* raw platform payloads rot and diverge; conflating post and referent breaks dedup and grounding. *Decision:* the core is an abstraction (the AS2/schema.org/oEmbed/OG/Media-RSS consensus) with the referent first-class; platform quirks live in adapters. *Consequences:* (+) clean dedup (50 saves → 1 Place), Instagram becomes an adapter not a rebuild, the entity lens is trivial; (−) upfront modeling cost; requires keeping raw payloads demoted to versioned artifacts. (Schema owned by Doc 04.)

**ADR-05 — Portability and open-schema export are a free default, not a paywall.**
*Accepted (revises May "export behind Pro").* *Context:* portability-as-default is the trust/openness moat; Dewey monetizes export because lock-in is the norm, so inverting it differentiates. *Decision:* open-schema JSON export is free; monetize depth, volume, polish. *Consequences:* (+) trust and open-core credibility; (−) removes an easy revenue lever, pushing monetization onto enrichment depth/volume (Doc 06 must absorb this).

**ADR-06 — Multi-tool iterative design; Figma is the source of truth; Claude Code implements; Claude-in-Chrome QAs.**
*Accepted.* *Context:* one-shot design converges on slop; the anti-slop bar demands divergence then convergence. *Decision:* diverge across Claude Design/v0/Figma Make → converge in Figma → implement in a shared React kit → QA states in-browser. *Consequences:* (+) distinctive, state-complete UI; shared kit serves extension + web; (−) more process for a solo founder (mitigated by shared substrate + deferral).

**ADR-07 — No feed, no chatbot; expose the engine via MCP instead.**
*Accepted.* *Context:* feeds are unwinnable and off-thesis; a built-in bot makes us the interface instead of resolving to real surfaces. *Decision:* no feed; no in-product chat agent; the engine is a callable via MCP for the user's own agent. *Consequences:* (+) trust and focus preserved, cheaper, differentiated; (−) forgoes engagement-driven growth (acceptable — growth is SEO/AEO-led per Doc 07).

---

## 10. The cross-cutting concerns reduce to one claim: here, trust is an architecture, not a tagline

- **Privacy & trust (load-bearing).** Local-first consumer core; nothing to our servers; only the user's own model calls leave the browser, surfaced in onboarding and a Settings "data & privacy" view; no telemetry of user content (May, kept). Web stores no user library (§4). Trust is *expressed* visually and in copy (§7.3), not merely asserted — the category's differentiator (ARCHV wins trust points purely by being local) [Internal: Competitive].
- **Security.** Zero remote code (MV3, no `eval`/remote scripts) — trust posture and Web Store requirement. MAIN-world interception reads the platform's own signed responses, never forges signatures. BYO key stored locally, never transmitted to us. Licensing via Lemon Squeezy with a grace-period cache (May §5.3, kept).
- **Observability.** The shared progress/status model — phase, count/total, %, ETA, pause/resume, per-item failure reasons — spans capture/enrich/ground/export (May, kept). With no content telemetry, product learning comes from the build-then-show retrieval tests, the Sean Ellis survey, and Facade-doorway intent [Internal: Validation], not analytics on user content.
- **Accessibility.** Keyboard nav (grid, filters, palette, drawer); focus management for the detail overlay; non-color status cues (badges legible without color); sufficient contrast. Audited via a11y tooling and Claude-in-Chrome (May, kept; strengthened by Rauno WIG).
- **I18n/scale.** Grounding authorities are global-ish but uneven (Places broad; TMDB/MusicBrainz global; Letterboxd/IMDb lack free APIs, so use TMDB/Trakt [Internal: Prior digest]). The item model is language-agnostic; MusicBrainz preferred over Spotify for durable open IDs.
- **Performance.** 60fps at 20k items via TanStack Virtual + ThumbHash; instant palette search over the local store; Batch −50% for server-side enrichment (Doc 04/06).

---

## 11. Rollout is build-then-show against pre-declared kill metrics, so craftsmanship cannot pass for evidence

Sequenced for a solo founder at ~10–20 hrs/wk, no hard deadline [Internal: Validation]. These metrics are what test the §2.3 vitamin hypothesis — if they fail, the relocation thesis is wrong and we pivot, not persevere.

1. **Instrument before you show.** Wire session logging (task success, time-to-find) and the Sean Ellis prompt; pre-register kill/persevere thresholds. This is what keeps build-then-show honest.
2. **Extension Library v1 (the anchor).** Implement the revised IA (DECIDE/ENTITIES/SEARCH, provenance strip, Apple-Photos grid) against the built engine and the 1,313-item corpus. Ship capture (proven) + enrich + **ground**.
3. **Retrieval validation, weeks 1–4.** 5–10 target users on *their own* corpora, one at a time (the Collison-installation motion), each session ending in a commitment ask; Sean Ellis at two weeks.[^nng][^seanellis] **Gate:** ≥~70% task success at lower time-to-find than the native baseline, ≥40% "very disappointed," ≥1 commitment per satisfied user. **Miss → pivot** toward the Segment-1 one-time Export-Pass funnel (Doc 06/07), not the retention-dependent subscription. This gate is the falsification test for the whole doc.
4. **Web Facade doorways, in parallel.** 2–3 live-resolving platform × intent pages off the seeded demo corpus (Doc 07), respecting the 2026 deindex constraint; measure intent.
5. **Instagram adapter** (fast-follow) — an adapter, not a rebuild (ADR-04).
6. **API/MCP + agency concierge, weeks 2–6, deferred build.** Concierge deliverable from one warm agency contact's real folder (Vanta/Ramp manual-report motion), driving toward an LOI or paid pilot before building the scaled pipeline [Internal: Validation; Doc 01].
7. **Decide out loud** against the pre-declared metrics — not against how good the artifact feels. The engine remains a career-defining portfolio artifact regardless of verdict, which is what makes it safe to judge the product harshly.

**Testing.** The 54 Vitest suite stays green (engine). State-level UI QA runs via Claude-in-Chrome across all load-bearing states (§7.1). The six-axis eval re-runs on each engine/taxonomy release (Doc 04) and is also the public web artifact.

---

## 12. The open questions are owned and dated, and every major claim is traceable to a labeled source

**Open questions (owned, dated):**

1. **Background cookie fetch (blocks how invisible enrichment is).** Can an extension background fetch with host-permissions carry platform cookies without a foreground tab? → Doc 04 / engineering spike (§4).
2. **Rebrand name + mark.** Output of §7.1; constraints in §7.4; domains checkable via tooling. → design phase.
3. **DECIDE-lens presence at the moment.** How far can an extension go toward "near me now" / "what's for dinner" without a mobile app or a feed? → design spike; may motivate the later mobile companion (NG3).
4. **Sync without breaking local-first.** What portable-but-private sync (a user-held file, their own storage) preserves the trust contract? → post-v1.
5. **Pricing reconciliation for ADR-05.** Free portability removes the export lever; Doc 06 must re-anchor monetization on enrichment depth/volume, with the Segment-1 one-time upsell as the pivot path.

**Appendix A — durable inheritances from the May docs (kept, not re-litigated):** the three in-extension surfaces and roles; capture-flow mechanics (paced scroll, interception, stall-nudge, manual-assist, resumable/deduped); the two-tier enrich model; entitlements-as-config (capabilities, never "is-Pro?"); the deduped-library + read-only imports-log data model; the shared progress/status model; local-first privacy surfacing; "content is the color / chrome frames it"; the anti-slop bar with humanized-copy examples.

**Appendix B — provenance of major claims.** *Internal dossier research (tagged [Internal: …]):* vitamin hypothesis + painkiller ranking (JTBD); build-then-show, retrieval test, Facade-over-Fake-Door, kill metrics (Validation); top-right quadrant, show-your-work, eager-capture moat, no-feed, open-core, mymind/Cosmos reconciliation (Competitive); consensus base object, referent separation, ThumbHash-as-standard (Platform-model); faceted controlled-core + open-tag taxonomy (Taxonomy); the reference apps, the stack canon, Rauno WIG, Emil Kowalski, the multi-tool method, the anti-slop bar (Prior digest). *Framework spine:* Google design-doc conventions; Nygard ADRs (§9); RFC proposed-for-consensus; JTBD/Christensen/Moesta; Blue Ocean *Eliminate*; NN/g 5-user testing; Sean Ellis 40%; Savoia Facade. *External primary evidence and auditable figures are in the footnotes.*

---

[^readthrough]: **Directional; vendor-sourced, not peer-reviewed.** "5–10% read-through" and "60–80% of browser bookmarks never re-clicked" originate in Burn 451, a vendor blog; consistent with the academic digital-hoarding literature but not independently measured. Confidence: moderate/directional. Relayed via the internal JTBD dossier. Pulled into the §2.3 body as the external spine for the vitamin hypothesis.
[^junkdrawer]: Instagram Saved "functions more like a digital junk drawer than an actionable space" — a 75-user study, Bootcamp / Yuvraj Singh. External, qualitative. Relayed via the internal JTBD dossier.
[^deadlinks]: **Directional; vendor-sourced.** "20–30% of saved items point at deleted/rotted content" originates in ContextBolt, a vendor blog, echoing the platform-model finding that signed CDN media rots within hours. Confidence: moderate/directional. Not a measured figure for our own corpus — a category expectation, not a promise.
[^facade]: Prefer-Facade-over-Fake-Door reasoning ("someone answers and something happens"; the 2026 thin-page deindex constraint) is external (Savoia, *The Right It*; Google 2026 core-update guidance), relayed via the internal Validation dossier.
[^nng]: NN/g: ~5 users completing real tasks surface ~85% of usability problems in a qualitative, task-based test, with sharply diminishing returns after. External primary (Nielsen Norman Group).
[^seanellis]: Sean Ellis 40% test — ≥40% answering "very disappointed" at losing the product correlates with the ability to grow. Empirically benchmarked; external primary.
[^cosmos]: Cosmos raised ~$21M total ($6M seed + $15M Series A); mymind is profitable but niche, without solving authenticated social capture or actionable resolution. External primary (Pulse 2.0; Cosmos blog; mymind pricing). Relayed via the internal Competitive dossier.
[^dewey]: Dewey's one-time "Export Pass" ($50 / 48h) and ~3.75% paid-conversion model (≈40k users, ≈1.5k paying). External/vendor figures (verified in the Fable brief appendix). Relayed via the internal Competitive dossier; treat conversion as competitor-reported.

---

**Revision note (not part of the doc).** Changes mapped to the critique: **(1) mymind contradiction resolved** — dropped from the §2.3 refused-vitamin list (now Pocket/Instapaper/Raindrop/Collections) with an explicit pointer, and reconciled in §6/§6.1 as "profitable but niche, not the mass pull we need, actionable-resolution quadrant still empty — a niche proof, not a counterexample." **(2) Core-bet credibility** — the "vitamin" thesis is downgraded from "overwhelming" to an explicit falsifiable *hypothesis*, the read-through (5–10%) and junk-drawer studies are pulled from footnotes into the §2.3 body as the external spine, and the thesis is now tied to the §11 kill metrics in §2.3, ADR-02, and §11 step 3. **(3) Length** — cut ~30–35%: §8 Alternatives collapsed to one-line pointers into the ADRs (removing the A1↔ADR-02 / A5↔ADR-04 / A2·A6↔ADR-07 duplication), §2.2 diagram narration compressed to defer the capture-moat argument to §4, and prose tightened throughout. **(4) Answer-first** — a 3–4 sentence SCQA lead now sits above the Status / normative-keywords / sourcing apparatus. **(5) Jargon** — WEMI/FRBR-LRM, faceted analysis (Ranganathan), Activity Streams 2.0, oEmbed, and Media RSS media:group are each glossed once in a plain-English clause on first appearance (§5.2, §5.5), with mechanics pushed to Doc 04 and the plain claim ("50 saves of one restaurant = 50 posts pointing at one real-world entity") kept in the body. If persisted, the natural path is `/Users/s0shaheen/Dev/attic-extension/docs/superpowers/specs/2026-07-02-dossier-05-product-ux.md`.