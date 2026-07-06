# 01 — Vision & Strategy

*Product-Strategy Dossier · Argued Memo · 2026-07-02*
*Structure: Rumelt's kernel (diagnosis → guiding policy → coherent action) with Cagan's vision/strategy separation. Cross-references: PRD (02), Market & Competitive Analysis (03), Technical Design (04), Business Model & Pricing (05), GTM (06).*

---

## 1. Strategic thesis

**We are not building a better place to keep your saves. We are building one grounded content-understanding engine, proven on a public scorecard, and shipping it first as a narrow consumer painkiller that resolves saved TikToks and Reels into verified real-world actions — a mappable restaurant, a cookable recipe, a film on TMDB — and later as the same engine sold to agencies via API/MCP. The durable asset is not the product; it is the engine plus the evidence that it works. The consumer app is a proof, a funnel, and a career artifact that happens to earn money.**

A skeptic should be able to disagree with that sentence. The rest of this memo is the case for why they shouldn't.

---

## 2. Diagnosis: the specific challenge we actually face

The honest challenge is not "people have messy saves." It is this, in one paragraph:

**The generic job we are tempted to sell — "understand and organize my saves" — is a vitamin the market has already, repeatedly, refused to swallow; and the narrow places where it becomes a painkiller sit inside a consumer category that commoditized in public over the last twelve months. So the challenge is dual: (a) we must avoid building for the vitamin job even though every mechanic of the product (capture, tag, store) lives there, and (b) in the painkiller pockets where real demand exists, we must win a red ocean where a dozen free apps already ship our literal v1 feature list.**

Both halves are evidenced, not asserted.

**The vitamin half.** JTBD theory (Christensen's milkshake: the *circumstance*, not the object, is the unit of analysis) tells us the save moment and the struggling moment are two different jobs. Job A — "capture this so I feel I've dealt with it" — is *already done the instant the user taps save*; the platform's own save button nails it, and the dopamine of "I dealt with that" is delivered at capture. The save-graveyard (read-later ~5–10% read-through; browser bookmarks 60–80% never reclicked; the 75-user Instagram-Saved study finding saves "function more like a digital junk drawer") is not a bug we can fix with prettier organization — it is *empirical proof that Job A is a vitamin.* If a better-organized shoebox were a painkiller, Pocket, Instapaper, Raindrop, mymind, and Instagram Collections would already have relieved the pain. They didn't. The painkiller-vs-vitamin literature makes the economic consequence concrete: a vitamin is demand-constrained (behavior-change-gated), so adoption curves run ~4x slower and plateau near 18–22% of TAM rather than 60–80%. Our own prior read already flagged this: understand-my-saves "may be a vitamin not a painkiller."

**The crowded half.** The consumer category is, in Porter's terms, structurally unattractive: rivalry extreme and intensifying (Rung-3 "actionable extractors" went from a handful to a dozen in ~a year — Stasht, Albo, Sorti, Sprink, ReelRecall, ARCHV — all converging on identical language), entry barriers near-zero (capture is semi-public, analysis is a metered Gemini call, grounding hits free APIs), buyer power high (everything is free; nobody has to pay), and substitutes brutal (the platforms can add collection search anytime; a user can already paste a link into a frontier model). **Stasht already ships our verbatim v1 — "places, dates, recipes, products… become useful, searchable cards, restaurants show up on your map" — for free.** Market & Competitive Analysis (03) works this in full; the verdict there is unambiguous: *do not enter consumer for direct consumer profit.*

That is the challenge, stated so it can be argued with. Everything downstream is the response to it.

---

## 3. Product vision (2–5 year horizon)

Per Cagan, the vision is the future we are trying to create, held separate from the plan to get there.

**In 3–5 years, there is one open, grounded content-understanding engine that any person or team can point at short-form social video and get back verifiable, real-world-resolved knowledge — with its work shown.** A saved TikTok becomes a Google Place ID, a TMDB film, a MusicBrainz recording, a structured recipe — each with a confidence score and a traceable path back to the frame and transcript line it came from. The engine's accuracy is published on a six-axis scorecard (retrieval, transcription, OCR, generated-analysis faithfulness, classification, grounding), and its ontology and schema are open-core, so a third party can inherit, inspect, and extend them.

That single engine expresses itself at two depths (Business Model & Pricing, 05):
- **A consumer reference tool** — cheap-to-free, trust-first, local-first, zero remote code — that surfaces the *actionable* things you saved and resolves them to external surfaces you'll actually act on.
- **A business/agency tier** — the same engine, a deeper/higher-volume pipeline config, sold as API/MCP — for teams whose reference/trend-video extraction is a genuine, budgeted painkiller.

The north star is not "users organized." It is **"decisions resolved with proof"** — the count of saved items turned into a trusted real-world action the user took without re-searching.

This vision is deliberately larger than any one app and deliberately durable: it is the founder's career-defining, technically-serious artifact *and* the thing that can earn money. Those are not in tension; §6 explains why the same asset satisfies both.

---

## 4. Guiding policy: the direction, and what it forbids

Rumelt's guiding policy is a signpost, not an itinerary — it narrows the action space by committing to an approach *and* to refusals.

**Our guiding policy: build the engine as the durable core; ship the consumer app only as a proof-and-funnel narrowed to a single acute, recurring, resolvable job; make provenance and openness — not features — the basis of competition; and defer the agency tier to a build-then-show motion against warm contacts. Compete on proof, grounding, and trust, because those are the only axes a fast follower cannot clone in a sprint.**

This policy forbids four things by construction:

1. **We will not sell the vitamin.** Capture/tag/store is table stakes the platforms give away; we do it invisibly and cheaply and spend zero product surface, polish, or pricing on making the shoebox prettier (JTBD directive: "beware building Job A while charging for Job B").
2. **We will not compete on the commoditized feature list.** Auto-tag, cross-platform breadth, transcript search, recipe/place extraction, "AI" — all free and ubiquitous. None is a moat; none anchors our positioning.
3. **We will not chase the social/discovery feed.** Cosmos and Stasht are drifting toward public feeds; that is an engagement arms race a solo founder cannot win and it dilutes the trust promise. Eliminating it is a positioning asset (Blue Ocean "Eliminate"), not a gap.
4. **We will not run a consumer subscription business as the primary bet, nor a B2B sales motion yet.** The consumer curve is vitamin-shaped; the agency motion needs a salesperson we don't have. Both are addressed by sequencing, not denial.

---

## 5. Coherent actions: mutually-reinforcing moves, in sequence

Each action is chosen so it makes the others work better (Rumelt's coherence test).

**Action 1 — Validate the painkiller before the heavy build (weeks 1–6).** The engine is already built and tested (54 Vitest, strict TS; TikTok capture spike proven). That means the correct next move is not more building — it is to use the built thing as a *commitment-extraction instrument* (Users-Validation brief; Paul Graham "do things that don't scale"; the Collison-installation motion). Run a task-based retrieval test on 5–10 target users' *own* corpora (NN/g: ~5 users surface ~85% of usability problems), measuring time-to-find and success against their native-app baseline, each session ending in a commitment ask (pay/refer/retain), followed two weeks later by the Sean Ellis 40%-"very disappointed" survey. Pre-register the kill/persevere thresholds (§8) *before* showing, so a beautiful artifact can't rationalize weak signals. The Mom Test warning is load-bearing here: "understand my saves" is exactly the flattering, aspirational idea that generates worthless warm hypotheticals — so we measure behavior and commitment, never opinion.

**Action 2 — Narrow the consumer doorway to one acute job: recipes first, restaurants second.** JTBD ranks the pockets unambiguously. **Recipes** is the strongest painkiller: daily forcing function, unambiguous execution test (dinner is on the table or it isn't), documented acute pain (the "rewinding, squinting at ingredient amounts that flash for half a second, giving up and ordering DoorDash" behavior), and — critically — *existing paid substitutes* (Preplo, Némos, Paprika) proving willingness-to-pay. **Restaurants** is second: the largest discovery shift (Google's own SVP: ~40% of 18–24s go to TikTok/IG over Maps), but we own only half the job — "TikTok won inspiration; Google still owns verification." We win by *completing* the journey to Maps, not replacing it. Films (frequent pain, near-zero WTP) and products (platform-owned, intent decays fast) are engagement/SEO surfaces, not v1 revenue. PRD (02) specifies the recipe flow.

**Action 3 — Make provenance and openness the product, not a footnote.** This is the Blue Ocean "Raise/Create" move and the consumer expression of the six-axis eval. Nobody in Rung 3 shows their work: "restaurant → map" is asserted in a black box. We *raise* grounding rigor and traceability ("this resolved to Google Place ID X — here's the frame and transcript line; correct me if wrong," with a visible confidence score), and we *create* the category's first open schema + local-first data ownership, turning the export upsell (which Dewey monetizes precisely because lock-in is the norm) into a *default*. This is what makes trust an architecture rather than a tagline.

**Action 4 — Move the payoff to the decision moment.** The graveyard proves the archive view is a vitamin. Architect so value surfaces *when the user faces the struggling moment* — a "what's for dinner" flow, a "places I saved near me now" trigger — rather than requiring them to remember to open a library. This is the milkshake team moving the dispenser to the front of the store. It is a design mandate on the engine's output surface (Technical Design, 04).

**Action 5 — Build the engine architected-for-two-depths now; validate the agency tier build-then-show, later.** The agency market is structurally *more* attractive (real budgets, painkiller not vitamin, WTP $50–300/mo+) but gated by a sales motion a 10–20 hr/wk solo founder cannot run. So we architect the pipeline for the deeper config now (05, 04) and validate via concierge deliverables to *warm* contacts (Vanta/Ramp manual-report motion; Lenny's "do-it-manually"), driving each toward an LOI or paid pilot — sidestepping the crowded agency field (dig.ai, VidContext, Mixpeek) because we're selling a *result* to someone who already trusts us, not a product into a contested market. Only after an LOI do we consider a Wizard-of-Oz dashboard, and only after that the scaled build.

**Action 6 — Grow through one-product-many-doorways SEO/AEO with *live* utility.** Platform × intent pages, each ≥60% unique *and* live-resolving (Google 2026 deindexes thin programmatic pages), doubling as Savoia Facade tests that both survive Google and measure true intent. Plus CWS-listing SEO, Product Hunt, Reddit, comparison pages, because SEO cannot cold-start from zero. GTM (06) sequences this.

These cohere: validation (1) de-risks the narrowing (2); the narrowing focuses the provenance edge (3) and decision-moment design (4); provenance+openness (3) is simultaneously the consumer moat, the agency sales artifact (5), and the SEO/AEO content (6); and the engine built once serves all of it.

---

## 6. Insight / source of power: separate the sprint-cloneable from the compounding

This is the crux the skeptic will attack, so it gets the most rigor. Rumelt's demand is a real asymmetry, not a wish.

**The reframe: cleanly separate what a competitor can copy in a sprint from what compounds over time, and stake everything on the latter.**

**Sprint-cloneable (NOT a moat — do not stake positioning on any of it):** the prompt, the ontology's surface, auto-tagging, cross-platform breadth, transcript search, recipe/place extraction, a pretty grid, "AI." All of it is already free across Stasht/Sorti/Sprink/Albo/ReelRecall. A competent solo dev ships the MVP in weeks — which is *why the field looks the way it does.* Any strategy whose defense is the feature set is dead on arrival.

**Compounding (the actual source of power):**

1. **Verifiable grounding + a published, kappa-validated eval (the six-axis scorecard).** This is the strongest and most cross-market-transferable moat. Competitors add entity extraction in a sprint; almost none will do the slow, unglamorous work of a version-locked golden set (our ~106 labeled items seeding toward 100–500, stratified) and an LLM-judge validated with Cohen/Fleiss kappa and swap-debias (raw agreement inflates 33–41pp). It compounds because every labeled item, every eval cycle, every corrected grounding makes the *measured* quality gap wider — and it is *exactly* the artifact that converts skeptical agency buyers, who demand accuracy guarantees. In 12 months a cloner has our prompt; they do not have our scorecard or the labeled corpus behind it.

2. **The open-core engine + ontology + schema as commitment-durable strategy.** Cosmos ($21M raised) and Stasht *cannot* open-source without cannibalizing their venture theses; we can, and it compounds into SEO/AEO surface, developer trust, portability-as-default, and the founder's portfolio artifact simultaneously. Open-core is the classic asymmetric weapon of a capital-poor entrant against well-funded closed incumbents — it converts the solo-founder constraint into a distribution and trust advantage. The taxonomy itself is engineered to compound: a durable governed core (closed enumerations, stable URIs, never-delete-with-replacement lifecycle, warrant-based promotion of emergent tags) that keeps the golden set valid across years while adapting at the leaves (Engine-Taxonomy prior art: Ranganathan facets, Dublin Core dumb-down, SNOMED/GO lifecycle, SKOS). A cloner copies today's ontology snapshot; they do not copy a governance process that has been accreting labeled warrant for a year.

3. **Compounding data and experience: the corpus, the grounding cache, the durable-ID choices.** The real 1,313-item corpus and its labeled slice are a head start no fast-follower has on day one. Grounding to *durable open IDs* (MusicBrainz over Spotify, TMDB, Places) is an engineering-taste edge that is hard to even *see*, therefore hard to copy quickly — and it means our resolved knowledge doesn't rot when a vendor API churns.

4. **Extension-only capture capabilities.** Eager poster/media capture at save-time — before signed CDN URLs expire in hours — is a capability pure mobile apps (Albo, Sorti, most of Rung 3) structurally cannot replicate. Adversarial to the platforms, yes (a capped moat, honestly acknowledged in 03), but a real one against the app-only field.

**The 12-month test, answered directly:** *If a funded competitor clones our prompt and feature list tomorrow, why do we still win in a year?* Because they will have shipped the sprint-cloneable layer — and so will five others — while we will have a published accuracy lead they cannot assert, an open ecosystem and ontology they cannot match without abandoning their business model, a labeled corpus and grounding cache that grew every day, and an agency pipeline validated on the *same* proven engine. **Proof, openness, and grounding are the uncontested top-right quadrant on both the consumer and business positioning maps (03) — and they are precisely the things that get better with time rather than being true or false on launch day.**

---

## 7. What we are explicitly NOT doing

Cagan's "pick your battles," made concrete:

- **Not selling "organize/understand my saves" as the pitch.** It's a vitamin; the graveyard is the proof, not the opportunity.
- **Not competing on feature breadth or platform count.** Depth on TikTok+Instagram over shallow 14-platform coverage (ARCHV's 14+, Stasht's 7). Depth is the anti-commodity move.
- **Not building a social/discovery feed.** Deliberate refusal, not an oversight.
- **Not prioritizing films or products for v1 revenue.** Films = engagement/SEO surface (weak WTP, strong substitutes); products = platform-owned, intent decays fast. Recipes and restaurants carry v1.
- **Not running a B2B sales motion now.** Agency tier is architected-for, validated build-then-show, built later — never a v1 GTM.
- **Not positioning "cheaper than Twelve Labs."** Twelve Labs (Bedrock-distributed, NVIDIA-backed, Pegasus/Marengo the pattern we emulate) is not out-modeled or out-priced; Pegasus at $0.0292/min isn't even expensive at our scale. We compete on openness, eval-transparency, and grounding specificity, not price.
- **Not treating remote code, cloud lock-in, or opaque analysis as acceptable.** Trust-first, local-first, zero remote code is a non-negotiable constraint, because trust is one of the only three defensible axes.
- **Not committing to the heavy consumer subscription build until validation passes.** If the retrieval test says vitamin, we pivot to the Segment-1 one-time Export-Pass funnel (Dewey's proven ~3.75% conversion, 40k users) rather than a retention-dependent subscription.

---

## 8. Objectives & how we'll measure progress

Because the core risk is "beautiful engine for a vitamin job," the objectives are pre-registered kill/persevere gates, not aspirations. Framework: Lean Startup Build–Measure–Learn ending in an explicit pivot-or-persevere call.

**Objective A — Prove the consumer painkiller is real (the decisive gate).**
- ≥ ~70% task success in the retrieval test with *meaningfully lower time-to-find* than the native-app baseline, across 5–10 target users on their *own* corpora.
- ≥ 40% "very disappointed" on the Sean Ellis survey after two weeks of real use (the honest dependency signal for a suspected vitamin).
- ≥ 1 commitment (pay at the $5–13/mo band / named referral / retained install) per satisfied user.
- **Miss → it's a vitamin: pivot to the Segment-1 Export-Pass funnel; lean consumer-as-funnel; accelerate the agency tier.**

**Objective B — Prove the engine's quality is *measurably* best (the moat, made legible).**
- Public six-axis scorecard live, LLM-judge kappa-validated; golden set grown from ~106 toward ≥245/slice (5%@95%).
- Grounding end-to-end entity-linking P/R/F1 published, with confidence + NIL handling.

**Objective C — Establish live-utility distribution.**
- 2–3 Facade doorways live-resolving (not thin), ranking intent across platform×intent surfaces under the 2026 deindex constraint; CWS listing + one Product Hunt/Reddit launch.

**Objective D — De-risk the agency tier without building it.**
- ≥ 1 signed LOI or paid pilot after concierge deliverables to warm contacts; plus any unsolicited inbound (Lenny's best signal).
- **No LOI after 2–3 concierge deliverables → the pain is real but not our-priced-solution-shaped; defer the tier as planned.**

**Objective E — Founder objective, which holds regardless of A–D.** A career-defining, technically-serious, taste-forward, *shipped and evaluated* engine — the portfolio artifact — exists and is public. This is what makes it safe to judge the *product* harshly: the artifact's value does not depend on the product's PMF verdict.

Infra stays <~$50/mo until a managed tier monetizes (Gemini Flash-Lite ~$0.001–0.002/clip; Batch −50% mandatory; a 20k-item visual pass ~$20–40/user).

---

## 9. Key risks & bad-strategy self-check

Rumelt's four hallmarks of bad strategy, applied to this memo as an adversarial audit:

**Is it fluff?** No. Every claim names a mechanism or a number (graveyard read-through rates, Porter forces, the ~106-item golden set, the Sean Ellis 40% gate). The thesis is falsifiable.

**Does it fail to face the challenge?** This is the risk the whole memo is built to avoid, so the self-check must be strict. The challenge (§2) is the vitamin verdict + the crowded market. We face both directly: we *concede* the generic job is a vitamin and refuse to sell it; we *concede* the consumer category is a red ocean and reposition consumer as funnel/proof rather than profit. The memo does not paper over either.

**Is it goals-as-strategy?** No — §8's OKRs are downstream of a guiding policy (§4) and coherent actions (§5), and are written as kill gates, not wishes.

**Does it rely on a non-existent source of power?** The sharpest risk. If the "moat" (§6) is imaginary, the strategy collapses. Honest exposures:
- *The consumer painkiller may be too weak even in recipes.* Mitigation: Objective A is a pre-registered gate with a defined pivot; we do not commit the heavy build until it passes.
- *Provenance/openness may not be things consumers actually value* (mymind is profitable and Cosmos raised $21M *without* solving authenticated capture or actionable resolution — the market rewards taste and trust at least as much as depth). Mitigation: we market on trust and design, treat depth as the agency-facing proof, and keep consumer cheap-to-run so it ships regardless.
- *Capture is adversarial and platform-dependent* — TikTok/Meta can break interception deliberately; signed URLs expire; ~360-item scroll throttles exist. This caps the whole category's defensibility, not just ours (03). Mitigation: eager capture-at-save-time, human-paced resumable capture, MAIN-world passive interception of the platform's own signed responses (never forge signatures), Apify MCP fallback.
- *Model-supplier risk* is real but bounded to moderate: Gemini Flash-Lite is substitutable by OSS Qwen3-VL/Gemma3, a genuine strength of the ground-up posture.
- *The strongest substitute is nonconsumption and re-search* (Christensen's honest frame): our real competitor is "just Google it again" and "order takeout." The only defense is making the resolved, verified answer *faster and more trustworthy than re-searching* — which is the grounding bet restated. If grounding isn't faster-and-more-trusted than a re-search, we do not have a business, and the retrieval test (Objective A) is precisely the instrument that tells us.

**The deepest situational risk, named plainly:** most founders fear build-then-show because building lets them avoid talking to customers. Our risk is the inverse — the engine is genuinely built and genuinely hard, so the temptation is to let its craftsmanship *substitute for evidence*. The entire OKR structure exists as the antidote: use the built thing as a probe that forces real users into real tasks and real commitments, treat every warm word as fluff until backed by cash/referral/retention/signature, and decide out loud against the pre-declared numbers.

---

### The one line a skeptic should accept

*The mass-market pitch is a vitamin in a red ocean — so we don't make that pitch. We ship a narrow, proven painkiller resolved to real-world action as the funnel-and-proof for a durable, open, measurably-best content-understanding engine whose moat is the compounding data, eval, and openness a sprint cannot clone; the same engine becomes agency revenue on a build-then-show motion; and every bet is gated by pre-registered kill criteria, so the engine is a career-defining artifact whether or not the product finds PMF.*

---

*Continue to: PRD (02) for the recipe-first flow and requirements · Market & Competitive Analysis (03) for the two-market Porter/Blue-Ocean case and positioning maps · Technical Design (04) for the multi-stage grounded pipeline and two-depth architecture · Business Model & Pricing (05) for the two-depth monetization and WTP · GTM (06) for one-product-many-doorways SEO/AEO.*