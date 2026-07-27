# Tasks — pilot-gold-set

## 1. Stratified sampler
- [x] 1.1 `eval/gold/sample.py` — deterministic stratified sample over the corpus; strata = hasSubtitles × isSlideshow × duration tercile + content buckets; oversample rare; emit stratum + weight
- [x] 1.2 Seed the hard slice (cover songs, chain restaurants, ambiguous titles, non-English on-screen text)
- [x] 1.3 Carve the 15–20% blind holdout, disjoint + flagged
- [x] 1.4 Tests: proportions, determinism-under-seed, oversampling, hard slice present, holdout disjoint

## 2. Media + pre-annotation
- [ ] 2.1 Resolve + fetch media for the sample (reuse the shipped tikwm/enrichment path) — NOT built. The review tool links out to the video instead of embedding it (design.md: "no video-player plumbing"), so adjudication does not block on this. The `content.transcript` / `content.on_screen_text` fields are plumbed sampler → suggestions → review tool and render when present; nothing populates them yet.
- [ ] 2.2 Pre-annotate with **Claude** (different family; Anthropic key) → `suggestions.json` with candidate KB IDs; record the family used — BUILT + unit-tested against a recorded response, never run: `ANTHROPIC_API_KEY` is absent. `gold/preannotate.py` fails with an actionable message rather than silently substituting a family.
- [x] 2.3 Blind rows get NO suggestions

## 3. Review tool (founder-time optimization)
- [x] 3.1 Self-contained HTML reviewer: per-item view, keyboard-first accept/correct/add, autosave/resume
- [x] 3.2 ID verification gate — candidate IDs link to MusicBrainz/Wikidata/Maps and cannot be marked verified unless opened; capture verification snapshot + KB snapshot date
- [x] 3.3 Explicit NIL capture; blind mode (suggestions withheld)
- [x] 3.4 Writes `gold.jsonl` in the harness's existing gold schema

## 4. Wire to the harness
- [x] 4.1 Gold records pass `schema_gate.validate_gold_record`
- [x] 4.2 End-to-end smoke: fixture gold + pred → `commonplace_eval score` → scorecard
- [x] 4.3 Run the harness's matcher-validation so the instrument is validated before claims rest on it — run and locked as a regression baseline (n=12, P=R=F1=0.833, tp=5 fp=1 fn=1 tn=5). **Short of §4's ~100 judged pairs**; the missing 88 need a human's judgment, so scaling is a founder task (see 5.0).

## 5. Adjudication (FOUNDER GATE — the only human-blocking step)
- [ ] 5.0 Judge ~88 more matcher match/non-match pairs so the matcher's own P/R is measured on the methodology's ~100, not 12
- [ ] 5.1 Stage 1: adjudicate ~60 videos → unblocks paired model/prompt benchmarking
- [ ] 5.2 Stage 2 (later): scale to ~150 dev for stable absolute figures
- [ ] 5.3 Stage 3 (later): sealed test ~350 for the published claim — opened once

## 6. Green
- [x] 6.1 `npm test` (722) + `npm run typecheck` (clean) + `npm run eval:test` (303, was 198) green
- [x] 6.2 `openspec validate pilot-gold-set --strict` passes
