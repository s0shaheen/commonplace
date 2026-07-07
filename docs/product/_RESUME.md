# RESUME POINTER (read me first after a /clear)

**Operating contract lives in `CLAUDE.md`** (repo root, auto-loaded) — Frame / Truth / Verdict. The `memory/` notes hold the *why*.

## STATE (2026-07-06, evening) — the re-founding is done; SPEC v5 governs; next = BUILD

**`docs/product/SPEC.md` (v5) is THE single governing document.** Written by Fable from intention down at the founder's directive ("start with the intention and work your way from there… get this whole thing ready to just go and build"). It supersedes `_FABLE-BRIEF.md` (v4) and everything before it. A build session starts at SPEC.md and should not need to re-decide anything.

What SPEC v5 settles (evidence: `_RESEARCH-2026-07-06.md`, 7 Fable research tracks, 2026-07-06 + `_FABLE-PHASE1-findings.md`):
- **Intention layer:** the humanist thesis as 5 architectural commitments; three founder goals resolved (trust/craft > usefulness > revenue); five measurable best-in-class bars.
- **Name (G1 pending):** **Commonplace** — "A commonplace book for the video age" (availability-checked; shortlist + collision scans in the research file). Attic stays as repo codename until G1.
- **Prices (G3 pending):** Free (100 hosted signup credits) · **$39 Deep Scan** (5,000 never-expiring credits, Batch API, ~65% GM; top-up $10/2k) · **$7/mo / $60/yr Managed** (annual includes one Deep Scan). Paywall line: "You pay for our compute and our servers — never for your data."
- **Design (G2 pending):** **Paper & Proof** — Literata + IBM Plex Mono, no grotesque sans, rubrication-red accent, oklch tokens specified, motion constitution, provenance strip as the signature component, design constitution checked into repo.
- **Distribution (corrected):** CWS search PRIMARY (myfaveTT proves the intent at 100k installs) · Reddit ignition SECONDARY (r/DataHoarder, Karakeep-shaped) · published-eval + one Show HN TERTIARY · **Product Hunt = zero hours** · doorways in miniature only (2–4 real utility pages).
- **Demo arc:** scripted 90s (capture-posture first, receipts + NIL beat, "map every restaurant in my saves" via MCP — the query Quiki's text-blob MCP can't answer).
- **Build sequence:** Block 0 spikes (IG-live · zero-knowledge sync · native-vs-VTT) → 1 artifact core → 2 library+design system → 3 platforms → 4 sync+money → 5 MCP → 6 public artifacts (accuracy page BEFORE launch) → 7 launch. Gates G1–G5. **No timelines anywhere, ever.**

**Verified this session (2026-07-06):** 61/61 engine tests · 8/8 capture tests · corpus = 4,661 items (fav 1,367 / likes 4,132 / posts 2; ∩ 840) · live grounding demo re-run (berlioz → MBID conf 1.00; 7 honest NILs).

## Next move: BUILD — Block 0 (in motion since 2026-07-06 evening)

## ✅ BLOCK 0 COMPLETE (2026-07-07) — all three spikes PASS; next = Block 1

**Block-0 status (2026-07-07) — all 3 spikes DONE:**
- ✅ **Spike #1 IG-live: PASS** (`spikes/ig-live/RESULT.md`) — saved view fires `GET /api/v1/feed/saved/posts/` (200, single JSON blob, `max_id` cursor, enrichable `{media}`); REST-cursor not GraphQL-doc_id (no rotation tax); constructing 400s → passive-observe only. **G4 → live-IG PROMOTED to a v1 headline lane.** IG DYD ZIP schema verified richer than assumed (`URL·Caption·Title·Hashtags·Owner`/post + collections; fixture `fixtures/ig-saved-sample.json`).
- ✅ **Spike #2 zero-knowledge sync: PASS both legs** (`spikes/sync-zk/RESULT.md`) — protocol (200 items) + **remote on live Supabase Postgres** (50 items, authed user + RLS, 6/6 incl. server-blindness verified at the storage layer). Remote leg caught+fixed a real seq-bump bug. **Backend LIVE in `attic-dev`** (`schema.sql`: `sync_items` + RLS + trigger) = the one project for sync + managed inference + MCP.
- ✅ **Spike #3 pipeline experiment: PASS — decisive** (`spikes/pipeline/RESULT.md`, 54 clean pairs, `gemini-2.5-flash-lite`). native-video vs keyframes+VTT: **jaccard 38%** → strongly complementary, not equivalent. Union 42% richer than native alone; keyframes ~8.4× cheaper; native has a reliability tail (one clip hung). **Decision:** confidence-routed cascade — keyframes+VTT default → native escalation → fuse for the golden set. No native-video vendor lock (open lane viable). Folded into SPEC §13/§15.

**Landed this session:** G1 ✅ **Commonplace** (domains available; founder buying) · Gemini key rotated+verified · Supabase authed, `attic-dev` restored + sync backend live · **Claude Design brief** (`docs/design/CLAUDE-DESIGN-BRIEF.md`) · IG export ingested (gitignored) → both ZIP importers scoped for Block 3.

**Remaining unblocks:**
- 🟡 Claude Design diverge session (founder refining) → **G2 pick**.
- 🟡 Drop the **TikTok DYD ZIP** when ready · **Google Places** key (SKU-disciplined) · **CWS dev account** · **G3** price signature before Block 4.
- 🟢 **Block 0 is closed.** Next = **Block 1 — the artifact core:** wire `src/lib` into the MV3 shell end-to-end (capture→analyze→ground→library-data→export), resumable offscreen queue, both lane adapters (cascade per §13), Wikidata+Places resolvers, open schema v1 + export, promptfoo eval slice in CI, early minimal CWS dry-run. No founder gate blocks starting it.

**Repo:** `github.com/s0shaheen/attic` (private). Docs: SPEC.md (governing) · _RESEARCH-2026-07-06.md + _FABLE-PHASE1-findings.md (evidence) · _ENGINE-groundup (engine method; stale corpus stats) · dossier 00–08 (reference) · _FABLE-BRIEF.md v4 + GATE0 docs (superseded).

**No background workflows running.**
