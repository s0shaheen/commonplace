# Evaluation — delta spec (change: pilot-gold-set)

## ADDED Requirements

### Requirement: Gold is sampled, never pooled from system output
The system SHALL build the gold set from a stratified sample of the real corpus, and SHALL NOT
construct gold from the union of pipeline outputs, so that recall is not inflated by pooling bias.

#### Scenario: Sampling is reproducible and stratified
- WHEN the sampler runs with a recorded seed
- THEN it SHALL produce the same sample, honoring the transcript/slideshow/duration strata with rare strata oversampled and each row carrying its stratum and reweighting weight

#### Scenario: A hard slice is deliberately seeded
- WHEN the sample is drawn
- THEN it SHALL include ambiguous cases (cover songs, chain restaurants, ambiguous titles, non-English on-screen text) where a confidently wrong ID is most likely

### Requirement: Pre-annotation uses a different model family than the pipeline
The system SHALL pre-annotate with a model family different from the one under evaluation, SHALL
treat those annotations strictly as suggestions, and SHALL record on the artifact which family
was used.

#### Scenario: Suggestions never become gold on their own
- WHEN pre-annotations are produced
- THEN no suggestion SHALL enter the gold set without explicit human adjudication

### Requirement: Every gold ID is verified against its authoritative record
The system SHALL require that each external identifier is confirmed by opening its authoritative
record, SHALL store a verification snapshot and KB snapshot date with the label, and SHALL treat
"no match" (NIL) as an explicit first-class label rather than an absence.

#### Scenario: An ID cannot be accepted on name similarity alone
- WHEN a candidate identifier is presented for a mention
- THEN it SHALL NOT be markable as verified until its authoritative record has been opened

#### Scenario: NIL is recorded, not omitted
- WHEN a mention has no correct entry in the knowledge base
- THEN the gold record SHALL carry an explicit NIL label for it

### Requirement: Pre-annotation bias is measured, not assumed
The system SHALL label a blind subset (15–20%) with suggestions withheld, so the recall gap
between assisted and blind labelling quantifies pre-annotation bias.

#### Scenario: Blind subset is disjoint and identifiable
- WHEN the sample is drawn
- THEN the blind subset SHALL be disjoint from the assisted set and flagged on each record

### Requirement: Gold feeds the existing harness unchanged
The system SHALL emit gold records in the schema the existing evaluation harness already
validates and scores, rather than introducing a second format.

#### Scenario: Gold validates and scores
- WHEN a produced gold file is passed to the harness with a prediction file
- THEN it SHALL validate against the gold-record gate and produce the per-layer scorecard
