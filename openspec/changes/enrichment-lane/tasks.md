# Tasks — enrichment-lane

## 1. Pure cores
- [x] 1.1 `src/lib/enrich/tierPolicy.ts` — `tierPolicy(missing, setting, quota) → lane|skip|exhausted` + exhaustive tests
- [x] 1.2 `src/lib/enrich/merge.ts` — absent-never-overwrites-present field fill + tests
- [x] 1.3 A common `EnrichResult` shape + each adapter's pure `normalize()` (payload → partial CapturedItem)

## 2. Lane adapters (glue + parser tests)
- [x] 2.1 `oembed.ts` — official endpoint, retry/pace; normalize test against a captured oEmbed fixture
- [x] 2.2 `tikwm.ts` (PRIMARY) — 1 req/s, daily-cap quota signal; normalize test against a response fixture
- [x] 2.3 `apify.ts` (BACKUP) — token from config, used only on tikwm failover; normalize test
- [x] 2.4 `ownSession.ts` — permalink worklist driven through the capture control plane (classifier + spine); intercept the signed envelope incl subtitleUrl

## 3. Pipeline integration
- [x] 3.1 `needsEnrichment` detection + an `enriching` stage before `analyzing` (checkpointed, resumable, idempotent)
- [x] 3.2 Eager poster/subtitle byte fetch via mediaFetch; reuse banGuard/pacing
- [x] 3.3 `config.ts` — enrichment-tier setting (off / free / depth / paid) + optional Apify token

## 4. Green
- [x] 4.1 `npm test` + `npm run typecheck` green; existing tests unaffected
- [x] 4.2 `openspec validate enrichment-lane --strict` passes

## 5. Live provider verification (founder/pilot-time)
- [ ] 5.1 Verify oEmbed/tikwm/Apify against real saved URLs on the founder's corpus (live calls not runnable in the build env; adapters are fixture-tested here)
