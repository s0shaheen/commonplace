# COMMONPLACE — Product Spec (v5, governing)

> **This is the single governing document.** It supersedes `_FABLE-BRIEF.md` (v4) and every earlier brief; the dossier (`00–08`) and `_ENGINE-groundup` remain reference depth; the evidence trails are `_FABLE-PHASE1-findings.md` (2026-07-06, six-agent pressure-test) and `_RESEARCH-2026-07-06.md` (2026-07-06, seven-track re-founding research). A build session starts here and should not need to re-decide anything below. **No timelines or effort estimates appear anywhere: the build is agentically coded; the only scarce resources are the founder's decisions, provisioning, and taste, and the plan is sequenced by exactly those gates.**
>
> Product name: **Commonplace** — **G1 RATIFIED by the founder 2026-07-06.** Domain availability re-verified via GoDaddy the same evening: `commonplacehq.com` and `usecommonplace.app` both available (founder registers; `commonplace.app` confirmed parked — acquisition inquiry is an upgrade, not a blocker). Codename "Attic" persists in repo paths until the open-core carve (Block 6), per the naming plan.

```
Date:      2026-07-06 (v5 — the re-founding)
Written:   from intention down, per the founder's directive; every inherited decision
           re-derived or explicitly carried; every 2026 claim re-verified this day.
Mandate:   READY TO BUILD. Parts I–V define the product; Part VI sequences the build;
           Part VII builds the career artifact deliberately. Three feasibility spikes
           open the build (Block 0); nothing else is uncertain enough to gate on.
```

---

# PART I — INTENTION

## 1. Why this exists

You have saved four and a half thousand videos. Each one was a small act of intent — *cook this, go here, learn that, remember this feeling*. The platform treats that intent as exhaust. Saves are write-only memory: no real search, no export, no sense of what's actually in there, and the platform can take any of it away without asking. The attic fills; nothing ever comes back down.

This product takes the one signal the algorithm didn't choose for you — **what you chose to keep** — and gives it back to you as something alive: owned, understood, and usable.

The founder's own founding sentence (2026-07-02, before any process): *"a truly durable, robust, valuable product that fits a user need, is genuine — not slop, not scammy, has a signature look that is my own."* And the depth bar, verbatim: *"We do not provide shallow insights or analysis; we do the FULL research-grade, no stones unturned analysis."* This spec is those two sentences, engineered.

## 2. The thesis (humanist, made structural)

What you chose to keep is a record of who you are — your taste, your plans, your curiosities. That record should **belong to you**, be **legible to you**, and **work for you**. Three verbs, three subsystems:

- **Out.** Your saves leave the platform passively, from your own logged-in session, by reading the responses the platform already sent you. No scraping, no forged requests, no credentials handed to anyone. (§7.)
- **Understood.** Every item gets a research-grade breakdown — what's said, what's on screen, what it's about, and *which real-world things it refers to*, resolved to durable public identifiers with confidence, evidence, and an honest "couldn't verify" when the system doesn't know. (§13–15.)
- **Usable.** A library you actually visit: search that works on meaning, entities, and words; exports that are always free; an MCP server so your own AI tools finally know what you know. (§8–11.)

The name carries the lineage: a **commonplace book** is the five-century-old humanist practice of collecting, excerpting, and indexing what you encounter so it becomes usable knowledge — Locke wrote an indexing method for his; Darwin kept one. This product is that practice, rebuilt for the medium your saves actually live in. *A commonplace book for the video age.*

"Humanist" and "intentional" are not brand adjectives; they are five structural commitments, each enforced by architecture, each violated by a specific temptation this spec forbids:

| Commitment | Enforced by | Forbidden temptation |
|---|---|---|
| **Your data is yours** | One-click full-fidelity export, documented open schema, free forever | Paywalling export (Dewey sells a $50, 48-hour "Export Pass" — the live example of the betrayal we never commit) |
| **Local-first** | Library lives in the extension; analysis runs locally or on your key; sync is client-side encrypted — we *cannot* read your library | Any server that sees plaintext saves "for convenience" |
| **Honesty over fluency** | Calibrated confidence on every claim; NIL ("no match") as a designed state; published accuracy including failures | Confident hallucinated tags; unaudited "98% accurate" marketing (ReelRecall's actual claim) |
| **A place, not a feed** | No engagement loops, no streaks, no badge-begging; calm density | Algorithmic resurfacing tuned for time-on-app |
| **Open where it counts** | Engine, schema, and eval harness are open source; the privacy policy is inspectable code | Open-washing: a dead mirror repo while the real logic stays closed |

## 3. Whose product this is

**The founder's three goals, resolved.** In his words (2026-07-06): *wow recruiters; show product / design / technical thinking coupled with a humanist / intentional approach; make me money* — money explicitly *"not at the expense of quality / user value / trust."* These are one bar applied three ways: **build it so well the craft is self-evident, so honestly the values are structural, and so useful that strangers pay.** Precedence when they conflict: trust/craft > usefulness > revenue — slop destroys the career artifact, dark patterns destroy the humanist claim, and revenue built on either is small anyway. Paying strangers are also the strongest line in the career story (the bar is binary — "strangers pay for it," roughly 5–20 of them plus the pricing decision written up — never an MRR figure, which at solo scale reads small and adds no hiring weight).

**The user.** Primary: the **consumption-conscious prosumer** — hundreds-to-thousands of saves across TikTok and Instagram, wants to *understand and use* them, not just hoard. Secondary doorway: the **ad-hoc exporter** ("just get my favorites out") who arrives through store search or a utility page and may never pay — welcome anyway; that intent is proven at 100k-install scale (myfaveTT) and it's the funnel. Tertiary, deferred: **agencies/strategists** — served in v1 only by the same personal MCP + open schema; a bulk API waits for a real demand signal.

One product for all three; no per-persona forks. And one honesty about scope: the founder's ambition was always the *universal* personal media archive (Reddit, Substack, YouTube, arbitrary URLs — his July-2 list). v1 refuses that breadth deliberately; **the open schema is the bridge** — it's how the narrow v1 becomes the universal archive without this team building every adapter.

## 4. What "best-in-class" means (five bars, all measurable)

1. **Capture you can trust.** Never lose a save; survive a renderer crash mid-capture; zero forged requests. Bar: a 5,000-item capture completes with storage-checkpointed accumulation; interruption loses nothing already seen.
2. **Understanding with receipts.** The flagship metric — entity-resolution accuracy to durable public IDs (P/R), NIL accuracy, confidence calibration (ECE) — **published, version-locked, reproducible** from an open harness. Verified today: no competitor publishes any of these.
3. **A library that feels like a place.** Find anything in under 10 seconds on a 5,000-item library; 60fps grid; grid→detail feels physical; every empty, loading, and error state designed.
4. **Leave-anytime portability.** Full-fidelity open-schema export in one click; schema documented and versioned; MCP so agents read the library natively. The proof: a user who leaves loses nothing but the UI.
5. **A repo that reads senior.** Tests and eval in CI, ADRs for the calls that matter, honest READMEs, clean history, releases with human notes. The repo is a first-class product surface (Part VII).

## 5. What this product refuses to be

- **Not a downloader.** The word never appears in product copy. Downloaders are a ToS-adversarial race to the bottom; this is an archive-and-understanding tool for your own data.
- **Not an AI brand.** AI is invisible plumbing. Founder, verbatim: *"We are not an AI business or brand; but we use AI behind the scenes."* No sparkle icons.
- **Not a feed.** No recommendations, no social graph, no public profiles in v1. (Cosmos, $21M raised, is drifting toward a public feed — the venture-scale path our counter-positioning exploits.)
- **Not a chatbot.** The honest version of "talk to your saves" is the MCP server — bring your own agent.
- **Not a breadth race.** TikTok + Instagram + X-bookmarks doorway in v1. The schema, not this codebase, is how the universe expands.

---

# PART II — THE PRODUCT

## 6. One breath, one loop

**In one breath:** the media you've saved, liked, and posted across platforms becomes a private, beautiful library where every item is deeply understood — transcript, on-screen text, themes, and the real-world things it refers to, each resolved to a durable public ID with confidence and evidence — searchable, exportable, and readable by your own AI tools.

**The core loop** (the retention thesis — what makes this a practice, not a one-time export):

```
CAPTURE (passive while you browse; bulk via auto-scroll / ZIP import)
  → UNDERSTAND (the engine runs — local or managed; items go raw → analyzed → grounded)
    → RESURFACE ("This Week" shelf: what you saved, what it's about, what's actionable)
      → FIND (the impossible query: "that pasta video with the brown butter" — it's there)
        → USE (open the place in Maps; export the recipe; let your agent read the library)
          → back to capture, now with a reason to save intentionally
```

The hinge is **RESURFACE + FIND**: a library you never re-enter is a vault (Dewey); a library that brings things back is a commonplace book. The digest is calm — a shelf inside the library, never a push notification.

## 7. Capture (the moat nobody can follow into)

- **TikTok (proven, shipped):** MAIN-world interception of the platform's own already-signed `item_list` responses during human-paced scrolling. Source-tagged (favorites / likes / posts) with union dedupe. The real 4,661-item corpus came through this path (verified this session: 1,367 favorites-tagged, 4,132 likes-tagged, 2 posts; overlap 840).
- **Instagram (live headline + ZIP fallback — G4 settled 2026-07-07):** the Block-0 spike PASSED (`spikes/ig-live/RESULT.md`), so **live interception is a v1 headline lane** for Instagram, matching TikTok: the saved view fires `GET /api/v1/feed/saved/posts/` (200, single JSON blob, `max_id` cursor, enrichable `{media}` items). The "Download Your Data" ZIP remains the **guaranteed fallback** for offline / ban-scared / zero-scroll users — and verified richer than assumed (`spikes/ig-live/RESULT.md`): `saved_posts.json` carries `URL · Caption · Title · Hashtags · Owner` per post + collections + timestamps, so it seeds real text search immediately, lacking only the media-derived signals (transcript/OCR/scene) the live lane's video fetch adds. The permalink is the join key that lets live capture later deepen a ZIP-imported item. The live lane is REST-cursor, not GraphQL-doc_id, so it carries no doc_id-rotation tax.
- **TikTok DYD ZIP (added 2026-07-06):** TikTok's own "Download Your Data" export ships as a second guaranteed TikTok lane alongside live capture — it cross-checks the live corpus, recovers likes/favorites a scroll session missed, and gives ban-scared users a zero-scroll path. Both platform ZIP importers land in Block 3; the founder's exports of both are in progress and become the importers' first fixtures.
- **X bookmarks:** same interception pattern, lowest-risk platform, after the core.
- **Eager media:** signed poster/media URLs expire in hours — fetch posters at capture. This is the structural advantage: mobile-app competitors cannot preserve expiring signed media; an extension sitting inside the session can.
- **The #1 correctness build:** the resumable, memory-bounded offscreen job queue (checkpointing, service-worker-death revival, 429 backoff, bounded concurrency). The 4,661-item capture crashing the renderer — and losing nothing, because accumulation is storage-checkpointed — is the lived proof of both the risk and the answer.
- **Posture:** read-only skim of your own session's responses. No request construction, no signature forging, no doc_id chasing — the failure mode that kills instaloader/instagrapi is one this architecture structurally does not share.

## 8. The library (information architecture)

Three container nodes, from library science (FRBR/LRM), because collapsing them is why competitors' dedupe and grounding are brittle:

- **Referent** — what the video is *about*. **Not one type — a discriminated union of four kinds** (governed by `_ONTOLOGY.md`), because "grounding" is not one operation: **NamedEntity** (the song/place/film → a KB instance ID; the flagship moat), **Concept** (the idea/subject/skill — ADHD, flow state, sourdough — → a subject vocabulary, hierarchically), **Claim** (the takeaway/thesis → a proposition scored by faithfulness, grounded to the video not the world), and **StructuredContent** (recipe/workout → schema.org slot-filling). Fifty saves of one restaurant collapse to one NamedEntity referent; a fitness video carries a Concept (progressive overload), a Claim (its thesis), and Facets at once.
- **Post** — the captured item: caption, creator, transcript, on-screen text, media renditions, poster. Carries orthogonal **Facets** (the 8-facet ontology: affect/genre/intent/…).
- **Save** — your relationship to it: which collection, when, from which surface (favorites vs likes are different intents — 71% of the real corpus is likes-only, a browse/retrieve population).

**Lenses over one deduped library, library-first landing:**

```
LIBRARY
├─ ALL        (the grid — dense, beautiful, fast; home)
├─ THIS WEEK  (the digest shelf: recent saves, understood; the return-visit hook)
├─ SEARCH     (cmdk palette; meaning + entities + words: caption, transcript, OCR, entity names)
├─ ENTITIES   (the referent lens: Places · Food & Recipes · Music · Film/TV · Products · Books)
├─ COLLECTIONS (your platform folders, preserved)
└─ IMPORTS    (capture history; audit; re-export; per-source counts)
```

**Screens (v1):** Library grid · Item detail (overlay: player-or-poster + analysis + provenance strip) · Entity page (one referent, all its posts, live external links) · Search results · Capture HUD (in-page: progress, counts, stall-nudge) · Imports/audit · Settings (engine lane, keys, sync, telemetry, export) · Onboarding (three beats: pick your lane → first capture → first grounded wow, powered by the 100 free hosted credits) · Two upgrade moments, exactly (the Deep Scan offer after first capture; sync when a second device appears) · designed empty/loading/error states everywhere — the states are the product too.

## 9. The signature pattern: the receipt

Every AI claim carries its receipts. On every resolved card and item detail, the **provenance strip**:

- the resolved entity with its durable ID, as a **live external link** (the place in Google Maps, the film's Wikidata/IMDb, the track's MBID);
- **calibrated confidence**, graded and visible — a tier the eval actually calibrates, not percent theater;
- the **evidence**: the frame, the transcript line, or the on-screen text the claim came from;
- **NIL, honestly designed:** `∅ no match — nearest: X, 0.41`. A confidently-wrong ID silently corrupts everything downstream; abstention is a feature and a headline metric;
- **"Not right? Fix it"** — one tap to correct, which becomes a golden-set label (the flywheel: users correcting receipts *are* the eval corpus growing).

One pattern, four payoffs: the trust that lets a user act without re-searching; the visible embodiment of honesty-over-fluency; the sales artifact for skeptical technical evaluators; and the product's screenshot-recognizable signature. Verified today: **nobody in the field shows provenance on AI claims.** The strip renders identically in the UI, exports, MCP payloads, and marketing shots — one component, spec'd once.

## 10. The open schema (the contract)

The durable core is the consensus object that Activity Streams 2.0, schema.org, Open Graph, oEmbed, and Media RSS converge on: `type · canonical id · creator · timestamp · text body · media renditions · refers-to · collection membership` — plus the grounding envelope on every record: `entities[] {surface, type, resolved_id?, kb_source, confidence, evidence_span, nil_reason?}`, `schema_version`, provenance, capture metadata. Platform weirdness (TikTok itemStruct, IG carousel children, X reference edges) lives in adapters and never leaks into the core; raw payloads are kept as versioned artifacts (they rot fastest — evidence, not foundation).

Versioning: additive-only within a major; migrations ship with the extension; the schema is **public and versioned from day one** — it is the standard-setting artifact, and what makes "leave anytime" true rather than sentimental.

## 11. The personal MCP (bring your own agent)

A local MCP server over the library: `search_library · get_entity · resolve_item · list_by_type`. **Free tier** — it serves already-local data; charging for access to your own archive would betray the ethos. MCP itself is table stakes (Quiki ships 8 tools; ReelRecall integrates Claude; Recall gives API+MCP away free at 100k installs) — so MCP is a distribution detail, never the headline. **The payload is the differentiation:** grounded, provenance-carrying, open-schema records. The demo query the foil structurally cannot answer: *"map every restaurant in my saves."*

## 12. The demo arc (the 90-second wow, scripted)

1. **0–12s. Kill the scraper objection, show the scale.** "This is my actual TikTok archive — 4,661 saves. It got here by reading the responses TikTok already sent me while I scrolled. No scraping, no credentials, nothing left my machine." The grid scrolls at 60fps, posters everywhere — obviously someone's real life.
2. **12–30s. The impossible query.** Type *brown butter pasta*. The half-remembered video surfaces — matched on transcript, not caption. Open it: the analysis, and the receipt showing the exact transcript line.
3. **30–50s. Grounded, with receipts — and honest refusal.** Entity lens → Places: a restaurant card resolved to a Place ID, one tap to Maps. Then the beat evaluators lean in for: `∅ no match` on an "original sound" — with the evidence anyway. *Every app tags your saves; none will tell you when they're wrong.*
4. **50–75s. Your agent can read it.** Claude Desktop: *"Map every restaurant in my saves."* Grounded answers, cited to specific items, from the local MCP. (Quiki's MCP returns text blobs; it cannot answer this.)
5. **75–90s. The receipts behind the receipts.** The public engine repo; the published accuracy page — grounding P/R, NIL accuracy, calibration, version-locked, reproducible. Close: **"and none of my data ever left this machine."**

---

# PART III — THE ENGINE

## 13. Two lanes, one iron rule

The model is a swappable commodity; the engine's value is everything around it. Two lanes, same schema, same grounding:

- **Local lane (free, open-source):** Qwen3-VL (Apache-2.0 at every size — the license is the reason) via Ollama; whisper.cpp for audio (every open VLM is deaf); ffmpeg scene keyframes + OCR. Multi-stage by necessity; this is the privacy tier and the OSS-credibility artifact. 8B default, 4B for slideshows/edge.
- **Managed lane (paid, zero-setup):** Gemini Flash-Lite. **Ingestion path is NOT yet decided** (the Block-0 pipeline probe was run against an unvalidated instrument — see §15 — so its "cascade" conclusion is RETRACTED). What holds from it is feasibility only: a keyframes+VTT path exists and is ~8× cheaper than native video, and native video has a reliability tail (one clip hung). The ingestion decision is made properly *after* the eval instrument is validated (ontology → schema → guidelines → gold set → validated metric → prompt-on-dev → then, and only then, the ingestion ablation). Batch API for Deep Scans (the margin). Never a multi-pass ensemble of the *same* path.

**The iron rule (both lanes): the model never emits external IDs.** Models hallucinate plausible MBIDs and Place IDs, and a fabricated durable ID silently corrupts the core promise. The model emits typed *mentions* — `{surface, type, evidence_span, disambiguation_context}` — and the deterministic grounding module resolves them. This decouples model choice from grounding correctness, which is what makes the two-lane thesis true.

## 14. Grounding (the real IP, already begun)

The built module (`src/lib/grounding.ts`; 61 tests green and the live demo re-run this day: berlioz → real MBID at 1.00, seven honest NILs): route by type → **KB search endpoints as the candidate generators** (no vector index to build or maintain) → one batched LLM "select" over candidates with clip context → confidence gate → NIL abstention → provenance. Runs **client-side on all tiers** (MusicBrainz is 1 rps/IP; the user's IP is the rate-limit domain).

Authorities (ToS-verified 2026): **Music → MusicBrainz MBID** (built). **Film/TV → Wikidata QID** (CC0; carries TMDB/IMDb/Letterboxd IDs as link-out properties — TMDB's API is non-commercial-only and is never called). **Places → Google Places** under written SKU discipline (IDs-only search → Essentials details on top-k → cache; naive Pro calls cost ~10×). **Everything else → Wikidata.** No Spotify API (Feb-2026 lockdown; keyless deep-links instead).

## 15. Measurement (the moat made legible)

**Method is governed by `_EVAL-METHOD.md` (Block 0.5) — read that; this is the summary.** Six axes on a version-locked golden set; the flagship, published: **grounding-to-external-ID precision/recall, NIL-F1, and confidence calibration (smECE, not plain ECE), per type**, with an asymmetric headline (Effective Reliability Φ_c: a confidently-wrong ID costs far more than an honest NIL) and cluster-bootstrap confidence intervals. The v1 slice is deterministic and cheap: **promptfoo in CI** (grounding-ID exact match, NIL accuracy, schema validity, Recall@k) + a **zero-cost replay harness** (frozen model outputs + frozen KB candidate sets → grounding changes A/B for $0). Any LLM judge waits until an axis needs it, then is kappa-validated (raw agreement inflates 33–41pp).

**Golden-set discipline:** re-stratify on the real corpus (4,661 items; 71% likes-only; 53% VTT; 17% slideshows; median 29s) *before* labeling. Stated honestly on the published page: the corpus is single-platform TikTok until IG/X capture lands — the claim's generality grows with the corpus, and the page says so.

**The deciding experiment — RETRACTED as a decision; feasibility signal only.** A native-video vs [VTT+keyframes] probe ran on 54 clips (`spikes/pipeline/RESULT.md`), but it was **methodologically invalid as a decision instrument**: it used an ad-hoc entity ontology matching neither the engine's `EntityType` nor the production prompt, exact-string+exact-type matching (so `place`≠`restaurant`, `song`≠`media` scored as disagreement), and **no ground truth** — the "38% agreement" mostly measures the incoherent matcher, not the models. **What survives:** feasibility only — a cheap keyframes path exists (~8× cheaper), native video has a reliability tail. **What is retracted:** any "cascade / complementary / union" *design decision*. The ingestion comparison is a legitimate ABLATION, but it is only run *after* the instrument is built and validated — that is the actual method (`_EVAL-METHOD.md`).

**Cost basis (managed lane):** ~$0.005/clip standard, ~$0.002–0.003 batched (Gemini 3.1 Flash-Lite; 2.5 Flash-Lite dies 2026-10-16 — model versions pinned in golden-set metadata; eval re-runs on every SKU turn). **Reality check 2026-07-07 (verified against the live API on the rotated key):** `gemini-3.1-flash-lite` is **not GA yet** (only `gemini-3.1-pro-preview` + `gemini-2.5-flash-lite` are live) — so the Block-0 pipeline experiment and early build run on **`gemini-2.5-flash-lite` (pinned)**, migrating to 3.1 Flash-Lite the day it ships (zero code change; the schema/grounding are model-agnostic by design). A 5,000-item Deep Scan costs ~$10–25 of inference against $39 — the margin is the Batch API.

---

# PART IV — THE BUSINESS

## 16. Open-core split

**Open source (Apache-2.0), fresh public repo, private app consumes it as a package:** the engine (both lanes), the grounding module + resolvers, the open schema (spec + validators + synthetic examples), the eval harness + golden-set labels/rules (labels + IDs + rules — never media bytes). **Closed (the product):** the extension app (capture UX, library, design system), sync service, managed inference, billing.

License call — **Apache-2.0, not AGPL:** the moat is the published metric + compounding golden set + trust brand, not code secrecy; Apache matches the Qwen posture and maximizes exactly the adoption (agents, tinkerers, evaluators) the standard-setting story needs. A fast-follower shipping our engine still can't ship our measured accuracy, our labeled corpus, or our brand. Why open-core is load-bearing: **free apps structurally can't publish accuracy (it exposes them); funded apps structurally can't open the schema (it cannibalizes lock-in — Cosmos at $21M is the proof).** A solo open-core builder can do both. That asymmetry *is* the positioning.

## 17. Tiers and prices (locked — gate G3 ratifies)

| SKU | Price | What it is |
|---|---|---|
| **Free** | $0 forever | Capture (all platforms), full library + search, unlimited local-lane analysis, BYO-key at zero markup, full export + open schema + MCP, no item caps ever, **100 hosted credits at signup** (powers the onboarding wow for GPU-less users) |
| **Deep Scan** | **$39 one-time** | "Understand everything I've ever saved" — 5,000 never-expiring credits (1 credit = 1 item fully understood: entities, confidence, provenance, NIL), run via Batch API. Top-ups $10 per 2,000 |
| **Managed** | **$7/mo or $60/yr** | Continuous hosted analysis of new saves (fair-use 1,000 items/mo) + zero-knowledge sync + priority queue; **annual includes one Deep Scan** |

- The paywall line, published verbatim: **"You pay for our compute and our servers — never for your data."**
- Anchors (verified today): the field clusters $7–13/mo (mymind $7.99–12.99, Dewey $7.50–10, Raycast $8, ReelRecall $9, Recall $10, Readwise $9.99) — $7 sits at the trust edge of the cluster. The $39 one-time is the differentiated SKU: TypingMind proves one-time converts for BYO-key audiences, and the identical 5k-library job on Quiki's credit menu runs ~$250. Deep Scan gross margin ≈ 65% (Batch API); blended year-one on annual ≈ 45%.
- Free-gravity honesty: the strongest competitors are free (Sorti, Stasht) — conversion stress-tests at **1–2%**, not Dewey's single 3.75% datapoint.
- **No agency SKU at launch** (that market repriced to $29/mo BYOK-unlimited commodity); the backend ships API-ready (auth/metering stubbed) so it's a config later, not a rebuild.
- Revenue framing: the milestone is **strangers pay** (5–20 of them, pricing decision written up) — validation and story, not livelihood.

## 18. Distribution (corrected: a store-search problem, not a launch problem)

Verified today: 40–70% of a typical extension's installs come from **Chrome Web Store internal search**, and this exact intent is proven at scale there — myfaveTT ("export your TikTok favorites," crude) has **100,000 users at 4.7★** while Dewey, with TechCrunch coverage, holds ~10k. The plan, ranked:

1. **PRIMARY — win CWS search** on the favorites/saved/export cluster: relevance-loaded title + summary, annotated screenshots, explicit free-forever export, narrow host permissions (which also converts). Submit an early minimal listing to absorb the multi-week 2026 review queue and start the rating clock. Multi-store via WXT (Chrome/Edge/Firefox). Expected order-of-magnitude: 10³ installs from ranking; 10⁴/yr at Dewey parity; 10⁵ is the category ceiling.
2. **SECONDARY — Reddit ignition:** after genuine account participation, one Karakeep-shaped launch post in r/DataHoarder (free, open-source, local-first, open schema, honest limits), then r/PKMS and r/selfhosted. 10²–10³ installs per well-received thread, plus the reviews that feed store rank.
3. **TERTIARY — the linkable eval:** the published accuracy report is the headline of a single Show HN, syndicated to r/LocalLLaMA. 10¹–10² installs (10²–10³ on a front-page tail) — kept regardless as the recruiter artifact and backlink engine.

**Explicitly not:** Product Hunt (2026 audience is founders/marketers; median launch 50–300 visitors; myfaveTT's own PH launch was a non-event next to its 100k store installs) — not one hour. No scaled doorway matrix ({platform}×{intent} templates are precisely what SpamBrain + the March-2026 core update demote); build **2–4 genuinely functional utility pages** (a real stateless exporter, one deep guide per platform, anchored by eval data). No paid acquisition, no social-content cadence, no outbound.

## 19. Competitive posture

The field (all claims re-verified 2026-07-06 on public surfaces — marketing, docs, MCP payloads, store listings): **Quiki is the named foil** — the only same-shape competitor (TikTok saves + transcripts + pay-per-scan + REST/MCP) — and its MCP returns an unstructured `formattedAnalysis` text blob with a self-assessed quality score, no export, weak traction. Around it: Dewey (metadata tags, paid export), mymind (taste + trust, no API), Cosmos ($21M, image-first, feed-drifting), Albo (free MCP, closed, Apple-only), Stasht/Sorti (free, consumer-legible extraction), ReelRecall (transcript search, unaudited "98%"), Recall (free API/MCP at 100k installs). **Nobody grounds to durable external IDs; nobody publishes measured accuracy; nobody opens their schema; nobody shows provenance.** The deep-but-closed lane and the open-but-shallow lane never overlap — the deep-AND-open-AND-measured quadrant is empty.

**The pitch line:** *Every app tags your saves; none will tell you when they're wrong. Commonplace resolves your saves to the real world — with a published error rate and a schema you can walk away with.*

**The 12-month answer:** in a year, five apps will say "AI understands your saves" and several will say "MCP." None will be able to say *"here is our measured entity-resolution accuracy, per surface, on a version-locked public benchmark, in a schema you can take anywhere"* without rebuilding their business model. Consequence: **the published-metric artifact ships before launch (Block 6), not after** — Quiki is one blog post from contesting the claim rhetorically.

**Standing risks, owned:** TikTok shipping native saves-search would vaporize the casual retrieval tier (Favorites still has no search bar as of 2026-07; grounding/export/trust are the halves platforms won't build). Memories.ai×Qualcomm puts video-to-memory at the device layer starting 2026 — the engine alone won't stay differentiating; the durable residue is own-saves capture + canonical IDs + published accuracy + open schema. Absence claims above were verified on public surfaces, not inside logged-in apps — undocumented depth is possible, and earns competitors no positioning credit.

---

# PART V — DESIGN

## 20. The design language: **Paper & Proof** (default direction; gate G2 ratifies)

The product should feel like **a well-lit reading room in your own house** — an archive *with apparatus*: paper, two inks, receipts, catalog-card geometry. The user's media supplies all the color; the interface is paper and ink around it. This deliberately dodges both 2026 uniforms: neon-gradient AI-slop *and* the now-commoditized "AI-tasteful" default (warm cream + Inter + one italic display serif + terracotta) that design tools emit on autopilot.

**The principles (each a gate, not a vibe):**
1. **A place, not a feed.** Nothing moves unless you moved it. Never: algorithmic reordering, engagement nudges, red badges.
2. **Your stuff is the interface.** Media leads; chrome recedes; UI lives in the margins. Never: cards drowning in metadata chips.
3. **Receipts over vibes.** Every claim wears its evidence, confidence, and live ID — or an honest `∅`. Uncertainty is a designed state. Never: a confident tag with no provenance.
4. **Calm density.** Apple-Photos density, mymind restraint, Raycast speed. Never: dashboard stat tiles, gamification.
5. **Warm, not cute.** Warmth through type, spacing, and material honesty. Never: mascots, emoji confetti, sparkle icons.
6. **Every state designed.** Empty, loading, error, offline, NIL, capture-interrupted — the empty library is the first screen every user sees; it's a hero surface.

**The direction, concretely:**
- **Type, two voices, no grotesque sans anywhere:** **Literata** (variable, OFL; display via optical size, upright italic for brand moments, tracked small-caps labels, text and chrome) + **IBM Plex Mono** (receipts, IDs, tables, tabular figures). Self-hosted in the repo.
- **Color (oklch tokens):** paper `oklch(0.965 0.01 90)` · warm ink `oklch(0.23 0.015 60)` · warm-dark "den" mode `oklch(0.21 0.01 60)` · **rubrication accent** `oklch(0.50 0.13 30)` (madder red — the manuscript tradition of red ink for emphasis; the same lineage as the name) · amber-uncertain + hollow-gray NIL semantics.
- **Material:** flat honest surfaces, hairline rules, real shadow only at real elevation (the item overlay). No glass, no gradient heroes, no AI-purple — and no terracotta.
- **Motion constitution:** ONE hero motion — the View Transitions grid→detail morph (source keyframe as the shared element into the receipt). Everything else ≤300ms ease-out, interruptible, `prefers-reduced-motion` parity.
- **Stack (settled):** oklch tokens + shared React kit in-repo (code is the source of truth; Figma is a review surface); custom row-based justified virtualizer on TanStack Virtual; ThumbHash placeholders; Base UI, cmdk, Sonner; Motion for micro-interactions only.
- **The signature component:** the provenance strip (§9), spec'd once, rendered identically in UI, exports, MCP payloads, and marketing screenshots.
- **Operational bind:** a one-page **design constitution** (principles + anti-patterns + tokens) checked into the repo — every agentic build session is bound by it; violations are review-rejects.

**Method:** the design sprint renders Paper & Proof plus two challenger directions as real screens → founder picks at **G2** → converge → system. Never one-shot.

## 21. Brand voice

Plain, warm, precise. Privacy stated as fact, not marketing: *"We can't read your library. That's the architecture, not a promise."* Limits reframed as care. The words "downloader" and "AI-powered" never appear; explanations may say "AI" plainly. All copy humanized — no LLM boilerplate cadence.

## 22. The name (gate G1)

**Commonplace** — defended: it names the promise (understanding, usable knowledge) where "Attic" names the problem (storage you never revisit — and, for the HN audience, a dead backup tool that became Borg); it carries the 500-year humanist lineage the whole product enacts; the position is verifiably unclaimed at brand scale in this field (checked today); USPTO quick-scan is clean for software classes (hospitality-class marks only; one UK entity warrants a professional clearance before launch assets); `commonplacehq.com` and `usecommonplace.app` showed available at standard price today (point-in-time — register at G1), with parked `commonplace.app` acquirable as an upgrade. Tagline: **"A commonplace book for the video age."** Runner-up shortlist + collision scans: `_RESEARCH-2026-07-06.md`. Fallback if clearance fails: keep Attic, register attic.app. G1 actions, same sitting: ratify → register both domains → claim GitHub org + CWS listing name + handles.

---

# PART VI — THE BUILD

## 23. What exists today (honest salvage map — verified this session)

- **Real and tested:** `src/lib` engine core + grounding module — 61/61 tests green (run today); MusicBrainz resolver live-proven today (real corpus song → real MBID at conf 1.00; 7 honest NILs including every "original sound"). TikTok capture with source-tagging + content-visibility pruning — 8/8 spike tests green (run today). The 4,661-item source-tagged corpus (counts reconciled today).
- **Real but spike-grade:** the MV3 shell still wires the old `src/gemini.js` path (enrichment disabled since the key-exposure fix); `src/lib` is **not yet wired into the running extension** — nothing in the shipping path produces `Mention` objects yet. First integration job, not a footnote.
- **Designed, not built:** resumable queue, storage/poster pipeline, library UI, design system, sync, MCP server, IG/X adapters, eval CI, open-core carve, all visual identity.
- **Debt carried, named:** the exposed Gemini key **must be rotated** (founder); `fixtures/sample-items.json` contains real TikTok usernames → replaced with synthetic before any public carve; corpus media was never persisted (expired signed URLs) → golden-set labeling needs a founder-in-loop re-capture for media-dependent axes; accuracy claims are TikTok-skewed until IG/X capture lands.

## 24. Build sequence (dependency-ordered; gates, never calendars)

**Block 0 — The spikes.** Capture/backend feasibility ✅ (IG-live + sync, below). **The engine/eval spike was mis-run** — a pipeline ablation was executed before the eval instrument existed; that decision is retracted (spike #3). A new **Block 0.5 — Eval foundation** (`_EVAL-METHOD.md`) precedes any engine/ingestion/prompt decision.
1. *IG-live probe:* **PASS 2026-07-07** (`spikes/ig-live/RESULT.md`, run read-only in the founder's live session). The saved view fires `GET /api/v1/feed/saved/posts/?max_id=… → 200` — a single JSON blob (not streamed), clean `more_available`+`next_max_id` cursor pagination, rich enrichable item shape (`{media:{pk,code,media_type,product_type,video_versions,image_versions2,caption,user,clips_metadata,taken_at…}}`). Constructing the request 400s without the page's signed headers — passive-observe is the only path, same as TikTok. **De-risk:** it's a REST `max_id` endpoint, **not** a GraphQL doc_id one, so the doc_id-rotation churn the brief feared does not apply. **G4 → PROMOTED: live-IG is a v1 headline capture lane; ZIP stays the guaranteed fallback.**
2. *Zero-knowledge sync probe:* **PASS — both legs (2026-07-07).** Protocol leg (`spikes/sync-zk/spike.mjs`, 200 items) + **remote leg on live Supabase Postgres** (`spikes/sync-zk/remote.mjs`, 50 items, authenticated user + RLS): cold-start + post-conflict convergence, LWW, tombstones, **server-blindness all PASS**; storage-layer audit confirms opaque HMAC keys + ciphertext-only + zero plaintext leak. The remote leg **caught a real bug** (upsert doesn't bump the `seq` cursor → incremental pull misses updates); fixed with a bump-seq trigger, now in the schema. **The backend is live in `attic-dev`** (`spikes/sync-zk/schema.sql` — `sync_items` + 3 RLS policies + trigger); this is the one project serving sync + managed inference + MCP. Prod note: PBKDF2 → Argon2id before launch.
3. *The pipeline experiment:* **RETRACTED as a decision (2026-07-07).** Ran (`spikes/pipeline/RESULT.md`) but the instrument was invalid — ad-hoc ontology (matching neither `src/lib/types.ts` nor `prompts/observe_video.md`), exact-string matching, no ground truth. It answered the wrong question in the wrong order. **Feasibility salvage only:** cheap keyframes path exists (~8× cheaper); native has a reliability tail; 60 real clips harvested for the real eval. The ingestion comparison returns as a validated **ablation** inside Block 0.5, not as a standalone spike.
- Done when: each spike has a written result with evidence; G4 applied; pipeline pick recorded as an ADR.

**Block 0.5 — Eval Foundation (GOVERNS the engine; `_EVAL-METHOD.md` + `_ONTOLOGY.md`).** The moat is published accuracy, so the measurement instrument is the core asset and is built *before* any engine/prompt/ingestion decision. Sequence: construct → **the one ontology** (`_ONTOLOGY.md`: four Referent kinds — NamedEntity/Concept/Claim/StructuredContent — + Facets on the WEMI spine; collapses the 3 conflicting type sets; grows the wired grounding from 1 type toward the v1 cut) + frozen JSON schema → annotation guidelines → stratified gold set (pilot ~150 → sealed test ~350; dev/test eyes-off; IDs API-verified; KB snapshots) → **validated matcher + the per-layer MATRIX scorecard** (entity-linking F1+NIL flagship via nervaluate/GERBIL/ELEVANT; concept hierarchical-F1@k; claim faithfulness+coverage; structured field/doc accuracy; facet macro-F1+κ; Φ_c asymmetric; smECE calibration; cluster-bootstrap CIs — never one blended number) → prompt on dev (promptfoo CI) → freeze → ablations (native-vs-VTT lives HERE) → report on test once. Open-source the harness. **Founder decision:** confirm the v1 layer cut (rec: NamedEntity music/place/screen_work/book + Concept subjects+skills + 8 Facets + 1 Takeaway + Recipe-only); annotation = auto-label + founder spot-check (chosen), 2nd-labeler seed deferred to publish-time.

**Block 1 — The artifact core (the spine).**
Wire `src/lib` into the MV3 shell end-to-end · resumable memory-bounded offscreen queue · storage + eager-poster pipeline · both lane adapters (per Block-0 pick) · Wikidata + Places resolvers join MusicBrainz · open schema v1 + one-click export · promptfoo eval slice in CI · early minimal CWS dry-run listing submitted (starts the review + rating clock).
Done when: a fresh TikTok capture flows capture→analyze→ground→library-data→export untouched by hand; eval runs in CI on every commit; a 500-item batch survives a service-worker kill mid-run.

**Block 2 — The library + design system (G2 first: founder picks from rendered directions).**
Design constitution + tokens + kit · grid virtualizer (60fps on 5k) · item detail + provenance strip · cmdk search · entity lenses + entity pages · This-Week shelf · onboarding (lane pick → first capture → first grounded wow on the 100 free credits) · every state designed.
Done when: demo-arc beats 1–3 are performable on the real corpus; find-anything <10s measured.

**Block 3 — Platforms.** IG ZIP lane · IG live (per G4) · X bookmarks · fresh founder captures (also un-skews the golden set).
Done when: an IG ZIP yields a browsable, analyzable library slice; source-tagging + union dedupe hold cross-platform.

**Block 4 — Sync + money (G3: founder signs the price card).**
Zero-knowledge sync productionized · managed lane + credits rail (Batch API) · the two upgrade moments · billing.
Done when: two browsers converge a library through the encrypted store with a written threat model showing the server cannot read it; a stranger can pay $39 and get a Deep Scan.

**Block 5 — The personal MCP.** The four tools over the local library, grounded payloads with provenance.
Done when: the "map every restaurant in my saves" demo beat works cold in Claude Desktop.

**Block 6 — The public artifacts (before launch, not after).**
Synthetic fixtures replace real-username fixtures · secret-scan · fresh public engine repo (app consumes it as a package) · eval harness published · **the accuracy page** (per-surface P/R, NIL accuracy, ECE, version-locked) · schema docs.
Done when: a stranger can clone the public repo, run the eval, and reproduce the published numbers.

**Block 7 — Launch (G5).** Full CWS listing engineered for the favorites/saved/export query cluster · Edge/Firefox · demo video (the 90s arc) · Reddit ignition post (r/DataHoarder, Karakeep-shaped) · Show HN with the eval as headline · 2–4 utility pages · story log current → founder pushes the button.

**The gates (the only calendar that exists):**
- **G1 — Name. ✅ RATIFIED 2026-07-06: Commonplace.** Founder still to do, same sitting: register `commonplacehq.com` + `usecommonplace.app` (available at check time) · claim GitHub org + CWS listing name + handles. Design sprint brief lives at `docs/design/CLAUDE-DESIGN-BRIEF.md`.
- **G2 — Design direction.** Pick from rendered directions (Paper & Proof + two challengers). Blocks: Block 2.
- **G3 — Prices.** Sign the §17 card. Blocks: Block 4's paywall.
- **G4 — IG-live posture.** Pre-agreed rule; auto-applies on the spike result.
- **G5 — Launch.**
- **Provisioning (parallel, founder-only):** 🔴 rotate the Gemini key · IG session + DYD ZIP · backend sandbox. 🟡 Google Places key (SKU-disciplined) · CWS dev account · domains at G1 · Twelve Labs free account (benchmark ref) · OSS-inference account when the local lane pins hosting. 🟢 taste gut-checks at G2; the G1/G3 signatures.

## 25. Security & platform posture (standing constraints)

Zero remote code; minimal host permissions (IG/X as `optional_host_permissions` granted at onboarding); `declarativeNetRequestWithHostAccess`; secrets never in `web_accessible_resources` (the closed key-exposure bug class gets a named regression test); CWS review treated as a design constraint (multi-week, one appeal — planned into every release train); telemetry = three planes that never touch extension content (cookieless doorway analytics + CWS stats + managed-tier server events) + an opt-in default-OFF content-free adapter-health ping + a visible "report broken capture" flow, posture published, unmeasured free-tier engagement accepted; compliance by design — personal use, own data, client-side.

---

# PART VII — THE META-ARTIFACT (the career layer, built deliberately)

The product is the proof; the proof needs a stage. Ranked by verified hiring-evaluation weight (the chain of *checkable* proof — the rarest 2026 signal being exactly what AI assistance cannot fake):

1. **The live demo on real personal data** — the 90-second arc (§12), recorded and performable live on the 4,661-item corpus.
2. **The published, reproducible accuracy page** — the single highest-leverage artifact: simultaneously the product's moat, the field's only falsifiable claim, and the strongest hiring signal. Regenerated in CI.
3. **The visible decision trail** — one deep case study (the design POV, the divergent directions, the provenance-strip evolution) + ADRs for the ten calls that matter (passive interception; no-LLM-emitted-IDs; deleting the server tier; killing the agent loop; the key-exposure catch; Apache over AGPL; store-first distribution; NIL-as-feature; two-lane engine; schema-as-bridge).
4. **Un-generatable interface craft** — Paper & Proof executed to the constitution, surviving the slop-tell checklist.
5. **Strangers pay for it** — presented as the binary + the pricing writeup, never an MRR figure.

Plus: README-as-product-page on the public repo · the "how it's built" essay · the story log (kept current; hard calls recorded when they happen — they cannot be reconstructed later).

The one-page recruiter narrative writes itself from these: *built an open standard for personal media understanding; published its accuracy; designed it like a place; strangers pay for it; every decision has receipts.*

---

# APPENDIX

- **Corpus (verified 2026-07-06):** 4,661 items, 100% TikTok-shaped; tags — favorites 1,367 · likes 4,132 · posts 2 (favorites∩likes = 840; likes-only 3,292; favorites-only 527); 53% carry VTT; 17% slideshows; median 29s. Media bytes not persisted (expired signed URLs) — metadata incl. `music{name,author}` intact.
- **Evidence index:** `_RESEARCH-2026-07-06.md` (this re-founding: 7 tracks, 7/7 completed, sources cited) · `_FABLE-PHASE1-findings.md` (the six-agent pressure-test: 18 holds / 11 shaky / 8 contradicted, D1–D15) · `_ENGINE-groundup-2026-07-02.md` (engine method; its corpus stats are stale — this spec's numbers govern) · dossier `00–08` (strategic depth, reference only).
- **Decision traceability:** §7↔D4 · §11/§17↔D5/D6 · §14↔D2/D3 · §24-sync↔D7 · §25-telemetry↔D8 · timelines-banned↔D9-overruled · §8/§20-stack↔D10/D11 · §18/§25-CWS↔D12 · §16↔D13 · §19↔D14 · §15↔D15.
- **Superseded:** `_FABLE-BRIEF.md` v4 and all prior briefs; doc 09; the Gate-0 pre-registration/kit (validation track dropped 2026-07-06).
