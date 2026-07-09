# Document 09 — Fable Orchestration: Running the Session on This Dossier

**The rule that governs this session:** consume what the dossier already settled, and spend Fable's effort only on the questions it deliberately left open. Each sibling doc was argued to a defended verdict and stress-tested by adversarial critics; re-running that analysis trades a hardened answer for a fresh, weaker one. So Fable prototypes, benchmarks, and converges on the open questions, and treats everything decided as load-bearing input. Call this **evaluate-then-build**. Every choice below enforces the rule; later sections reference it rather than restate it.

This memo uses Rumelt's kernel — diagnosis, guiding policy, coherent action — and Cagan's split of vision from strategy (Doc 01 applies the same spine to the product). Orchestration is strategy and earns the same bad-strategy self-check.

---

## 1. Diagnosis: what this session has to beat

The customer this session ultimately serves is concrete, and naming her keeps everything below honest. She is the heavy saver standing hungry in a neighborhood who needs *the restaurant near me now* pulled out of her own saves; or the person at 6pm who needs *what's for dinner* from the recipes she once saved and can't re-find. The JTBD analysis found that this decision-moment retrieval is the single painkiller in a category of vitamins. So the job Fable exists to make shippable is "resolve my own saves into a real-world action at the moment I need it" — not "organize my archive."

The naive framing — "run a big Claude session to design the product" — wastes the dossier. The real challenge has three faces.

**The substrate invites its own re-derivation.** Hand a capable model the competitive analysis (Doc 03), the JTBD analysis, the taxonomy prior-art, and the platform-model research, and it will re-run what it is reading: re-scan competitors, re-argue painkiller-vs-vitamin, re-invent an ontology. That is pure waste. The competitive teardown already ran Porter and Blue Ocean to a verdict: consumer is a red ocean; the white space is *verifiable, grounded, open*. The JTBD analysis already committed to a POV: the archive is a vitamin, the decision-moment is the painkiller, recipes then restaurants. The taxonomy research already distilled a working methodology from decades of practice. Redoing any of it discards a settled answer for a shakier one.

**The founder has a documented over-planning failure mode.** The brief names it: a 63%-strategy / 6%-building split in prior work. A rich dossier is fuel for that trap. An orchestration that produces more strategy is not neutral; it feeds the exact pathology the build must escape.

**The wedge is "measured quality," so the session cannot merely assert quality.** The analysis engine is not the moat. It is weeks-cloneable: the capture tricks are semi-public, the analysis is one metered Gemini call (~$0.001–0.002/clip), and grounding hits free public APIs — a solo dev ships the obvious MVP in weeks, and VidContext already sells structured video extraction at roughly $0.20 a video. What compounds is the *proof*: a published grounding-to-external-ID accuracy figure, an open eval harness, a resolved-entity index. This has a hard consequence. A session that designs a "high-quality pipeline" by argument, without benchmarking it on real data, would contradict the positioning it exists to serve. Measured accuracy forces the orchestration to be evaluation-first, or it is incoherent.

Stated in one line: **turn a hardened decision substrate and a genuinely-built engine into an evidenced, shipped v1 — without re-litigating what is settled, without ballooning the spec, and with the quality wedge proven in numbers.**

---

## 2. Operating stance: the built engine is the measuring instrument

The 2–5-year north star (Doc 01) is the **content-understanding standard**: an open grounded schema, a multi-stage pipeline, a published grounding metric, an open eval harness — artifacts no competitor publishes. Fable is not that standard. Fable is the session that ships its first credible version.

The users-validation research dissolves the "build-then-show vs. Lean" tension: Ries never banned building, only building *without a falsifiable learning goal*, and for a content-understanding engine the built thing is the only possible measuring instrument. That instrument already exists. The engine is built and tested (54 Vitest, strict TS), the TikTok capture spike is proven, and the repo holds a real 1,313-item corpus, `fixtures/`, ~106 hand-labeled items, and a live Gemini key. So the unit of progress is not research; it is **prototype-and-benchmark** — run the pipeline on the labeled corpus and score it, rather than argue about it.

The stance in one line: the dossier decides *what*, the engine makes *whether-it-works* executable, and Fable closes the gap by measurement and convergence.

---

## 3. Guiding policy: five commitments that narrow the action space

Rumelt's guiding policy is a signpost, not an itinerary — it commits to a direction and to refusals. Normative force is graded explicitly (MUST / SHOULD / MAY).

**(1) Consume the substrate; the only re-open surface is §0.5.** Every founder-locked decision (north-star, TikTok+Instagram at launch, open-core, hybrid monetization, trust-first/local-first, rebrand-from-scratch) is fixed. The sibling-doc verdicts are inputs, not prompts. The only re-openable questions are the eight assumed calls in §0.5 of the brief; Phase 0 exists to confirm them. Anything else re-litigated is scope theft. (One narrow exception — a re-open trigger — is defined in §10.)

**(2) Orchestrate, don't solo.** For each substantive phase, fan out parallel subagents: understand → design → verify → synthesize. This is how the v1 brief itself was hardened. Reach for the widest expert tool per task — including external, uninstalled ones from Glama / mcp.so / PulseMCP, per the founder's R2 directive that the first tooling pass was shallow.

**(3) Evaluate-then-build.** Where no deterministic answer exists, run the thing: A/B prompts and models, throwaway grids to feel the UX, the `playground` skill for explorers. You **MUST** benchmark the pipeline before building anything on top of it — the labeled corpus and live key let Phase 1 benchmark from minute one. This is the direct antidote to the assert-quality incoherence in §1.

**(4) Converge, never one-shot.** The analysis system (prototype → benchmark → refine) and the brand/design (diverge across tools → converge into Figma as token source-of-truth) are the two things it is most tempting to one-shot. You **SHOULD** converge across multiple design tools rather than accept a first generation as a verdict.

**(5) Every phase ends in a concrete artifact behind two gates — an adversarial critic and the founder.** The founder gate is a **MUST**: no phase chains forward without sign-off. The full mechanism — three critic layers, including the empirical eval-and-retrieval tripwire — is defined once in §6.

Refusals are consolidated in §8.

---

## 4. Coherent actions: the phased plan, argued

The phases are sequenced so each de-risks the next. Full mechanics live in the companion plan; the argument for the *shape* is below.

**Phase 0 — Frame and decide (short, founder present).** Lock §0.5 and war-game the moat. The moat war-game is load-bearing: since the engine is cloneable, a judge panel must answer "why do we still win in 12 months after Albo/Dewey copy the obvious?" and separate sprint-cloneable (prompt, ontology) from compounding (resolved-entity index, library experience, export-out/API, distribution). Doing this first points every later phase at the compounding assets. Gate: founder signs off on scope and wedge.

**Phase 1 — Analysis system and eval, first and deepest.** This is the core IP, and the phase that makes the whole strategy coherent. A parallel judge panel weighs three architectures — multi-stage deterministic, multi-stage plus agentic verification, and ensemble-routing — on cost, quality-measurability, and maintainability, then converges on one.

The winner is benchmarked on the ~106-item labeled corpus: the founder's hand-labeled golden subset of the real 1,313-item TikTok corpus already in the repo. Scoring runs against the six-axis scorecard — retrieval, transcription, OCR, generated-analysis faithfulness, classification, grounding. Twelve Labs' Pegasus schema-driven segmentation and VidFactScore faithfulness patterns are adopted as *method*; Pegasus itself **MAY** serve as an optional reference bar, nothing more.

Sequencing this first is non-negotiable. The wedge is measured grounding accuracy, so a real benchmarked quality report must exist before anything builds on it — and everything downstream inherits from here: the schema the UX renders, the entities the resolver links, the costs pricing depends on. Tools: Exa (research-of-record), Ollama/vLLM plus fal/Modal (run models), promptfoo/DeepEval/Ragas plus Langfuse (eval), the Gemini key (bench). Gate: founder reviews the pipeline and the numbers.

The ontology work here consumes the taxonomy prior-art whole rather than reinventing it: a governed controlled core plus an open-tag layer, faceted (Ranganathan) not enumerated, with graceful roll-up (Dublin Core dumb-down; GO True Path Rule), published as SKOS with stable URIs, the durable referent modeled apart from the post and the save (FRBR/LRM), and warrant-based promotion of emergent tags. Doc 04 already did this synthesis — which is exactly why Phase 1 must not re-derive it.

**Phase 2 — Capture, storage, resilience.** After Phase 1, because capture exists to feed it. The platform-model research (Doc 04 appendix) already settled the hard question: model a durable base object over the platforms, demote the raw signed payload to a versioned captured artifact, separate the saved-reference from the referenced content (the YouTube playlistItem pattern), and capture posters eagerly because signed URLs expire in hours. The phase designs the adapters (TikTok proven; IG ZIP-primary plus a live feasibility probe; X-bookmarks intercept), the resumable offscreen queue, and the large-library multi-session capture UX, clean-rooming gallery-dl / twitter-web-exporter / cobalt with GPL/AGPL boundaries respected. Gate: founder reviews architecture and probe result.

**Phase 3 — Product/UX and design system (multi-tool, iterative).** Diverge across Claude Design + Vercel v0 + Figma Make for key screens and states; converge into Figma as source-of-truth; implement in Claude Code (Motion, TanStack Virtual, ThumbHash); QA in Claude-in-Chrome at 60fps against captured Apple-Photos/mymind references. The JTBD verdict shapes the IA: the payoff surface is the decision moment, not the archive — "near me now" for restaurants, "what's for dinner" for recipes — because the archive is the vitamin and resolve-to-action is the painkiller. Gate: founder picks direction; reviews hi-fi states.

**Phase 4 — Brand and identity (convergent), run early and in parallel.** It blocks repos, domains, store listing, and copy, so it cannot be last. Multi-round name generation → availability gauntlet (GoDaddy domains; Exa/WebSearch trademark screen, formal clearance deferred to a lawyer; manual social-handle and CWS-name checks) → distinctive verbal and visual identity. Gate: founder commits name and kit.

**Phase 5 — Business model and pricing.** After capture and analysis, because it needs their real cost structure. Fable models product→ops→cost→pricing across candidate structures with unit economics at 5k/10k/20k libraries, benchmarked against competitor economics — Dewey's public ladder ($7.50/mo Pro, $225 lifetime, a $50 Export Pass, a modeled ~3.75% paid conversion on ~40k users), mymind's $5–13/mo, and the bimodal consumer-vs-B2B WTP — and mirrors the one-time Export Pass for Segment 1. Consumes Doc 05 and the JTBD WTP read (consumers pay grudgingly for painkiller pockets, not for the vitamin) rather than re-deriving demand. Gate: founder approves the model.

**Phase 6 — GTM: SEO/AEO and cold-start.** The doorway matrix and template spec (≥60% unique plus live utility, since Google's 2026 updates deindex thin programmatic pages), AEO canonical guides plus schema, comparison pages, and the cold-start motion (CWS SEO / Product Hunt / Reddit). Consumes Doc 06. The Facade-over-Fake-Door correction is the design constraint: doorways must resolve a handful of items live, to survive Google and to measure true intent. Gate: founder approves the growth architecture.

**Phase 7 — Maintainable build system and Claude-Code OS.** `.env.master` plus gen script, two environments, deploy-as-a-command, centralized tokens, CI/lint/test, a lean `CLAUDE.md`, project slash commands, a resilience runbook. This attacks the founder's #1 friction and installs guardrails against the session's own bloat by keeping the OS lean. Gate: founder approves the OS.

**Phase 8 — Synthesize into a build-ready plan.** Fold every phase into a phased implementation plan (v1.0 core → v1.1 IG/X → v1.2 API/MCP → v1.3 OSS), sized to ~10–20 hrs/wk, with the real-user retrieval kill/pivot tripwire as the release valve. Terminal state: hand the approved plan to a build session (superpowers:executing-plans / subagent-driven-development), TDD-first, eval harness gating CI.

The sequencing in one sentence: prove the IP (1), feed it (2), make it usable and lovable (3) under a committed brand (4), price what it costs (5), route demand to it (6), make it maintainable (7), then commit a build plan (8) — each phase de-risking the next, each ending in a gated artifact.

---

## 5. The do-it-now / Fable-owns / defer-to-build split

Mis-bucketing is how sessions stall or bloat, so the triage is argued, not listed.

**Do-it-now (pre-flight, before Fable opens).** Test: cheap, unblocking, and it makes Phase 1 executable or removes a landmine. You **MUST** rotate the leaked Supabase/OpenAI keys — a security obligation, unrelated to design.

The rest is quick setup. Back up the un-versioned assets. Declare `src/lib` the engine source-of-truth and deprecate the divergent spike schema. Confirm §0.5 with the founder. Install the four must-have skills (frontend-design, web-design-guidelines, mcp-builder, webapp-testing), vetting domain MCPs via Glama first. Run the two cheap probes: IG live-capture feasibility, and the Gemini File API >18MB path.

Stand up the eval seed last, because it is the highest-leverage move: load the ~106 labeled items plus `results/`/`fixtures/`, and wire a bench script that hits the Gemini key. That seed is what lets Phase 1 benchmark from minute one — the difference between evaluate-then-build being real and being aspirational.

**Fable owns (deep design/architecture).** Test: it needs orchestration, judgment, or measurement. Everything in Phases 0–8 requiring divergence, benchmarking, adversarial verification, or convergence — the pipeline and open schema, the resilient capture queue, the pricing model, the design system, the name, the eval slice, the moat-durability answer.

**Defer to the build session.** Test: the decision is made and only disciplined execution remains. TDD implementation, CI wiring, the doorway pages, OSS publication. Fable produces the *plan*; it does not execute, because conflating design and build is how the spec balloons and the 6% stays at 6%.

The bright line between the last two buckets is the retrieval kill/pivot tripwire (§6): Fable's terminal deliverable is a plan *with* the tripwire installed, so the build session cannot proceed on faith past a failed real-user retrieval test.

---

## 6. Grounded-critic gates: the mechanism that keeps the wedge self-consistent

Three concentric critic layers, escalating in stakes. This section is the canonical definition of the gate-and-tripwire mechanism; other sections point here.

**Layer 1 — adversarial verification of claims and designs.** Independent skeptic agents attack every load-bearing finding; a majority-refute kills it. This is the routine gate inside each phase's understand→design→verify→synthesize loop. It carries one specific guardrail seen twice in pre-work — the placeholder pathology, where forced-StructuredOutput research agents emit dummy values or hit the retry cap. Mitigation is policy: you **SHOULD** prefer free-text research agents (parse the prose yourself) or hardened shallow schemas carrying an explicit "no placeholders; shallow = failure" instruction.

**Layer 2 — the founder gate per phase.** No phase chains forward without sign-off (the §3 MUST), and each produces a concrete artifact so the gate is over something real. This is Rumelt's focus made procedural — the structural brake on silent scope growth.

**Layer 3 — the empirical critic: the eval harness and the retrieval tripwire.** Because the wedge is measured quality, the ultimate critic of the *pipeline* is the six-axis scorecard against a version-locked golden set, gating CI, with grounding-to-external-ID as the flagship published metric. The ultimate critic of the *product hypothesis* is the users-validation stack: a task-based retrieval test on 5–10 users' own corpora (NN/g's 5-user rule), the Sean Ellis 40%-"very disappointed" gate at two weeks, and Mom-Test commitment asks (pay / refer / retain) over applause. Fable *designs* these gates and pre-registers their thresholds — for the retrieval tripwire: ≥~70% task success with meaningfully lower time-to-find than the native-app baseline, ≥40% "very disappointed," and ≥1 commitment per satisfied user. The build and validation sessions execute them. **This retrieval tripwire is the canonical kill/pivot gate referenced throughout this memo.**

These gates are not overhead bolted onto the strategy — they are the reason the strategy is internally honest. You cannot claim measured quality as your moat while running a session that only asserts quality. That consistency is the asymmetry §7 names.

---

## 7. We win by evaluating a pre-built engine, not generating from priors

Rumelt asks what asymmetry makes this work where a competitor's approach fails. Here it is: a naive design session is generative guesswork; this one is evaluation over three assets no fast follower and no from-scratch sprint has together — a hardened substrate, a built engine, and an executable benchmark corpus.

That combination changes the economics of the session. Generative sessions are slow and low-confidence because every decision is argued from priors. Here the competitive, JTBD, taxonomy, and platform-model verdicts remove the need to *find* answers; the engine and corpus let the session *test* the open ones; the critic gates ensure the survivors are proven, not merely plausible. The founder's constraints flip from liabilities to advantages: open-core turns limited capital into distribution and trust (the competitive analysis's asymmetric-weapon reading), and the pre-built engine turns "no time to research" into "already researched, now measure."

---

## 8. What this session is explicitly NOT doing

Each non-goal traces to a diagnosis or a sibling verdict.

- **Not re-deriving the competitive, JTBD, taxonomy, or platform-model research** — inputs, not prompts (§1).
- **Not re-opening founder-locked decisions** — only §0.5, closed in Phase 0 (one narrow trigger aside, §10).
- **Not building before Phase 1 proves the wedge** — the pipeline is benchmarked first (§3.3, §6).
- **Not standing up a B2B/agency GTM** — Segment 3 is deferred to a near-zero-cost API/MCP surface on the same engine, not a sales org a solo founder cannot staff. The competitive and validation docs both converge on concierge-then-defer.
- **Not one-shotting brand or design** — convergence across tools is the §3.4 SHOULD.
- **Not positioning on "cheaper than Twelve Labs"** — a stance the competitive analysis proved weak and already taken.
- **Not extending the spec when a phase balloons** — cut scope to the phased v1 instead. The direct countermeasure to 63%/6%.
- **Not assuming solo-parallelism** — realistic max ≈ one build track plus one spec track; the plan phases aggressively for it.

---

## 9. Success = wedge proven in numbers + moat answer written + build-ready plan with tripwire

The session succeeds when the twelve §11 deliverables exist *and* pass three outcome tests that separate a real result from a fluffy one:

1. **The wedge is proven in numbers, not prose** — a benchmarked quality report on the ~106-item corpus with grounding-to-external-ID as a published figure (not "we ground well").
2. **The moat-durability answer is written** — a defended "why we still win in 12 months after the obvious is copied," separating sprint-cloneable from compounding assets.
3. **A build-ready phased plan exists with the §6 retrieval kill/pivot tripwire installed** — sized inside ~10–20 hrs/wk and <~$50/mo, with the open-core boundary drawn (gallery-dl GPL / cobalt AGPL respected).

If those three hold, the session produced a decision-ready artifact rather than a bigger map.

---

## 10. The gravest risk is producing more strategy; per-phase gates neutralize it

Rumelt's four hallmarks of bad strategy are fluff, failure to face the challenge, mistaking goals for strategy, and bad objectives. This orchestration must survive its own test.

- **The over-planning trap turned on itself.** The gravest risk is that *this document* becomes more strategy in a 63%-strategy founder's life. The mitigation is structural: every phase terminates in a concrete artifact and a founder gate, and "done" means a build-ready plan handed to a TDD session, not a richer spec. Absent benchmarked numbers and a shippable v1.0 slice, the session failed regardless of how good the artifacts feel.

- **Confirmation lock-in — the objection to this memo's own rule.** The §3.1 policy "consume the substrate; only §0.5 is re-openable" hard-codes a real danger: it forbids re-deriving verdicts that could themselves be wrong, removing the only check on them. A sibling-doc verdict — the competitive read, the JTBD "painkiller" premise, the taxonomy design — is an argued judgment, not a proven fact. The rule is worth keeping *only* because the session generates fresh evidence the docs never had, and that evidence is the escape hatch. So a cheap, explicit re-open trigger overrides the lock: if a Phase-1 benchmark or the real-user retrieval tripwire **contradicts** a locked verdict — most sharply, if the retrieval and Sean Ellis results say the decision-moment job is not a felt painkiller — that result **MUST** force re-opening the "locked" verdict rather than being explained away. Evidence beats the substrate; the substrate beats argument.

- **The vitamin risk, faced not assumed away.** The JTBD analysis is explicit that "understand my saves," as usually pitched, is a vitamin the market has refused. The orchestration faces it with the §6 retrieval tripwire as a pre-registered kill criterion, and by pre-committing the pivot toward the Segment-1 one-time Export-Pass funnel if that tripwire fails. This is the same evidence that fires the re-open trigger above.

- **Bounded, mitigated risks.** Placeholder pathology (the Layer-1 guardrail) and model/pricing drift (re-verify 2026 model versions and prices before hardcoding) are known and handled in policy. CWS review risk is treated as a design constraint, not a late surprise: the exact permission combo (broad host_permissions + DNR Referer injection + credentialed cross-origin fetch) is what post-purge reviewers scrutinize, so a private dry-run submission and the ZIP-import fallback are architected in.

- **Bad-objective check.** The success metric is "5–10 real users retrieve value + published eval numbers + a standout open artifact," not "revenue by date X" — a feasible, honest objective under the founder's envelope, with revenue as a fast-follow signal deliberately kept out of the v1 gate.

The engine is a career-defining artifact whatever the verdict, which is exactly what makes it safe to judge the *product* harshly — and what makes evaluate-then-build the right way to run the session on this dossier.

---

Change log (all five fixes applied, reworked not appended):
1. Section 1 VidContext figure de-contradicted — dropped the "(100 videos for $80)" gloss, kept the single consistent "~$0.20 a video." Only one instance existed in this draft.
2. Customer anchored in the memo's own voice at the top of Section 1 ("restaurant near me now" / "what's for dinner" from one's own saves).
3. Prose density cut in the Phase 1 paragraph (Section 4) and the do-it-now paragraph (Section 5), each broken from run-on/semicolon stacks into 2–3 shorter units.
4. "48-hour" removed from Dewey's "$50 Export Pass" (Section 4 Phase 5) — the only instance in this draft; matches the brief's unqualified "$50 Export Pass."
5. Gate/tripwire mechanism consolidated: §6 is now the single canonical definition (thresholds moved into Layer 3); §3.5, §5, §9, and §10 reference §6 instead of re-teaching the mechanism or re-listing thresholds.