# Dossier 06 — Business Model, Pricing & Go-To-Market

**One engine, two doorways, priced against reality**

*Type: Business Model & Pricing (Osterwalder Business Model Canvas + value-based-pricing measurement stack) fused with Go-To-Market (7-step B2B GTM framework). Cross-references: Doc 01 (Product Strategy Memo), Doc 02 (PRD), Doc 03 (Market & Competitive Analysis), Doc 04 (Technical Design Document).*

---

## Strategic thesis (the claim to agree or disagree with)

**Situation.** We have one content-understanding engine — already built, tested (54 Vitest, strict TS), with the capture spike proven — and two candidate markets it can serve: consumers who over-save short-form video, and agencies that need video understood in bulk.

**Complication.** The consumer "understand my saves" job has already been priced at exactly $0. Stasht, Sorti, Sprink, Albo, and ARCHV are all free; Raindrop's paid floor is just $3/mo (help.raindrop.io). It behaves like a vitamin, and the save-graveyard is the proof: read-later apps see 5–10% read-through and browser bookmarks are 60–80% never re-clicked. The category has refused to pay for organization for a decade. So a retention subscription as the *primary* revenue line would bet the business on the exact behavior the graveyard proves does not happen.

**Question.** How do we monetize a genuinely valuable engine without staking the P&L on a habit the market has repeatedly refused to form?

**Answer — monetize the engine, not the archive.** The correct model is a **three-lane structure on one engine**:

- **Lane 1 — a free, local-first, bring-your-own-key consumer tool.** It costs us near-nothing to run. Its job is to prove the engine, feed the SEO/AEO funnel, and stand as the portfolio artifact.
- **Lane 2 — a one-time "Resolve/Export Pass."** It captures value at the acute decision moment where the vitamin becomes an aspirin. Dewey has already proven this exact shape: a $50, 48-hour Export Pass sold *alongside* a $10/mo Pro and a $225 lifetime tier, converting an estimated ~3.75% of its ~40,000-member base (TechCrunch, Jan 2025; Chrome Web Store listing; prior grounded WTP research). A *thin* optional subscription is reserved for the validated recipe/restaurant painkiller pocket only.
- **Lane 3 — a usage/seat-priced agency API/MCP tier on the identical engine.** It is built-then-sold to warm contacts, and positioned on openness-and-proof rather than on price.

Growth is SEO/AEO-led through live-utility doorways. It is cold-started off the Chrome Web Store listing plus Product Hunt plus Reddit, because organic search cannot start from zero.

Everything below argues this case and commits to the numbers.

---

## Part A — Business model (Business Model Canvas)

I use Osterwalder's nine blocks (Strategyzer) as the scaffold, but the load-bearing move is recognizing that **the same nine blocks describe two different businesses that happen to share Key Resources and Key Activities.** That shared core is the entire thesis of the product frame, and it has direct precedent.

### The one-engine/two-surface model is proven, not novel

The instinct to fear here is the one Doc 03 names explicitly: treating "consumer save-app" and "agency video-intelligence" as one market because they share an engine. They are two markets — different buyer, WTP, distribution, and moat. What they legitimately share is the **content-understanding engine** (Doc 04): scene-detect → transcript → one VLM+OCR pass → schema-driven synthesis → deterministic grounding → agentic verification. Two depths, one codebase, different pipeline *config*.

This structure is not risky. It is the dominant pattern in exactly our adjacency:

- **Twelve Labs runs two models on one core and sells them at multiple depths.** Marengo handles retrieval; Pegasus handles schema-conditioned extraction. It ships them as a raw API and as a fully-managed service inside Amazon Bedrock, serving both developers and enterprises. This is the direct architectural precedent for "one engine, many productizations." Doc 03's instruction still stands: emulate the *architecture*, never position cheaper-than-Twelve-Labs.
- **The open-core canon proves the monetization shape.** GitLab, Elastic, Sentry, and Supabase all give away the engine and charge for managed convenience. Our engine, ontology, schema, and eval are open (our stated commitment); the managed convenience is what people pay for. Open-core is the classic asymmetric weapon of a capital-light entrant against funded closed incumbents (Cosmos has raised ~$21M; Twelve Labs ~$77M). It turns the solo-founder constraint into a distribution-and-trust advantage, and it doubles as the career artifact.
- **The outcome-layer analogues price the agency lane for us.** dig.ai reads the video itself and charges from $100/mo. VidContext turns an uploaded video into structured text at 100 videos for $80 ($0.80/video), explicitly pitched as "give your AI agent eyes" — i.e., MCP-adjacent. Both prove the business surface of a video engine is real and fundable.
- **Stripe is the GTM precedent.** Its "give me your laptop" motion pairs a self-serve developer surface with a hand-to-hand enterprise motion, off one API. That is exactly our two-motion plan.

The nine blocks:

**1. Customer Segments: heavy savers with a recurring, deadline-bearing decision — not the shoebox hobbyist.** Three, in beachhead order. (a) *Beachhead:* heavy savers with a recurring, executable decision — the weeknight home cook (recipes: strongest painkiller per JTBD) and the "always deciding where to eat" urban social diner (restaurants). (b) *Funnel/volume:* Segment-1 ad-hoc exporters — the "get my TikTok favorites out" one-time job (Dewey's ~40k-user proof). (c) *Deferred, real-budget:* Segment-3 agencies/brands doing high-volume reference/trend-video extraction (the founder's warm contacts). Films and products are *engagement/SEO surfaces, not revenue surfaces* (films: frequent pain, near-zero WTP, strong substitutes; products: platform-owned, intent decays) — deprioritized per JTBD.

**2. Value Propositions: resolve-to-action with the work shown — not one more organizer.** Consumer: "the actionable things you saved, resolved to a real external surface (a place on the map, a film on Letterboxd/TMDB, a track on Spotify/MusicBrainz) — *with the work shown*, in an open schema, on your device." Agency: "the same grounded, eval-transparent extraction as a batch API/MCP — structured, timestamped, entity-linked JSON your agents can consume." The single unifying line lives in Doc 03. The differentiators that survive both Porter analyses are **measurable depth + provenance + open schema + grounding-to-durable-IDs + design taste** — never the feature list (auto-tag, cross-platform, transcript search are all commoditized and free).

**3. Channels: live-utility SEO/AEO doorways, cold-started off the store listing.** SEO/AEO "one-product-many-doorways" (platform × intent pages, each live-utility); Chrome Web Store listing (itself an SEO surface and the cold-start seed); Product Hunt; Reddit; comparison pages. Agency: founder-led outbound to warm contacts (Lenny Rachitsky: "outbound sales is consistently the best signal"), then inbound off the open-core/eval reputation. Detailed in the GTM section.

**4. Customer Relationships: zero-touch and trust-first for consumers, high-touch concierge for agencies.** Consumer: self-serve, zero-touch, trust-first (local-first, zero remote code, data-portability-as-default). Acquisition = organic search + listing; retention is *deliberately not the primary lever* for the mass tool (it's a vitamin); expansion = the one-time Pass and, for the painkiller pocket, an opt-in subscription. Agency: high-touch concierge → Wizard-of-Oz → productized (per Doc users-validation sequencing; Vanta/Ramp manual-report precedent).

**5. Revenue Streams: a one-time Pass carries consumer revenue; agency usage carries the margin.** (i) Free tier: $0, BYO-key. (ii) One-time Resolve/Export Pass: ~$49. (iii) Optional consumer subscription (painkiller pocket only, post-validation): ~$6–8/mo. (iv) Agency: usage ($/video) and/or seat/tier. Argued in Part B.

**6. Key Resources: the proven engine and its public eval are the moat — not the feature list.** The built engine (`src/lib`, 54 Vitest, strict TS); the golden set + six-axis eval (the *sales artifact* for agencies and the trust artifact for consumers); the open ontology/schema (Doc 05 taxonomy); the proven MAIN-world capture spike; the live Gemini key; the 1,313-item corpus + ~106 labeled seed.

**7. Key Activities: run the pipeline, maintain the eval, feed the doorways.** Running and improving the pipeline; maintaining the eval/golden-set; the taxonomy release train; SEO/AEO content + doorway maintenance (each ≥60% unique + live); agency concierge delivery.

**8. Key Partners: substitutable inference is a strength; the platforms are an adversarial supplier.** Inference (Gemini Flash-Lite today; OSS Qwen3-VL/whisper.cpp as substitutable fallback — this substitutability keeps supplier power at 3/5, a genuine strength); grounding authorities (Google Places IDs-free, TMDB, MusicBrainz/Spotify, Open Library); burst compute (Fal/Modal/Replicate). The adversarial "partner" is the *platforms* whose signed responses we intercept — a supplier with forward-integration threat that caps the whole category's defensibility.

**9. Cost Structure: ~95% front-loaded inference at ingest — the single fact that dictates pricing.** This is where the model is won or lost, so it gets its own section.

### Cost is front-loaded, and that single fact dictates the pricing

The dominant cost is **inference at ingest**, and it is ~95% front-loaded per user. Prior grounded cost research puts a 20k-item visual pass at **~$20–40/user standard**, and **Batch (−50%) is mandatory**, so ~$10–20 batched. Scaling down (scene-detect is local/free; platform subtitles are preferred over WhisperX to avoid transcription cost; synthesis is a cheap text call; grounding hits free/cheap APIs):

| Library size | Onboarding inference, standard | Onboarding inference, **batched (−50%, our default)** | Ongoing/month (storage + incremental saves) |
|---|---|---|---|
| 5k items | ~$5–10 | **~$2.50–5** | cents |
| 10k items | ~$10–20 | **~$5–10** | cents |
| 20k items | ~$20–40 | **~$10–20** | cents |

The real corpus is 1,313 items; a typical heavy saver lands in the 5–10k band. So the *median* managed-onboarding cost is roughly **$2.50–10 per user, paid once**, then near-zero.

Two consequences fall straight out, and they are the crux of the whole memo:

1. **A retention subscription is structurally mismatched to a front-loaded, vitamin-demand product.** If we pay the inference, month 1 is underwater and we only recover it if the user *stays* — but the category's demand curve plateaus at ~18–22% of TAM and read-later retention is famously awful. We would be betting the P&L on the exact behavior the graveyard proves doesn't happen.
2. **Bring-your-own-key collapses the cost to ~$0 for us**, and it is *already implied* by trust-first/local-first/zero-remote-code. If the user's own Gemini/OSS key pays for their own inference, founder infra stays comfortably under the <$50/mo ceiling no matter how many free users onboard. This is the design choice that makes a free consumer tier *sustainable* rather than a subsidy we can't afford.

This is why the recommended model leads with **free + BYO-key**, monetizes the acute moment with a **one-time Pass** (which also happens to cover a managed-onboarding bill with fat margin), and treats subscription as a *validated add-on for the painkiller pocket only*, not the foundation.

---

## Part B — Pricing (value-based pricing measurement stack)

### 10. The value metric differs by lane because the job differs: an event for consumers, a video for agencies

**Value-based, not cost-plus — but the value metric differs by lane, because the value differs by job.**

- **Consumer:** the value is delivered *per resolved decision at the acute moment*, not per stored item. The right value metric is therefore an **event/outcome** (a resolved, exportable, act-on-able library), captured as a **one-time Pass** — because willingness-to-pay spikes at the forcing function (dinner tonight; the TikTok ban; "I need my saves out") and does not sustain into a monthly habit for most users. This is Dewey's empirical discovery: they monetize *export* precisely because retrieval-and-lock-in is a one-time acute need, and they run Pro at $10/mo, a $225 lifetime, *and* a $50 48-hour Export Pass in parallel (TechCrunch Jan 2025; keep.md) — a ladder that says the one-time job is real money.
- **Agency:** the value scales with volume and it is a painkiller (real budget, WTP $50–300+/mo). The right value metric is **per-video usage** (tracks value and cost linearly) and/or a **seat/tier** for predictability — sitting at or above the outcome-layer benchmarks VidContext ($0.80/video; vidcontext.com) and dig.ai ($100/mo entry; dig.ai).

### 11. Treat survey willingness-to-pay as an upper bound; let behavior set the number

The value-based-pricing literature is explicit that survey WTP is an *upper bound*, not a point estimate, and must be triangulated then validated in-market. Plan:

- **Van Westendorp PSM** on the beachhead (recipe/restaurant heavy savers) to bound the acceptable band — PMC/PME as floor/ceiling, IPP/OPP as internal references. Prior research gives a strong prior: consumer WTP is **bimodal, ~$5–13/mo vs. $50–300 B2B**. The competitive map anchors the consumer band hard: **Raindrop $3** (floor; help.raindrop.io), **Cosmos $8/$72yr**, **Dewey $10/$7.50yr**, **mymind $12.99/$129yr** (ceiling; mymind pricing). A one-time Pass anchors to **Dewey's $50** Export Pass.
- **Choice-based conjoint** to find the feature *fences* — critically, to test whether **provenance/verifiability, open-schema export, and grounding depth** actually shift choice and WTP. They are our only defensible axes; if they don't move the conjoint, the differentiation is cosmetic and we should know that *before* building the paid tier.
- **The gating caveat (Doc users-validation):** treat *all* survey data as suspect for a vitamin, because the Mom Test predicts flattering hypotheticals on an identity-flattering idea. **The real WTP instrument is behavioral:** the retrieval test on the user's *own* corpus, ending in a commitment ask (pay/refer/retain), plus the Sean Ellis 40%-"very disappointed" gate at two weeks. Pricing research informs the *number*; behavior decides *whether to charge a subscription at all*.

### 12. Three consumer doors and a usage-first agency ladder on one engine

**Consumer — three doors, one engine:**

| Tier | Price | What it is | Why |
|---|---|---|---|
| **Free (Local)** | $0, BYO-key | Local-first capture + full engine on your own key; open-schema export always on; eager poster-capture; the "your data is yours, verifiable" promise | Sustainable at <$50/mo infra; the SEO/AEO funnel; the portfolio artifact; the trust wedge Doc 03 identifies as the empty top-right quadrant (actionable + verifiable/open) |
| **Resolve/Export Pass** | **~$49 one-time** (48-hr managed run, à la Dewey's $50 Pass) | We run the batched managed pipeline over your whole library and hand back resolved, grounded, exportable results — no key needed | Captures value at the acute moment; ~$2.50–10 cost → strong one-shot margin; matches Dewey's ~3.75% conversion on a ~40k base; sidesteps retention risk entirely |
| **Reference (opt-in subscription)** | **~$6–8/mo**, *only ships after the Sean Ellis 40% + retrieval gates pass* | Managed continuous processing of new saves + the painkiller-pocket surfaces (near-me-now restaurants, "what's for dinner" recipe flow) | The minority of daily-cadence heavy users are the only segment with genuine recurring WTP; priced between Cosmos ($8) and Raindrop ($3), below mymind |

Feature fences derived from conjoint, not guessed: the free tier must be *genuinely useful* (or it's a fake-door that Google deindexes and users bounce from); the fence is **managed inference + resolve-to-external-surface convenience + the decision-moment surfaces**, not the raw understanding (which is free and commoditized).

**Agency — usage-first, tiered for predictability. Canonical usage band: ~$1.00–2.00/video (deep config).**

| Tier | Price | Notes |
|---|---|---|
| **Pilot / concierge** | Paid pilot or LOI, custom | Built-then-shown: run the deeper config on their real folder overnight, hand back the deliverable openly as a service (Vanta/Ramp motion). Validates value + price before the scaled pipeline exists. |
| **API/MCP usage** | **~$1.00–2.00/video** (deep config) | Sits **at or above VidContext's $0.80/video**, where depth + grounding + eval justify the premium; **never positioned as cheaper than Twelve Labs.** Deep-config inference is ~$0.05–0.15/video → the price is a premium on proof, not a race to the floor. |
| **Seat/subscription** | **~$150–500/mo** | For predictable-volume shops (roughly 150–500 videos/mo bundled at the per-video rate); anchored above dig.ai's $100/mo entry, priced up on eval-transparency + open schema + grounding-to-durable-IDs. |

### 13. The tiers are candidate ranges; revealed preference sets the price

Per the operationalized value-based-pricing method (survey → in-market → iterate), the tiers above are *candidate ranges*, not commitments. Set the operational number by revealed preference:

1. **Consumer:** launch Free + a **Facade doorway** (Savoia) that live-resolves a handful of items — this simultaneously survives the 2026 thin-page deindex, ranks doorway intent, and A/B-tests the Pass price ($39/$49/$59) via a real checkout. Fire the Sean Ellis survey at two weeks before committing engineering to the subscription tier.
2. **Agency:** the concierge deliverable *is* the price test — drive every engagement to an LOI or paid pilot (the only honest signal). No LOI after 2–3 warm concierge deliverables ⇒ defer the tier, exactly as planned; don't build the scaled pipeline on applause.

### 14. Unit economics: the Pass prints margin without retention; the agency tier is the long-term engine

**Consumer, one-time Pass (recommended primary consumer revenue):**
- Revenue $49 − onboarding cost $2.50–10 (batched) = **~$39–46 contribution per Pass.** No retention dependency. At Dewey-like ~3.75% conversion on, say, 10k organic free users → ~375 Passes → ~$15–17k contribution — modest but real, self-funding infra, and it *validates the engine commercially* without betting on a habit.
- **Sensitivity:** the number that matters is conversion, not price — a vitamin's price elasticity is brutal, but the acute-moment Pass is inelastic *at the moment* (Dewey proves it). If conversion undershoots 3.75%, the correct response is more/better doorways (top-of-funnel), not a lower price.

**Consumer, subscription (secondary, gated):**
- At **$7/mo, BYO-key** (cost ≈ storage cents) → ~$84/yr near-pure margin *if retained*.
- Managed (we pay inference): **month-1 net ranges from +$2 (best case, $5 onboarding) to −$3 (worst case, $10 onboarding).** The best case is already profitable in month 1. The worst case carries a −$3 deficit that the second month's $7 more than clears, so **breakeven lands during month 2 at the latest.** Even so, this tier is only viable if the Sean Ellis gate clears — hence gating it.
- **Where value-based pricing does NOT apply:** the *free* mass tier is effectively a commoditized good (organize-my-saves priced at $0 by five free competitors), so pricing power there is zero — which is *why* it's free and a funnel, not a product. Correct read, not a failure.

**Agency (the actual margin engine long-term):**
- At the canonical **$1.00/video** with deep-config inference cost ~$0.05–0.15/video → **~85–95% gross margin.** A single 500-video/mo agency = ~$500/mo revenue at ~$425–475 contribution. Ten such accounts clear the founder's income bar with headroom, on the *same engine* that runs the free consumer tool. CAC is founder-time (warm outbound), not cash — the solo-founder-appropriate motion.
- **Sensitivity:** the risk is sales-motion capacity (a solo 10–20 hr/wk founder), not unit economics — which is exactly why the tier is architected-now, built-and-sold-later.

**The economic through-line:** the free consumer tier is a near-zero-cost funnel (BYO-key), the Pass is a positive-margin one-shot that doesn't depend on retention, and the agency tier is the high-margin painkiller — and all three ride one engine whose marginal cost is a cheap, substitutable inference call.

---

## Part C — Go-To-Market (7-step B2B GTM framework, applied to a two-motion product)

### 1. ICP: heavy savers with a recurring, deadline-bearing decision, and agencies paid to watch reels

**Consumer beachhead ICP (for content/doorway targeting, not sales):** a high-volume saver (hundreds–thousands of items, i.e. volume has *already broken* native saves — "too much to scroll") with a **recurring, deadline-bearing, executable job**: the weeknight home cook and the urban social diner. Trigger/pain signal: has failed to re-find a specific saved recipe/place in the last 90 days (JTBD: 63% of cooks have). *Disqualifier:* the casual saver who wants a prettier shoebox — that's the vitamin, and we don't chase it with paid effort.

**Agency ICP:** small-to-mid social/creative agencies and brand social teams doing **high-volume reference/trend-video review**, where a human currently watches reels to extract structure. Buyer roles: the strategist/analyst who feels the pain; the founder/lead who signs. Pain signal: a folder of hundreds of saved reels someone is paid to summarize. Disqualifier: enterprises wanting Bedrock-scale managed infra (that's Twelve Labs' game — don't compete on the channel we can't match). Precise enough to disqualify unaided; ICP ≠ TAM.

### 2. Positioning: win on trust and proof, never on features or price-vs-Twelve-Labs

The single line (Doc 03): *an open, grounded content-understanding engine that turns saved TikToks and Reels into verifiable, real-world-resolved knowledge, with its work shown — unlike Stasht/Sorti/Albo (assert in a black box) or Twelve Labs/dig.ai (powerful but closed and enterprise-gated).* Consumer framing leads with **trust + actionability** (the empty top-right quadrant); agency framing leads with **proof (public six-axis scorecard) + openness + grounding-to-durable-IDs** (the empty open-core/eval-transparent quadrant). We do **not** position on features or on price-vs-Twelve-Labs.

### 3. Channels: every doorway must carry live utility or Google deindexes it

**"One product, many doorways"** — a matrix of **platform × intent × domain** pages ("TikTok restaurant finder," "Instagram recipe saver," "export my TikTok favorites," "find that saved reel"). The hard constraint from prior research: **Google 2026 deindexes thin programmatic pages**, so every doorway must carry **≥60% unique content + a *live* utility** on the page — resolved via Savoia's **Facade** (the door opens and the engine actually resolves a few items). That simultaneously (a) survives the deindex, (b) delivers real value, and (c) measures true intent to rank which doorways to invest in. Thin fake-doors are explicitly rejected.

Layer **AEO** on top, because search has shifted: **68% of searches are zero-click**, AI Overviews cut CTR ~58%, but **AI-referred visitors convert 11–23×**. So each doorway ships a **canonical, citable guide** ("how to actually find/act on your saved X") with schema.org markup (Recipe, Restaurant, VideoObject, FAQ) so AI answer engines cite us as the authoritative, *proof-backed* source. Our eval-transparency is a genuine AEO asset here: we can substantiate accuracy claims competitors can't.

### 4. The doorway CTA ladders free install → live resolve → the $49 Pass

Each doorway's CTA ladders into the Part-B structure: free install (local, BYO-key) → live Facade resolution → the **$49 Resolve/Export Pass** at the acute moment. The Chrome Web Store listing is itself a channel *and* an offer surface (CWS-listing SEO is a first-class ranking target, not an afterthought).

### 5. Sales enablement: the public eval scorecard is what converts skeptical agency buyers

The "enablement asset" for a solo founder is the **concierge deliverable + the public eval scorecard**. Buyers are sophisticated and demand accuracy (buyer power 4/5); the six-axis scorecard (VidFactScore faithfulness, grounding P/R/F1, etc.) is *the* thing that converts skeptical agency buyers — measurable faithfulness is a sales artifact, not academic garnish. Every concierge engagement ends in commitment currency (LOI → paid pilot → cash), never applause.

### 6. Launch: seed non-search channels first, because SEO can't cold-start from zero

**SEO cannot cold-start from zero** — this is the single most important GTM caveat. The launch sequence borrows from Dewey/TinyWow/Cobalt/Wise:

1. **Seed non-search channels first:** ship the CWS listing (optimized), then **Product Hunt**, then **Reddit** (the ban-driven "get my TikTok saves out" and recipe/cooking communities — where Dewey found its wedge). These generate the initial users, backlinks, and reviews that *make* the SEO doorways rankable.
2. **Stand up 2–3 live-utility Facade doorways** in parallel to rank intent (per Doc users-validation).
3. **Publish the open-core engine + eval scorecard** — itself an AEO/developer-trust and backlink engine, and the funnel into the agency lane.
4. **Compound:** each ranked doorway + each AEO citation lowers CAC over time; the agency lane opens via founder outbound once the reputation exists.

### 7. Comparison pages win high-intent traffic; pre-declared gates say whether the strategy works

**Comparison pages** ("Attic vs Stasht," "vs Dewey," "vs mymind," "Dewey alternative") are a deliberate, high-intent SEO surface — the category churns names fast (Quiki/The Saved already fading), and comparison intent is where our *only* defensible axes (verifiability, open export, grounding depth) can be shown side-by-side rather than asserted. These are also where we honestly concede the free-competitor reality and win on trust + proof, not feature count.

**Measurement / OKRs (the strategy-is-working signals):**
- *Consumer funnel:* doorway → install → Facade-resolve → Pass conversion (target Dewey-like ~3.75%); AEO citation count; CWS ranking.
- *Painkiller-pocket validation gate:* retrieval-test task success ≥~70% with lower time-to-find than native baseline (5–10 users); **Sean Ellis ≥40% "very disappointed" at two weeks** — the go/no-go for the subscription tier.
- *Agency gate:* ≥1 signed LOI/paid pilot after ≤3 concierge deliverables; any unsolicited inbound.
- *Infra discipline:* founder infra <$50/mo maintained (BYO-key enforced on free tier).

---

## Recommended model (committed)

1. **Consumer v1 = Free (local-first, BYO-key)** — sustainable, trust-first, the SEO/AEO funnel and portfolio artifact. Do *not* subsidize managed inference on the free tier.
2. **Primary consumer revenue = one-time Resolve/Export Pass (~$49)** — Dewey-proven, retention-independent, positive-margin, aimed at the acute moment where the vitamin becomes an aspirin. In-market A/B the exact price.
3. **Consumer subscription (~$6–8/mo) is conditional** — ships only for the recipe/restaurant painkiller pocket, and only after the Sean Ellis 40% + retrieval gates clear. Pre-committing to build it now would bet against the strongest evidence.
4. **Agency tier = usage (~$1–2/video) + seat/tier ($150–500/mo) on the same engine** — built-then-sold via concierge→WoZ→product to warm contacts; priced *at or above* VidContext's $0.80/video and positioned on open-core + eval-transparency + grounding, **never on price-vs-Twelve-Labs**. This is the long-term margin engine.
5. **GTM = SEO/AEO live-utility doorways + comparison pages, cold-started off CWS listing + Product Hunt + Reddit**, with the open-core release as its own trust/backlink/AEO engine.

**Bad-strategy self-check:** this model refuses the fluffy default (a horizontal "understand your saves" subscription) precisely because the evidence says it's a vitamin priced at $0; it commits to a hard non-goal (no retention-dependent mass subscription until proven); it faces the real constraint (front-loaded inference cost) with a real mechanism (BYO-key + one-time Pass); and it aligns every revenue lane to the one durable asset — the proven, open, grounded engine.

---

*Load-bearing figures are sourced inline at point of use (competitor prices: help.raindrop.io, mymind pricing, Dewey via TechCrunch Jan 2025 / keep.md / Chrome Web Store, vidcontext.com, dig.ai; inference-cost basis and Dewey ~3.75% conversion: prior grounded cost/WTP research). Frameworks applied: Osterwalder/Strategyzer Business Model Canvas; value-based pricing operationalized (choice-based conjoint + Van Westendorp PSM + in-market validation, treating survey WTP as an upper bound); 7-step B2B GTM (ICP→positioning→channels→offer→enablement→sequencing→measurement); Savoia Fake-Door/Facade; Sean Ellis 40% test; Lean Startup build-measure-learn; JTBD/Christensen-Moesta forces. Sibling refs: Doc 01 strategy kernel, Doc 03 Porter/Blue-Ocean positioning, Doc 04 pipeline cost basis, Doc 05 open ontology.*