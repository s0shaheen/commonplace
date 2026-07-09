# Fable Brief — Product Spec (v4) — ⛔ SUPERSEDED

> **SUPERSEDED 2026-07-06 by [`docs/specs/product-specification.md`](./product-specification.md) (v5, governing).** v4 was the brief that *commissioned* a build-ready spec; product-specification.md is that spec — re-founded from intention, with every hard problem below resolved to a defended call (evidence: `2026-07-06-refounding-research.md`). Kept for history only. Do not build from this document.

> ~~**This is the single governing spec.**~~ v4 folds the founder-ratified Phase-1 decisions (D1–D15) and every 2026-verified correction into one document; it supersedes v3 and the dossier's doc 09. The evidence trail is `archive/superseded/fable-phase1-findings.md`; strategic depth is the dossier (`01–08`); the engine design is `2026-07-02-engine-groundup-analysis.md` (now governing — see §7.A). **No timelines or effort estimates appear here by design:** the build is agentically coded, so the only scarce resource is the founder's decisions, provisioning, and taste — the build is sequenced by *those* gates, not by hours.

```
Date:     2026-07-06 (v4)
Mandate:  CONVERGE TO A BUILD-READY PLAN — architecture, schema, designs, and a
          dependency-ordered build sequence an agentic Claude Code session can execute
          without re-deciding anything. Back it with REAL feasibility spikes on the two
          unproven bets: (a) live Instagram saved-view interception, (b) zero-knowledge sync.
Stance:   GROUND-UP. Prior iterations are REFERENCE, never rails. Evaluate the ALREADY-BUILT
          engine as evidence; don't regenerate it. Reason from first principles + user value.
Dropped:  No consumer-validation track (wedge / recruiting / retrieval kill-tests) — dropped.
```

## 0. The mandate, precisely
Fable's output is a **build-ready plan for the full v1**, structured as the hard problems below, each solved or narrowed to one defended recommendation. Little/no production code **except the two feasibility spikes** (live-IG interception; zero-knowledge sync) — a plan that merely *asserts* those work is not build-ready. **Bias to the artifact, not to more apparatus** — no elaborate process scaffolding; when a hard problem has an obvious defensible answer, take it.

## 1. Objectives & envelope (settled)
- **Primary goal:** **artifact-first / career-leaning.** A portfolio-grade product and open-core standard; revenue welcome but secondary, never at the expense of craft/trust. Optimize for the technical + OSS story.
- **The scarce resource is the founder's attention** — decisions, provisioning (keys/logins), taste calls, and the two live spikes. Build effort is *not* a constraint (agentic). Sequence the build to **minimize and order the founder's touchpoints**, not to manage coding hours. **No time/effort estimates in the plan.**
- **Money:** infra kept minimal until a managed tier monetizes; a small inference budget on the founder's own key for benchmarking.
- **Success of the Fable session:** the full §11 deliverables + the repaired "why we still win" (§4) + one coherent build-ready sequence. No user-validation metric gates it.

**Settled product decisions (founder-ratified 2026-07-06):**
1. Primary user = the **"understand & use all my saves" prosumer**; open-core grounded engine = moat/credibility spine; ad-hoc exporters = free SEO funnel.
2. Product is **horizontal** ("understand all your saves"), not a single vertical wedge.
3. **Instagram = ZIP-primary + spike-gated live** (D4): the ZIP-import lane is the reliability guarantee; live interception ships as best-effort and is *promoted to a headline* only if the Phase-2 spike passes. TikTok live capture is proven.
4. **Agency = split** (D5): the **personal-library MCP + open schema ship in v1** (now table-stakes — Albo/Quiki ship MCP free); the **agency bulk-analysis API is deferred** behind a real demand signal, with the backend built API-ready (auth/metering stubbed). No B2B sales motion.
5. Monetization = hybrid (free local/BYO-key + paid managed); **model = free + one-time credit "full-library run" + managed subscription** (§7.C).
6. Local-first / zero-remote-code; **telemetry resolved to a 3-plane + opt-in posture** (§8, D8) — not absolute zero-phone-home.
7. **Naming delegated to Fable** — propose an availability-checked shortlist; founder picks.

## 2. The product in one breath
A tool that turns the media you've **saved / liked / favorited / posted** across platforms into a **private, beautifully-browsable library where every item is deeply understood** — the media itself *plus* a structured, research-grade breakdown of what's *in* it — that you can **search, act on, and take anywhere** (your notes, your LLM, Google Maps, an API/MCP). Not an AI brand (AI is invisible plumbing), not a "downloader." **The enriched, grounded, browsable library is the product.**

## 3. Who it's for (one unified product, do NOT fork per persona)
1. **Ad-hoc exporters** — the free SEO doorway + a one-time Pass. Not a business alone.
2. **"Consumption-conscious" prosumers** — export **and understand + use** all their saves. **The paying core of v1.** Not white space (Dewey, Albo, mymind, Quiki, Stasht, Cosmos already do save + auto-tag + search + *light* grounding), so we win on **depth + measured accuracy + traceability + open schema**, not "we ground."
3. **Agencies / strategists** — served in v1 only via the **personal MCP + open schema** on the same engine; the bulk agency API is deferred (§7.C).

## 4. Positioning, wedge & moat (corrected — payload, not protocol)
"Cross-platform save + search + light AI" is occupied, and **grounding + MCP are now table-stakes** (Albo ships a free Claude MCP; Quiki ships MCP+REST; Gemini ships Grounding-with-Google-Maps as an API tool). So the wedge is **not** "we ground" or "we have an API" — it's the **payload + the proof**:

> Research-grade analysis of the media itself — scene-level understanding + transcript + on-screen text + entities that **resolve to the correct external ID** — delivered in a **durable open schema** with **published, measured accuracy**, and the **only** MCP/export whose entities arrive grounded with **confidence + provenance + NIL handling**.

**The repaired "why we still win in 12 months" (four pillars):**
1. **The published, version-locked grounding metric + open eval harness = the structural non-follow.** Free apps can't afford to publish accuracy (it exposes them; ReelRecall's unaudited "98%" is marketing); funded apps can't afford to open the schema (it cannibalizes lock-in). We can do both — that's the counter-position.
2. **Compounding proprietary assets** — the golden set, per-surface grounding-correctness rules, and the resolved-entity index — what a fast-follower can't copy in a sprint is the *measured, calibrated, multi-KB system*, not the prompt.
3. **Experience + trust** — the library craft + the local-first, OSS-engine-as-privacy-policy posture (validated by the ongoing 2025–26 spyware waves).
4. ~~Distribution/SEO~~ **demoted to a contested channel** (Stasht/ReelRecall/Quiki/Albo run the identical doorway playbook with a domain-age head start) — the only durable SEO asset is the linkable *accuracy/grounding* content, not the channel.

**Do NOT** position on "cheaper than Twelve Labs." **Deepest current competitor = Quiki** (per-video deep scans, bulk import from data exports, REST+MCP) — the published-accuracy artifact must land early, before it contests the claim rhetorically.

## 5. LOCKED (founder-decided)
1. North-star: the **content-understanding standard** (§4). 2. v1 = TikTok live + **Instagram ZIP-primary/spike-gated-live** + X doorway + cross-device sync + **personal MCP** + from-scratch design system + open-core. 3. Monetization hybrid (§7.C). 4. Open-core (engine + ontology + open schema + eval harness). 5. Not an AI brand. 6. **Rebrand from scratch** — name delegated to Fable. 7. Growth SEO/AEO-led (a contested channel, §7.G). 8. **Trust-first, local-first, zero-remote-code**; telemetry per §8.

### Carried-forward technical facts (spike-proven)
- **Capture = passive interception** of the platform's *own already-signed* `item_list` responses during human-paced scroll. Proven for TikTok. The doc_id-rotation fires that kill instaloader/instagrapi are **request-construction** failures Attic structurally does not share (we skim, we don't construct) — but whether IG's logged-in saved view fires an interceptable XHR is **unproven** (the §7.B spike settles it). Build interceptors **doc_id-agnostic + shape-tolerant** (match stable URL paths; tolerate single-blob or streamed JSON-lines).
- **Eager posters** (signed URLs expire) fetched at capture; **content-visibility pruning** keeps large lists scrollable (shipped); the resumable memory-bounded offscreen queue is the #1 unbuilt capture-correctness risk (a 4,661-item Likes capture crashed the renderer — lived proof).
- **Deterministic entity normalization + dedupe + cross-item index** = the retrieval primitive (built + tested).

## 6. v1 scope — the full product (dependency-sequenced, not time-boxed)
All of it is v1. The plan sequences the *build* by dependency and by founder-gate, never by effort/time. A sensible spine, **Slice 1 = the "artifact core"**: TikTok capture (built) + the wired `src/lib` engine (META-12) + Wikidata/MusicBrainz/Places resolvers + the extension-hosted library v1 + open-schema export keyed on open IDs + the promptfoo eval slice. Everything else (IG lanes, X doorway, sync, personal MCP, full design system, agency-ready backend, open-core carve) sequences behind it, each gated where it needs a founder decision/provision/taste call — **not** on a calendar.

**Instagram (D4):** ZIP-import is the always-works lane (carries the saved list + named collections + timestamps, not media/captions → guarantees *discovery*, not enrichment). Live interception is the §7.B spike's subject; promote it to hero only on a pass.
**Deferred (genuinely out of v1):** the agency bulk-analysis API (§7.C); Reddit/YouTube/etc.; the data-marketplace concept.

## 7. The hard problems (solve, or narrow to one defended recommendation)

### 7.A Analysis engine — the core IP (two lanes; `_ENGINE-groundup` governs)
The engine is **model-agnostic with two lanes** — this is the whole thesis (the model is a swappable commodity):
- **Free / local / open-core lane = Qwen3-VL (Apache-2.0)** on Ollama + **whisper.cpp** for audio. This is the privacy tier *and* the OSS-credibility artifact. Because open VLMs don't ingest audio natively, this lane keeps the **multi-stage pipeline** (ffmpeg → scene keyframes → VLM+OCR → separate transcript → structured synthesis → deterministic grounding).
- **Paid / hosted / managed lane = Gemini Flash-Lite** — the "just works, no local GPU" convenience path. Per **D2**, ratify `_ENGINE-groundup`'s **single constrained native-video+audio pass** (Gemini ingests video+audio in one call; median clip is 29s; multi-pass ensembles collapse inter-run kappa and poison the golden set) → deterministic grounding → confidence-routed escalation later. **Run the one deciding experiment first:** native-video vs [VTT + keyframes + OCR] on the re-stratified golden seed (53% of the real corpus carries subtitles).
- **Grounding resolver = the built module** (`src/lib/grounding.ts`: route→candidate→select→confidence-gate→NIL+provenance). **Grounding runs CLIENT-side on all tiers** (MusicBrainz is 1 rps/IP).
- **Economics (D1):** re-anchor on **Gemini 3.1 Flash-Lite** — 2.5 Flash-Lite shuts down **Oct 16 2026** (inside the build window) and its successor costs ~2.5–3.75× more, so "costs only fall" is false. Plan ~$0.005/clip standard, ~$0.002–0.003 batch+low-res, 20k backfill ≈ $40–70 batch (still trivial vs WTP). **Pin model versions in golden-set metadata; re-run eval when the SKU turns.** Twelve Labs Pegasus stays the reference bar (10–30× cost), never a price anchor. (Fix the stale <18MB inline threshold → <100MB.)
**Deliverable:** the two-lane pipeline design, open schema (v1, versioned), model/prompt/grounding strategy, cost model at 5k/10k/20k on 3.1 Flash-Lite.

### 7.A.5 Grounding authority set (D3 — TMDB/Spotify APIs are OUT)
- **Film/TV → Wikidata QIDs** (CC0; carries TMDB/IMDb/Letterboxd IDs as link-out properties). **TMDB's API is non-commercial-only** (+$149/mo commercial, + an LLM/chatbot clause hitting the MCP surface) → do **not** call it; deep-link out instead. Wikidata is already in `grounding.ts`'s `KbSource` union.
- **Music → MusicBrainz MBID** (built + tested). **Spotify's Feb-2026 lockdown** (dev Premium, 1 client ID, 5 users) makes its API unusable → keyless `open.spotify.com` deep-links only.
- **Places → Google Places** with **written SKU discipline** (IDs-only search → Essentials details on top-k → cache) — IDs-only SKUs are unlimited-free; naive Pro calls cost ~10×.
- **Remove TMDB + Spotify keys from provisioning.**

### 7.B Resilient capture + processing
Adapters: TikTok (proven), **Instagram (ZIP-primary + the live spike)**, X-bookmarks (same interception pattern — the lowest-risk platform). Study gallery-dl/twitter-web-exporter/yt-dlp clean-room (license-aware). **Apify is public-content-only → managed-tier fallback for re-enriching *public* URLs, cannot see a private saved collection.** The **resumable, memory-bounded offscreen job queue** (checkpoint, SW-death revival, 429 backoff, bounded concurrency) is the #1 correctness risk. Eager posters; verify the Gemini File API path for large clips.
**Deliverable:** capture adapters, resumable-queue design, storage + eager-poster pipeline, and **the live-IG spike result** (does the logged-in saved view fire an interceptable XHR; single blob vs streamed JSON-lines; shape stability over weeks).

### 7.C Business model + the split agency surface (Fable owns the modeling)
Direction = hybrid. **Recommended shape (D6):** free local/BYO-key tier (~$0 COGS) + a **one-time ~$39–49 "full-library run"** implemented internally **as credits** (Dewey's proven acute-moment mechanic; top-ups reuse the rail; heavy libraries metered) + a **$6–8/mo managed tier** for continuous processing + sync. **Agency split (D5):** the **personal MCP + open schema ship in v1** (cheap — serves already-local data); the **agency bulk-analysis API is deferred** (it needs the server-side ingest posture the architecture deliberately deleted + auth/metering/billing/abuse/ops, into a market whose commodity floor is now **$29/mo BYOK-unlimited**). Strike the old $0.80–$2/video B2B anchors. Build the §7.I backend API-ready so the agency surface is a later config, not a rebuild.
**Deliverable:** the model + unit economics on 3.1 Flash-Lite + tier definitions + the personal-MCP spec + the deferred-agency gate.

### 7.D Product/UX + design system (corrected stack)
- **Surface (D10):** **extension-hosted library** (MV3 `unlimitedStorage` exempts the origin from quota *and* eviction) + stateless web doorways for SEO + the personal MCP; posters ride the encrypted sync store (§7.I) — **kill the "web for library" phrasing**, there is no poster server.
- **Library refs:** Apple Photos (unified zoom, shared-element open) + mymind (search-first). **Corrected tech (D11):** **View Transitions API** for the grid→detail morph (now Baseline; Motion `layoutId` fights virtualized grids — keep Motion for micro-interactions only); a **custom row-based justified virtualizer on TanStack Virtual**; ThumbHash LQIP; **Base UI drawer** (Vaul is unmaintained); cmdk; Sonner.
- **Design method:** multi-tool **divergence → convergence**, **code as source-of-truth** (oklch tokens + shared React kit in the repo; Figma is the *review* surface via the official Claude Code→Figma flow, not the SoT). Never one-shot. All copy humanized.
- **IA:** inherit doc 05's mechanics (post/save/referent model, lenses, provenance strip) but **not** its DECIDE-first landing (that was conditioned on the dropped validation test) → **library-first**.
- **Anti-slop is a hard requirement** (no default faces/AI-purple/cookie-cutter/happy-path-only; a real signature element; designed empty/loading/error states).
**Deliverable:** surface architecture, IA + flows, from-scratch design system/tokens, hi-fi mockups of key screens + states.

### 7.E Brand & identity (from scratch)
**Propose an availability-checked name shortlist** (naming delegated to Fable; founder picks) + a distinctive verbal/visual identity, POV, brand kit. Premium/trustworthy/personal, not AI-slop. Its own convergent sprint, run **first** (it's wall-clock-bound and blocks repos/domains/CWS/copy).
**Deliverable:** name shortlist → founder pick → brand kit + voice.

### 7.F Build system + open-core topology
- **WXT** (one-command Chrome/Firefox/Edge submit + MV3 dev ergonomics). Swap `declarativeNetRequest` → **`declarativeNetRequestWithHostAccess`**. `.env.master` + generation script; deploy-is-a-command; centralized tokens; CI/lint/test. The lean Claude-Code OS (CLAUDE.md exists) + a platform-breakage runbook. **Avoid elaborate agent/process scaffolding.**
- **Distribution (D12):** Edge Add-ons + Firefox AMO + dev-mode ZIP as last resort — **self-hosted CRX install is blocked on Chrome (Win since v33 / macOS since v44), so "own-store" is not a fallback.** Early minimal CWS dry-run listing.
- **Open-core carve (D13):** private app repo is SoT; cut a **fresh, clean, secret-scanned public engine repo** (history verified clean — secrets never committed) when the grounding interface stabilizes. **Replace `fixtures/sample-items.json` (real TikTok usernames/URLs) with synthetic fixtures before the carve.**
**Deliverable:** repo/env/deploy/tooling architecture + the solo-founder operating system + the publish pipeline.

### 7.G Growth: SEO/AEO (a contested channel, not a moat)
"One product, many doorways" `{platform}×{intent}`, each with **genuine per-page utility answering a query no sibling answers** (Google's March-2026 core update enforces scaled-content abuse algorithmically — there is **no published "60% unique" threshold**, so bar it on *unique data + real utility*). The linkable differentiator is the **accuracy/grounding** content. AEO conversion multipliers are **~1.2–4.4×** (the 11–23× figure was one outlier property). Cold-start via CWS/Product-Hunt/subreddits/comparison pages.
**Deliverable:** SEO/AEO architecture + doorway template + cold-start plan.

### 7.H Evaluation & quality (the wedge made real — engine quality, not user validation)
Per-capability scorecard vs a **version-locked golden set**, six axes, with **grounding-to-external-ID the flagship published metric.** **v1 slice (D15):** **promptfoo** CI gate (grounding-ID exact-match, NIL accuracy, schema validity, Recall@k on the ~106 seed) + a **zero-cost replay harness** (frozen VLM outputs + frozen KB candidate sets); defer any LLM-judge until an axis needs it, then validate (Cohen's kappa + swap-debias — raw agreement inflates 33–41 pp). **Re-stratify the golden set on the REAL 4,661-item corpus** (likes vs favorites = different intent; 47% lack VTT; median 29s; 17% slideshows) **before any labeling** — labeling on the stale 1,313 distribution version-locks the wrong world. **Open-source the harness.**
**Deliverable:** the eval system design + v1 slice + the re-stratified golden-set plan.

### 7.I Cross-device sync (D7 — in-house zero-knowledge)
Build **in-house zero-knowledge encrypted-blob sync**: per-item LWW + tombstones over **client-side AES-GCM** (passphrase-derived key) on R2/Supabase — all mainstream sync engines are server-plaintext and disqualified by the posture. **Posters ride the same encrypted store** (resolves the §7.D poster tension — no poster server). **One backend serves sync + managed inference + the personal MCP, agency-ready.** Open-schema export stays the free portability lane.
**Deliverable:** the sync model + the spike result (client-side encrypt/decrypt + push/pull/conflict) + the unified backend topology.

## 8. Constraints & the telemetry resolution (D8)
- **Trust is architecture, visible:** zero remote code, minimal host-permissions, OSS engine as the privacy policy, single-purpose framing, never "downloader." Treat CWS review (multi-week, one appeal) as a design constraint.
- **Telemetry (resolving the old §7.B-vs-§8 self-contradiction):** three measurement planes that never touch extension content — **cookieless doorway analytics + CWS dashboard stats + managed-tier server events** (a consented server relationship) — plus an **opt-in, default-OFF, content-free adapter-health ping** solely for capture breakage, and a visible "report broken capture" flow. **Publish the posture; explicitly accept unmeasured free-tier engagement.**
- Local-first free tier; `navigator.storage.persist()`; designed for platform breakage; humanized copy everywhere. Compliance by design (personal-use, own-data, client-side).

## 9. What already exists (current)
- **BUILT + tested (`src/lib` = engine SoT):** the framework-agnostic TS engine + the **grounding module** (`grounding.ts` + MusicBrainz resolver, 61 tests green). Shell still runs `src/gemini.js` → **META-12: wire `src/lib` in** (real integration — nothing yet produces `Mention` objects or a prod LLM selector).
- **BUILT (spike):** MAIN-world TikTok capture (now **source-tagged** favorites/likes/posts + **content-visibility pruning**); the **real 4,661-item `attic-favorites.json`** (source-tagged; 71% likes-only; median 29s; 53% subtitles; 17% slideshows) = the dev corpus. **Alt+Shift+E enrichment is disabled** (its `web_accessible_resources` exposure was a key-leak — removed; the exposed Gemini key must be rotated).
- **Prompts:** `prompts/observe_video*.md`.
- **Prior repos:** `attic-saas` + `attic-sandbox` **archived** (reference only). Repo `github.com/s0shaheen/attic` (private, pushed; rename to the brand).
- **DESIGNED, NOT built:** MV3 shell wiring, resumable queue, storage/poster pipeline, library UI, sync, personal MCP, licensing, all visual identity.

## 10. Provisioning (founder-only; parallel — none blocks Fable starting)
- 🔴 **Rotate the exposed Gemini key** (into `src/secrets.js`). A **logged-in IG session** for the §7.B spike; an **IG "Download Your Data" ZIP**. Fresh **IG/X capture** at spike time.
- 🟡 **Google Places** key (billing; SKU-disciplined). A **Twelve Labs** free account (benchmark ref). An **OSS-inference account** (Together/Fireworks/HF) once Fable pins the local-lane model. **(No TMDB / no Spotify — dropped per D3.)**
- 🟡 A **backend** (Vercel + Supabase MCPs = sandbox) for the sync/MCP spike; **CWS dev account** + a **domain**.
- 🟢 **Design taste gut-checks** + the **name pick** from Fable's shortlist.

## 11. Deliverables — definition of done
1. Unified product definition (surfaces, IA, flows). 2. Two-lane engine architecture + open schema + cost model on 3.1 Flash-Lite (§7.A). 3. Capture + resumable-queue + eager-poster design + **live-IG spike result** (§7.B). 4. Monetization model + unit economics + personal-MCP spec + deferred-agency gate (§7.C). 5. From-scratch design system + hi-fi mockups (§7.D). 6. Name shortlist → pick + brand kit (§7.E). 7. Build system + open-core topology + publish pipeline (§7.F). 8. SEO/AEO + doorway template + cold-start (§7.G). 9. Eval system + v1 slice + re-stratified golden set (§7.H). 10. **Sync model + spike result + unified backend topology** (§7.I). 11. **The build-ready, dependency-sequenced plan** (Slice-1 artifact-core fully specified; founder-gate points named; **no timelines**). 12. The repaired "why we still win" (§4) + the open-core plan (licensing; gallery-dl GPL / cobalt AGPL boundaries).

## 12. How Fable operates (standing instructions)
- Ground-up, but **evaluate the built engine as evidence** — don't regenerate `src/lib`.
- **Run the three spikes FIRST** (live-IG interception; sync encrypt/push/pull; the native-video-vs-VTT pipeline experiment) — their results gate scope (D4) and lock the backend (D5/D7) before the rest converges.
- **Multi-tool, iterative, convergent** (design + brand): diverge, converge, never one-shot.
- **Phase with founder gates** — end each hard-problem block with a defended recommendation + the founder decisions/provisioning it needs; default and proceed where the call is obvious.
- Converge to a **plan, not code** (except the spikes). Re-verify 2026-current numbers before hardcoding. **No timelines/effort estimates.** Bias to shipping, not apparatus.

## 13. Story anchors (preserve + showcase)
The **content-understanding standard** (open grounded schema + the two-lane pipeline + the published grounding-to-external-ID metric + the open eval harness — artifacts no competitor publishes). Supporting, all real: "stop trying to sign the request" (passive interception); deleting a server tier with evidence (client-side fetch); cost-as-architecture; defining + measuring "quality" for grounded short-form video; trust engineered into the manifest (incl. catching + closing a live key-exposure); killing the moat you built (cutting the agent, discarding ~80% of a codebase). Keep a running story log.
