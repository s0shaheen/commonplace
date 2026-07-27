# Design — capture-control-plane

## The precise bug (verified in code, 2026-07-27)

`scrollState.ts:163` — a `page_captured` with `hasMore:false` transitions **unconditionally** to `done`. It is the only path to done, and it trusts the platform's claim with no context.

`completeness.ts:43` — `if (inp.terminalDone) return "done"`. A `hasMore:false` terminal **overrides** the declared-count corroboration entirely; the `suspicious` short-fall check only runs when there was *no* terminal.

So a well-formed 2xx `hasMore:false` at full velocity (the live fake-done: 5,191 captured, `+24 items/s`, `hasMore:true` one beat prior, then a black screen) sails straight to `done`. And the ratio guard cannot save it: 5,191 / 5,989 = **86.7%**, above the 85% tolerance. **A ratio check alone does NOT fix this.** The distinguishing signal is *velocity + vitality*: a genuine end-of-list decelerates and the cursor exhausts; this arrived at full speed with `hasMore` flipping true→false in one beat, immediately followed by non-vital/empty pages.

## Approach — a classifier that gates `done`, plus one recovery spine

### 1. `captureState.ts` — observed-state classifier (pure reducer, new)

`classify(inputs) → ObservedState` ∈ `PROGRESSING | STALLED_VITAL | NOT_VITAL | CHALLENGED | CLAIMED_DONE`. Inputs are facts already available:
- `hasMoreClaim` (from the page) — **evidence only**
- `velocity` — recent per-tick growth rate + whether the immediately prior page had `hasMore:true` while growing (the fake-done fingerprint)
- `transportSignal` (`ok | http_error | challenge | api_error | offline | empty_ok`) from `interceptParse.ts`/`main-world.js`
- `vitality` (grid renders vs blank) from `pageClear.ts`
- `overlay` / `banSignal` from `overlayClassifier.ts` / `banGuard.ts`
- `captured` vs `declared` from `completeness.ts` / `declaredCount.ts`

Corroboration rule for `CLAIMED_DONE`: a `hasMore:false` is **corroborated** (→ genuine done) only when it is NOT at full velocity (the stream had already decelerated / cursor stopped advancing) OR the captured count reconciles with declared/ZIP ground truth. A `hasMore:false` that lands mid-velocity, or is followed by a vitality drop / consecutive `empty_ok`, is **uncorroborated** → routes to the spine, never to `done`.

### 2. `recoverySpine.ts` — one budgeted path (new)

`step(state, budget) → continue | nudge | reload_resume | pause_for_human | verdict`. Reuses machinery that already exists:
- `reload_resume` = the supervisor's existing resume path (`resuming:true`, resume-from-cursor). One reload per source per run; full-jitter backoff.
- `pause_for_human` on `CHALLENGED` = the existing overlay/challenge pause; auto-resume on next healthy arrival.
- `verdict(done)` only on corroborated `CLAIMED_DONE`; `verdict(incomplete, reason)` when the budget is spent — honest, persisted, never "done".

This is also the resume-after-flag discriminator: reload+resume proceeds past the wall ⇒ it was a session flag (spine handled it); re-walls at the same cursor ⇒ hard cap ⇒ honest incomplete + the ZIP/enrichment lane covers the tail.

### 3. Integration (surgical, preserve the 519 green tests)

- `completeness.ts`: `terminalDone` no longer unconditionally wins. Add a `terminalAtVelocity` input; a terminal that arrives at full velocity AND is unreconciled is `suspicious`, not `done`. Existing callers that pass no velocity default to today's behavior (backward-compatible).
- `scrollState.ts`: the `hasMore:false` branch consults the classifier's corroboration instead of absorbing `done` directly; an uncorroborated claim yields a new non-terminal `claimed` status that the glue routes to the spine. Keep every existing transition intact for the corroborated/normal paths so current tests still pass.
- The glue (`background.ts` / `content.js`) feeds velocity + transport + vitality into the classifier and executes the single spine command.

## Testing (TDD — write these first, watch them fail, then implement)

- **The fake-done regression (the headline test):** replay the live shape — steady growth at velocity with `hasMore:true`, then one 2xx `hasMore:false` at 86.7% of declared followed by a vitality drop — and assert the run does NOT reach `done`; it routes to `reload_resume`, then to `suspicious`/incomplete if it re-walls.
- Classifier: every state; corroborated vs uncorroborated `CLAIMED_DONE`; the velocity fingerprint in both directions.
- Spine: reload once per source; budget exhaustion → incomplete-with-reason; challenge freezes counters and auto-resumes.
- completeness: terminal-at-velocity-unreconciled → suspicious; genuine decelerated terminal → done; no-velocity caller unchanged.
