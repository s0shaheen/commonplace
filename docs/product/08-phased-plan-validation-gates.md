# 08 — Phased Plan and Validation Gates

*Dossier for the content-understanding engine (ex-"Attic"). Companion to Doc 01 (Product Strategy Memo), Doc 02 (PRD), Doc 03 (Market & Competitive Analysis), Doc 04 (Technical Design Document), Doc 05 (Business Model & Pricing), and Doc 06 (Go-To-Market Plan). This document sequences the build and, more importantly, pre-commits the tripwires that decide whether each next phase is earned.*

---

## Situation

The engine at the core of this product ingests a user's saved short-form videos — TikToks and Reels — and runs a multi-stage vision-language pipeline that works out what each clip is actually about. It then resolves those items to real external entities: a restaurant to a Google Place, a film to a TMDB record, a track to a MusicBrainz ID, with its reasoning shown. The engine is already built. It carries 54 Vitest specs under strict TypeScript, and its live TikTok capture path is proven.

## Complication

But a built engine is not a validated product, and this one aims squarely at a market where the obvious pitch is a trap. Doc 03's jobs-to-be-done analysis concludes that "understand, organize, and remember my saves" — the generic promise — is a *vitamin*, and a historically unsellable one: the save-graveyard is not a bug better organization fixes, it is proof the archival job is already discharged the instant the user taps save, which is why the whole read-later category plateaus near 18–22% of its market instead of the 60–80% a painkiller reaches. And because the engine is genuinely hard and genuinely finished, the founder's specific failure mode is the inverse of most: letting craftsmanship stand in for evidence.

## Question

So the only question that matters before another hour of heavy build is: *is there a narrow, acute job where re-finding and resolving a saved item is a real painkiller — and can we prove it cheaply enough to still afford to be wrong?* This document is the answer, expressed as an order of operations with pre-committed tripwires.

## Strategic thesis

Ship the smallest thing that turns the already-built engine into a truthful measuring instrument. Run one decisive retrieval kill-gate on a single acute job *before* any further heavy build. Then let every later phase — Instagram and X breadth, the agency API, the open-core release — be unlocked by a pre-registered signal, not by a calendar and not by how good the artifact feels.

The phasing is not a delivery schedule. It is a sequence of falsifiable bets. Each is cheap enough to run inside a solo, ~10–20 hr/week, sub-$50/mo envelope, and each is defended by a number written down in advance.

This is the one document in the dossier whose job is to say *no* — to defer, to gate, and to name the conditions under which we stop. Everything else argues what to build. This argues in what order, and how we would know we were wrong.

---

## 1. Diagnosis: two traps that a phased plan exists to defuse

A roadmap earns its place only by naming the specific challenge it navigates — a diagnosis, not an environmental scan, in Rumelt's terms. The Complication above states the two traps; here is the evidence under each, because the whole plan is engineered around them.

**Trap one — the vitamin.** The save-graveyard is empirical, not anecdotal. Read-later apps convert only 5–10% of saves into reads, and 60–80% of browser bookmarks are never re-clicked (Burn 451). A 75-user study of Instagram Saved found the two top failure modes were "too much to scroll through" and users simply forgetting they had saved anything (Bootcamp / Yuvraj Singh). Products like these are demand-constrained: the bottleneck is behavior change, not supply, so they are modeled at roughly 4× slower adoption, plateauing near **18–22% of the addressable market** rather than 60–80% (Funding Blueprint).

The implication is stark. If we build for the archival job, no amount of engineering saves us. The value lives entirely in the decision moment — where a saved item must resolve into a real-world action — and only in a *narrow* set of those moments. Recipes are strongest and monetizable. Restaurants are strong, but we own only the resolve-to-Maps half. Films are frequent but low-willingness-to-pay. Products are platform-owned and weakest (Doc 03).

**Trap two — the builder's inversion.** Ries's discipline defuses this. He does not forbid building before learning; he forbids building *without a falsifiable learning goal attached to a leap-of-faith assumption*, followed by a Build–Measure–Learn turn that ends in an explicit pivot-or-persevere call. For a content-understanding engine the built thing is the only possible measuring instrument — you cannot run a retrieval test on a slide deck — so build-then-show here is not a violation of Lean discipline but its correct application. It is the same "do things that don't scale" move Stripe made when its founders set up each early user by hand (Paul Graham).

**The diagnosis, in three short claims (Doc 03).** First, we hold a technically serious engine aimed at a market where the generic promise is a vitamin. Second, the consumer arena is a bloody red ocean: Stasht already ships our literal v1 feature list for free, and rivalry, entry threat, buyer power, and substitutes all run high. Third, the honest business demand sits in an adjacent, sales-gated market that a solo part-timer cannot yet work.

The plan's entire purpose follows: spend the least capital reaching the one measurement that tells us which reality we live in — before we pour the founder's scarce hours into breadth, backend, or a public open-source commitment we can't retract.

---

## 2. Vision the phasing serves (2–5 year horizon)

Kept explicitly separate from the plan, per Cagan's vision-versus-strategy distinction. The north star (Doc 01, and the founder's locked decision of 2026-07-02) is **the content-understanding standard**: research-grade, structured, *grounded* analysis of saved media, in a durable open schema, with entities resolved to real external surfaces and its work shown.

One durable engine, productized at two depths: a cheap or free consumer reference tool, and a business/agency API tier on the same rails, wrapped in an open core — engine, ontology, schema, and evaluation harness. The roadmap below is the signpost toward that future, not the future itself, and no single phase should be mistaken for the destination.

---

## 3. Guiding policy: five commitments that narrow the action space

The guiding policy — Rumelt's second kernel element — commits as much to what we *refuse* as to what we do.

1. **Validation before scale, always in that order.** No phase that costs real founder-hours proceeds until the phase before it has cleared a pre-registered gate. We buy information before we buy breadth.
2. **The built engine is a commitment-extraction instrument, not a product to admire.** Every "show," consumer or agency, must end in commitment currency — cash, a named referral, retained usage, a letter of intent, or a signed pilot. Otherwise it collected fluff. This is the core discipline of the Mom Test (Fitzpatrick).
3. **One acute doorway, not a horizontal promise.** The consumer v1 leads with a single acute, recurring, executable job resolved to action — recipes first — never "understand everything you saved." This is the milkshake lesson: one object, but you pick the job and design for *its* competitors. Ours are re-search and nonconsumption (ordering DoorDash), not Stasht.
4. **Stay inside the envelope by construction.** Solo, ~10–20 hrs/wk, no hard deadline, under ~$50/mo until a managed tier pays for itself. Gemini 2.5 Flash-Lite runs at roughly $0.001–0.002 per clip, and mandatory batch processing halves that. That is what makes a small retrieval test and a handful of agency runs cost lunch money rather than a seed round. Cost discipline is a *strategy input*, not an afterthought.
5. **Irreversible moves go last.** Open-sourcing the core is a one-way door — you cannot un-publish trust. Doc 03 notes that Cosmos and Stasht *cannot* open-source without cannibalizing their venture theses, which is exactly why we can, and exactly why it must be timed to compound rather than to leak an unproven schema. Open source is therefore v1.3, released only after the ontology and evaluation have survived real corpora and the engine has earned an audience to release *to*.

What this policy refuses: racing platform breadth (ARCHV's 14+ platforms, Stasht's 7), building the scaled high-volume agency pipeline before a signed commitment, a social or discovery feed, and any energy spent making the archive prettier.

---

## 4. Coherent actions: the four phases

Each action is designed to make the next one work better — Rumelt's coherence test. The through-line: v1.0 proves the *value hypothesis* on the cheapest surface; v1.1 buys *reach* only once value is proven; v1.2 monetizes *depth* against a buyer with budget; v1.3 converts the whole thing into a durable moat and funnel.

Each phase carries a rough founder-effort size so the plan can be resource-checked against the ~10–20 hr/wk envelope. Sizes are **S / M / L** with an approximate build-hour range and its translation into calendar weeks at the stated cadence. They are estimates, not commitments — "gates, not dates" still governs — but they exist so the reader can confirm v1.0 is actually reachable *before* Gate 0.

One deliberate reconciliation with the founder's locked "TikTok **and** Instagram at launch" decision. The *validation build* (v1.0) is TikTok-led, because live TikTok capture is proven and is the fastest path to a trustworthy instrument. Instagram's guaranteed presence at public launch is carried by the "Download Your Data" ZIP-import lane (v1.1), with a live-Instagram feasibility probe running in parallel from day one. Both platforms are at launch, per the lock. The sequencing of *learning* simply front-runs the surface that can produce a valid retrieval test first (Doc 04).

### v1.0 — Proven TikTok core + the retrieval instrument (the validation build)

**What.** Take the existing engine and the proven TikTok live-capture path. (That path passively intercepts the platform's own signed responses and eagerly grabs the poster and media at capture-time, before those signed URLs expire.) Wrap it in the minimum library UX needed to run a real retrieval task on a real user's own corpus, and instrument it: session logging for task success and time-to-find, a paired baseline capture, and a wired Sean Ellis prompt. Lead the consumer surface with one acute domain — **recipes** — resolved to structured, grounded output, with ingredients, quantities, and steps extracted from the video. Recipes are the strongest painkiller and the one with proven willingness-to-pay, validated by paid entrants like Preplo, Némos, and Paprika (Doc 03).

**Effort: M–L, ~40–70 build-hours (≈4–6 weeks at 10–20 hr/wk).** The engine and capture already exist; the spend is minimal library UX, the recipe-domain polish, and the instrumentation harness. This is the reachability check the constraint demands: v1.0 lands inside roughly a month and a half of part-time work before Gate 0 is even run.

**Why first.** This is the one experiment the built engine uniquely enables, and the only one that adjudicates the vitamin question. It is also the cheapest: no new platform, no backend, batch inference on Flash-Lite. Doc 03 explicitly authorizes treating consumer v1 as a proof-and-funnel, not a profit center — and the retrieval test's job is to tell us whether the funnel is even worth pouring into.

**Gate.** Gate 0, the retrieval kill-or-pivot decision before any further heavy build. Detailed in §5. Nothing downstream is funded until Gate 0 clears.

### v1.1 — Instagram (ZIP-import) + X-bookmarks doorway (breadth, earned)

**What.** Ship the Instagram lane via the official "Download Your Data" ZIP-import fallback, guaranteeing Instagram regardless of the live-capture probe; if the probe comes back green, upgrade Instagram to live later. Stand up X-bookmarks as a low-cost SEO doorway. Add platform adapters on top of a shared base object built from open web standards — Activity Streams 2.0, schema.org, oEmbed — with per-platform quirks isolated in adapters and each raw payload demoted to a versioned artifact (Doc 04). Runs the doorway demand probe (§5) in parallel.

**Effort: M, ~30–50 build-hours (≈3–5 weeks).** ZIP parsing and adapter plumbing are well-scoped; the Facade doorways reuse the live engine, so the marginal cost is a thin front end, not new analysis.

**Why second, not first.** Breadth is a multiplier on a validated value proposition and dead weight on an invalid one. Doc 03 is explicit: depth over breadth on TikTok and Instagram is the anti-commodity move. We pay for reach only after Gate 0 says there is something worth reaching. The X doorway is deliberately thin but live — a Facade, not a pure fake door — respecting Google's 2026 deindexing of thin programmatic pages while still ranking real intent (Doc 06).

**Gate 1.** The retention/PMF gate (§5), which decides the consumer *monetization posture* — subscription versus a one-time Export-Pass funnel (Doc 05).

### v1.2 — API / MCP for the agency tier (depth, monetized, build-then-show)

**What.** Expose the same engine — deeper pipeline config, higher volume — as an API surface, but *validate by build-then-show*, do not launch. Concretely (Doc 03): run a **concierge** deliverable for one or two of the founder's known agency contacts. Take their real folder of reference and trend reels, run the engine overnight in a deeper config, and hand back the structured, grounded, timestamped-JSON deliverable openly as a manual service — the motion Vanta used with manual compliance reports, Ramp with manual savings reports, Food on the Table with hand-built shopping lists. Only after a letter of intent or a paid pilot do we consider a Wizard-of-Oz dashboard that looks autonomous while we still run every batch by hand.

**Effort: S–M build, ~20–40 build-hours, plus ongoing outreach/delivery time.** The engine already produces the agency deliverable, so the marginal build is thin; the real cost is founder time on outbound and manual concierge runs, which is deliberately manual until Gate 2 justifies automation.

**Why third.** The agency market is structurally more attractive — real budgets, a painkiller not a vitamin, willingness-to-pay of **$50–300/mo and up** (Doc 03's Porter analysis) — but gated by a sales motion a 10–20 hr/wk founder cannot run cold. The concierge motion sidesteps the crowded-market problem (dig.ai, VidContext, Mixpeek): we are not selling a product into a contested category, we are selling a *result* to someone who already trusts us. The expensive scaled pipeline is deferred until a signed commitment justifies it.

**Gate 2.** The agency commitment gate (§5).

### v1.3 — Open-core release (moat + funnel, irreversible, last)

**What.** Open-source the framework-agnostic analysis engine, the ontology, the export schema, and the six-axis evaluation harness as a standalone library and CLI — the "standard." The app and hosted product stay proprietary (open-core, per the locked decision).

**Effort: L, ~60–100 build-hours (≈6–10 weeks).** Packaging, documentation, an editorial/governance guide, and CI-enforced ontology invariants are real work — which is another reason it goes last, not first.

**Why last.** Doc 03 names this the entrant's asymmetric weapon against well-funded closed incumbents (Twelve Labs on Bedrock, Cosmos's $21M raised) and the strongest, most cross-market-transferable moat — but only if the schema is *worth* inheriting. Releasing an unproven ontology is worse than not releasing: it invites forks of a wrong abstraction and burns the one-time credibility of the launch. Doc 03's taxonomy research is unambiguous that a taxonomy is a governed product with a release cadence (IPTC, SNOMED, MeSH): never delete, deprecate with a reason and successor, promote on warrant, enforce roll-up invariants in CI. So v1.3 ships only after v1.0–v1.2 have hardened the core against real corpora and the golden set, and only after there is an audience — earned via the SEO doorways and a Product Hunt or Reddit moment — to release *to*.

---

## 5. The gates in detail: pre-registered, or they don't count

One discipline keeps build-then-show honest: write the falsifiable thresholds down *before* the show, so the artifact you're proud of cannot retroactively rationalize weak signals. This is Ries's Build–Measure–Learn ending in a stated pivot-or-persevere call. What follows is a pre-registration: one page, dated before the first user session.

**The kill-gate spine is three gates — Gate 0, Gate 1, Gate 2.** These are the numbered decisions that gate founder-hours. There is one additional demand probe (the doorway probe) that lives *inside* v1.1 and informs GTM; it is deliberately **not** part of the kill-gate spine and carries no number, precisely so the reader can see it is a marketing sub-test, not a go/no-go on the product.

### Gate 0 — Retrieval kill-gate (before any further heavy build)

The consumer leap-of-faith is that re-finding saved *actionable* items is a felt pain, and that grounding to external IDs removes it durably. The instrument is a task-based retrieval test on each user's *own* corpus — worthless on our internal 1,313-item corpus, because retrieval value is entirely "can *you* find the thing *you* saved and later wanted." It runs in two distinct parts, because they answer two different questions and each has its own statistically appropriate method. **This split is the correction to the previous version, which pinned a quantitative kill threshold to Nielsen Norman's 5-user rule — a rule that governs qualitative problem discovery, not rate estimation.**

**Part A — Qualitative discovery pass (N = 5, one at a time).** Purpose: surface usability problems and read whether the resolved, actionable answer makes users light up at the decision moment. This is where Nielsen Norman's finding applies and *only* here: ~5 users, running real tasks on their own corpus, surface roughly 85% of usability *problems*, with sharp diminishing returns after. Keep it Mom-Test-clean — anchor each task to a specific past struggle ("earlier you told me you saved a ramen place and couldn't re-find it; find it now"), not a hypothetical. **Output is a problem inventory and a qualitative verdict, with no numeric pass/fail threshold attached.** Citing the 5-user rule to license a success-rate number would be a category error, and we do not do it.

**Part B — The persevere/kill decision (within-subject time-to-find delta).** The decision does not turn on an absolute task-success *rate*, because at N = 5–10 an absolute rate is uninterpretable: a 3.5-of-5 versus 4-of-5 outcome flips the verdict entirely inside its own sampling noise, and NN Group themselves state that quantitative/benchmark metrics need roughly 20+ users to estimate a rate with any confidence. Instead the decision turns on a **paired, within-subject comparison**: for each user, time-to-find and success *in the tool* versus the same user performing the same retrieval against their native-app search or their own memory. Each participant is their own control, which removes between-user variance and makes the signal defensible even at N = 5–10, in a way an absolute rate is not.

- **Persevere if:** across the cohort, the median within-subject time-to-find in the tool is *materially* shorter than each user's own baseline — a large paired delta (directional target ≥ ~40–50% faster) with few or no reversals — *and* users reach a resolved, actionable answer they say they trust. A vitamin produces "nice, but I'd have just searched again." A painkiller produces a visibly shorter, higher-confidence path than the tool they live with today. Absolute task success ~70% is retained **only as a directional sanity floor**, explicitly not as the pass/fail line.
- **Kill or pivot if the paired delta is small, inconsistent, or reversed:** it's a vitamin. Pivot away from retention-dependent subscription toward the one-time Export-Pass funnel Dewey has already proven — a **$50 48-hour export pass and a $225 lifetime tier, converting roughly 3.75% of a ~40k-user base** (Dewey's published pricing, TechCrunch Jan 2025; conversion modeled in Doc 05). Lean the consumer product harder into pure proof-and-funnel and accelerate the agency tier. The engine remains a career artifact either way — which is exactly what makes it safe to judge the product harshly.

*Escalation clause, pre-committed:* if a true quantitative success-*rate* pass/fail (e.g., "≥70% of tasks succeed") is ever wanted as the headline number instead of the within-subject delta, N must rise to **~15–20 users**, per NN Group's own guidance for benchmark metrics. That is a larger recruit than this wedge warrants at the kill-gate stage, which is precisely why the within-subject delta — not a small-N rate — is the primary instrument here.

### Gate 1 — Retention / PMF (unlocks monetization posture)

The must-have signal, collectable only after real use. Fire the Sean Ellis survey at two weeks: "How would you feel if you could no longer use this?"

- **Persevere if:** **≥40% answer "very disappointed"** — Ellis's empirically-benchmarked growth threshold, which measures *dependency*, not satisfaction — *and* at least one commitment per satisfied user: they pay within the **$5–13/mo** willingness-to-pay band the market supports, refer a friend by name, or keep the extension installed so usage can be re-checked in two weeks.
- **Kill or pivot if missed:** treat glowing sessions as noise. Default to the one-time-export monetization path and de-fund subscription infrastructure (Doc 05).

### Doorway demand probe (a sub-test within v1.1 — not a kill-gate)

This informs GTM sequencing (Doc 06); it does not gate the product and is intentionally left unnumbered to keep it off the kill-gate spine. Stand up two or three **Facade** doorways rather than pure fake doors. A fake door advertises a product that does not exist and measures who clicks; a Facade goes one step further — when someone knocks, it delivers a real, minimal result, here live-resolving a handful of items with the engine (Savoia's escalation). This both survives Google's 2026 thin-page deindex and yields richer intent data than a click. Use it to rank platform-by-intent surfaces — "TikTok restaurant finder," "Instagram recipe saver" — by live knock-through before committing build to each. Keep the distinction clean: a Facade or fake door tests *demand before build*, whereas a smoke test is a release sanity-check (Userpilot).

### Gate 2 — Agency commitment (unlocks the scaled pipeline in v1.2+)

The B2B leap-of-faith is that agencies have painful, high-volume video-extraction needs and real budget (**$50–300/mo and up**, Doc 03). This gate is pre-registered to be as falsifiable as Gate 0, which means naming the exact count of failed attempts that triggers DEFER — not just the success condition.

- **Persevere and build the scaled pipeline if:** at least one signed letter of intent **or** paid pilot is secured after no more than three concierge deliverables to *distinct* warm contacts, optionally reinforced by any cold or referral inbound (Lenny Rachitsky's "unsolicited interest" signal).
- **DEFER — explicit trigger:** **three completed concierge deliverables to three distinct warm contacts, with zero LOIs and zero paid pilots**, means the pain is real but not our-priced-solution-shaped. Defer the tier as originally planned rather than building automation on faith. (A concierge "deliverable" = one real folder run and handed back with an explicit commitment ask; a deliverable that never reaches the ask does not count toward the three.)

*Reconciling the two counts so they are not in tension.* The "~30 prospects" figure and the "three concierge deliverables" figure measure different things and must not be conflated. The ~30 is a *conversation/outreach* calibration (founders typically talk to ~30 prospects; Zip ran 75 in 2–3 weeks) — it sizes the top of the funnel we cast to *find* warm contacts. The three concierge deliverables are the *deep, hands-on* engagements at the bottom of that funnel, and they are what the DEFER trigger counts, because Doc 03 is clear that only about a third of successful startups used formal design partners and that a small number of deep, committed engagements beats a wide survey (≈73% of successful B2B SaaS started with manual service delivery before automating). So: cast wide (~30 conversations) to source contacts; commit to at most three deep concierge runs; DEFER on three-for-zero.

---

## 6. Source of power: why this sequence wins where a feature race won't

Rumelt calls this "discovering power" — the asymmetry that makes the strategy work. Ours is not the feature list. Doc 03 is emphatic: auto-tagging, cross-platform breadth, transcript search, recipe and place extraction, "AI" — all free and ubiquitous across Stasht, Sorti, Sprink, Albo, ReelRecall, and none a moat. The power is threefold, and the phasing unlocks it.

**First, a *validated* engine is the only asset that survives both Porter analyses and sits in uncontested market space on both maps.** On the consumer map, that space is the empty "actionable resolution plus verifiable and open" corner; on the business map, the empty "open-core, evaluation-transparent, grounded-to-durable-IDs" corner. Sequencing validation first is what lets us honestly claim "proven" — the whole differentiator.

**Second, measurable depth plus a published evaluation is a slow, unglamorous moat almost no consumer app will build.** It rests on the six-axis scorecard, a version-locked golden set of 100–500 items, and an automated judge checked against human raters for agreement (Cohen's/Fleiss' kappa) and corrected for position bias. It is exactly the sales artifact that converts skeptical agency buyers. So v1.0's evaluation work is not academic garnish — it is the thing v1.2 sells, and the phases reuse the same core: one durable artifact, four strategic surfaces.

**Third, the gates convert a solo founder's biggest constraint — scarce hours — into an advantage.** By refusing to fund breadth or backend until value is proven, and by sizing each phase against the ~10–20 hr/wk envelope, we guarantee the hours go only toward moves the evidence has earned. That is the opposite of the crowded field's shallow feature-racing.

---

## 7. What we are explicitly NOT doing (and when we'll revisit)

Deliberate non-goals and deferred bets (Cagan's "pick your battles"; Rumelt's "focus"):

- **No horizontal "understand all your saves" promise in v1.** It's the vitamin. Revisit only if Gate 0 or Gate 1 somehow prove mass retrieval demand, which Doc 03 makes unlikely.
- **No products or shopping domain in v1.** Weakest pocket — purchase intent decays fast and the platforms own it (Instagram Shops). Deprioritized indefinitely.
- **No social or discovery feed.** Eliminating it is a positioning asset, not a gap (Doc 03's Blue Ocean "Eliminate"). An engagement arms race a solo founder cannot win, and it dilutes the trust promise.
- **No platform-breadth race.** TikTok and Instagram deep; X thin-and-live for SEO only; YouTube and Reddit later, gated.
- **No scaled agency pipeline before a signed commitment.** Concierge and Wizard-of-Oz only, until Gate 2.
- **No premature pricing lock.** Monetization is directionally hybrid — free local or bring-your-own-key, plus a paid managed tier — but exact model and tiers are deferred to Doc 05. The v1.0–v1.1 gates *feed* that decision.
- **No open-source release until v1.3.** Irreversible, and timed to compound rather than to leak an unproven schema.
- **No forged platform signatures, ever.** Capture stays passive interception of the platform's own signed responses, and human-paced, resumable, multi-session capture respects TikTok's roughly 360-item scroll throttle (Doc 04). Compliance is settled and non-negotiable.

---

## 8. Objectives & how we'll measure progress (OKRs)

Outcomes, not output — the signals that the strategy is working.

- **O1 — Prove the value hypothesis (v1.0).** KR: Gate 0 cleared via a material within-subject time-to-find delta across 5–10 own-corpus users (Part B), on top of a clean Part-A discovery pass at N = 5. KR: ≥40% "very disappointed" at two weeks. KR: at least one commitment per satisfied user.
- **O2 — Establish the durable core's quality (spans v1.0–v1.3).** KR: golden set version-locked at 100–500 items, stratified ~30/50/20 and seeded from the ~106 already-labeled items. KR: six-axis scorecard computed and published. KR: automated judge validated against human raters — raw agreement inflates the score by 33–41 points, so an unvalidated judge is disqualified. KR: end-to-end entity-linking precision/recall/F1 tracked, with explicit handling for items that resolve to nothing.
- **O3 — Earn agency demand without a sales team (v1.2).** KR: up to three concierge deliverables to distinct warm contacts. KR: at least one signed LOI or paid pilot (DEFER on three-for-zero). KR: at least one unsolicited or referral inbound.
- **O4 — Build the funnel and the standard (v1.1–v1.3).** KR: two or three live Facade doorways ranking intent. KR: open-core library and CLI released with a written editorial guide and CI invariants. KR: a Product Hunt / Reddit / comparison-page launch moment, since SEO cannot cold-start from zero (Doc 06).
- **O5 — Stay in the envelope (all phases).** KR: infra under ~$50/mo until the managed tier monetizes (Flash-Lite plus mandatory batch, −50%). KR: no phase started before its predecessor's gate cleared. KR: each phase's actual build-hours tracked against its S/M/L estimate in §4.

---

## 9. Key risks & bad-strategy self-check

Rumelt's four hallmarks of bad strategy, applied honestly:

- **Fluff?** No. The gates are numeric and pre-registered; "validate before scale" is operationalized as specific thresholds and a specific method per gate.
- **Failure to face the challenge?** No. The challenge — vitamin risk plus the builder's inversion — is named in the Complication and §1, and the plan's spine is the mechanism to face it. Gate 0 exists to try to *kill* the consumer thesis cheaply.
- **Mistaking goals for strategy?** No. §4 is coherent, sequenced, mutually-reinforcing action, each phase reusing the core and unlocking the next — with effort sized so the sequence is checkable.
- **Bad objectives?** No. The OKRs are outcome and dependency measures — within-subject delta, "very disappointed" percentage, signed commitments — not vanity output counts.

**Residual risks and mitigations.**
1. *Platforms are adversarial suppliers.* Signed URLs expire in hours and interception can be broken deliberately; Doc 03 flags supplier power as the category's sharpest exposure. Mitigation: eager capture at save-time; the Instagram ZIP-import lane guarantees Instagram regardless of the live-probe outcome; model-substitutability (OSS Qwen3-VL or Gemma3 fallback) caps model-supplier power.
2. *Stasht or an incumbent closes the actionable-resolution gap first.* Mitigation: our edge is provenance, a published evaluation, and openness — which they structurally won't build, because their venture theses forbid open-sourcing.
3. *Gate 0 passes but monetization fails.* Mitigation: Gate 1 explicitly routes to the Export-Pass funnel; the phasing pre-plans the pivot.
4. *Founder-hours slip.* Mitigation: no hard deadline is a feature. Gates, not dates, govern progression, and the §4 sizes flag slippage early, so a slow month delays but never invalidates the plan.

**The decision discipline that makes all of this real.** At the end of each phase, make the pivot-or-persevere call out loud, against the pre-declared number and its pre-declared method — not against how good the artifact feels. The engine is a career-defining portfolio artifact no matter the verdict, which is precisely what makes it safe to judge the *product* harshly.