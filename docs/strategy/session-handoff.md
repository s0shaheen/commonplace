# RESUME POINTER (read me first after a /clear)

> **⚠ LOCAL PATH CHANGED (2026-07-09 eve):** the working directory was renamed `~/Dev/attic-extension` → **`~/Dev/commonplace`** (matching the project rename). If a session launches in the old path and fails, `cd ~/Dev/commonplace`. Remote unchanged: `github.com/s0shaheen/commonplace`.

**Operating contract lives in `CLAUDE.md`** (repo root, auto-loaded) — Frame / Truth / Verdict. The `memory/` notes hold the *why*.

> ## ▶ EXECUTION PLAN: `docs/strategy/roadmap.md`
> After reading this pointer, go to the roadmap — it's the single from-here-to-launch plan (phases, founder gates, the provisioning punch-list, how to run it). To drive the build, say **"execute the roadmap"**. Governing spec = `docs/specs/product-specification.md`; schema = `knowledge-ontology.md` v3; eval = `evaluation-methodology.md`; standard = `knowledge-organization-standard.md`.

## STATE (2026-07-06, evening) — the re-founding is done; SPEC v5 governs; next = BUILD

**`docs/specs/product-specification.md` (v5) is THE single governing document.** Written by Fable from intention down at the founder's directive ("start with the intention and work your way from there… get this whole thing ready to just go and build"). It supersedes `archive/superseded/fable-brief-v4.md` (v4) and everything before it. A build session starts at product-specification.md and should not need to re-decide anything.

What SPEC v5 settles (evidence: `2026-07-06-refounding-research.md`, 7 Fable research tracks, 2026-07-06 + `archive/superseded/fable-phase1-findings.md`):
- **Intention layer:** the humanist thesis as 5 architectural commitments; three founder goals resolved (trust/craft > usefulness > revenue); five measurable best-in-class bars.
- **Name (G1 pending):** **Commonplace** — "A commonplace book for the video age" (availability-checked; shortlist + collision scans in the research file). Attic stays as repo codename until G1.
- **Prices (G3 pending):** Free (100 hosted signup credits) · **$39 Deep Scan** (5,000 never-expiring credits, Batch API, ~65% GM; top-up $10/2k) · **$7/mo / $60/yr Managed** (annual includes one Deep Scan). Paywall line: "You pay for our compute and our servers — never for your data."
- **Design (G2 pending):** **Paper & Proof** — Literata + IBM Plex Mono, no grotesque sans, rubrication-red accent, oklch tokens specified, motion constitution, provenance strip as the signature component, design constitution checked into repo.
- **Distribution (corrected):** CWS search PRIMARY (myfaveTT proves the intent at 100k installs) · Reddit ignition SECONDARY (r/DataHoarder, Karakeep-shaped) · published-eval + one Show HN TERTIARY · **Product Hunt = zero hours** · doorways in miniature only (2–4 real utility pages).
- **Demo arc:** scripted 90s (capture-posture first, receipts + NIL beat, "map every restaurant in my saves" via MCP — the query Quiki's text-blob MCP can't answer).
- **Build sequence:** Block 0 spikes (IG-live · zero-knowledge sync · native-vs-VTT) → 1 artifact core → 2 library+design system → 3 platforms → 4 sync+money → 5 MCP → 6 public artifacts (accuracy page BEFORE launch) → 7 launch. Gates G1–G5. **No timelines anywhere, ever.**

**Verified this session (2026-07-06):** 61/61 engine tests · 8/8 capture tests · corpus = 4,661 items (fav 1,367 / likes 4,132 / posts 2; ∩ 840) · live grounding demo re-run (berlioz → MBID conf 1.00; 7 honest NILs).

## Next move: BUILD — Block 0 (in motion since 2026-07-06 evening)

## CURRENT (2026-07-09 eve): PHASE 3 COMPLETE — next = Phase 2 pilot prep, Phase 4 in parallel

**Phase 3 CLOSED (final whole-branch review: Ready to merge YES).** All 9 tasks + rc.6 + one final fix wave (e9a527f) on main: capture→analyze→ground→library-data→export end-to-end, kill-surviving offscreen queue, open-schema export Ajv-valid against rc.6 with per-record `extractor_ref` provenance, promptfoo replay + 3-job CI, submit-ready (NOT submitted) CWS package + key-exposure audit. 145 vitest + 8 capture + 198 pytest green. Ledger (`.superpowers/sdd/progress.md`) holds the Phase-4/5 backlog of accepted minors — trust it over memory.

**FOUNDER QUEUE (nothing blocks silently):** ① ratify the per-record `extractor_ref` ruling (final review found the plan's uniform export stamp mislabels mixed-lane libraries; fixed to derive from `rec.analysis` — provenance-first-class governs); ② confirm contact email `hello@commonplacehq.com`; ③ listing name keeps "Search" (SPEC §18 keyword trade) while the dry-run build has no search UI — deliberate, roadmap-labeled; ④ dev-manifest name must change before any PUBLIC listing; ⑤ live Chrome smokes (steps in task-6 + task-7 reports); ⑥ Places key; ⑦ CWS $5 account; ⑧ G2 design pick (gates Phase 5).

**Next build move:** Phase 2 pilot prep (auto-label ~150-video stratified pilot → founder spot-check gate) and/or Phase 4 (prompt tuning + native-vs-VTT ablation — needs the eval instrument, which exists). Process: superpowers SDD loop per DEC-027; plans → `docs/plans/`; decisions → `docs/decisions/decision-log.md`.

**2026-07-09 also:** repo renamed `attic`→`commonplace` (GitHub + package.json; local folder still `~/Dev/attic-extension`); docs restructured to the `docs/README.md` IA (kebab-case convention enforced); founder briefing artifact published.

## (superseded) 2026-07-08: Phase 1 COMPLETE
Phase 1 (schema freeze + eval harness) is done and final-reviewed: `schema/` (JSON Schema 1.0.0-rc.5, SHACL base+TikTok, JSON-LD context, facet vocab, fixtures) + `eval/` (`commonplace_eval`, 194 tests green: matcher, per-layer metric matrix, Φ_c, bootstrap CIs, calibration, scorecard CLI) + `eval/construct.md` + `eval/guidelines.md`. Status log + carry-forwards live in `roadmap.md`. Next unchecked phases: **Phase 3** (wire engine into MV3 shell — AUTO; Places resolver waits on the API key) and **Phase 2 prep** (pilot gold set auto-label → founder spot-check gate).

## (superseded 2026-07-08 — kept for lineage) Block 0.5 — Eval Foundation (the engine's real first work)

Capture + backend feasibility are done (IG-live + zero-knowledge sync spikes PASS). But the **pipeline experiment (native-vs-VTT) was retracted** — it was run before any eval instrument existed (ad-hoc ontology, exact-string matching, no ground truth → uninterpretable). Founder correction: *"think like an ai engineer/scientist… don't skip steps."* → **Block 0.5 now precedes the engine build.** Two governing docs written (cited research in `_RESEARCH-eval-method-*` + `_RESEARCH-ontology-*`):
- **`evaluation-methodology.md`** — instrument-before-experiment; the full sequence (construct → ontology+schema → guidelines → gold set dev/**sealed-test** → validated matcher/metric → prompt-on-dev → freeze → ablations → report-once); nervaluate matching, GERBIL/ELEVANT grounding, Φ_c asymmetric headline, smECE, cluster-bootstrap CIs, solo-annotator protocol.
- **`knowledge-ontology.md`** (+ `knowledge-ontology-hierarchy.txt`) — the ONE ontology, answering the founder's "how do we capture ideas/concepts/subjects/services/jobs": **four Referent kinds — NamedEntity (→instance ID, flagship) · Concept (→subject vocabulary, hierarchical) · Claim (→proposition, faithfulness) · StructuredContent (→schema.org slot-filling) — + Facets (the original 8-facet IP)**, on doc-03's WEMI/SKOS spine. Scorecard = per-layer **matrix**, never one blended number. Grounding authorities licensing-checked (Wikidata/IPTC/ESCO/O*NET/LCSH/MeSH; reject Dewey/UDC/TMDB-API).

**ONTOLOGY v3 COMMITTED (2026-07-07, founder-approved).** v2 was stress-tested categorically per the founder's directive: a live-web census of every major platform's content types + non-platform cases (web pages, bare links, local files) → **32 archetypes, 45 gaps (14 blocking), all folded** (`2026-07-07-media-census.md`). Headline v3 fixes: identity de-URL-ed (handle union + content hash; admission = identity+savedAt only), mediaKind +audio/document/file, children/membership plurality, workRef (Work level: DOI/ISBN/podcast-GUID), depicts recursion edge (screenshot-of-a-tweet), lifecycle+captureFidelity, selectors completed (PDF/EPUB), Save annotations/scope/per-source timestamps, signal language+translations, platform-native authority tier, the Observation pattern. **The teaching companion — the 16-step derivation with 15 rules — is `schema-derivation-walkthrough.html`** (also the artifact the founder can present from). **v1 populate-cut: decided by pilot data, not assumption** ("Recipe-only" retracted). Annotation = auto-label + founder spot-check (chosen); 2nd-labeler seed at publish-time.

**Next concrete steps (Block 0.5):** freeze the JSON schema + SHACL shapes from `knowledge-ontology.md` v3 → annotation guidelines (`guidelines.md`) → matcher + per-layer metric harness (open-source) → ~150-video pilot gold set (auto-label + spot-check; its distribution sets the v1 populate-cut) → then prompt iteration + the (re-run, valid) native-vs-VTT ablation. Block 1 (`src/lib`→MV3 wiring) proceeds in parallel where it doesn't touch the ontology (capture, queue, storage).

### (superseded) earlier framing: "Block 0 complete → Block 1"

**Block-0 status (2026-07-07) — all 3 spikes DONE:**
- ✅ **Spike #1 IG-live: PASS** (`spikes/ig-live/RESULT.md`) — saved view fires `GET /api/v1/feed/saved/posts/` (200, single JSON blob, `max_id` cursor, enrichable `{media}`); REST-cursor not GraphQL-doc_id (no rotation tax); constructing 400s → passive-observe only. **G4 → live-IG PROMOTED to a v1 headline lane.** IG DYD ZIP schema verified richer than assumed (`URL·Caption·Title·Hashtags·Owner`/post + collections; fixture `fixtures/ig-saved-sample.json`).
- ✅ **Spike #2 zero-knowledge sync: PASS both legs** (`spikes/sync-zk/RESULT.md`) — protocol (200 items) + **remote on live Supabase Postgres** (50 items, authed user + RLS, 6/6 incl. server-blindness verified at the storage layer). Remote leg caught+fixed a real seq-bump bug. **Backend LIVE in `attic-dev`** (`schema.sql`: `sync_items` + RLS + trigger) = the one project for sync + managed inference + MCP.
- ✅ **Spike #3 pipeline experiment: PASS — decisive** (`spikes/pipeline/RESULT.md`, 54 clean pairs, `gemini-2.5-flash-lite`). native-video vs keyframes+VTT: **jaccard 38%** → strongly complementary, not equivalent. Union 42% richer than native alone; keyframes ~8.4× cheaper; native has a reliability tail (one clip hung). **Decision:** confidence-routed cascade — keyframes+VTT default → native escalation → fuse for the golden set. No native-video vendor lock (open lane viable). Folded into SPEC §13/§15.

**Landed this session:** G1 ✅ **Commonplace** (domains available; founder buying) · Gemini key rotated+verified · Supabase authed, `attic-dev` restored + sync backend live · **Claude Design brief** (`docs/design/claude-design-brief.md`) · IG export ingested (gitignored) → both ZIP importers scoped for Block 3.

**Remaining unblocks:**
- 🟡 Claude Design diverge session (founder refining) → **G2 pick**.
- 🟡 Drop the **TikTok DYD ZIP** when ready · **Google Places** key (SKU-disciplined) · **CWS dev account** · **G3** price signature before Block 4.
- 🟢 **Block 0 is closed.** Next = **Block 1 — the artifact core:** wire `src/lib` into the MV3 shell end-to-end (capture→analyze→ground→library-data→export), resumable offscreen queue, both lane adapters (cascade per §13), Wikidata+Places resolvers, open schema v1 + export, promptfoo eval slice in CI, early minimal CWS dry-run. No founder gate blocks starting it.

**Repo:** `github.com/s0shaheen/attic` (private). Docs: product-specification.md (governing) · 2026-07-06-refounding-research.md + archive/superseded/fable-phase1-findings.md (evidence) · _ENGINE-groundup (engine method; stale corpus stats) · dossier 00–08 (reference) · archive/superseded/fable-brief-v4.md v4 + GATE0 docs (superseded).

**No background workflows running.**
