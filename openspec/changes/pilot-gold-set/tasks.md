# Tasks — pilot-gold-set

## 1. Stratified sampler
- [ ] 1.1 `eval/gold/sample.py` (or .ts) — deterministic stratified sample over the corpus; strata = hasSubtitles × isSlideshow × duration tercile + content buckets; oversample rare; emit stratum + weight
- [ ] 1.2 Seed the hard slice (cover songs, chain restaurants, ambiguous titles, non-English on-screen text)
- [ ] 1.3 Carve the 15–20% blind holdout, disjoint + flagged
- [ ] 1.4 Tests: proportions, determinism-under-seed, oversampling, hard slice present, holdout disjoint

## 2. Media + pre-annotation
- [ ] 2.1 Resolve + fetch media for the sample (reuse the shipped tikwm/enrichment path)
- [ ] 2.2 Pre-annotate with **Claude** (different family; Anthropic key) → `suggestions.json` with candidate KB IDs; record the family used
- [ ] 2.3 Blind rows get NO suggestions

## 3. Review tool (founder-time optimization)
- [ ] 3.1 Self-contained HTML reviewer: per-item view, keyboard-first accept/correct/add, autosave/resume
- [ ] 3.2 ID verification gate — candidate IDs link to MusicBrainz/Wikidata/Maps and cannot be marked verified unless opened; capture verification snapshot + KB snapshot date
- [ ] 3.3 Explicit NIL capture; blind mode (suggestions withheld)
- [ ] 3.4 Writes `gold.jsonl` in the harness's existing gold schema

## 4. Wire to the harness
- [ ] 4.1 Gold records pass `schema_gate.validate_gold_record`
- [ ] 4.2 End-to-end smoke: fixture gold + pred → `commonplace_eval score` → scorecard
- [ ] 4.3 Run the harness's matcher-validation (~100 judged pairs) so the instrument is validated before claims rest on it

## 5. Adjudication (FOUNDER GATE — the only human-blocking step)
- [ ] 5.1 Stage 1: adjudicate ~60 videos → unblocks paired model/prompt benchmarking
- [ ] 5.2 Stage 2 (later): scale to ~150 dev for stable absolute figures
- [ ] 5.3 Stage 3 (later): sealed test ~350 for the published claim — opened once

## 6. Green
- [ ] 6.1 `npm test` + `npm run typecheck` + `npm run eval:test` green
- [ ] 6.2 `openspec validate pilot-gold-set --strict` passes
