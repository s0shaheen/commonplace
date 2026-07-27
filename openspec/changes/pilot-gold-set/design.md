# Design — pilot-gold-set

## Pipeline

```
corpus (4,661 favorites + DYD index)
   │  1. stratified sample  (+ seeded hard slice, + 15–20% blind holdout)
   ▼
sample.jsonl ──► 2. enrich+fetch media (existing lanes) ──► 3. pre-annotate with CLAUDE (suggestions)
                                                                   │
                                                                   ▼
                                              4. REVIEW TOOL (founder: confirm / correct / add / verify IDs)
                                                                   │
                                                                   ▼
                                                    gold.jsonl (harness schema) ──► existing commonplace_eval
```

## 1. Stratified sampler (pure, tested)

Strata from the methodology: `hasSubtitles` (53% of corpus) × `isSlideshow` (17%) × duration
terciles, with entity-type coverage enforced by targeting the corpus buckets we measured
(food/place, tech/startup, film/TV, sports, music, dark-matter-no-caption). Oversample rare
strata; store the stratum + sampling weight on each row so the overall figure can be reweighted.
Deterministic given a seed (recorded), so the sample is reproducible.

**Seeded hard slice** (ambiguous-name seeding, per §3): cover songs vs originals, chain
restaurants (which "Joe's Pizza"?), ambiguous film/TV titles, and non-English on-screen text.
These are where a confident-wrong ID is most likely — exactly what Φ_c punishes.

## 2. Pre-annotation with a different model family

Pipeline = Gemini, so pre-annotator = **Claude** (methodology §5.1 — avoids correlated errors and
self-preference; a Gemini pre-annotator grading a Gemini pipeline would inflate agreement).
Same task, same ontology, output as *suggestions* with confidence. Also emit candidate KB IDs to
verify (never accepted automatically). Requires an Anthropic key; the runner is pluggable so the
family can change if that key is unavailable — but the substitution must be recorded on the
artifact, because it weakens the independence claim.

## 3. The review tool (the founder-time optimization)

A single self-contained HTML file (no server, no account, no deploy) that loads
`suggestions.json` and writes `gold.jsonl`:

- one item per screen: poster/video link, caption, transcript, on-screen text, and the suggested
  mentions/concepts/facets/claims as editable chips;
- **keyboard-first**: accept-all, accept-one, reject, edit surface/type, add missed entity, next —
  the founder should never need the mouse for the common path;
- each candidate ID renders as a link to its authoritative record (MusicBrainz / Wikidata /
  Google Maps) and cannot be marked verified without being opened — the methodology's "never
  accept an ID by name similarity", enforced by the UI rather than by discipline;
- captures NIL explicitly (a first-class label, not an absence);
- **blind mode** for the 15–20% holdout: identical UI, suggestions withheld, so the recall gap
  vs the assisted pass measures pre-annotation bias;
- autosaves progress so a session can be abandoned and resumed (bounded sittings, per the plan).

## 4. Output contract

`gold.jsonl` in the harness's existing gold schema (validated by `schema_gate.validate_gold_record`
— reuse it, do not invent a second format), one record per video, carrying: mentions
(surface + aliases + type + external ID **or explicit NIL**), concepts, facets, claims,
structured, plus per-label `verification {name,address,lat,lng,url}` and KB snapshot dates, plus
the stratum/weight and whether the row was blind-labelled.

## 5. Scoring

Nothing new: `commonplace_eval` already implements the per-layer matrix (linking P/R/F1, NIL-F1,
Φ_c, hierarchical concept F1, facet macro-F1 + κ, calibration smECE, cluster-bootstrap CIs). This
change only has to emit gold in the shape it already reads. **Also run the harness's own
matcher-validation** (~100 human-judged match/non-match pairs) so the instrument is itself
validated before any claim rests on it.

## Testing

- Sampler: strata proportions honored, deterministic under seed, rare strata oversampled, hard
  slice present, blind holdout disjoint.
- Gold records validate against `schema_gate.validate_gold_record`.
- Review-tool round-trip: suggestions → simulated edits → gold.jsonl parses and scores.
- An end-to-end smoke: a tiny fixture gold + pred through `commonplace_eval score` produces a
  scorecard.
