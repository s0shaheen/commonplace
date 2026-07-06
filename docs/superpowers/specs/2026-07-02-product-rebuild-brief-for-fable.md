# Product Rebuild — Briefing Package for the Fable Session (v2)

> **SUPERSEDED 2026-07-02 → `docs/product/`.** Folded into the grounded product-strategy dossier (docs 01–08 supersede this brief; doc 09 supersedes the orchestration plan). Kept for history. Start at `docs/product/README.md`.

```
Date:     2026-07-02
Author:   Salman Shaheen (with Claude Opus)
Version:  v2 — integrates the adversarial red-team of v1 + two deep-research rounds
          (competitive/legal/multimodal-cost/design/GTM; then Twelve Labs methods,
          ground-up analysis-system design, OSS models, entity-grounding SOTA,
          external tooling/MCP scout, 3-segment audience, iterative design method).
Status:   Founder decisions locked where noted; §0.5 lists ASSUMED calls to confirm.
Purpose:  The complete, self-contained brief for a Fable 5 design + architecture session.
          Reading this + the orchestration plan should let Fable solve/narrow every hard
          problem WITHOUT re-litigating settled calls and WITHOUT lacking context/access.
Companion: docs/superpowers/plans/2026-07-02-fable-orchestration-plan.md (how to RUN the session)
Stance:   GROUND-UP rebuild. Prior iterations (Modal sandbox → hosted SaaS → MV3 spike) are
          REFERENCE/story, never rails. Legal compliance is treated as SETTLED, not a ceiling.
          Reason from first principles + user value.
```

## 0. How to read this

A handoff, not an implementation plan. It states **what the product is**, **what's decided**, **what Fable must solve**, **the constraints**, and **what "done" looks like**. Where this brief and older repo docs conflict, **this brief wins**; the `2026-05-*` docs describe a narrower TikTok-only extension and are superseded. Numbers/tools cited are 2026-current and sourced in the research scratchpad; Fable should re-verify pricing/model versions before hardcoding.

## 0.5 Objectives & constraints (ASSUMED pending confirmation — override any at review)

The red-team correctly flagged that the brief must state the founder's objective + envelope, or Fable optimizes for the wrong target. These are my best-judgment defaults from the founder's stated intent; **confirm or correct**:

- **Primary goal (assumed):** *balanced, career-leaning* — a genuinely exceptional, resume/portfolio-grade product that also earns real revenue, but craft + the hard-problem story come first; revenue not at the expense of quality/trust/adoption.
- **Time budget (assumed):** *substantial but part-time (~10–20 hrs/wk)* → phase aggressively; treat solo-parallelism as a myth (realistic max ≈ 1 build + 1 spec track).
- **Deadline (assumed):** *no hard external deadline* — founder sets pace. (The prior June-2026 $10k cash deadline is past and treated as void.)
- **Money budget (assumed):** infra < ~$50/mo until a managed tier monetizes; a small one-time inference budget on the founder's existing Gemini key (`src/secrets.js`) for benchmarking.
- **Success metric (assumed):** ship a phased v1 + prove 5–10 real users *retrieve* value ("find the X I saved") + a standout open-source/technical artifact. Revenue is a fast-follow signal, not the v1 gate.

**Assumed answers to the open decisions** (each expanded in-section; all overridable):
1. **Scope shape:** phased v1 (proven TikTok core + retrieval test → IG/X/API/OSS as committed fast-follows). §5
2. **Instagram lane:** ZIP-import PRIMARY + live-capture experimental/opt-in (not v1-maintained). §5/§7.B
3. **Analysis system:** ground-up **multi-stage grounded pipeline + lightweight verification** for v1, agentic claim-level verification as fast-follow (not the single-shot Gemini call). §7.A
4. **Compute delivery:** **hybrid** — local-first OSS default (free tier) + optional hosted managed tier; every pipeline node model-agnostic. §7.A/§7.C
5. **Business model:** hybrid direction; exact model/pricing **deferred to Fable** to model. §7.C
6. **B2B "Twelve-Labs-lite" segment:** **deferred** as a self-serve API/MCP surface on the same engine — not a separate v1 GTM. §2/§7.C
7. **Open source:** open-core — engine + ontology + **open schema + eval harness + grounding-correctness rules**. §4/§7.H
8. **Eval system:** ship the cheap deterministic slice in v1; open-source the harness; grow over time. §7.H

---

## 1. The product in one breath

A tool that turns the media you've **saved / liked / favorited / reposted / posted** across platforms into a **private, beautifully browsable library where every item is deeply understood** — the media itself *plus* a structured, objective, research-grade breakdown of what's *in* it — that you can **search, act on, and take anywhere** (your notes, your own LLM, Google Maps, Letterboxd, or an API/MCP). Not an AI brand (AI is invisible plumbing), not a "downloader," not just another cross-platform bookmark exporter. **The enriched, grounded, browsable library is the product.**

## 2. Who it's for (3 validated segments — do NOT fork the product per persona)

1. **Ad-hoc exporters** (export one collection / a profile's posts / a URL list). The **free SEO doorway** + a one-time upsell — *not a business* (commoditized, churny). Dewey monetizes this with a $50 "Export Pass"; mirror that mechanic, don't build around it.
2. **"Consumption-conscious" users** who want to export **and understand + use** all their saves (grounded entities, themes, memes/trends). **The paying core of v1.** CAUTION: no longer white space — a 2025-26 wave (Stasht, Quiki, Sprink, The Saved, ARCHV, ReelRecall) + Dewey/Albo/mymind already do save + auto-tag + search + *light* grounding (Stasht already does places→map; Quiki has re-consumption "Swipe Mode"). "Auto-tag + search," and even basic grounding, are commoditized.
3. **Agencies / SMBs / social strategists / GTM** needing Twelve-Labs-level video intelligence with less setup/cost. **Real but crowded and funded** (dig.ai, VwD, Mixpeek, VidContext, VectorMethods; plus metrics-only creator analytics). **Defer as a self-serve API/MCP surface on the same open-core engine** — near-zero incremental product cost — NOT a separate enterprise GTM a solo founder can't staff (sales/SOC2/real-time coverage).

One unified product; hyper-specific SEO doorways make it *feel* purpose-built per intent while the core stays coherent.

## 3. Positioning & the wedge (READ — drives everything)

"Cross-platform save + search + light AI" is **occupied** (Dewey: multi-platform + bulk AI tagging + export; Albo: Places-grounded entities + maps, mobile; + the Segment-2 copycats). The defensible wedge is the part none of them do well:

> **Research-grade, MEASURABLY-accurate, GROUNDED, traceable analysis of the media itself** — scene-level understanding + transcript + on-screen text + entities that **resolve to the correct external ID** (Google Place / TMDB / Letterboxd / Spotify / Book) — in a **durable, open, portable schema**, with **best-in-class no-slop design** and a **trust-first local posture**, exposed via an **API/MCP**.

**Sharpening (post-research):** light grounding is now table stakes, so the wedge is *depth + measured accuracy + traceability + open schema*, not "we ground." Make **grounding-to-external-IDs the flagship, published metric** ("we resolve to the correct external ID X% of the time") — a claim competitors structurally can't make (Twelve Labs doesn't ground to consumer external surfaces; the copycats do it shallowly and don't measure it). Borrow dig.ai's proven **"defensible, source-linked, traceable"** framing.

**Moat honesty (a red-team catch):** you cannot call the analysis *engine* your moat and also open-source it. The engine/prompt/ontology is weeks-cloneable (VidContext already sells structured video extraction at ~$0.20/video). The OSS engine is your **credibility + SEO + portfolio artifact**; the **real moat** is (a) the **compounding proprietary resolved-entity index / data**, (b) the **library experience + brand + trust**, (c) **export-OUT + API/MCP** that Albo structurally refuses, (d) **distribution/SEO**. Fable must deliver a **"why we still win in 12 months after Albo/Dewey copy the obvious"** answer, separating what's sprint-cloneable (prompt/ontology) from what compounds and resists copying.

**Guardrail:** do NOT position on "cheaper than Twelve Labs" (weak/taken; TL isn't expensive at small scale). Compete on grounding-to-real-surfaces + open schema + own-your-data + measured quality.

## 4. DECIDED (founder-locked — do not re-open)

1. **North-star / story:** the content-understanding standard (§3). Capture/architecture are *supporting* stories.
2. **v1 scope:** TikTok + Instagram at launch (both deep), X-bookmarks doorway — sequenced (§5).
3. **Monetization direction:** hybrid (free local/BYO + paid managed); exact model **deferred to Fable** (§7.C). Architecture must not foreclose a managed backend; free tier local-first.
4. **Open source:** open-core — engine + ontology + **open schema + eval harness + per-surface grounding-correctness rules** (§7.H). App/hosted product proprietary.
5. **Not an AI brand.** AI is invisible plumbing.
6. **Rebrand from scratch.** Name is NOT "Attic"; no prior brand carries forward. Naming + identity is a dedicated from-scratch sprint (§7.E).
7. **Growth = SEO/AEO-led** ("one product, many doorways") + a defined cold-start motion (§7.G); founder-UGC optional.
8. **Trust-first, local-first, zero remote code** posture (§8).

### Carried-forward technical facts (spike-PROVEN; reuse unless Fable finds cause)
- **Capture = passive interception**, never signature-forging: MAIN-world script skims the platform's *own already-signed* API responses while human-paced scrolling. Proven for TikTok Favorites (`GET /api/user/collect/item_list/`, items under `itemList`, `id` is a string).
- **Client-side video fetch** by mirroring the page's own request (credentialed CORS + `Range` + DNR-injected `Referer`, no ACAO injection). Enables AI-independent `.mp4` export; no server for capture. *(Note: this is an EXTENSION-only capability — see §7.B/§7.D surface constraint.)*
- **Deterministic entity normalization + dedupe + cross-item index** (the retrieval primitive). Conservative aliasing.
- ~~Tiered "text-default, visual opt-in" analysis~~ — **SUPERSEDED.** That was cost-driven; multimodal cost has collapsed (~$0.001–0.002/clip). The analysis is now a ground-up multi-stage pipeline (§7.A); whether visual runs per-item vs on-demand vs by-content-type is a §7.A decision, not a carried-forward default.
- **Capture OSS to study/clean-room** (§7.B): gallery-dl (user's own TikTok saved/liked + IG saved via cookies), twitter-web-exporter (X bookmarks past the 800 cap), cobalt (UX), yt-dlp (media backend).

## 5. v1 scope (phased — assumed)

**Trajectory (all of it ships; sequenced to force an early, testable release):**
- **v1.0 — the proven core:** TikTok capture (favorites/likes/posts/collections) + the deep grounded analysis pipeline (§7.A) + the Apple-Photos-grade library (browse/search/filter/collections) + structured export + the open schema. **Gate:** put it in front of 5–10 real target users and watch them *retrieve* ("find the restaurant/recipe I saved"). **Kill/pivot tripwire:** if they can't retrieve value, stop and change before the heavy build — do not proceed on faith.
- **v1.1 — cross-platform doorways:** Instagram (ZIP-import PRIMARY; live-capture experimental) + X-bookmarks (browser capture, twitter-web-exporter pattern). Honest "cross-platform" claim + two more SEO doorways.
- **v1.2 — power surface:** API/MCP (read + analysis) for power users; seeds the deferred Segment-3.
- **v1.3 — open-core:** publish the engine + ontology + open schema + eval harness.
- **Brand/identity sprint** runs early, in parallel (§7.E), since it blocks repos/domains/store/copy.

**Instagram lane (assumed, red-team-driven):** IG ships via the **official "Download Your Data" ZIP-import** (reliable, maintainable, legitimate; uniquely includes the user's named saved *collections* → "your collections are already here"). Live IG capture is **experimental/opt-in, NOT under v1 maintenance commitment** (Meta killed Basic Display, no saved-posts API, rotating GraphQL `doc_id`s break every 2–4 weeks — an unmaintainable fire for a solo founder). Fable still runs a quick live IG feasibility probe (now runnable via Playwright/chrome-devtools MCPs) to *quantify what live would add*, not to decide the shape.

**ZIP-import is a resilience BACKSTOP, not the onboarding hero** (red-team): it's the documented conversion-killer (export-request → wait days → upload). The first "aha" must be a **live in-browser capture/preview** delivering value before any export wait. Note TikTok's ZIP is a bare `{Date, Link}` list (enrichment mandatory; no collections) — so live capture is the good TikTok path and ZIP is the fallback.

**Deferred (fast-follow, not v1):** Reddit, YouTube (real OAuth data-portability API — easy later win), Substack, LinkedIn, Threads/Bluesky; the direct URL/share-sheet "save one thing" (design the schema so it slots in); any data-marketplace concept (out of scope).

## 6. Requirements & differentiators (testable)

1. **Media + structured analysis out.** Per item: the media file *plus* a structured record in a **stable, versioned, open schema** — metadata, transcript, on-screen text, scene-by-scene visual analysis, grounded entities (with external IDs/links), takeaways, audio info, themes/memes/trends, tone/style/category. *(Schema must SUPPORT scene-by-scene depth; whether it runs per-item, on-demand, or by content type is a §7.A decision. Visual facets are conditional on the item being video — N/A for X-bookmark text.)*
2. **Grounded, exportable entities**, measured end-to-end (§7.H): entity-linking precision/recall/F1 + disambiguation accuracy to the correct external ID + NIL accuracy, with per-surface partial-credit rules written *before* labeling.
3. **No-slop, joyful UI** (Apple-Photos-grade): unified zoom, shared-element tile→detail morph, virtualized 10k+ grid at 60fps, keyboard-first/command palette, robust search/filter/sort, rich collections (import + create). §7.D.
4. **Quality is defined and measured** (NEW): a per-capability scorecard against a version-locked golden set gates every release in CI (§7.H). This is itself a differentiator vs shallow-tagging rivals.
5. **Free where free-to-us, paid where it costs us** (model deferred — §7.C); serves all 3 segments without forking.
6. **Grounded ≠ shallow** — full research-grade analysis, no stone unturned (the explicit anti-Albo requirement), proven by published eval numbers.
7. **Take-it-anywhere** — export to notes/LLM/real external surfaces; API/MCP.
8. **Unified & re-syncable** — one deduped library; re-run to fill gaps; provenance first-class.
9. **Maintainable by one person**, incl. designed-for-breakage (§7.F, §8).
10. **SEO/AEO-native from day one** (§7.G).
11. **Trust is visible** (§8).

## 7. The hard problems for Fable (solve, or narrow to one reliable answer with a recommendation)

### 7.A Multimodal analysis pipeline — the core IP (rebuilt ground-up)
Replace the single-shot Gemini schema with a **model-agnostic, multi-stage grounded pipeline** (Twelve-Labs-informed). Recommended design (Fable to refine + cost/latency-model):
- **(0) Ingest** — capture adapter or ZIP → media + platform metadata.
- **(1) Pre-process** — ffmpeg audio demux + **PySceneDetect** scene boundaries → a few representative keyframes per scene. *The single biggest cost lever: analyze scenes, not every frame.* (Mirrors Twelve Labs "time becomes addressable.")
- **(2) Transcript** — prefer the free platform subtitle track; else WhisperX (word timestamps + diarization) local-first / whisper.cpp on-device (Apple Silicon) / Deepgram or AssemblyAI hosted fallback.
- **(3) Vision + OCR (one pass)** — a VLM over scene keyframes emits scene description + on-screen text + entity candidates together (Qwen2.5-VL / dots.ocr local via Ollama/vLLM; Gemini Flash-Lite hosted; PaddleOCR cheap verification). The salvaged `observe_video` prompt lives here, refactored per-scene.
- **(4) Structured synthesis** — an LLM composes transcript + OCR + scene descriptions + metadata into the open schema via **structured outputs / responseSchema**, written as **checkable atomic claims** (VidFactScore-decomposable). *(responseSchema reduces but doesn't eliminate failures — keep the defensive parser + a `finish_reason=length` check; size `max_tokens`.)* This is where the old single-shot call survives — as ONE node.
- **(5) Grounding resolver (deterministic, post-LLM)** — entity candidates → canonical external IDs (Google Places IDs-only free; TMDB free; Spotify + MusicBrainz [prefer MusicBrainz for durable open IDs]; Google Books/Open Library free; Letterboxd/IMDb have no free API — use TMDB/Trakt). Confidence threshold before showing links; record NIL when nothing matches; per-surface correctness rules ship in the OSS schema repo.
- **(6) Verification (agentic self-check)** — second model verifies each atomic claim against transcript+frames (faithfulness) and **escalates low-confidence/hard items to a stronger tier** (Gemini Pro / Twelve Labs Pegasus). An item "fully passes" only when transcript + entities + category + ≥1 grounded link are all correct (Video-MME-v2-style group scoring). *(Full agentic verification is a fast-follow; v1 ships lightweight deterministic checks.)*
- **Retrieval index** built from outputs (LanceDB or sqlite-vec, multimodal, local-first). Consider Twelve-Labs' **compute-embeddings-once, reuse-for-search-AND-generation** substrate pattern.

**Model economics (verified):** Gemini 2.5 Flash-Lite ~$0.10/$0.40 per 1M (+$0.30 audio), ~$0.001–0.002/clip; a full 1,300-item visual pass ≈ $1.4–2.6 tokens, but **re-anchor on 5–20k-item libraries** — a 20k full-visual pass is ~$20–40/user → **Batch API (−50%) mandatory for backfills; meter the managed visual tier on heavy libraries.** OSS (Qwen2.5-VL/whisper.cpp via Ollama) wins for the local-first free tier + privacy; hosted (Flash-Lite + Batch, Fal/Modal burst) for the managed tier; Twelve Labs Pegasus as the reference bar + optional premium backend. **Every node must be model-agnostic (swap local↔hosted).**
**Adopt from Twelve Labs:** Pegasus's *schema-driven segmentation* (define segment types + custom fields → timestamped JSON) as the pattern for our scene schema; Marengo's entity-focused embeddings + multi-vector-vs-fused tradeoff for retrieval; VidFactScore for faithfulness eval; per-capability reporting.
**Deliverable:** the pipeline design, the open schema (v1, versioned), model/prompt/grounding strategy, and a cost model at 5k/10k/20k.

### 7.B Resilient capture + processing at scale
- **Adapters:** TikTok (proven), Instagram (ZIP-primary + experimental live probe), X-bookmarks (twitter-web-exporter intercept pattern = our proven MAIN-world approach). **OSS to study/clean-room** (license-clean; avoid GPL/AGPL infecting open-core): gallery-dl (user's own TikTok saved/liked + IG saved via cookies — materially de-risks IG), twitter-web-exporter (X bookmarks past the 800 cap), cobalt (UX only, AGPL — don't embed), yt-dlp (universal media/metadata fallback). **Apify MCP** as an anti-bot ingestion fallback.
- **Resumable offscreen job queue** at 5–20k items: checkpointing, service-worker-death revival, 429 backoff, bounded concurrency, cost/ETA. *Biggest unbuilt correctness risk.*
- **Large-library capture UX** (red-team): the ~360-item auto-scroll throttle means a 20k library is a multi-hour, multi-session chore — design **resumable multi-session capture** (checkpoint + resume) with honest onboarding expectations; investigate whether cursor/pagination params in the signed responses allow next-page without full DOM scroll.
- **Eager posters (red-team-critical):** platform media URLs are signed/expire in hours — posters **must be fetched/generated eagerly at capture time** and stored as the durable ≤60KB asset; "re-derive later" is best-effort only. Poster/media fetch is an **extension-only capability** → resolve the §7.D surface split up front. Verify the Gemini File API path for the ~13% of videos >18MB.
- **Designed for breakage:** telemetry from day one; graceful degradation to caption/hashtag-only (~75–85% classification); ZIP lane as the always-works path.
- **Deliverable:** capture adapters, resumable-queue design, storage + eager-poster pipeline, resilience/telemetry plan, IG-probe result.

### 7.C Business model, cost structure & pricing (Fable OWNS — do the modeling)
Direction = hybrid (free local/BYO + paid managed). Fable does full product→ops→cost→pricing modeling and lands a **real, market-grounded model** (founder rejected anchoring). Inputs: managed margins (Flash-Lite + Batch ≈ 85%+ gross; but meter heavy libraries — 20k visual ≈ $20–40 COGS); thin-proxy infra; abuse/rate-limit surface. **Competitor economics:** Dewey $7.50/mo Pro, $225 lifetime, **$50 Export Pass**, ~3.75% paid conversion, 40k users/~1.5k paying; mymind $5–13/mo (solo, no teams); consumer **WTP is bimodal** (~$5–13/mo consumer vs $50–300/mo B2B mid-market vs $800+ enterprise). Mirror the **one-time Export Pass** for Segment 1. Keep the engine API-clean so the higher-WTP B2B surface is a later near-zero-cost add. Constraints: no-brainer, profitable, trust-preserving, never trap users. **Do NOT price on "cheaper than Twelve Labs."**
**Deliverable:** a recommended model with unit economics + tier definitions + reasoning, decision-ready.

### 7.D Product/UX, surfaces & the no-slop design system
- **Surface decision (resolve up front):** web app vs Chrome/Edge extension vs mobile vs API/MCP vs combination. Constraint: signed-media/poster fetch is **extension-only** → likely **extension for capture + web for library/SEO + API/MCP**, but that means the web library needs posters synced from the extension (or a server) — Fable must resolve the poster-sync/local-first tension explicitly (extension-hosted library, OR extension eager-capture + sync, OR accept a poster server and re-open local-first).
- **Best-in-class library (references + tech, all verified — strong priors, not mandates):** Apple Photos (unified zoom, shared-element open) + mymind (search-first, zero-org; beat its scale weakness with lightweight collections) as primary refs; Raycast/Linear (restraint, keyboard-first), Family (motion-explains-state), Notion Calendar (type scale). Tech: Motion (`layoutId` morph), TanStack Virtual (10k+ @60fps with precomputed layout from stored aspect ratios), react-photo-album or own justified layout (portrait 9:16 → fixed-aspect/justified, NOT masonry), ThumbHash/BlurHash LQIP, image/video CDN posters. Canon primitives: cmdk, Sonner, Vaul, Motion. Follow Rauno Freiberg's Web Interface Guidelines + Emil Kowalski's animation guidance as build checklists.
- **Design METHOD — multi-tool, iterative, never one-shot** (founder directive): **diverge** (Claude Design + Vercel v0 + Figma Make generate MULTIPLE directions for key screens/states) → **converge** (promote the winner into **Figma as the token + component source-of-truth**; Claude Design imports a design system from a repo and self-checks against it) → **implement** (Claude Code owns the code; `/design-sync` + `/design` round-trip) → **QA** (Claude-in-Chrome captures Apple-Photos/mymind references + verifies at 60fps). Never converge on a first generation. **All copy humanized** (no AI-voice/generic-SaaS tone).
- **Anti-slop is a hard requirement:** no Inter/Roboto defaults, no AI-purple, no cookie-cutter SaaS layout, no happy-path-only states; distinctive display + neutral body face; oklch tokens with light+dark first-class; restrained motion; a real signature element; designed empty/loading/error states.
- **Deliverable:** surface architecture, full IA + flows, from-scratch design system/tokens, hi-fi mockups of key screens + states.

### 7.E Brand & identity (from scratch — reuse nothing)
Produce a **name** (availability gauntlet — see §10 for the honest per-check method), a distinctive verbal + visual identity, philosophy/POV, brand kit. Must read premium/trustworthy/personal — explicitly not a sketchy grabber and not AI-slop. Run as its own focused multi-round *convergent* sprint (not one generation).
**Deliverable:** committed name + brand kit + voice, availability-checked.

### 7.F Maintainable solo-founder build system (founder's #1 friction)
- Secrets/config: ONE gitignored `.env.master` + a generation script (beats Doppler/1Password for one person); two environments max (local + prod-with-test-keys) pre-PMF; no premature staging; deploy-is-a-command; centralized design tokens (a UI refresh is a config change); CI/lint/test automation.
- The **Claude-Code operating system:** a lean `CLAUDE.md`, project-specific slash commands encoding brand/architecture rules, the eval harness (§7.H), a resilience runbook for platform breakage. Avoid the prior trap of elaborate agent/process scaffolding that displaces shipping. Integrations via a tiered MCP approach gated behind real usage.
- **Deliverable:** repo/env/deploy/tooling architecture + the solo-founder operating system, optimized so the founder never fights the system.

### 7.G Growth: SEO/AEO primary + a cold-start motion
- **"One product, many doorways":** `{platform} × {intent}` landing matrix (`/export-tiktok-favorites`, `/backup-x-bookmarks`, `/analyze-my-saved-videos`, …), each with **genuine per-intent live utility** (Google's 2026 core updates deindex thin programmatic pages — bar is ≥60% unique + a real tool above the fold). Refs: Dewey, TinyWow, Cobalt, Wise.
- **Cold-start (red-team):** SEO can't bootstrap from zero (new domain + CWS ranking need installs). Add a defined launch motion — CWS listing SEO (its own algorithm), Product Hunt, relevant subreddits, "vs Dewey/Stasht/Albo" comparison pages — for the first few hundred installs. Not the ongoing UGC treadmill the founder wants to avoid.
- **AEO/GEO:** canonical how-to guides ("How to export your TikTok favorites in 2026"), HowTo/FAQPage/SoftwareApplication schema, be the *cited* answer (AI Overviews ~58% lower CTR but AI-referred convert ~11–23×). Sell the **depth/grounding wedge** in doorways, not export (capture is not a durable differentiator — all rivals share the ZIP lane).
- **Deliverable:** SEO/AEO architecture + doorway template spec + day-1 checklist + cold-start plan.

### 7.H Evaluation & quality-measurement system (NEW — the wedge made real)
"Best-in-class/accuracy/quality" is a **per-capability scorecard vs a version-locked golden set**, never one number (public video benchmarks leak spatial/textual/single-frame shortcuts). Six axes: **Retrieval** (Recall@k/MRR/nDCG) · **Transcription** (WER/CER) · **On-screen OCR** (F1, stratified single-frame vs cross-frame) · **Generated analysis** (VidFactScore-style claim-level faithfulness + coverage; ALOHa/VALOR-EVAL open-vocab hallucination) · **Classification** (accuracy/macro-F1/Cohen's kappa) · **GROUNDING** (end-to-end entity-linking P/R/F1 + disambiguation to correct external ID + NIL) — stratified by difficulty + platform. Make **grounding the flagship published metric.**
- **Golden set:** promote the founder's ~106 labeled items → version-locked, grow to 200–500 (~245/slice needed for 5% margin @95%); ~30% easy / 50% failure-mode / 20% adversarial + 5–10% should-refuse; 80/20 dev/holdout; quarterly 10–20% refresh; per-surface grounding correctness rules written before labeling.
- **LLM-as-judge only for open-ended axes, validated:** Cohen's/Fleiss' kappa + ICC (never raw agreement — it inflates 33–41 pts), swap-debias (position-flip 25–50%), multi-trial, ≥2-judge panel, human adjudication of disagreements. Lean on deterministic checks (schema validation, exact-ID grounding match, WER) wherever possible.
- **Harness:** CI-gated (promptfoo + DeepEval/Ragas + Langfuse), per-slice thresholds, diffable report, fail on >~5% regression. **Open-source it** (part of open-core; the standard-setting + B2B credibility artifact).
- **v1 sequencing (solo caveat):** ship only the cheap high-signal slice first — deterministic grounding-ID exact-match + Recall@k on the 106 items + schema validation — layer claim-level faithfulness + validated judge as fast-follows. Don't block v1 on the full framework.

## 8. Non-negotiable constraints & principles
- **Trust is architecture, visible.** Category poisoned by a 2025 spyware wave (12+ fake downloader extensions, 130k users, pulled for remote code): **zero remote code**, minimal host-permissions, **OSS engine as the privacy policy**, radical transparency, single-purpose framing, **never "downloader."**
- **Chrome Web Store review risk (red-team):** the exact permission combo (broad host_permissions + declarativeNetRequest Referer injection + credentialed cross-origin media fetch) is what post-purge reviewers scrutinize. Treat CWS approval as a design constraint; do a private/dry-run submission; keep Edge + own-store + Mode-B ZIP as fallbacks.
- **Local-first for the free tier**; managed backend allowed but optional + honestly framed. **Persistent storage:** IndexedDB is evictable — call `navigator.storage.persist()` for the "durable" claim to hold. **BYO-key reality:** free-tier Gemini keys have low RPM *and daily* caps — a 20k backfill on a free key may be infeasible; the managed tier + Batch is the real path for large libraries.
- **Compliance by design, settled.** Personal-use, own-data, client-side. Don't design against legal fear.
- **Designed for platform breakage** (telemetry, adapters, graceful degradation, ZIP backstop).
- **Ship, then validate retrieval with real users** (counter the documented 63%-strategy/6%-building failure mode). Explicit kill/pivot tripwire in v1 (§5).
- **No slop, humanized copy** everywhere.

## 9. What already exists (salvage map)
- **BUILT + tested (reuse):** `src/lib/**` — framework-agnostic TS enrichment engine (types, ontology, entities, geminiClient+parser, tiered enrich orchestrator, mediaFetch+parseVtt, JSON/CSV/Obsidian exporters). 54 Vitest green, strict TS. **Declare this the engine source-of-truth**; deprecate the divergent spike `src/gemini.js`.
- **BUILT (spike, proven, lift the technique):** MAIN-world TikTok capture + client-side video fetch (`src/*.js`, `rules.json`). Real 1,313-item `attic-favorites.json` + `fixtures/` = deterministic dev/test corpus (build the Library without re-scraping). A live **Gemini key is at `src/secrets.js`** (gitignored) + prior enriched outputs in `results/` — the benchmark corpus for §7.A/§7.H.
- **Prompts:** `prompts/observe_video*.md` (perception prompt = IP; becomes the per-scene vision node).
- **Prior repos (reference/salvage):** `s0shaheen/attic-saas` (archived SaaS — 8-facet taxonomy, entity resolvers to Maps/Books/TMDB/Spotify, Gemini classification); `s0shaheen/attic-sandbox` (Modal clustering — keyframe/OCR/transcription/clustering ref). Drop all AWS/Supabase/Apify/Next infra.
- **DESIGNED, NOT built:** MV3 shell, resumable queue, storage/poster pipeline, the Library UI, licensing, all visual identity.

## 10. Capability manifest (so Fable is never blocked)
**Connected + authenticated MCPs (ready):** Figma (design-to-code + tokens + FigJam), Canva (brand assets), Framer/Unframer, Lucid (flows/journey maps), Vercel (deploy previews, import-design-from-URL), Notion, Gmail, Google Calendar/Drive, Todoist, GoDaddy (domains), **Exa** (deep web research/fetch — now authed), and browser stacks: **Playwright**, **chrome-devtools MCP**, claude-in-chrome, computer-use. **Claude Design** (claude.ai/design + `/design`, `/design-sync`) for the divergence step. **Skills:** superpowers, deep-research, dataviz, vercel:shadcn/*, supabase:*, sentry:*, skills-discovery.
**Inference credential:** a live **Gemini key at `src/secrets.js`** + `results/`/`fixtures/` corpus → §7.A/§7.H benchmarking IS executable (give it a small $ budget).
**External tools to ADOPT (the red-team's "scout what we don't have"):**
- *Pipeline OSS:* ffmpeg, PySceneDetect, WhisperX/faster-whisper/whisper.cpp, Qwen2.5-VL/dots.ocr, PaddleOCR, Ollama, vLLM.
- *Hosted inference/burst:* Fal, Modal, Replicate/Together/Baseten; Twelve Labs (reference/premium).
- *Eval:* promptfoo, DeepEval, Ragas, Langfuse (self-host).
- *Retrieval:* LanceDB (embedded, multimodal) or sqlite-vec.
- *Grounding APIs:* Google Places (paid), TMDB, Spotify + MusicBrainz (free/open), Google Books/Open Library (free).
- *MCP servers to add:* Deepgram MCP (transcription), fal MCP (media/VLM), Replicate MCP, Apify MCP (scraping fallback), a Google Maps MCP; discover via Glama (scored/safety-audited) / mcp.so / PulseMCP. **Security: vet before install (~22% of sampled Smithery servers had findings).**
- *Skills to install (vetted):* MUST — `@anthropics/skills/frontend-design` (or enable the disabled plugin), `@vercel-labs/agent-skills/web-design-guidelines`, `@anthropics/skills/mcp-builder`, `@anthropics/skills/webapp-testing`. NICE — `@mrgoonie/claudekit-skills/ai-multimodal` + `media-processing`, `@wshobson/agents/llm-evaluation`, `@daymade/claude-code-skills/promptfoo-evaluation`, `@coreyhaines31/marketingskills/ai-seo`, `@daymade/.../ui-designer`, `@pbakaus/impeccable`.
**Honest gaps (red-team):** no well-vetted MV3-*development* skill (WXT-starter refs only — expertise stays with the build); brand availability gauntlet is under-tooled (GoDaddy = domains only; **trademark = WebSearch/Exa screen only, formal clearance deferred to a lawyer**; verify social handles + Chrome-Web-Store listing name manually); `plugin:github` MCP is down → use the authed `gh` CLI.

## 11. Success criteria for the Fable session (deliverables)
1. Unified product definition (surfaces, IA, flows — a coherent whole). 2. Analysis architecture + open schema (v1) + model/prompt/grounding strategy + cost model at 5k/10k/20k (§7.A). 3. Capture + resumable-queue + storage/eager-poster resilience architecture + IG-probe result (§7.B). 4. Recommended pricing model with unit economics (§7.C). 5. From-scratch design system + hi-fi mockups of key screens/states, non-slop, humanized (§7.D). 6. Committed name + brand kit + voice, availability-checked (§7.E). 7. Maintainable solo-founder build system + Claude-Code OS (§7.F). 8. SEO/AEO architecture + doorway template + cold-start plan (§7.G). 9. **The eval/quality system design + v1 slice** (§7.H). 10. Build-ready phased implementation plan with the real-user retrieval **kill/pivot tripwire** as the release valve. 11. **"Why we still win in 12 months"** moat-durability answer (§3). 12. Updated open-core plan (what's OSS, the standard/schema repo, licensing — note gallery-dl GPL / cobalt AGPL boundaries).

## 12. Resume / story anchors (preserve + showcase)
Lead with the **content-understanding standard** (open, grounded schema + the multi-stage grounded pipeline + the published grounding-to-external-ID metric + the open eval harness — artifacts no competitor publishes). Supporting, all real: "stop trying to sign the request" (passive interception); deleting a server tier with evidence (client-side video fetch); **cost-as-architecture**; **defining + measuring what "quality" means for grounded short-form video** (the eval); trust engineered into the manifest; killing the moat you built (cutting the agent, discarding ~80% of a codebase); TDD against real 1,313-item data; knowing when 90% is 100% (deletion-rate forensics); the value-asymmetry teardown that killed the data-marketplace pre-build. Keep a running story log during the build.

## 13. Housekeeping / now-actions
- **Rotate (compromised):** the Supabase URL + anon + `service_role` JWTs and OpenAI `sk-proj-` key pasted into the exported convo archive (`AWS app naming strategy for attic.md`).
- **Back up (un-versioned):** `/Dev/attic-marketing`, the `~/Attic` Obsidian vault, the untracked pivot docs in `/Dev/attic`.
- **Declare `src/lib` the engine SoT**; deprecate the divergent spike enrichment schema.

---

*Appendix — verified numbers. Gemini 2.5 Flash-Lite $0.10/$0.30(audio)/$0.40 per 1M; ~$0.001–0.002/clip; 20k-item full-visual ≈ $20–40/user; Batch −50%. Twelve Labs Pegasus analyze $0.0292/min, Marengo index $0.042/min; Marengo 3.0 = 512-dim embeddings; VidFactScore Pegasus-1 51.7% F1. Benchmark saturation: Video-MME-v2 best 49.4 vs 90.7 human; MME-VideoOCR Gemini-2.5 Pro 73.7%. Golden set 100–500 sweet spot, ~245/slice for 5% @95%; LLM-judge kappa deflation 33–41pp, position-flip 25–50%. Competitors: Dewey ($7.50/mo, $225 lifetime, $50 Export Pass, ~3.75% conv, 40k users); mymind $5–13/mo; Albo $29.99/$49.99–59.99; VidContext ~$0.20/video; B2B mid-market $50–300/mo, enterprise listening $800–60k+/yr. Capture 1,313/1,463 (gap = deleted); ~360-item scroll throttle; 18MB inline ceiling (~13% exceed). Grounding: Places IDs-only free, TMDB/Books/MusicBrainz free, Letterboxd/IMDb no free API. SEO: ~68% zero-click, AI Overviews ~58% lower CTR, AI-referred convert ~11–23×, Google 2026 requires ≥60% unique + live utility.*
