# Capture — delta spec (change: capture-control-plane)

## ADDED Requirements

### Requirement: Observed-state classification
The system SHALL classify capture progress from sensor facts into exactly one observed
state — PROGRESSING, STALLED_VITAL, NOT_VITAL, CHALLENGED, or CLAIMED_DONE — via a single
pure reducer, and no individual sensor SHALL independently terminate a run.

#### Scenario: New items arriving
- WHEN the per-run unique-item delta increased within the recent window
- THEN the observed state SHALL be PROGRESSING and capture continues

#### Scenario: Self-inflicted lazy-load stall
- WHEN no new items arrived AND no list request was even issued AND the grid still renders content
- THEN the observed state SHALL be STALLED_VITAL (routed to a bounded motion nudge, not a giveup)

#### Scenario: Challenge or ban signal
- WHEN a ban signal fires OR a captcha/login overlay is detected
- THEN the observed state SHALL be CHALLENGED regardless of any completion claim

### Requirement: Completion requires corroboration
The system SHALL treat a platform completion claim (`hasMore:false`) as evidence only, and
SHALL mark a run `done` ONLY when the captured count corroborates the source's declared
count on a healthy final page (or reconciles against an imported ZIP index).

#### Scenario: Well-formed false "done" at full velocity
- WHEN a healthy 2xx response reports `hasMore:false` immediately after full-velocity growth (the prior page had `hasMore:true` while the count was still climbing), and the captured count is not reconciled against declared/ZIP ground truth
- THEN the run SHALL NOT be marked done; it SHALL route to the recovery spine (even when the captured/declared ratio is within the normal tolerance)

#### Scenario: Corroborated completion
- WHEN `hasMore:false` arrives on a healthy final page after the stream has decelerated (no full-velocity growth in the prior page) OR the captured count reconciles with declared/ZIP ground truth
- THEN the run SHALL be marked done

### Requirement: Single recovery spine
The system SHALL respond to a recoverable bad state through one budgeted, idempotent path
(checkpoint, reload, resume-from-cursor), with at most one reload-resume per source per run
and full-jitter backoff, never an unbounded retry loop.

#### Scenario: Suspect completion recovers via reload-resume
- WHEN the state is an uncorroborated CLAIMED_DONE or NOT_VITAL and the reload budget is not exhausted
- THEN the spine SHALL checkpoint, reload, and resume from the last cursor exactly once for that source

#### Scenario: Challenge pauses for the human
- WHEN the state is CHALLENGED
- THEN the spine SHALL freeze the giveup/stall counters, notify the user, and auto-resume on the next healthy arrival

### Requirement: Honest incompleteness
The system SHALL, when the recovery budget is exhausted without corroborated completion,
record a persisted, reason-labeled incomplete outcome that is never presented or exported
as "done".

#### Scenario: Hard cap reached
- WHEN a reload-resume re-walls at the same cursor and the budget is exhausted
- THEN the run SHALL be recorded as incomplete with a reason and the captured-vs-declared shortfall surfaced
