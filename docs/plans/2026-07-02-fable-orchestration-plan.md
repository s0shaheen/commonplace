# Fable Session — Orchestration Plan

> **SUPERSEDED 2026-07-02 → `docs/archive/dossier/09-fable-orchestration.md`.** Folded into the grounded dossier. Start at `docs/archive/dossier/README.md`.

```
Date:    2026-07-02
Pairs with: docs/archive/early-specs/2026-07-02-product-rebuild-brief-for-fable.md (the WHAT)
Purpose: The HOW — exactly how to run the Fable 5 design + architecture session so it
         produces the §11 deliverables at maximum depth, using the available tool/agent
         stack, converging (not one-shotting), and staying in the founder's loop.
Audience: Fable 5 (as the driving model) + the founder supervising.
```

## A. How Fable should operate (standing instructions)

1. **Orchestrate, don't solo.** For every substantive phase, fan out parallel subagents / dynamic workflows (understand → design → adversarially verify → synthesize). Use the widest set of tools per task; reach for the expert reference in each domain.
2. **Iterate and converge; never one-shot** — especially brand/design (generate multiple directions, critique, converge) and the analysis system (prototype → benchmark → refine on the real corpus).
3. **Adversarially verify** load-bearing claims and designs (independent skeptic agents; majority-refute kills a finding). The v1 brief itself was hardened this way.
4. **Prototype to decide** when a deterministic answer isn't available (run the pipeline on the 106-item corpus; A/B prompts/models; build a throwaway grid to feel the UX). Use the `playground` skill for interactive explorers.
5. **Avoid the two known failure modes:**
   - *Workflow placeholder pathology* (observed twice in pre-work): forced-StructuredOutput research agents emit dummy values (`"test"/"a"/"b"`) or hit the retry cap. → Prefer **free-text research agents** (parse prose yourself) OR hardened schema + an explicit "no placeholders; shallow = failure" instruction; keep schemas shallow to avoid truncation.
   - *Over-planning* (the founder's documented 63%-strategy/6%-building trap): every phase ends in a concrete artifact + a founder gate; bias toward shipping the v1 slice over an ever-growing spec.
6. **Stay in the loop:** each phase has a founder review gate. Don't chain past a gate without sign-off.
7. **Model/tool routing:** heavy reasoning/judge/synthesis → strongest tier; mechanical extraction → cheaper tier. Re-verify 2026 model versions/pricing before hardcoding.

## B. Pre-flight scaffolding (do NOW, before the Fable session)

- **Security:** rotate the leaked Supabase + OpenAI keys (brief §13).
- **Back up** the un-versioned assets (brief §13).
- **Declare `src/lib` the engine source-of-truth**; deprecate the divergent spike `src/gemini.js` schema.
- **Confirm the §0.5 assumed decisions** with the founder (goal, time, scope-phasing, IG lane, analysis ambition, delivery, B2B, eval scope).
- **Install the vetted must-have skills** (brief §10): frontend-design (enable the disabled plugin), web-design-guidelines, mcp-builder, webapp-testing. Add nice-to-haves as phases need them.
- **Add domain MCP servers** (vet via Glama first): Deepgram, fal, Replicate, Apify, a Google Maps MCP. (Canva/Figma/Vercel/Exa/Playwright/chrome-devtools already connected.)
- **Two cheap unblocking probes** (both now runnable): IG live-capture feasibility via Playwright/chrome-devtools (quantify what live adds vs ZIP); Gemini File API >18MB upload path. Note the settled fact: TikTok item-list capture needs a live signed page context (tab + human-paced scroll) — background credentialed fetch is proven for MEDIA only, so the real capture question is "minimize/automate the scroll session," not "remove the tab."
- **Stand up the eval seed:** load the ~106 labeled items + `results/`/`fixtures/` as the golden-set seed and a bench script that hits the `src/secrets.js` Gemini key — so Phase 1 can benchmark from minute one.

## C. Phased session plan (each phase = a workflow + a founder gate)

**Phase 0 — Frame & decide (short, founder-in-the-room).**
Lock §0.5. War-game the moat: a small judge panel answers "why do we still win in 12 months after Albo/Dewey copy the obvious?" and separates sprint-cloneable (prompt/ontology) from compounding (resolved-entity data, experience, export-out/API, distribution). Output: locked objective + the moat thesis. Gate: founder sign-off on scope + wedge.

**Phase 1 — Analysis system + eval (THE core IP; do this first and deepest).**
- *Design* (parallel judge panel of 3 architectures: multi-stage deterministic / multi-stage + agentic verification / ensemble-routing) → score against cost, quality-measurability, maintainability → synthesize the winner (brief §7.A).
- *Prototype + benchmark* on the 106-item corpus: run candidate pipelines/models (Gemini Flash-Lite via the local key; OSS Qwen2.5-VL/whisper.cpp via Ollama; optionally Twelve Labs Pegasus as the reference bar) and score on the six-axis scorecard (brief §7.H). Adopt Pegasus schema-driven-segmentation + VidFactScore patterns.
- *Converge* on: the pipeline, the open schema (v1), the grounding resolver + per-surface correctness rules, and the v1 eval slice.
- Tools: Exa (research), Ollama/vLLM + fal/Modal (run models), promptfoo/DeepEval/Ragas + Langfuse (eval), the Gemini key (bench). Gate: founder reviews the pipeline + a real benchmarked quality report.

**Phase 2 — Capture + storage + resilience.**
Design adapters (TikTok proven; IG ZIP-primary + probe; X-bookmarks intercept), the resumable offscreen queue, eager-poster pipeline, large-library multi-session capture UX. Clean-room study gallery-dl / twitter-web-exporter / cobalt (respect GPL/AGPL for the open-core boundary). Run the IG probe. Resolve the extension-only-media → surface constraint (feeds Phase 3). Tools: Playwright/chrome-devtools (probe), the OSS capture repos, Apify MCP. Gate: founder reviews the capture + storage architecture + probe result.

**Phase 3 — Product/UX + design system (multi-tool, iterative, never one-shot).**
- *References + IA:* Claude-in-Chrome captures Apple Photos / mymind / Family; Lucid for flows/journeys.
- *Diverge:* Claude Design + Vercel v0 + Figma Make each generate MULTIPLE directions for the key screens/states (10k+ grid, tile→detail morph, command palette, empty/loading/error).
- *Converge:* promote the winner into Figma as the token + component source-of-truth (oklch light+dark, distinctive display + neutral body face, restrained motion, a signature element); Claude Design imports the system + self-checks.
- *Implement + QA:* Claude Code owns code (Motion, TanStack Virtual, ThumbHash); Claude-in-Chrome QAs at 60fps against captured references. Enforce Rauno's Web Interface Guidelines + Emil Kowalski's animation bar. Humanize all copy.
- Gate: founder picks the direction; reviews hi-fi mockups + states.

**Phase 4 — Brand & identity sprint (convergent).**
Multi-round name generation → availability gauntlet (GoDaddy domains; Exa/WebSearch trademark screen + note lawyer-deferred; manual social-handle + Chrome-Web-Store name check) → distinctive verbal + visual identity + kit + voice. Run early (blocks repos/domains/store/copy). Gate: founder commits the name + kit.

**Phase 5 — Business model + pricing.** Fable models product→ops→cost→pricing across candidate structures (one-time / subscription / usage-credits / hybrid) with unit economics at 5k/10k/20k libraries + competitor economics (brief §7.C); recommends one. Gate: founder approves the model.

**Phase 6 — GTM: SEO/AEO + cold-start.** Doorway matrix + template spec (≥60% unique + live utility), AEO canonical guides + schema, comparison pages, the cold-start motion (CWS SEO / PH / Reddit). Tools: Exa (keyword/landscape), `ai-seo` skill. Gate: founder approves the growth architecture + day-1 checklist.

**Phase 7 — Maintainable build system + Claude-Code OS.** `.env.master` + gen script, two-env setup, deploy-is-a-command, centralized tokens, CI/lint/test, lean `CLAUDE.md`, project slash commands (brand/architecture/eval rules), resilience runbook, tiered-MCP integration plan. Gate: founder approves the operating system.

**Phase 8 — Synthesize → build-ready plan.** Fold all phases into a **phased implementation plan** (v1.0 core → v1.1 IG/X → v1.2 API/MCP → v1.3 OSS) fit inside the founder's time/$ envelope, with the **real-user retrieval kill/pivot tripwire** as the release valve and the open-core plan. Gate: founder approves; hand to build (executing-plans / subagent-driven-development).

## D. Guardrails & definition of done
- Every phase produces a concrete artifact + passes a founder gate; no silent scope growth.
- The analysis wedge is proven by **published eval numbers**, not claims (Phase 1 is non-negotiable depth).
- v1 stays inside the time/$ envelope; if a phase balloons, cut scope to the phased v1, don't extend the spec.
- Design converges through multiple tools/directions; brand is never a single generation.
- Done = the §11 deliverables exist, the moat-durability answer is written, and the build-ready phased plan has a retrieval tripwire.
```
Terminal state: hand the approved phased plan to a build session (superpowers:executing-plans /
subagent-driven-development), TDD-first, with the eval harness gating in CI.
```
