# Dossier 02 — Users, Jobs-to-be-Done, and Market

*Attic content-understanding engine · product-strategy dossier · 2026-07-02*
*Companion to: Doc 01 (Product Strategy Memo), Doc 03 (PRD), Doc 04 (Technical Design — Engine, Taxonomy & Platform Model), Doc 05 (Business Model & Pricing), Doc 06 (Go-To-Market). Cross-references below use those numbers.*

---

## 1. Executive summary & market thesis

**The thesis, stated so you can disagree with it:** the mass-market job this product is usually pitched against — "understand and organize everything I saved" — is a *vitamin*, and it is a vitamin the market has already, repeatedly, refused to swallow. The save-graveyard is not an unmet need waiting for a better shoebox; it is the *empirical proof* that the organize-my-saves job is low-urgency and demand-constrained. The product only becomes a *painkiller* in a narrow set of decision-moment jobs — recipes above all, restaurants second — where a recurring deadline creates a forcing function and where re-searching is genuinely painful. Everything strategic follows from taking that verdict seriously.

From that single diagnosis, three consequences fall out, and they organize this entire document:

1. **The three audience segments are not three markets to win; they are one engine pointed at three demand curves of radically different quality.** Segment-2 (the "consumption-conscious" save-organizer) is a red ocean commoditizing in public and priced by the market at $0. Segment-1 (the ad-hoc exporter) is a commodity job with a proven *one-time* willingness to pay. Segment-3 (the agency / creator-video-intelligence buyer) is the only structurally attractive, painkiller-grade, real-budget market — but it is sales-gated and cannot be a solo founder's v1 go-to-market. This asymmetry is the whole game.

2. **Our defensible position exists in exactly one place on each of the two competitive maps: the top-right "actionable + verifiable/open" quadrant that no one currently occupies.** Not "another save app," not "a cheaper Twelve Labs." A *verifiable, grounded, open* content-understanding layer — the thing every competitor asserts and none can prove — deployed consumer-first as a trust-and-SEO proof artifact and business-second as the same engine via API/MCP.

3. **Because the core question (vitamin or painkiller?) is falsifiable and cheap to test against a built engine, the correct next action is not more building — it is a build-then-show validation sprint with pre-declared kill criteria.** The engine is already built (54 Vitest, strict TS; capture spike proven; 1,313-item corpus; ~106-label golden seed per the BUILD STATE digest). It is now an *instrument of learning*, and the honest move is to use it as a probe, not to let its craftsmanship substitute for evidence.

The rest of this memo argues each claim in turn, grounding the demand-side reading in Christensen/Ulwick JTBD-ODI, the industry-structure reading in Porter's Five Forces, and the positioning in Kim & Mauborgne's Blue Ocean tools — and it ends with the honest, uncomfortable read on stickiness and willingness-to-pay that a founder should carry into the build-or-pivot decision.

---

## 2. Macro-environment scan (PESTLE): the forces that make this a *now* opportunity and a *fragile* one

PESTLE (Aguilar's macro-scan; *Scanning the Business Environment*, 1967) is used here narrowly — not to catalogue every force, but to isolate the handful that actually move this decision.

- **Social — the discovery shift is real, large, and directional.** Google's own SVP has said ~40% of 18–24s go to TikTok/Instagram over Maps/Search for lunch ([Mashable](https://mashable.com/article/gen-z-tiktok-search-engine-google); [NYT](https://www.nytimes.com/2022/09/16/technology/gen-z-tiktok-search-engine.html)); Toast's 2026 report (n=1,466) puts TikTok at 38% of Gen Z restaurant discovery and 46% of 18–34s using social to find places, with 73% having visited a restaurant after a social review ([BEApp/Toast](https://blog.beapp.co/2026/06/how-diners-discover-restaurants-on-social-media/)); 81% of surveyed cooks cook recipes found on social ([The Kitchn 2023](https://www.thekitchn.com/home-cooking-grocery-survey-2023-23517050)); 72% of 18–27s get food ideas from platforms like TikTok ([NY Post/SWNS](https://nypost.com/2025/08/05/lifestyle/gen-z-relies-on-social-media-for-meal-planning-new-survey-shows/)). Content is where inspiration now happens; the *bridge to action* is where it breaks. That broken bridge is the opportunity.

- **Technological — the technical floor has collapsed, which is both the enabling condition and the central threat.** Grounded analysis is a metered call to Gemini Flash-Lite (~$0.001–0.002/clip; Batch −50%), grounding hits free/cheap public APIs (Places IDs, TMDB, MusicBrainz), and capture techniques are semi-public. A competent solo dev ships a Rung-3 MVP in weeks — which is *precisely why a dozen competitors exist*. The same force that lets us build cheaply lets everyone else build cheaply. Durability cannot live in the feature set (Doc 04 argues it lives in eval + ontology + grounding rigor).

- **Political/Legal — platform adversarial risk and the TikTok-ban-adjacent "get my saves out" anxiety.** Signed media URLs expire in hours and platforms can break MAIN-world interception deliberately; this caps the whole category's defensibility (see §4 supplier power). It also *creates* a real one-time job — the Segment-1 export/preservation need Dewey monetizes (below). Separately, the **Google 2026 deindexing of thin programmatic pages** directly constrains the GTM (Doc 06): doorways must be *live utility*, not thin SEO pages.

- **Economic — willingness-to-pay is bimodal and, for the consumer job, structurally near-zero.** The market has priced consumer "organize my saves" at $0 (Stasht, Sorti, Sprink, Albo all free; Raindrop free tier). WTP splits ~$5–13/mo consumer vs. ~$50–300/mo B2B — the split that justifies the two-depth model but also warns against expecting consumer subscription revenue to carry the company.

- **Environmental** is not materially load-bearing here beyond the modest, genuine "compute-once, reuse embeddings" cost-and-efficiency story (Twelve Labs Indexing-3.0 pattern; Doc 04), which is a cost-structure point, not a demand driver.

**So-what:** the macro-picture is a genuine, *now* opening (discovery has moved to social; the action-bridge is broken) sitting on top of a *fragile* substrate (zero technical moat, adversarial suppliers, a deindexing GTM constraint, and near-zero consumer WTP). That combination is the exact signature of a market you enter for *strategic* reasons — proof, funnel, portfolio — rather than for direct consumer profit. That is not a hedge; it is the correct reading of the evidence, and Doc 01 builds the strategy on it.

---

## 3. Market sizing (TAM / SAM / SOM): why the honest number is small on purpose

I will not manufacture a spurious TAM. The disciplined read, reconciling top-down and bottom-up, is:

- **The demand curve itself caps the consumer TAM.** The painkiller-vs-vitamin framework models a *demand-constrained* (behavior-change-gated) product as adopting ~4× slower and plateauing at ~18–22% of TAM, versus 60–80% for a supply-constrained painkiller ([Funding Blueprint](https://fundingblueprint.io/painkiller-vs-vitamin-startup-problem)). Since "organize my saves" is demand-constrained, the *effective serviceable-obtainable* market for a subscription is a fraction of the nominal "everyone who saves videos" TAM — which is why a top-down "billions of savers" number is misleading and I refuse to lead with it.

- **Bottom-up consumer (Segment-2):** reachable via CWS listing + SEO/AEO doorways + Product Hunt/Reddit (Doc 06). At the market's $0–13/mo band and Dewey-class conversion (~3.75% paid on ~40k users), the *subscription* SOM is modest and slow. This is the number that says: consumer is a funnel and proof surface, not a P&L engine.

- **Bottom-up Segment-1 (ad-hoc export):** Dewey's revealed model — a **$50 48-hour Export Pass**, **$225 lifetime**, ~3.75% conversion across ~50k members ([Dewey Chrome Store](https://chromewebstore.google.com/detail/dewey/occohfgiljdagdmklhpplgmcnliljmgi); [TechCrunch, Jan 2025](https://techcrunch.com/2025/01/22/dewey-launches-a-solution-to-save-your-tiktok-favorites-just-in-case/)) — proves a *one-time* WTP on a commodity job. Small per-user LTV, but real cash and a clean SEO-to-upsell funnel.

- **Bottom-up Segment-3 (agency):** small N, high ACV. Consumer WTP $50–300/mo+ per the digest; concierge/pilot economics (Doc 05) mean a handful of signed pilots dwarfs thousands of consumer subscriptions. This is where the money is — but it is *earned* through a sales motion the founder can't yet run at 10–20 hrs/wk.

**So-what:** the sizing exercise itself argues the strategy. The largest *nominal* market (Segment-2) has the worst *quality of demand*; the smallest market (Segment-3) has the best. TAM/SAM/SOM here is not a fundraising slide — it is the quantitative expression of "consumer is loss-leading proof-and-funnel; agency is the deferred profit center." Detailed unit economics live in Doc 05.

---

## 4. Industry structure (Porter's Five Forces): two markets sharing an engine and nothing else

The strategic error waiting to be made is to treat "save/organize/analyze" and "agency video intelligence" as one market because one engine serves both. Porter run twice shows they are not one market — they differ on every force.

### Market 1 — Consumer save / organize / analyze

- **Rivalry: extreme (5/5), intensifying.** Rung-3 "actionable extractor" apps went from a handful to ~a dozen in roughly a year, all converging on identical language ("save, we do the rest, find it later, maps/recipes/reminders"). The feature set is commoditizing *in public*.
- **New entrants: very high (5/5).** Near-zero barriers (semi-public capture, Flash-Lite analysis, free grounding APIs). The only real barriers are trust, taste/brand, and durable capture that survives platform countermeasures — none of which a fast follower gets free.
- **Buyer power: high (4/5).** Abundant free substitutes (native saves, Raindrop free, Stasht/Sorti/Sprink/Albo free) hand buyers total switching leverage. Nobody *has* to pay — the vitamin demand curve, priced at $0.
- **Substitutes: high (4/5).** The dangerous substitutes are not other apps but (a) the *platforms themselves* (Instagram/TikTok can add collection search anytime and have the strongest incentive to close the shopping loop) and (b) *general-purpose AI* (paste a link into Gemini/ChatGPT). We must be materially better than "ask a frontier model once," or the substitute wins on convenience. And per JTBD (§5), the deepest substitute of all is **re-search** and **nonconsumption**.
- **Supplier power: moderate (3/5) — our sharpest exposure.** Two critical suppliers: the inference model (substitutable — OSS Qwen3-VL/Gemma3 fallback keeps this at 3, a genuine strength of the ground-up posture) and the *platforms whose signed responses we intercept* (adversarial, forward-integrating, capable of breaking capture deliberately).

**Verdict: low-to-moderate attractiveness.** High rivalry + high entry threat + high buyer power + a vitamin demand curve = a market entered for reasons other than direct consumer profit. Porter *confirms* the strategic instinct.

### Market 2 — Agency / creator video intelligence

- **Rivalry: high (4/5) but stratified** — you rarely fight all layers at once. Real outcome-layer rivals: dig.ai and VidContext (both early, both fundable).
- **New entrants: moderate (3/5).** Enterprise trust, data-handling/compliance, and a *sales motion* gate entry — higher barriers than consumer, though frontier VLMs keep lowering the technical floor.
- **Buyer power: high (4/5).** Agencies/brands are concentrated, sophisticated, price-negotiate, and demand accuracy guarantees. This is *why* measurable faithfulness (the six-axis eval / VidFactScore spine, Doc 04) is not academic garnish — it is the *sales artifact* that converts skeptical buyers.
- **Substitutes: moderate-high (4/5).** Pipe clips into Gemini/GPT with a custom prompt, or lean on incumbent listening tools. Defense: verifiable grounding to durable external IDs + domain ontology — what a generic prompt can't reliably deliver.
- **Supplier power: moderate (3/5)** — same model-substitutability strength, with a distribution wrinkle: **Twelve Labs is on Amazon Bedrock** ([AWS, July 2025](https://aws.amazon.com/about-aws/whats-new/2025/07/twelvelabs-models-fully-managed-amazon-bedrock/)), so AWS itself can push clients to the incumbent. We can't match that channel; we compete on openness and specificity.

**Verdict: structurally *more* attractive** (real budgets, painkiller not vitamin, WTP $50–300/mo+) but gated by a sales motion. Porter validates the founder's "architect-for-now, build-and-validate-later, build-then-show to agency contacts" sequencing.

**So-what:** the two Porter analyses point in opposite directions on *attractiveness* but the *same* direction on *strategy* — the only asset that survives both is a genuinely-built, *proven*, open engine. Everything else on both maps is commoditizing (consumer organize), capital-gated (Cosmos, Twelve Labs), or asserting-without-proving (all of Rung 3, dig.ai, VidContext).

---

## 5. Demand-side needs — JTBD & Outcome-Driven Innovation: the reframe that decides everything

This is the load-bearing section. It uses Christensen's causal-mechanism JTBD (circumstance, not object or demographic, is the unit of analysis — [HBS](https://www.library.hbs.edu/working-knowledge/clay-christensens-milkshake-marketing); [Christensen Institute](https://www.christenseninstitute.org/theory/jobs-to-be-done/)), Moesta's Four Forces of Progress ([jobstobedone.org](https://jobstobedone.org/the-four-forces/)), and Ulwick's ODI job-map + desired-outcome statements ([Ulwick/Strategyn](https://anthonyulwick.com/outcome-driven-innovation/)).

### 5.1 The reframe: the save moment is *not* the struggling moment

The milkshake lesson is that the *same object* is hired for different jobs in different circumstances, "each job has a very different set of competitors… evaluated according to very different criteria" ([Re-Wired Group](https://therewiredgroup.com/case-studies/milkshakes/)). Apply it to a saved TikTok and there are two distinct jobs:

- **Job A — "capture this so I feel I've dealt with it."** *Already done the instant the user taps save.* The reward is delivered at capture — "the act of bookmarking provides a small dopamine hit of 'I dealt with that' without requiring the actual work" ([Bulkmark](https://bulkmark.io/blog/why-twitter-bookmarks-pile-up)). A tool that helps you do Job A better is *redundant* — the platform's save button already nails it, for free.

- **Job B — "I'm making a real-world decision *right now* and the answer is trapped inside something I once saw."** A struggling moment with a forcing function: dinner tonight; hungry near a place I saved; 90 minutes and nothing to watch; finally buying the thing.

**The graveyard is the proof, not the opportunity.** Read-later apps see 5–10% read-through as a category; a 75-user Instagram-Saved study found the top failure modes were "too much to scroll" and "literally forget they saved stuff," concluding saved content "functions more like a digital junk drawer than an actionable space" ([Bootcamp/Singh](https://medium.com/design-bootcamp/rethinking-instagram-saved-driving-more-revisits-to-saved-content-d368c30009f2)). If a better-organized shoebox were a painkiller, Pocket/Instapaper/Raindrop/mymind/Collections would already have relieved the pain. They didn't. The PKM/"second brain" category confirms it — abandonment via the collector's fallacy, not bad tools ([Forte Labs](https://fortelabs.com/blog/test-driving-a-new-generation-of-second-brain-apps-obsidian-tana-and-mem/)).

Run the Four Forces on "organize my saves" and every quadrant is weak: diffuse push (mild guilt), enormous habit (keep scrolling / re-Google / order DoorDash), real anxiety (yet another app). Net: no switch. **At the decision moment, push spikes** into a concrete deadline and the same capability flips to a painkiller. The decisive design implication: *the moment of truth is the retrieval/resolution moment, not the library view* — ideally a moment the product can be *present for* (proximity, mealtime), the milkshake team's "move the dispenser to the front of the store."

**The corollary, and the honest competitive frame:** the biggest competitor is not Stasht or mymind. It is **re-search** ("just Google/TikTok it again," free and increasingly good) and **nonconsumption** (order takeout, watch whatever autoplays). Christensen's "competing against nonconsumption" is the real fight.

### 5.2 JTBD by domain — ranked by painkiller intensity (ODI desired-outcomes attached)

The pain is not uniform. It is acute exactly where the job is (a) recurring, (b) has an unambiguous execution step, (c) carries a measurable success metric, and (d) where the saved item genuinely can't be re-found by searching.

1. **RECIPES — strongest painkiller, and the one with proven WTP.** Functional job: *"When I've decided to cook tonight, help me execute a dish I was inspired by, without re-deriving it from a video."* Daily forcing function; unambiguous execution test (dinner is on the table or it isn't); documented acute pain — a cited 1,800-cook survey reports 87% saved a recipe in 30 days, **63% failed to find a specific saved recipe in 90 days, 41% abandoned a collection, median 247 saves** (treat exact figures cautiously; the pattern is corroborated — [Némos](https://nemosapp.com/blog/save-recipes-from-instagram-tiktok/)). Qualitatively: "rewinding, pausing, squinting at ingredient amounts that flash for half a second, and eventually giving up and ordering DoorDash" ([Medium/Statescu](https://medium.com/@razvanst/most-people-who-save-a-cooking-video-will-never-cook-it-im-building-an-app-to-fix-that-9d1a7b7a0856)). *ODI outcomes:* minimize time to extract exact ingredient quantities from a video; minimize likelihood of arriving at the stove missing an ingredient; minimize time to find "that specific saved dish." Dedicated paid entrants (Preplo, Némos, Paprika) already monetize this — proof of WTP. **This is precisely what the VLM+OCR+structured-synthesis engine is built to nail.**

2. **RESTAURANTS — strong, but we own only half the job.** Functional job: *"When choosing where to eat, help me act on a place I saw and trusted."* Discovery has moved (§2), but discovery and decision are *sequential stages*: "TikTok and Instagram have won the moment of inspiration, Google still owns the moment of verification" — only ~25% of Gen Z find TikTok effective at *locating* info; 85% still rate Google most helpful for search ([BEApp/Toast](https://blog.beapp.co/2026/06/how-diners-discover-restaurants-on-social-media/)). That seam *is* the grounding-to-Places play: the saved TikTok owns the craving; the pain is the broken bridge to the verified, mappable, "is-it-open, can-I-book" surface. **We win by *completing* the journey to Maps, not replacing it.** *ODI outcomes:* minimize time to resolve a saved place to its current Maps entry; minimize likelihood of trekking to a closed/defunct spot; minimize time to recall "places I saved near where I am now."

3. **FILMS / TV — frequent pain, weak monetization, abundant substitutes.** Functional job: *"When I have time to watch, help me decide on something I already vetted, fast."* Choice overload is quantified (~110 hrs/yr deciding, ~60% have given up entirely — [Streaming Media/UserTesting](https://www.streamingmedia.com/Articles/News/Online-Video-News/Lost-in-the-Stream-Survey-Finds-Americans-Waste-Nearly-Five-Days-a-Year-Just-Deciding-What-to-Watch-167376.aspx)). But substitutes are brutal (Letterboxd, JustWatch, "Play Something," autoplay) and WTP is near-zero. **High frequency, low monetizability — a great engagement/SEO surface, a poor revenue surface.**

4. **PRODUCTS / SHOPPING — weakest, structurally contested.** Purchase intent is real (social commerce >$1.2T in 2025 — [EMARKETER](https://www.emarketer.com/press-releases/tiktok-shop-makes-up-nearly-20-of-social-commerce-in-2025/)) but (a) intent decays fast so a graveyard is near-worthless by resolution time; (b) the platforms have the strongest incentive and best position to close this loop themselves; (c) repeat behavior is low. **A vitamin dressed as commerce — deprioritize for v1.**

### 5.3 Mapping domains onto the three segments

The three audience segments (from the prior digest) are best read as *who* carries these jobs and *how* they buy:

- **Segment-1 — the ad-hoc exporter (commodity job, one-time WTP).** JTBD: *"Get my saves out / preserve them before they rot or the platform changes"* — a *preservation* painkiller our eager-capture-at-save-time architecture already addresses (signed URLs rot; Reddit silently caps saves at 1,000; ~20–30% of saved tweets may point at deleted content — [ContextBolt](https://contextbolt.com/blog/why-social-bookmarks-disappear/)). Validated by Dewey's Export Pass economics. Role: **commodity SEO funnel + one-time upsell**, not a retention business.

- **Segment-2 — the consumption-conscious save-organizer (the vitamin, contested).** JTBD as *usually pitched* ("understand/organize my saves") is Job A — the vitamin. It becomes an aspirin only for the **high-volume, high-frequency heavy saver with a recurring execution deadline**: the weeknight home cook (recipes), the "always deciding where to eat" urban diner (restaurants) — the users for whom volume has already broken platform saves ("too much to scroll") *and* who face the job daily/weekly. Role: **the consumer wedge, but only if narrowed to a single acute domain resolved to action** — never a horizontal "understand everything you saved" promise.

- **Segment-3 — the agency / creator-video-intelligence buyer (the real painkiller, real budget).** JTBD: *"Extract structured, grounded intelligence from a high volume of reference/trend videos — spoken words, on-screen text, creator profiles, entities — faster and more reliably than a human or a generic prompt."* Recurring, high-volume, measurable, budgeted. Role: **the deferred profit center**, the same engine in a deeper/higher-volume/API-MCP config (Doc 04, Doc 05).

**The through-line JTBD insight:** grounding is not a feature — it is the **anxiety-and-habit-reducer** in Moesta's forces. It is what lets a user trust the resolved answer enough to *skip re-searching Google*, which is the only way to beat the dominant habit. Re-expressed: our grounding-to-external-IDs bet *is* our force-of-progress lever. And the standing warning: **do not build Job A while charging for Job B.** Capture/tag/store is table stakes the platforms give away — do it invisibly and cheaply; reserve all product surface, polish, and pricing for resolve-to-action.

---

## 6. Competitor teardown: two maps, three rungs, four layers

### 6.1 Consumer market — three rungs (the distinction matters more than any feature list)

- **Rung 1 — Bookmark managers (organize, don't understand).** *Raindrop* is the price floor: free-forever, Pro $3/mo, AI assistant + full-text + YouTube-transcript search all inside $3 ([help.raindrop.io](https://help.raindrop.io/premium-features)). *Dewey* is the social-native cousin: ingests 10+ platforms, AI bulk-tag, ~50k members, and the telling monetization ladder — Pro $10/mo, $225 lifetime, **$50 Export Pass** ([keep.md](https://keep.md/compare/dewey-vs-raindrop)). Commodity economics.

- **Rung 2 — AI auto-taggers (understand a little, mostly image/text).** *mymind* is the taste/price ceiling ($12.99/mo or $129/yr, member-funded, no investors/ads/tracking, in-image OCR, distinguishes article/product/book/recipe) — **but "can only access public pages," so it does not solve authenticated social capture at all** ([mymind/what](https://mymind.com/what)). *Cosmos* is the venture phenomenon — **$15M Series A** (Shine, Matrix; Squarespace CEO participating), millions of users, 10M images/mo, Apple "25 Apps for 2025," $8/mo ([Pulse 2.0](https://pulse2.com/cosmos-15-million-series-a-closed-as-it-expands-social-discovery-and-attribution-features/)) — and it has *already built our grounding thesis for images*: "a system that researches every image… and synthesizes who created it, what it depicts, where/when it was published, and its cultural lineage" ([Cosmos blog](https://www.cosmos.so/blog/the-future-of-cosmos)). Provenance-grounding, productized — but image-first and creative-audience-first, not actionable-resolution-first.

- **Rung 3 — actionable extractors (our wedge, already crowded).** *Stasht* is the most direct competitor in existence — verbatim our v1 ("Places, dates, recipes, products, text and speech become searchable cards… restaurants on your map, events in your calendar"), 7 platforms, one-click import, free, and now a *public* map ([stasht.app](https://stasht.app/)). *Albo* (recipe + travel extraction, freemium IAP), *Sorti* ("AI taste agent," free), *Sprink* (cross-platform + reminders, free), *ReelRecall* (transcript-search specialist), *ARCHV* (the trust/local-first play: "no account, no tracking, no analytics — everything stays on your device," 14+ platforms). "Quiki" and "The Saved" have negligible footprints — itself a signal that names churn fast here.

### 6.2 Business market — four layers (they rarely compete head-to-head)

- **Foundation-model/API:** *Twelve Labs* — $50M Series A (NEA, NVIDIA NVentures), 30k+ devs, on **Bedrock**, Marengo (512-d multimodal embeddings) + Pegasus (schema-conditioned timestamped JSON). The architecture we already emulate. **Do not position "cheaper than Twelve Labs."**
- **Managed-pipeline/infra:** *Mixpeek* — grounded, citation-first multimodal RAG sold to developers. Architecturally *most similar to our engine*; it validates the architecture and warns us that "grounded pipeline with citations" is not novel at the infra layer — our novelty must be *ontology + eval + domain grounding + productization*, not the RAG plumbing.
- **Application/outcome (the direct business-tier rivals):** *dig.ai* — video-first social listening that "reads the content of the video itself, not the text wrapped around it," evidence-backed search, **$100/mo** entry ([dig.ai](https://dig.ai/)). *VidContext* — "upload a video, get structured text any AI can understand," seven analysis modes, **100 videos for $80**, explicitly "give your AI agent eyes" (MCP-adjacent) — a direct shot across our business-tier bow ([vidcontext.com](https://www.vidcontext.com/)). Worth continuous monitoring.
- **Incumbent social-listening:** Brandwatch, Talkwalker (Hootsuite), Meltwater, Sprout, Tubular — own the *budgets and buyers* but are text/metadata-first; video understanding is bolt-on. Vulnerable on depth-of-video, unassailable on distribution/account control.

### 6.3 Positioning matrix (the two teardowns as a decision, not a catalogue)

| | *Organize / assert* | *Resolve-to-action* | *Verifiable & open* |
|---|---|---|---|
| **Rung 1 (Raindrop, Dewey)** | ● | — | — |
| **Rung 2 (mymind, Cosmos)** | ● (+ taste/provenance) | partial (Cosmos, image) | partial (Cosmos provenance) |
| **Rung 3 (Stasht, Albo, ReelRecall…)** | ● | ● | **✗ (black box, assert-don't-prove)** |
| **Business incumbents** | text-first | — | closed |
| **Twelve Labs / Mixpeek / dig.ai / VidContext** | — | ● (video) | **closed / opaque** |
| **Attic (target)** | (invisible, cheap) | ● | **● (proven, open, portable)** |

**So-what:** every Rung-3 competitor ships actionability but *shows no work* — "restaurant → map" is asserted; none surface confidence, none say "resolved to Google Place ID X, here's the frame and transcript line, correct me if wrong." And every business player is closed. The empty quadrant on *both* maps is the same: **actionable resolution + verifiable/open.** No one is there.

---

## 7. White-space & positioning — Blue Ocean Strategy

Kim & Mauborgne's Strategy Canvas + ERRC/Four Actions ([blueoceanstrategy.com](https://www.blueoceanstrategy.com/tools/strategy-canvas/)) reconstruct buyer value to find uncontested space.

**Consumer strategy canvas — the factors of competition:** every Rung-3 competitor scores *high* on breadth-of-platform, auto-organization, and free-price, and *low-to-nonexistent* on verifiability, external-ID resolution depth, data portability/openness, and trust architecture. The value curve is a herd.

**Four Actions (consumer):**
- **Eliminate — the social/discovery feed.** Cosmos and Stasht are drifting toward public feeds and tastemaker browsing — an engagement arms race a solo founder can't win and that *dilutes the trust promise*. Eliminating it is a positioning asset, not a gap.
- **Reduce — breadth-of-platform racing.** Do TikTok+Instagram *demonstrably deeper* rather than 14 platforms shallowly. Depth is the anti-commodity move.
- **Raise — grounding rigor and *traceability*.** Resolve to real external IDs (Maps, TMDB, Spotify/MusicBrainz) *with visible provenance and confidence* — the consumer-facing expression of the six-axis eval (Doc 04). This is the one axis where we can be measurably, defensibly best.
- **Create — open schema + local-first data ownership that is genuinely portable.** Dewey monetizes *export* precisely because lock-in is the norm; ARCHV wins trust purely by being local. Create the category's first "your understood data is yours, in an open ontology, verifiable, and it leaves cleanly" — turning the export upsell into a *default* and trust from a tagline into an architecture.

**Business strategy canvas:** incumbents are text-first/closed; Twelve Labs/Mixpeek/dig.ai/VidContext are true-video but closed/proprietary. **The empty quadrant is open-core, eval-transparent, grounding-to-durable-IDs.** Open-core is the entrant's classic asymmetric weapon against well-funded closed incumbents — it converts the solo-founder/limited-capital constraint into a distribution-and-trust advantage, *and* doubles as the career/portfolio artifact.

**The single positioning line that unifies both maps:**

> *For people and teams who save more short-form video than they can ever act on, and who can't trust today's tools to actually understand or resolve what's inside — Attic is an open, grounded content-understanding engine that turns saved TikToks and Reels into verifiable, real-world-resolved knowledge (a place on the map, a film on Letterboxd/TMDB, a track on Spotify/MusicBrainz) with its work shown. Unlike Stasht, Sorti, and Albo (which assert results in a black box) or Twelve Labs and dig.ai (powerful but closed and enterprise-gated), Attic proves its accuracy on a public scorecard, grounds to durable open IDs, and lets your data leave in an open schema — free-to-cheap for consumers, and the same engine via API/MCP for agencies.*

**Sustainable advantage — tested against "can they copy it in <2 years?":**
1. **Verifiable grounding + published six-axis eval — durable.** Adding entity extraction is a sprint; building an honest version-locked golden set + a kappa-validated LLM-judge (swap-debias; raw agreement inflates 33–41pp) is slow, unglamorous work almost no consumer app will do — and it is exactly what wins skeptical *agency* buyers. Strongest, most cross-market-transferable moat.
2. **Open-core engine + ontology + schema — durable via commitment.** Cosmos/Stasht *cannot* open-source without cannibalizing their venture theses; we can. Compounds into SEO/AEO, dev trust, portability-as-default. (The taxonomy's durability discipline — closed core, stable URIs, never-delete/deprecate, warrant-based promotion — is specified in Doc 04.)
3. **Eager capture-at-capture-time (poster/media before signed URLs expire) — moderately durable.** An extension-only capability pure mobile apps (Albo, Sorti, most of Rung 3) structurally can't replicate — but adversarial to platforms.
4. **Grounding to durable *open* IDs (MusicBrainz over Spotify, TMDB, Places) — durable** as an engineering-taste/data-quality edge, hard to see and copy.
5. **Depth-over-breadth on TikTok+Instagram — weak alone, strong combined.**

**What is *not* a moat:** auto-tagging, cross-platform breadth, transcript search, recipe/place extraction, a pretty grid, "AI." All already free and ubiquitous. Do not stake positioning on any of them.

---

## 8. Synthesis: where we win, why, and how we'll *know* before the heavy build

### 8.1 Where we win

Consumer: the **top-right actionable-and-verifiable/open quadrant**, entered through a *single acute domain* (recipes first — highest intensity, clearest execution test, proven paid substitutes; restaurants second — largest discovery shift, but designed to *complete* the journey to Maps). Not as a profit center but as a proof-and-funnel-and-portfolio artifact. Business: the **open-core, eval-transparent, grounded API/MCP** quadrant — the deferred profit center on the same engine. The engine that is genuinely built ground-up and *proven* is the only asset that survives both Porter analyses and occupies both blue oceans.

### 8.2 The validation method — build-then-show as a commitment-extraction engine

The core question (vitamin or painkiller?) is falsifiable, and the built engine is the *only possible measuring instrument* — so build-then-show is not a violation of Lean discipline but its correct application here. Two cautions govern the method: (a) the **Mom Test** predicts interview-first discovery will *lie* on an aspirational, identity-flattering idea like "understand my saves" — anchor to *observed behavior and extracted commitment*, not opinion ([momtestbook.com](https://www.momtestbook.com/)); (b) every "show" must end in commitment currency (pay / refer-by-name / retained usage / signature), or it collected fluff.

**Consumer instrument — the task-based retrieval test** (NN/g: ~5 users surface ~85% of usability problems — [NN/g](https://www.nngroup.com/articles/why-you-only-need-to-test-with-5-users/)), run on **each user's own corpus** (not our 1,313-item corpus), against a **past-behavior task** ("find the ramen place you saved a few months ago and couldn't re-find"), **measured against their native-app baseline** (time-to-find, success/fail), **ending in a commitment ask**. Hardened by the **Sean Ellis 40% test** after two weeks ("how would you feel if you could no longer use Attic?" — ≥40% "very disappointed" — [LearningLoop](https://learningloop.io/plays/product-market-fit-survey)) — the single most honest number for a suspected vitamin, collectible only *after* real use of a built thing. GTM doorways validated via **Facade** (not pure Fake-Door) tests that resolve a few items live — satisfying both Savoia's escalation and the 2026 deindex constraint.

**Agency instrument — concierge, then Wizard-of-Oz.** Run **concierge first** (the customer knows it's manual; Food-on-the-Table / Vanta-manual-reports / Ramp-savings-reports pattern — [Lenny](https://www.lennysnewsletter.com/p/how-to-validate-your-b2b-startup)): take one known agency contact's real folder, run the engine in a deeper config overnight, hand back the structured, grounded deliverable *openly as a service*. This tests whether the *output* is worth money and sidesteps the crowded-market problem — you're selling a result to someone who already trusts you. Drive to an **LOI or paid pilot** ("outbound sales is consistently the best signal"). Only *after* an LOI move to Wizard-of-Oz (a dashboard/API that looks autonomous while batches run by hand) to validate workflow/volume before building the scaled pipeline.

**Pre-declared kill/persevere criteria (write them before showing):**
- **Consumer leap-of-faith** (re-finding saved actionable items is felt pain; grounding removes it durably): **persevere** iff ≥~70% task success with meaningfully lower time-to-find than baseline across 5–10 target users, *and* ≥40% "very disappointed" at two weeks, *and* ≥1 commitment per satisfied user. **Miss → it's a vitamin;** pivot toward the Segment-1 one-time Export-Pass funnel (Dewey's proven ~3.75% model), not the retention-dependent Segment-2 subscription.
- **Agency leap-of-faith** (painful, high-volume extraction need + real budget): **persevere** iff ≥1 signed LOI/paid pilot after a concierge deliverable, plus any unsolicited inbound. **No LOI after 2–3 concierge deliverables to warm contacts → the pain is real but not our-priced-solution-shaped;** defer the tier as planned.

### 8.3 The honest read on stickiness and WTP (the part a founder must not flinch from)

- **Stickiness is the central risk, not a footnote.** As pitched horizontally, this is a vitamin, and vitamins are demand-constrained (~18–22% TAM plateau, ~4× slower adoption). The archive view has *no* durable stickiness — the graveyard proves it. Stickiness can exist *only* if the payoff surfaces at the decision moment for a recurring, deadline-bearing job (recipes; restaurants-near-me-now). If the retrieval test shows people don't actually return to their saves, that is not a UX bug to fix — it is the market telling the truth, and the correct response is to lean harder on consumer-as-funnel and accelerate the agency tier.
- **WTP is bimodal and, for the consumer job, near-zero and grudging.** Consumers will pay *cheaply and grudgingly* for the painkiller pockets (recipes especially, where Preplo/Némos/Paprika prove WTP); they will **not** pay for the vitamin. The market has priced Segment-2 at $0. Segment-1 supports a *one-time* $50–225 export/preservation payment (Dewey). Segment-3 is the only tier with real, recurring $50–300/mo+ WTP — and it's the one gated by a sales motion. This is exactly why the two-depth model is sound and why the consumer v1 must **lead with a single acute domain resolved to action**, never a horizontal promise. (Pricing structure, tiers, and Van Westendorp/conjoint methodology → Doc 05.)

**Bottom line:** the market rewards *taste and trust* at least as much as technical depth (mymind is profitable and Cosmos raised $21M *without* solving authenticated social capture or actionable resolution), and Stasht already ships our literal v1 feature list for free. Our edge therefore *cannot* be the feature list. It must be **measurable depth + provenance + openness + design taste**, marketed on trust, aimed at the one job that is a painkiller — and validated with real users, real tasks, and real commitments before the heavy build, against numbers we commit to in advance. The engine remains a career-defining portfolio artifact regardless of the verdict — which is precisely what makes it safe to judge the *product* harshly.

*→ Continue to Doc 05 (Business Model & Pricing) for tiering and WTP research design; Doc 06 (GTM) for the doorway/Facade + AEO/SEO plan and ICP; Doc 04 (Technical Design) for the engine, six-axis eval, and durable-yet-adaptable taxonomy that underwrite the "proven + open" moat; Doc 01 (Product Strategy Memo) for the kernel that ties diagnosis → guiding policy → coherent action.*