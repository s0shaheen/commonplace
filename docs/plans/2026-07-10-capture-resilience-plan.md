# Capture Resilience — Execution Plan

> **Governing spec:** `docs/specs/capture-resilience.md` (the failure register, gaps, invariants, domain solutions). This is the **ordered, stable** build sequence — later work slots into these waves without reshuffling. Extends Phase 2A (`docs/plans/2026-07-09-capture-hardening-and-autopilot.md`); the Phase-2A pure-core-behind-thin-glue pattern and SDD loop (DEC-027) carry forward. **Process:** superpowers SDD; Opus implementer subagents, Fable reviewers (per `subagent-model-policy`); each task = a committed, tested, reviewed artifact; ledger in `.superpowers/sdd/progress.md`.

## How to read this

Tasks are grouped into **waves** by dependency + leverage, not by domain. Each task names the **failure IDs** (from spec §3/§4) it closes and its **done-when**. A wave is a barrier only where noted; within a wave, tasks are largely parallel-safe. The invariants in spec §5 bind every task. Exit criteria = spec §7.

**Cardinal rule for this plan (stability):** every task lands behind a **pure, unit-tested decision core** (injected `now()`/`rng()`), so the failure surface keeps shrinking in a legible, regression-guarded way. No task may reintroduce a false "done," silent data loss, or a bot-tell.

---

## Wave A — the four criticals + the live-run unblockers (do first)

These block a clean unattended run and a trustworthy live test. **A1 and A2 are the gate to re-testing capture at all.**

- **A1 · Scroll-motion engine** — closes SCROLL-01, SCROLL-03, COMPL-04, PACE-03. New `src/lib/capture/scrollMotion.ts` (pure reducer: `stepping|retriggering|stalled` → `down|retrigger|stall|backoff`; the `requestIssued` motion-vs-throttle discriminator); `main-world.js` bumps a monotonic `tiktokRequestsIssued` on `item_list` initiation; `content.js` glue rewrite (`wheelBy` incremental transit, `maxSafeUpPx`, `waitForContent`), delete `nudgeToBottom`'s teleports; evidence-adaptive giveup; full-jitter backoff + toString-mask + drop console banner. `scrollState.ts`/`pacing.ts` logic unchanged — only their inputs cleaned. **Done-when:** the 12 scroll acceptance criteria (spec §6.1) pass, incl. a live >1,400-item run reaching `done`/count-justified-`giveup` with zero teleports and a forced-stall recovering via `retrigger` without entering `scrollState.wait`.
- **A2 · Storage self-healing + halt-loud** — closes STORE-01, S-SW-1 (partial), S-DB-2, S-SW-8. Store-existence assertion after open → contains-guarded idempotent `version+1` reopen → `deleteDB`+rebuild fallback; never memoize a rejected open; an unrecoverable DB HALTS capture + surfaces to popup (no swallowed-write-as-done); oldVersion-driven migration ladder + `{blocked,blocking,terminated}` handlers; `count = await db.count()` reconciliation on every SW/run start; legacy-migration clear-in-`finally` + `migratedLegacy` flag. **Done-when:** a planted store-less/corrupt DB self-heals or halts loudly with an export-then-reset path; a v1→v2 migration from a populated v1 DB is tested green before any bump.
- **A3 · Idempotent resumability alarm** — closes S-SW-4. Register `cp_queue_revive` via `alarms.get`-guard / `onInstalled`+`onStartup` only; never unconditional top-level `create()`. **Done-when:** the revive alarm demonstrably survives repeated sub-minute cold starts under steady capture traffic (unit + a driven check).
- **A4 · Honest completion guards** — closes COMPL-01, COMPL-02, INJ-02 (the completion half). Typed transport signal from the interceptor (`ok|http_error|challenge|api_error|offline`); accept `hasMore:false` as done only on a healthy 2xx non-challenge page; pin the real `hasMore`/`cursor` field from a **live `item_list` fixture** + read all plausible keys + a conservative secondary terminal; route 403/redirect → "session expired", challenge → pause+prompt. **Done-when:** injected 403/redirect/captcha/offline each produce their distinct terminal (never "done"); the real field names are pinned by a committed fixture.

*Wave-A live proof (founder session, after A1–A4): a clean remove+reload of the extension (resets my earlier DB corruption), then a real Likes/Favorites capture driven via CDP trusted wheel — confirm the scroll fix, flat memory, honest completion, and the pinned field names.*

---

## Wave B — high-severity resilience (after A)

- **B1 · Interceptor liveness + drift self-check** — DRIFT-02. Grid-populated-but-zero-arrivals ⇒ loud "endpoint drifted" diagnostic; broaden matcher (item_list + GraphQL ops); harden the wrap (non-writable, dual fetch+XHR, Worker-scope investigation).
- **B2 · Eviction hardening + DOM ceiling** — EVICT-01. Scan past decorator front-children; live-tile-count basis; multi-pattern selectors; generic "remove oldest N of the tallest scroller" fallback + a DOM-node ceiling alarm.
- **B3 · Monotonic coalescing merge** — S-DD-1. `capturedAt`/version stamp; field-by-field `preferDefined` coalesce so absence never overwrites presence and a stale straggler never clobbers fresh signed URLs; always union sources.
- **B4 · Poison-pill quarantine + atomic job completion** — S-RS-5. `reviveCount`→quarantine past a ceiling; guard the crash-prone keyframe step (size/duration limits); short-circuit already-grounded; job→done in the same tx as `saveGroundings`.
- **B5 · Completeness accounting + honest-incompleteness report** — COMPL-07, SUP-04. Per-run captured **delta** as `scroll_done.captured`; robust localized saved-count parser; captured/expected surfaced; refuse "done" (mark "suspicious") on a grossly low ratio; persisted post-run report.
- **B6 · Autonomous target + sub-tab nav robustness** — SUP-02, SUP-05. Persist own handle/secUid from an intercepted `item_list`; navigate `/@handle` before driving; gate the toggle until a handle is known; locale-independent tab handles; wait-for-target-source's-first-arrival instead of the fixed sleep; structured popup outcome for every Sync.
- **B7 · Export at scale** — EXP-01. All exports via the offscreen Blob path; `lastError` checked; first-class popup export button; bundle poster bytes or omit unresolved refs.
- **B8 · Cursor/index storage perf** — S-DB-8, S-DB-3. Answer "work remains" via index/openCursor early-exit (no `getAll` on the alarm path); short synchronous write-only txs (reads→in-memory merge→chunked ≤500); a `needsPoster` flag/index.

---

## Wave C — the unattended-overnight gaps (after A/B; this is where "resilient + intelligent" is won)

- **C1 · Background-tab / visibility resilience** — the big gap. Detect `document.hidden`/discarded/throttled tab → pause+notify (freeze giveup), keep the driven tab foregrounded or drive by an occlusion-surviving mechanism; handle App-Nap/on-battery throttling.
- **C2 · Single-active-driver lease + per-run isolation** — CONC-01 + gap. Persisted TTL lease (navigator.locks/meta); per-run/per-tab progress (own arrivals + own new-id delta); reserve the shared `count` for display only.
- **C3 · Liveness watchdog + run deadline** — gap. A proof-of-progress heartbeat (not merely "still scrolling") + an overall wall-clock deadline so a hung loop can't silently hang an unattended run.
- **C4 · Storage persistence + eviction detection** — S-DB-5 + gap. `navigator.storage.persist()` at startup + popup warning; a library-integrity startup check that notices a vanished corpus (never phantom-done off a stale count); poster bucket isolation.
- **C5 · Signed-URL freshness on wake** — S-RS-3. Heartbeat timestamp; on wake past the URL TTL, re-capture fresh signed URLs before media fetch; classify expired vs transient vs dead.
- **C6 · Resumability-spine race fixes + keep-alive** — S-OS-1. getContexts-guarded offscreen creation; offscreen self-kick on load; keep-alive Port during drains; per-consumer try/catch; persisted "running" leases.
- **C7 · Anti-block circuit-breaker + conservative default cap** — gap + PACE-03 remainder. Ban/soft-block detection → immediate halt; conservative-by-default rate cap; adaptive slowdown on rising inter-arrival latency (AIMD keyed on latency).
- **C8 · Preflight self-test** — gap. Before an unattended run: logged-in · own profile · DB healthy · interceptor live · storage headroom → refuse/warn instead of grinding four sources to giveup.
- **C9 · Chrome-restart / update re-drive** — gap. Re-open the TikTok tab, re-inject, re-drive the persisted `current` after a browser relaunch/session-restore; fail-stop the content script on "context invalidated."

---

## Wave D — correctness tail, cross-platform seam, and scale economics (after C)

- **D1 · Wall-clock → monotonic + onMessage port hygiene** — ENV-01. Monotonic elapsed for staleness/backoff (clamp negatives); `return true` only on the async branch; validate `createTime` magnitude.
- **D2 · Corpus reconciliation** — gaps. Cursor-precise resume where possible; tombstoning of unfavorited/removed items; detect list mutation (new-at-top/reorder) between runs so the moving window can't skip items.
- **D3 · Analysis-lane cost & throughput** — gaps. A per-run/lifetime **spend ceiling** + spend telemetry + halt-on-budget; bounded concurrency to actually drain a corpus-scale backlog; typed LLM error classes (401/RESOURCE_EXHAUSTED/safety/oversized); skip-already-done idempotency.
- **D4 · Account/identity provenance** — gap. Tag every captured item + supervisor checkpoint with owner account; scope resume to the matching account; keep multi-account corpora distinguishable.
- **D5 · Platform adapter seam** — XPLAT-01. The adapter interface (sources · interception matcher · navigation · normalizer · platform/saveKind mapping); `Source` per-adapter; `platform` threaded through the open schema — the seam Instagram (live + DYD ZIP) builds on. (IG itself remains a later phase; this only lays the seam so the "lane-generic" claim is real.)
- **D6 · Export/read consistency** — gap. A read-consistency guard so an export snapshot can't serialize a torn mid-write view.

---

## Sequencing & integration notes

- **Wave A is the only hard gate.** It restores a trustworthy live run; everything after is resilience-hardening that a working capture can absorb incrementally.
- **This plan supersedes Phase 2A §8's remaining scope** (the old §8 scroll assumptions are retracted by spec §6.1). Phase 2A Tasks 0–5 stay as landed; their reducer/pacing/eviction cores are reused, not rebuilt.
- **The Phase-2 pilot corpus** (roadmap Phase 2A→2 dependency) is produced by the Wave-A live proof run — so Wave A also unblocks the gold-set work.
- Each wave closes with a ledger entry and, at natural boundaries, a whole-branch review + a roadmap status-log line. On completion the roadmap's Phase 2A entry is replaced by "Capture Resilience (spec + plan)".

## Provenance

Ordered from the 2026-07-10 `capture-resilience-audit` (28 ranked failures + 17 gaps + 18 capability gaps) synthesized in `docs/specs/capture-resilience.md`.
