# Fable Brief — Product Rebuild (v3, current)

> **This is the authoritative Fable handoff.** It supersedes the v2 brief (`docs/superpowers/specs/2026-07-02-product-rebuild-brief-for-fable.md`) and doc 09's orchestration, and it *drops the consumer-validation track entirely*. Read this + the dossier (`docs/product/01–08`) and you can solve/narrow every hard problem without re-litigating settled calls or lacking access.

```
Date:     2026-07-06
Author:   Salman Shaheen (with Claude Opus)
Mandate:  CONVERGE TO A BUILD-READY PLAN for the full v1 — not code. Back the plan with
          real FEASIBILITY SPIKES on the two things that are unsafe to merely assert:
          (a) live Instagram saved-posts capture, (b) the cross-device sync + agency-API backend.
          "Build-ready" = an implementer (a later Claude Code session) can execute it without
          re-deciding architecture, design direction, schema, models, or scope.
Stance:   GROUND-UP rebuild. Prior iterations (Modal sandbox → hosted SaaS → MV3 spike) are
          REFERENCE/story, never rails. Evaluate the ALREADY-BUILT engine as evidence; do not
          re-generate it from priors. Reason from first principles + user value. Legal
          compliance is SETTLED, not a ceiling.
Dropped:  No wedge selection, no user recruiting, no retrieval kill-gate, no Gate-0/tripwire.
          Validation happens later, when there is a real artifact to put in front of people.
          Fable builds the best-in-class grounded product + the plan to ship it.
```

## 0. The mandate, precisely

Fable's output is a **build-ready plan for the complete v1**, structured as the hard problems below, each solved or narrowed to one defended recommendation. Little or no production code — **except the feasibility spikes**: a plan that assumes "live IG capture works" or "zero-knowledge sync works" without a probe is not build-ready. Spike those two, report what they cost, and let the plan reflect reality.

**Bias to the artifact, not to more apparatus.** The founder's documented failure mode is over-planning (63%-strategy / 6%-building). This session exists to *converge and de-risk*, then hand off to build — not to generate more strategy, more decision-trees, or elaborate agent/process scaffolding. When a hard problem has an obvious defensible answer, take it and move.

## 1. Objectives & envelope (SETTLED — not assumed)

- **Primary goal:** **artifact-first / career-leaning.** A genuinely exceptional, portfolio-grade product and open-core standard; revenue is welcome but secondary and never at the expense of craft/trust. Optimize for the technical + OSS story.
- **Time budget:** part-time, ~10–20 hr/wk → phase the *build* aggressively; solo-parallelism is a myth (≈ 1 build track + 1 spec track).
- **Deadline:** none external; founder sets pace.
- **Money budget:** infra < ~$50/mo until a managed tier monetizes; a small inference budget on the existing Gemini key (`src/secrets.js`) for benchmarking.
- **Definition of a successful session:** a build-ready plan for the full v1 (all §7 deliverables) + a standout open-core/technical artifact story + the "why we still win in 12 months" moat answer. **No user-validation metric gates this session.**

**Settled product forks (founder-ratified 2026-07-06):**
1. **Primary user = the "understand & actually use all my saves" prosumer** (Segment 2). Open-core grounded engine = the moat/credibility spine; ad-hoc exporters (Segment 1) = the free SEO funnel; **agencies (Segment 3) = an in-v1 self-serve API/MCP surface on the same engine** (promoted from deferred — no separate B2B sales motion).
2. **v1 is horizontal** — "understand all your saves," not a single acute vertical. (The single-domain wedge was a validation device; it's gone.)
3. **Full v1 scope** — live IG capture, cross-device sync, the agency API, and the from-scratch design system are all **in v1**, not fast-follows.

## 2. The product in one breath

A tool that turns the media you've **saved / liked / favorited / reposted / posted** across platforms into a **private, beautifully browsable library where every item is deeply understood** — the media itself *plus* a structured, objective, research-grade breakdown of what's *in* it — that you can **search, act on, and take anywhere** (your notes, your own LLM, Google Maps, Letterboxd, or an API/MCP). Not an AI brand (AI is invisible plumbing), not a "downloader," not just another cross-platform bookmark exporter. **The enriched, grounded, browsable library is the product.**

## 3. Who it's for (3 segments — one unified product, do NOT fork per persona)

1. **Ad-hoc exporters** — export one collection / a profile / a URL list. The **free SEO doorway** + a one-time Export-Pass upsell (mirror Dewey's $50 mechanic). Not a business on its own.
2. **"Consumption-conscious" users** — export **and understand + use** all their saves (grounded entities, themes, memes/trends). **The paying core of v1.** Not white space anymore (Stasht, Quiki, Sprink, ARCHV, ReelRecall, Dewey, Albo, mymind do save + auto-tag + search + *light* grounding) — so we win on depth + measured accuracy + traceability + open schema, not "we ground."
3. **Agencies / SMBs / social strategists** — Twelve-Labs-level video intelligence with less setup/cost. **In v1 as a self-serve API/MCP surface on the same open-core engine** (near-zero incremental product cost) — NOT an enterprise sales motion a solo founder can't staff.

## 4. Positioning, wedge & moat (the durable strategy — still governs)

"Cross-platform save + search + light AI" is **occupied** (Dewey, Albo, + the Segment-2 wave). Light grounding is table stakes. The defensible wedge:

> **Research-grade, MEASURABLY-accurate, GROUNDED, traceable analysis of the media itself** — scene-level understanding + transcript + on-screen text + entities that **resolve to the correct external ID** (Google Place / TMDB / Letterboxd / Spotify / Book) — in a **durable, open, portable schema**, with **best-in-class no-slop design** and a **trust-first local posture**, exposed via an **API/MCP**. Make **grounding-to-external-IDs the flagship, published metric** ("we resolve to the correct external ID X% of the time") — a claim competitors structurally can't make.

**Moat honesty (do not skip):** you cannot call the analysis *engine* the moat and also open-source it — the prompt/ontology is weeks-cloneable. The OSS engine is **credibility + SEO + portfolio artifact**; the **real moat** is (a) the compounding proprietary resolved-entity index/data, (b) the library experience + brand + trust, (c) export-OUT + API/MCP that Albo structurally refuses, (d) distribution/SEO. **Deliverable: a defended "why we still win in 12 months after Albo/Dewey copy the obvious," separating sprint-cloneable from compounding.** Do NOT position on "cheaper than Twelve Labs."

## 5. LOCKED (founder-decided — do not re-open)

1. **North-star / story:** the **content-understanding standard** (§4). Capture/architecture are *supporting* stories.
2. **v1 scope:** TikTok **+ Instagram both deep and LIVE-captured**, X-bookmarks doorway, + cross-device sync + agency API + from-scratch design system (§6).
3. **Monetization direction:** hybrid (free local/BYO-key + paid managed); **exact model/tiers/pricing = Fable's to model** (§7.C). Architecture must not foreclose a managed backend; free tier local-first.
4. **Open source:** **open-core** — engine + ontology + open schema + eval harness + per-surface grounding-correctness rules. App/hosted product proprietary.
5. **Not an AI brand.** AI is invisible plumbing.
6. **Rebrand from scratch.** The name is **not "Attic"**; nothing carries forward. Naming + identity is a dedicated from-scratch sprint (§7.E).
7. **Growth = SEO/AEO-led** ("one product, many doorways") + a defined cold-start motion (§7.G).
8. **Trust-first, local-first, zero remote code** posture (§8).

### Carried-forward technical facts (spike-proven; reuse unless Fable finds cause)
- **Capture = passive interception**, never signature-forging: a MAIN-world script skims the platform's *own already-signed* API responses during human-paced scroll. Proven for TikTok Favorites (`GET /api/user/collect/item_list/`, items under `itemList`, string `id`).
- **Client-side video fetch** by mirroring the page's own request (credentialed CORS + `Range` + DNR-injected `Referer`). AI-independent `.mp4` export, no server for capture. **Extension-only capability** — resolve the §7.D surface split around it.
- **Eager posters:** platform media URLs are signed and expire in hours → fetch/store posters eagerly at capture time (the ≤60KB durable asset). "Re-derive later" is best-effort only.
- **Deterministic entity normalization + dedupe + cross-item index** = the retrieval primitive (already built + tested — §9).

## 6. v1 scope — the FULL product (build-sequenced, but all in scope)

All of it is v1. Fable's plan may sequence the *build* (to force an early internal release and manage solo bandwidth), but nothing here is a "later" that escapes the plan.

- **Engine:** the multi-stage grounded analysis pipeline (§7.A) + the open, versioned schema + the eval/quality system (§7.H).
- **Capture:** TikTok (proven live) + **Instagram LIVE** (with ZIP-import as the resilience backstop, not the hero) + X-bookmarks doorway. §7.B.
- **Library:** the Apple-Photos-grade browse/search/filter/collections surface. §7.D.
- **Sync:** **cross-device sync** consistent with the local-first / "nothing plaintext at rest on our servers" posture — Fable picks the model (user-held-file vs zero-knowledge encrypted server) and **spikes it**. §7.I (new).
- **Agency API/MCP:** a self-serve read + analysis surface on the same engine. §7.C.
- **Brand + design system:** from scratch, iterative/convergent. §7.D/§7.E.
- **Open-core:** the engine + ontology + open schema + eval harness published as the standard. Release timing is a Fable call, but lean **earlier than "strictly last"** — the grounding module is already clean and tested, so it can double as public GitHub activity + SEO/credibility once its interface stabilizes.

**Instagram (now IN v1, not experimental):** live saved-posts capture is the hard one — Meta killed Basic Display, there's no saved-posts API, and GraphQL `doc_id`s rotate every 2–4 weeks. **Fable must run a real live-IG feasibility spike** (via Playwright / chrome-devtools MCP against a logged-in IG session) and design capture to be *maintainable* (adapter + telemetry + graceful degradation), with the official "Download Your Data" ZIP-import as the always-works backstop (it uniquely carries the user's named saved *collections*). Study gallery-dl (clean-room, license-aware) — it materially de-risks IG.

**Deferred (genuinely out of v1):** Reddit, YouTube, Substack, LinkedIn, Threads/Bluesky; the direct URL/share-sheet "save one thing" (design the schema so it slots in later); any data-marketplace concept.

## 7. The hard problems for Fable (solve, or narrow to one defended recommendation)

### 7.A Multimodal analysis pipeline — the core IP (rebuilt ground-up)
Model-agnostic, multi-stage grounded pipeline (Twelve-Labs-informed), replacing the single-shot Gemini call:
- **(0) Ingest** — capture adapter or ZIP → media + platform metadata.
- **(1) Pre-process** — ffmpeg audio demux + **PySceneDetect** scene boundaries → representative keyframes per scene. *Biggest cost lever: analyze scenes, not frames.*
- **(2) Transcript** — platform subtitle track if present; else WhisperX / whisper.cpp local-first; Deepgram/AssemblyAI hosted fallback.
- **(3) Vision + OCR (one pass)** — a VLM over scene keyframes emits scene description + on-screen text + entity candidates (Qwen3-VL / dots.ocr local via Ollama/vLLM; Gemini Flash-Lite hosted; PaddleOCR cheap verify). The salvaged `prompts/observe_video*.md` lives here, refactored per-scene.
- **(4) Structured synthesis** — an LLM composes transcript + OCR + scene + metadata into the open schema via structured outputs, as checkable atomic claims. Keep the defensive parser + `finish_reason=length` guard.
- **(5) Grounding resolver (deterministic, post-LLM)** — **this is the built module** (`src/lib/grounding.ts`): route → candidate-gen → select → confidence-gate → NIL + provenance. MusicBrainz resolver is real; **Fable adds the remaining resolvers** (Google Places IDs-only free; TMDB free; Spotify; Google Books/Open Library; Letterboxd/IMDb have no free API → TMDB/Trakt) and swaps the heuristic selector for an LLM selector in prod. Per-surface correctness rules ship in the OSS schema repo.
- **(6) Verification (agentic self-check)** — a second model verifies each atomic claim against transcript+frames and escalates low-confidence items to a stronger tier. v1 ships lightweight deterministic checks; full agentic verification is a fast-follow.
- **Retrieval index** built from outputs (LanceDB or sqlite-vec, multimodal, local-first).

**Economics (verified):** Gemini 2.5 Flash-Lite ~$0.001–0.002/clip; re-anchor on 5–20k-item libraries (a 20k full-visual pass ≈ $20–40/user → Batch API −50% mandatory for backfills; meter the managed visual tier on heavy libraries). OSS (Qwen3-VL/whisper.cpp via Ollama) for the local-first free tier; hosted (Flash-Lite + Batch) for managed; Twelve Labs Pegasus as reference bar. **Every node model-agnostic (swap local↔hosted).**
**Deliverable:** pipeline design, open schema (v1, versioned), model/prompt/grounding strategy, cost model at 5k/10k/20k.

### 7.B Resilient capture + processing at scale
- **Adapters:** TikTok (proven), **Instagram (LIVE, v1 — spike + make maintainable, ZIP backstop)**, X-bookmarks (twitter-web-exporter intercept pattern). Study OSS clean-room (license-aware; avoid GPL/AGPL infecting open-core): gallery-dl, twitter-web-exporter, cobalt (UX ref only), yt-dlp. Apify MCP as anti-bot fallback.
- **Resumable offscreen job queue** at 5–20k items: checkpointing, service-worker-death revival, 429 backoff, bounded concurrency, cost/ETA. *Biggest unbuilt correctness risk.*
- **Large-library capture UX:** ~360-item auto-scroll throttle → a 20k library is multi-hour/multi-session → design resumable multi-session capture with honest onboarding; investigate cursor/pagination params in the signed responses to page without full DOM scroll.
- **Eager posters:** signed URLs expire → fetch eagerly at capture (extension-only). Verify the Gemini File API path for the ~13% of videos >18MB.
- **Designed for breakage:** telemetry from day one; graceful degradation to caption/hashtag-only (~75–85% classification); ZIP as the always-works lane.
- **Deliverable:** capture adapters, resumable-queue design, storage + eager-poster pipeline, resilience/telemetry plan, **live-IG spike result**.

### 7.C Business model + agency API (Fable OWNS the modeling)
Direction = hybrid (free local/BYO + paid managed). Full product→ops→cost→pricing modeling → a real, market-grounded model (founder rejected anchoring). Inputs: managed margins (Flash-Lite + Batch ≈ 85%+ gross; meter heavy libraries); competitor economics (Dewey $7.50/mo, $225 lifetime, **$50 Export Pass**, ~3.75% conv; mymind $5–13/mo; consumer WTP bimodal ~$5–13/mo vs B2B $50–300/mo). Mirror the one-time Export Pass for Segment 1. **The agency API/MCP is a v1 surface** — design its auth, rate-limiting, and pricing as part of the model (near-zero incremental product cost on the same engine). Constraints: no-brainer, profitable, trust-preserving, never trap users. **Don't price on "cheaper than Twelve Labs."**
**Deliverable:** recommended model + unit economics + tier definitions + the agency-API surface spec, decision-ready.

### 7.D Product/UX, surfaces & the no-slop design system
- **Surface decision (resolve up front):** signed-media/poster fetch is **extension-only** → likely **extension for capture + web for library/SEO + API/MCP**; resolve the poster-sync/local-first tension explicitly (extension-hosted library, OR eager-capture + sync, OR a poster server that re-opens local-first). This couples to §7.I sync.
- **Best-in-class library (strong priors, not mandates):** Apple Photos (unified zoom, shared-element open) + mymind (search-first) as primary refs; Raycast/Linear (restraint, keyboard-first), Family (motion-explains-state). Tech: Motion (`layoutId` morph), TanStack Virtual (10k+ @60fps from stored aspect ratios), justified layout (portrait 9:16, not masonry), ThumbHash/BlurHash LQIP. Canon primitives: cmdk, Sonner, Vaul, Motion. Follow the Web Interface Guidelines + Emil Kowalski animation guidance.
- **Design METHOD — multi-tool, iterative, never one-shot** (founder directive): **diverge** (Claude Design + Vercel v0 + Figma Make generate MULTIPLE directions for key screens/states) → **converge** (promote the winner into Figma as the token + component source-of-truth) → **implement** (Claude Code owns code; `/design-sync` round-trip) → **QA** (Claude-in-Chrome verifies at 60fps vs the references). Never converge on a first generation. All copy humanized (no AI/SaaS voice).
- **Anti-slop is a hard requirement:** no Inter/Roboto defaults, no AI-purple, no cookie-cutter SaaS layout, no happy-path-only states; distinctive display + neutral body face; oklch tokens with light+dark first-class; restrained motion; a real signature element; designed empty/loading/error states.
- **Deliverable:** surface architecture, full IA + flows, from-scratch design system/tokens, hi-fi mockups of key screens + states.

### 7.E Brand & identity (from scratch — reuse nothing)
**Propose a shortlist of name options** (availability-gauntlet-checked — see §10) for the founder to pick from — naming is **delegated to Fable** (founder-ratified 2026-07-06); Fable proposes, the founder chooses. Plus a distinctive verbal + visual identity, philosophy/POV, brand kit. Premium/trustworthy/personal — not a sketchy grabber, not AI-slop. Its own focused convergent sprint (not one generation), run early since it blocks repos/domains/store/copy.
**Deliverable:** an availability-checked name shortlist → founder pick → brand kit + voice.

### 7.F Maintainable solo-founder build system (founder's #1 friction)
- Secrets/config: ONE gitignored `.env.master` + a generation script; two environments max (local + prod-with-test-keys); deploy-is-a-command; centralized design tokens; CI/lint/test automation.
- The **Claude-Code operating system:** a lean `CLAUDE.md` (already exists), project-specific slash commands encoding brand/architecture rules, the eval harness (§7.H), a platform-breakage runbook. **Avoid elaborate agent/process scaffolding that displaces shipping** (the prior trap).
- **Open-core repo topology:** private app monorepo + a fresh, clean, secret-scanned public repo carved from `src/lib` for the OSS engine (do not make the private repo public). Design the publish pipeline. Repo is `github.com/s0shaheen/attic` (rename to the brand when named).
- **Deliverable:** repo/env/deploy/tooling architecture + the solo-founder operating system.

### 7.G Growth: SEO/AEO primary + a cold-start motion
- **"One product, many doorways":** `{platform} × {intent}` landing matrix, each with **genuine per-intent live utility** (Google 2026 deindexes thin programmatic pages — ≥60% unique + a real tool above the fold).
- **Cold-start:** SEO can't bootstrap from zero → CWS listing SEO, Product Hunt, relevant subreddits, "vs Dewey/Stasht/Albo" comparison pages for the first few hundred installs. Not an ongoing UGC treadmill.
- **AEO/GEO:** canonical how-to guides + HowTo/FAQPage/SoftwareApplication schema; be the *cited* answer. Sell the depth/grounding wedge in doorways, not export.
- **Deliverable:** SEO/AEO architecture + doorway template spec + day-1 checklist + cold-start plan.

### 7.H Evaluation & quality-measurement system (the wedge made real — ENGINE quality, not user validation)
"Best-in-class/accuracy/quality" = a **per-capability scorecard vs a version-locked golden set**, never one number. Six axes: **Retrieval** (Recall@k/MRR/nDCG) · **Transcription** (WER/CER) · **OCR** (F1) · **Generated analysis** (VidFactScore-style claim-level faithfulness + coverage) · **Classification** (macro-F1/kappa) · **GROUNDING** (end-to-end entity-linking P/R/F1 + disambiguation to correct external ID + NIL). Make **grounding the flagship published metric.**
- **Golden set:** promote the founder's ~106 labeled items → version-locked, grow to 200–500; ~30% easy / 50% failure-mode / 20% adversarial; 80/20 dev/holdout; per-surface grounding-correctness rules written before labeling.
- **LLM-as-judge only for open-ended axes, validated** (kappa/ICC, swap-debias, ≥2-judge panel). Lean on deterministic checks (schema validation, exact-ID grounding match, WER) wherever possible.
- **Harness:** CI-gated, per-slice thresholds, diffable report, fail on >~5% regression. **Open-source it** (part of open-core — the standard-setting + B2B credibility artifact).
- **v1 slice (solo caveat):** ship only the cheap high-signal slice first — deterministic grounding-ID exact-match + Recall@k on the 106 items + schema validation — layer the rest as fast-follows.

### 7.I Cross-device sync (NEW — now v1)
Design a sync model consistent with the locked local-first / "nothing plaintext at rest on our servers" posture, and **spike it**. Options to weigh: (a) user-held-file portable sync (private, manual, zero infra); (b) managed zero-knowledge encrypted server (best UX, re-opens data-at-rest — mitigate with client-side E2E encryption). Couples to §7.D (the poster-sync tension) and §7.C (the managed backend that the agency API also rides). Resolve whether one backend serves sync + agency-API + managed-inference.
**Deliverable:** the sync model + a working feasibility spike + the backend topology that unifies sync, the agency API, and the managed tier.

## 8. Non-negotiable constraints & principles
- **Trust is architecture, visible.** Category poisoned by a 2025 spyware wave (fake downloaders pulled for remote code): **zero remote code**, minimal host-permissions, **OSS engine as the privacy policy**, single-purpose framing, never "downloader."
- **Chrome Web Store review risk:** the permission combo (broad host_permissions + DNR Referer injection + credentialed cross-origin media fetch) is what post-purge reviewers scrutinize. Treat CWS approval as a design constraint; dry-run submit; keep Edge + own-store + ZIP as fallbacks.
- **Local-first for the free tier**; managed backend optional + honestly framed. IndexedDB is evictable → `navigator.storage.persist()`. Free-tier Gemini keys have low RPM + daily caps → managed tier + Batch is the real path for large libraries.
- **Compliance by design, settled.** Personal-use, own-data, client-side. Don't design against legal fear.
- **Designed for platform breakage** (telemetry, adapters, graceful degradation, ZIP backstop).
- **Bias to building** over more strategy/apparatus. No slop, humanized copy everywhere.

## 9. What already exists (salvage map — current)
- **BUILT + tested (reuse; declare `src/lib` the engine source-of-truth):** `src/lib/**` — framework-agnostic TS engine: types, ontology, entities (normalize/dedupe/`buildEntityIndex`), geminiClient+parser, tiered enrich orchestrator, mediaFetch+parseVtt, JSON/CSV/Obsidian exporters, **and the new grounding module** (`grounding.ts` + MusicBrainz resolver: route→candidate→select→confidence-gate→NIL+provenance) with `scripts/ground-demo.ts`. **61 Vitest green, strict TS clean.** The shell still runs the untested `src/gemini.js` → **META-12: wire `src/lib` in (a real integration — nothing produces `Mention` objects or a prod LLM selector yet), deprecate `gemini.js`.**
- **BUILT (spike, proven, lift the technique):** MAIN-world TikTok capture + client-side video fetch (`src/*.js`, `rules.json`). Real 1,313-item `attic-favorites.json` + `fixtures/` = deterministic dev/test corpus. Live **Gemini key at `src/secrets.js`** (gitignored) + prior enriched outputs in `results/` = benchmark corpus for §7.A/§7.H.
- **Prompts:** `prompts/observe_video*.md` (perception prompt = IP; becomes the per-scene vision node).
- **Prior repos (reference/salvage only — now ARCHIVED):** `s0shaheen/attic-saas` (archived SaaS — 8-facet taxonomy, entity resolvers to Maps/Books/TMDB/Spotify, Gemini classification); `s0shaheen/attic-sandbox` (archived Modal clustering — keyframe/OCR/transcription/clustering ref). Drop all AWS/Supabase/Apify/Next infra.
- **DESIGNED, NOT built:** MV3 shell wiring, resumable queue, storage/poster pipeline, the Library UI, sync, the agency API, licensing, all visual identity.

## 10. Capability manifest & founder-provisioning (so Fable is never blocked)
**Connected + authed MCPs (ready):** Figma, Canva, Framer, Lucid, Vercel, Notion, Gmail, Google Calendar/Drive, Todoist, GoDaddy (domains), **Exa** (research), Supabase; browser stacks **Playwright**, **chrome-devtools**, claude-in-chrome, computer-use. **Claude Design** (`/design`, `/design-sync`) for divergence. Skills: superpowers, deep-research, dataviz, vercel:shadcn/*, supabase:*, sentry:*.
**Inference:** Gemini key at `src/secrets.js` + `results/`/`fixtures/` corpus → §7.A/§7.H benchmarking is executable (give it a small $ budget).
**External to ADOPT:** ffmpeg, PySceneDetect, WhisperX/whisper.cpp, Qwen3-VL/dots.ocr, PaddleOCR, Ollama/vLLM; hosted burst Fal/Modal/Replicate/Together; eval promptfoo/DeepEval/Ragas/Langfuse; retrieval LanceDB/sqlite-vec; grounding APIs Places/TMDB/Spotify/MusicBrainz/Open Library. Discover MCP servers via Glama/mcp.so/PulseMCP (**vet before install**).
**Founder must provision (parallel to the session — none blocks writing/running the spec):**
- 🔴 **Fresh corpus capture** (media expired; the engine + golden set need intact media) + logged-in **TikTok / Instagram / X** sessions for the capture spikes; an **IG "Download Your Data" ZIP**.
- 🟡 **Grounding-KB keys** (TMDB free, Spotify free, **Google Places = billing card**), an **OSS-inference account** (Together/Fireworks/HF) for the local engine path, a **Twelve Labs** free account (benchmark reference).
- 🟡 **Backend** (Vercel + Supabase MCPs give a sandbox) for the sync + agency-API + managed-inference spike; **payments** (Stripe/LemonSqueezy) when the model lands; **Chrome Web Store dev account** ($5) + a **domain**.
- 🟢 **Taste input:** a name decision (or license to propose) + periodic design gut-checks.
**Honest gaps:** no vetted MV3-*dev* skill (expertise stays with the build); brand availability = WebSearch/Exa + manual handle/CWS-name checks, formal trademark deferred to a lawyer.

## 11. Deliverables — definition of done
1. Unified product definition (surfaces, IA, flows — a coherent whole).
2. Analysis architecture + open schema (v1) + model/prompt/grounding strategy + cost model at 5k/10k/20k (§7.A).
3. Capture + resumable-queue + storage/eager-poster resilience architecture + **live-IG spike result** (§7.B).
4. Recommended pricing model with unit economics + the agency-API surface spec (§7.C).
5. From-scratch design system + hi-fi mockups of key screens/states, non-slop, humanized (§7.D).
6. Committed name + brand kit + voice, availability-checked (§7.E).
7. Maintainable solo-founder build system + Claude-Code OS + open-core repo topology (§7.F).
8. SEO/AEO architecture + doorway template + cold-start plan (§7.G).
9. The eval/quality system design + v1 slice (§7.H).
10. **Cross-device sync model + spike result + unified backend topology (§7.I).**
11. **Build-ready phased implementation plan** for the full v1 (no user-validation gate — sequencing is for solo-bandwidth, not a kill-gate).
12. **"Why we still win in 12 months"** moat-durability answer (§4) + the updated open-core plan (what's OSS, the standard/schema repo, licensing — gallery-dl GPL / cobalt AGPL boundaries).

## 12. How Fable should operate (standing instructions)
- **Ground-up, but evaluate the built engine as evidence** — do not re-generate `src/lib` from priors; measure it, then improve it.
- **Multi-tool, iterative, convergent** — especially design and brand: diverge across tools, converge on one, never one-shot.
- **Phase with founder gates** — at the end of each hard-problem block, surface a defended recommendation and the decisions that need the founder, then continue. Don't stall on his time; default and proceed where the call is obvious.
- **Converge to a plan, not code** — except the two feasibility spikes (live IG, sync/backend), which must be real.
- **Re-verify 2026-current numbers** (pricing, model versions, API shapes) before hardcoding.
- **Bias to shipping, not apparatus.** No elaborate agent/process scaffolding. When an answer is obvious and defensible, take it.

## 13. Story anchors (preserve + showcase)
Lead with the **content-understanding standard** (open grounded schema + the multi-stage pipeline + the published grounding-to-external-ID metric + the open eval harness — artifacts no competitor publishes). Supporting, all real: "stop trying to sign the request" (passive interception); deleting a server tier with evidence (client-side video fetch); cost-as-architecture; defining + measuring what "quality" means for grounded short-form video; trust engineered into the manifest; killing the moat you built (cutting the agent, discarding ~80% of a codebase); TDD against real 1,313-item data. Keep a running story log during the build.
