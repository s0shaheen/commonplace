# Proposal — capture-control-plane

## Why

The live full-library run (2026-07-13) proved the one failure the current capture cannot survive: at item 5,191 of 5,989, TikTok returned a well-formed 2xx response with `hasMore:false` — a lie — and the extension accepted it as "done," 798 items short. The audit (`docs/specs/capture-resilience.md`) mapped 28 ranked failures behind this. The individual sensors it prescribed are already built and unit-tested (`banGuard`, `overlayClassifier`, `completeness`, `declaredCount`, `scrollMotion`, `sessionRecovery`, `pageClear`, `watchdog`, `lease`, `deadline`, `backgroundTab`, `pacing`, `preflight`, …). What is missing is the part that failed: a single place that treats the platform's completion claim as **evidence, not truth**, and one recovery path they all feed. Today those sensors are wired ad hoc; there is no unifying classifier and no single spine, so a well-formed false "done" still slips through.

## What changes

- **ADD an observed-state classifier** (`captureState.ts`, pure reducer): sensor facts in → one of `PROGRESSING · STALLED_VITAL · NOT_VITAL · CHALLENGED · CLAIMED_DONE`. Existing sensors are demoted to inputs; none of them individually ends a run.
- **ADD one recovery spine**: checkpoint → reload → resume-from-cursor, idempotent, budgeted, backoff — the single response to a recoverable bad state, replacing scattered per-case nudges.
- **MODIFY completion at its two real sites**: `scrollState.ts` (the `hasMore:false ⇒ done` transition at line 163) and `completeness.ts` (the `terminalDone`-wins override at line 43). A `hasMore:false` that arrives at full velocity and is unreconciled becomes a non-terminal claim that routes to the spine — not `done`. The discriminator is velocity + vitality, not the captured/declared ratio (the live fake-done was 86.7%, inside the 85% tolerance).

Non-goals: no new sensors (they exist), no engine/schema changes, no enrichment work (that is `enrichment-lane`), no change to source-sequencing in `supervisor.ts` beyond feeding it the spine's verdict.

## Capabilities

- **New capability**: `capture` — the source-of-truth spec for how capture decides progress, completion, recovery, and honest incompleteness. (First OpenSpec capability spec in the repo; deeper mechanism stays in `docs/specs/capture-resilience.md`.)

## Impact

- Code: `src/lib/capture/` (new `captureState.ts` + `recoverySpine.ts`; `supervisor.ts` rewired; `main-world.js` already emits the transport/velocity signals the classifier needs).
- Invariants preserved: read-only own-session, no forged requests, deterministic policy, no bot-hammering, account-safety halt, honest incompleteness (config.yaml + capture-resilience.md §5).
- Exit: an unattended run of the founder's ~6k-item library reaches a corroborated `done` or a count-justified, reason-labeled incomplete — never a false "done".
