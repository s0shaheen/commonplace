# Tasks — capture-control-plane

## 1. Observed-state classifier
- [x] 1.1 `src/lib/capture/captureState.ts` — pure `classify(inputs) → ObservedState` reducer (combinational: no now/rng needed — decision is a total function of sensor facts)
- [x] 1.2 Exhaustive unit tests: every state, both directions of the requestIssued discriminator, the corroboration gate

## 2. Recovery spine
- [x] 2.1 `src/lib/capture/recoverySpine.ts` — `step(state, input, budget, deps) → command`; idempotent reload-resume, full-jitter backoff (now/rng injected)
- [x] 2.2 Unit tests: reload once per source; budget exhaustion → incomplete-with-reason; challenge freezes counters

## 3. Wire the supervisor
- [x] 3.1 Glue drives off the corroboration gate: `content.js` computes velocity + reconciliation and routes an uncorroborated completion to reload-resume (reusing the supervisor's resume-from-cursor), never `done`; `supervisor.ts` sequencing unchanged (design non-goal), it records the spine's verdict via `scroll_done`
- [x] 3.2 declaredCount/completeness corroboration fed into the CLAIMED_DONE gate — `scrollState.ts` (`claimed`), `completeness.ts` (`suspicious`), and `background.ts` (final `assessCompleteness` gate)

## 4. Regression + proof
- [x] 4.1 Scripted fake-done (hasMore:false at velocity, no corroboration) must NOT reach `done` (regression test — `fakeDone.test.ts` + captureState/scrollState/completeness suites)
- [x] 4.2 `npm test` + `npm run typecheck` green (568 tests pass; typecheck clean)
- [x] 4.3 `openspec validate capture-control-plane --strict` passes

## 5. Remaining verification (founder-machine — not runnable in the build env)
- [ ] 5.1 Live proof run: unattended capture of the ~6k-item real library reaches a corroborated `done` or a count-justified, reason-labeled incomplete — never a false "done" (capture-resilience.md §7, exit criterion #8). This exercises the untested content.js/main-world.js glue end-to-end.
