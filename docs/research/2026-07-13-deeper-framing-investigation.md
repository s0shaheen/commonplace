# What This Actually Is — the deeper framing, tested against history

```
Date:     2026-07-13
Status:   Research synthesis + argued verdict. Not a spec; nothing here re-decides
          ratified gates. Hypotheses are flagged as hypotheses.
Method:   29-agent grounded investigation (8 research lanes → 18 load-bearing claims
          adversarially fact-checked against primary sources → 3 hostile critics
          attacking the working thesis). 317 web fetches. Two claims failed
          verification and appear here only in corrected form. Prompted by the
          founder's question: "what is the deeper thing this fills or unlocks —
          and how does this class of attempt play out in history?"
Verdicts: journal at .claude session workflows wf_4df2419a-504 (local only).
```

---

## 1. The verdict

**What you are building, named precisely:** a capture-and-normalization instrument for the first mass medium in history that structurally cannot have an archive or an independent measurement layer — because each person's feed is unique, login-walled, multimodal, and gone the moment it is rendered. Every prior mass medium eventually got both: print got legal deposit (1662) and the ISBN/MARC records that made books computable; broadcast got the Nielsen panel and the Vanderbilt Television News Archive; the open web got the Internet Archive, Common Crawl, and GDELT. Whole sciences, industries, and accountability regimes stand on those instruments. The personalized feed has none, none is possible centrally, and the research community has already converged — independently, in writing — on the only remaining observation point: **the consenting user's own client.** That is the thing you felt at dinner but couldn't name. It has a name. It's measurement and archival infrastructure, instantiated at personal scale.

**The three corrections the evidence forces.** The investigation was designed to attack this thesis, and three parts of the *romantic* version of it died:

1. **The schema is not the moat.** Zero-shot GPT-4o hits 98.95% F1 on entity-matching benchmarks ([OpenSanctions Pairs](https://arxiv.org/html/2603.11051), Feb 2026 — the production rule-based system it beat scored 91.33%; a locally-run 14B open model hits 98.23%), and schema-induction systems auto-derive structured views from raw heterogeneous documents at a 110x cost reduction ([Evaporate, VLDB 2024](https://vldb.org/pvldb/vol17/p92-arora.pdf)). Anyone holding raw captures can regenerate an equivalent-or-better schema on demand. What **cannot** be regenerated is the capture itself: impression-level exposure is generated once, shown once, and appears in no export. **The durable asset is the raw longitudinal capture corpus with provenance — plus the consent structure around it. The schema is the codebook**: cheap to rebuild, necessary to *use* the records, versioned, and expected to be restructured by real usage.
2. **"Nielsen-for-feeds" is not a business.** Measurement currencies monetize *ad* exposure, through platform-permissioned clean rooms, with panels of 725k+ and an accreditation regime (MRC) that took congressional hearings to create — and even certified Nielsen rivals are currently failing to displace it ([JIC certified Comscore and VideoAmp in 2024; "no measurement company is certified for transacting cross-platform demos"](https://www.adexchanger.com/measurement/the-jic-certifies-comscore-and-videoamp-as-national-tv-currencies/)). Nobody transacts on organic feed exposure, and the constituencies who want that data — researchers, journalists, watchdogs — are the budget-poor ones (50,000 CrowdTangle petitioners did not become 50,000 customers). The aggregate layer is real, but it is **civic infrastructure exercised through institutions, not a revenue line.**
3. **The insight-mirror is a horoscope with extra steps.** People rate *fake* feedback about themselves as more accurate than real feedback ([Trif et al. 2022](https://doi.org/10.24837/pru.v20i2.518)); Co-Star built ~30M registered users on exactly that mechanic; the flagship self-tracking RCT found the group *with* the data mirror did worse ([IDEA, JAMA 2016](https://pubmed.ncbi.nlm.nih.gov/27654602/): 3.5kg vs 5.9kg weight loss); screen-time dashboards raise awareness without changing behavior; and the strongest feed-exposure experiments ever run moved exposure massively while moving attitudes not at all ([Guess et al., Science 2023](https://www.science.org/doi/10.1126/science.abp9364) — a null contested by unreported mid-study "break glass" algorithm changes, but a contested null is still not a product). "Understand what your feed does to you" is not a defensible personal value proposition. **"Find and use what you kept, in a record that outlives the platform" is.**

**What survives — stronger than before, because it survived attack:**

- **The structural gap is real and on the record.** The US Surgeon General's advisory lists *"What type of content, and at what frequency and intensity, generates the most harm?"* as a priority unanswered research question and names platform data opacity as the barrier ([2023](https://www.hhs.gov/sites/default/files/sg-youth-mental-health-social-media-advisory.pdf)). The APA says the causal data *"may be available within technology companies, but have not been made accessible"* ([2023](https://www.apa.org/topics/social-media-internet/health-advisory-adolescent-social-media-use)). NASEM asked Congress to legislate researcher access ([2024](https://www.ncbi.nlm.nih.gov/books/NBK603423/)). An ERC grantee states the un-observable quantity plainly: *"we need to see the complete outcomes [algorithms] produce in terms of what content they show to individual users"* ([2025](https://erc.europa.eu/news-events/magazine-article/what-users-see-and-dont-see)). Even the EU's compelled-access regime returns a fraction of reality: the first Article 40 application decision took ~80 working days and failed on 5 of 7 requests; audited research APIs expose only ~50–75% of what feeds actually show users and 17–42% of the metadata the platform sends to the user's own browser ([Bekavac & Mayer 2026](https://arxiv.org/html/2601.12390)).
- **Your architecture sits on the winning side of every documented failure axis** (§3). This was the investigation's most surprising result: the canonical *anti*-metadata literature specifically exempts what you're building. Doctorow's "Metacrap" — the essay that buried the Semantic Web — carves out observational, machine-recorded behavioral metadata as *"far more reliable than the stuff that human beings create,"* and Shirky's "Ontology is Overrated" *prescribes* exactly your mechanism: *"you merge from the URLs… probabilistic, partial merges."* Entity resolution to durable public IDs with confidence and NIL states is Shirky's recommendation, implemented.
- **The four-way cell is genuinely empty.** Consented session-level capture × research-grade multimodal analysis × entity-resolved open schema × consumer product: every *pair* is occupied (Zeeschuimer/4CAT has capture+analysis for researchers; the 2025–26 save-app wave has analysis-lite+consumer; screenpipe has capture+consumer as pixels), but no one occupies the intersection — and **entity resolution to durable IDs with confidence/evidence/NIL appears genuinely unbuilt anywhere**, research or consumer. It's empty because it's new (the whole consumer wave postdates cheap multimodal LLMs), hard (Citizen Browser needed 8 engineers and 10 months just for the pipe; Zeeschuimer still can't capture Instagram's Saved overview — your exact surface), and incentive-shaped (grant tools die with grants; startups don't build open schemas because lock-in is their moat).

**The identity, in one breath, for the next dinner:** *"Every mass medium eventually got an independent record — legal deposit for print, Nielsen and the Vanderbilt archive for TV, the Internet Archive for the web. The feed can't have a central one: each person's is unique, authenticated, and erased on render. I build the instrument that lets a person keep their own — complete, portable, entity-resolved, with receipts — which is a product today (your library, finally usable) and, if it spreads, the only honest way the science of this medium ever gets done."*

---

## 2. The answer to "what's the point of the schema?"

This was the question that exposed the gap. The answer, Bain-proof:

**Why not just a URL?** A URL is a pointer into someone else's mutable database. Platform media URLs are signed and expire in hours; posts get deleted; platforms die and take everything (Mozilla shut Pocket July 2025 and **permanently deleted all user data** after Oct 8 2025; Meta acquired Limitless in Dec 2025, disabled Rewind's capture Dec 19, and terminated service — with data deletion — in the EU, UK, Brazil, and four other regions). An ISBN identifies an *edition* forever; a URL locates a *copy* until it moves. The record — content plus context, captured at the moment it existed, with provenance — is what an archive is. That's the durability answer.

**Why not per-item extractors (YouTube-to-transcript etc.)?** Because single-item extraction produces islands. Five thousand islands don't aggregate: without shared identifiers and a shared vocabulary, "which restaurants did I save across three platforms, and which did I save twice" is unanswerable. Normalization + entity resolution is exactly what she already accepted at the Excel level — it's what makes records *comparable*, hence countable, hence analyzable. And the market already prices this operation: what hedge funds pay $100k–$500k/yr for is literally described by the vendor as data *"normalized at the ticker level"* ([YipitData](https://www.yipitdata.com/public-investors)) — entity resolution IS the product; the raw data is worthless to them un-normalized. That's the comparability answer.

**Why an *open, documented* schema?** So the records are usable by parties that don't exist yet — your own future agent over MCP, a researcher with their own governance, the next tool after this one dies. Every archive that mattered was readable without asking its creator's permission. That's the third-party answer — and it's also the honest limit: **the schema is a codebook, not a moat** (§1). Its job is to make records durable, comparable, and consumable; its job is not to be defensible IP, and history says the standard-maker rarely captures the standard's value anyway (§4).

---

## 3. The pattern: when normalizing a messy domain works, and how it fails

This is the general-form answer to "how does this appear in history." Every claim in these tables was researched this session; starred rows survived adversarial fact-checking against primary sources.

### 3a. Five conditions of success

| # | Condition | Historical evidence | Commonplace scored honestly |
|---|---|---|---|
| 1 | **Born from one actor's operational pain, not a metadata vision** | ISBN: triggered by W.H. Smith's 1965 computerized-warehouse plan (Publishers Association/Gordon Foster devised the SBN, 1966; ISO 2108 by 1970)*. MARC: LC's card-distribution costs ($130k pilot, 1966–68)*. Crossref (2000): ~12 publishers drowning in N² bilateral citation-linking deals. | ✅ Born from a real 4,661-item corpus and the founder's own retrieval pain. Not invented for a hypothetical user. |
| 2 | **The describer is paid at the moment of describing — or supply is mandated** | schema.org succeeded because Google/Bing/Yahoo paid webmasters instantly in rich-snippet CTR*. OpenGraph paid in link previews. PDB was voluntary and sparse for ~18 years until journals mandated deposition (IUCr 1989)*; ICD supply is forced by billing; legal deposit by law. **The control case: Dublin Core — elegant, institutionally backed, ignored on the open web because nothing rewarded the person adding markup. Solid — Berners-Lee, MIT, Inrupt, a decade — same fate.** | ✅ by design: capture is a passive byproduct of normal browsing, and the capturing user is paid immediately in retrieval + ownership. ⚠️ But this is exactly why **"open standard adopted by others" cannot be the plan** — nobody else has a payment loop yet. Adoption by researchers requires *their* payoff (a validated instrument they'd otherwise build themselves). |
| 3 | **Minimal durable-identifier core; richness optional** | The UPC carries manufacturer+product identity in a 95-module symbol* — a dumb identifier that seeded the entire CPG-analytics industry and, via the Kilts Center scanner data, a workhorse of empirical economics*. ISBN is 13 digits. Versus: Cyc — ~$200M, ~2,000 person-years, ~30M hand-coded assertions, marginal adoption. | ⚠️ **This is the live pattern violation.** A 4-referent-kind, 9-facet ontology was frozen before any user corpus existed — the Shirky/Cyc failure shape. The mitigation is posture, not rework: the identifier core (Referent → durable public ID, with confidence/NIL) is condition-3-minimal and correct; the facets are hypotheses that real usage must be allowed to restructure. Version the codebook; expect v2 to be shaped by the corpus. |
| 4 | **Validation governance precedes trust — measurement without audit dies** | The MRC exists because 1963–64 congressional hearings caught ratings services fabricating numbers*; Nielsen's currency status survives only under continuous accreditation (it lost MRC accreditation in 2022, regained 2023). PDB runs expert biocuration; ImageNet labeled every image 3× (49k Turk workers, 167 countries)*. **The cautionary case: GDELT — machine-coded news into CAMEO events at scale, ~71% shared variance with hand-curated equivalents, systematic false positives; reliable-but-invalid, and a decade of papers now warns against naive use.** Insel's 2013 verdict on DSM is the same failure: *"The weakness is its lack of validity."* | ✅ The published eval harness + calibrated confidence + designed NIL state is precisely the countermeasure — this instinct predates this investigation and is the single most institutionally-legible thing in the spec. It is the MRC-shaped move, and it's what separates the analysis layer from every "98% accurate" competitor claim. |
| 5 | **Value pools later, at the aggregation/transaction layer, with third parties** | LC gave MARC away; OCLC monetized the shared-record network (cards at less than half traditional cost*; copy cataloging $8.87 vs $58.72–75.43 original, Iowa State 1997–98). Common Crawl archived the web for 15 years as a tiny nonprofit; >80% of GPT-3's tokens came from it*; OpenAI captured the value. The PDB's 230,000 structures (preserved at ~1% of determination cost) trained AlphaFold — the 2024 Chemistry Nobel laureates explicitly credited it* — 50 years after founding, 35 after the mandate. Delicious invented tagging; tagging conquered the web; the company sold to Pinboard in 2017 for $35,000. | ⚠️ Read this cold: **the schema/archive maker does not capture the value; the layer above does.** For a career-defining artifact this is fine — the MARC/Avram position is reputational and real. For revenue it means: price the *product surface* (library, retrieval, agent access), never the records; and treat any future aggregate value as an option others exercise with you, not a plan. |

### 3b. Six failure modes (the taxonomy)

1. **Labor/benefit misalignment** — asking people to describe things so *others* benefit. Killed the Semantic Web, meta-tags, microformats, Dublin Core-on-the-web, Solid. *Dodged by design: observational capture, describer = beneficiary. Doctorow's exemption applies.*
2. **Ontology ahead of use** — categories before corpus. Cyc; Yahoo's directory; Twitter Annotations (announced April 2010 to developer excitement, never shipped). *Live risk — the frozen ontology. Mitigation: treat it as versioned hypothesis (above).*
3. **Archive without an instrument** — collection with no access/analysis layer. The Library of Congress took Twitter's full public archive in 2010, scaled back to "selective" on Dec 26 2017 with the archive *embargoed, "no projected timetable"* for access; ~400 research inquiries went unserved. Gordon Bell's MyLifeBits is the same failure at n=1: *"It just doesn't have a lot of value until we have a lot more software that will make it more useful to us."* *Live risk in miniature: captured saves with weak retrieval = dead capital. The analysis/retrieval layer is not the garnish on capture; it is the product.*
4. **Construct without validity** — reliable labels that measure nothing real. DSM (Insel/RDoC); Klout (log-followers explained 95% of score variance; dead May 2018); GDELT. *Dodged if — and only if — the eval harness ships with published numbers and NIL stays first-class. Never ship a score.*
5. **Measure becomes target** — Goodhart/Campbell. ICD codes became billing and promptly distorted (highest-severity Medicare stays reportedly +20%, FY2014–19). *Future risk only: never tie records to rewards, streaks, or optimization targets.*
6. **Legibility erases context** — Scott's forestry, Bowker & Star: *"Each standard and category valorizes some point of view and silences another."* *Standing discipline: provenance-first, descriptive-before-evaluative, uncertainty explicit.*

The failure literature, read closely, is not a warning against this project. **It is a specification for it** — one your existing instincts (confidence, evidence, NIL, provenance, open export) had already partially written down. The two places it bites are the frozen facets (mode 2) and any drift toward insight-scores (modes 4–5).

---

## 4. The structural gap, stated so it survives a hostile read

The romantic claim — "the feed is the first mass medium with no archive" — is falsifiable by anyone who has opened Google Takeout, and the fact-check lane duly narrowed it. The defensible version:

**What exports/APIs already cover** (never claim otherwise): YouTube's export includes lifetime watch history with URLs/titles. TikTok's covers ~6 months at 100% fidelity for browsing/likes (audited), and in the EEA/UK its DMA-era Data Portability API supports ongoing transfers of watch history, likes, favorites, searches. The user's own save/like/post graph is durably exportable *somewhere* on most platforms.

**What exists nowhere, for anyone:**
- **Impression-level exposure** — what was *shown*, not what was acted on. Absent from every export; the NIO's stated founding rationale is that existing instruments capture *"production behavior… as opposed to consumption behavior or exposure."*
- **Dwell/attention** — "time spent" appears in no platform's export ([audit, arXiv 2502.11208](https://arxiv.org/html/2502.11208v2)).
- **Crippled surfaces** — Instagram: 2-week watch window, Reels history absent, and even Zeeschuimer (the best-maintained research capture tool, 11+ platforms) explicitly cannot capture the Saved overview. This is your headline surface, and it is *technically hard, not just unfashionable*.
- **Anything on a platform that dies or a whim that changes** — Pocket and Limitless both deleted user data within a single 12-month window, 2025.
- **Independent measurement of any of the above.** The only content-level exposure science that exists was run *by platforms on themselves* (Twitter's 2M-account internal amplification experiment; the Meta 2020 election studies), and Science's own embedded rapporteur ruled the model out: *"independence by permission is not independent at all."*

So: **the complete record of the feed exists only transiently, in one place — the consuming client — and the only party with an unambiguous right to keep it is the user.** Consented client-side capture isn't a growth hack or a gray trick; it is the method the research field converged on after every alternative failed (NSF's National Internet Observatory: consented browser extension parsing HTML snapshots into structured records — your architecture, built as public infrastructure, ~10k participants, enclave-gated, US-only, not user-facing). The 2023–26 record — X's $42k/month enterprise API, Pushshift dead, CrowdTangle dead over 50k signatures and an EC proceeding, the NYU Ad Observatory researchers de-platformed *despite* user consent and an FTC rebuke of Meta's justification — all points one direction: platforms are closing every observation channel they control. The client is the one they can't close without breaking the product itself.

One deflationary honesty the civic story must carry: better measurement may *shrink* the harm narrative rather than confirm it (Orben/Przybylski's 0.4%-of-variance "potato" result; the Meta/Science nulls). The honest promise is never "we'll prove feeds are hurting people." It is: **the question becomes answerable.** Measurement precedes findings in both directions — that's what makes it infrastructure rather than advocacy.

---

## 5. Where the value actually lives — the two honest forms

### 5a. Personal: sell the index and the exit. Never the mirror.

The personal-value literature splits on one variable: whether the structured record plugs into **action and retrieval within a task**, or is consumed as **ambient self-knowledge**. The first quadrant is five centuries old and durable — Locke's 1685 commonplace-book indexing method was literally a personal retrieval schema, successful enough that publishers sold pre-formatted blank commonplace books. The second quadrant is a graveyard: wearable abandonment (a third within six months), the IDEA trial's *negative* effect, Bell's self-refutation, the PKM wave's own theorists (Matuschak: *"People who write extensively about note-writing rarely have a serious context of use"*), and Pocket's corpse. Even Pocket's internal numbers (via Fast Company, 2013) showed saves opened at ~10% rates with a ~37-day half-life — and note, the oft-quoted "82% never read" statistic is unsourceable and should never appear in our materials.

Concretely for the product:
- **The pitch that holds:** *the things you kept become findable and usable at the moment of a task — the recipe when cooking, the place when booking, the claim when citing — in a record you own that outlives any platform.* Both halves are now evidence-backed: retrieval is the quadrant history rewards, and platform mortality was demonstrated twice in twelve months.
- **The validation discipline (this is the anti-horoscope answer):** the personal layer can only be validated behaviorally — found-and-used rate at task time; re-open rate of entity-resolved items vs raw saves. Satisfaction and "this feels so me" are Barnum-contaminated and validate nothing. If a Wrapped-like expressive artifact ever ships, it ships labeled as play.
- **The size honesty:** comparables bound the wedge at prosumer-niche revenue — Dewey: 40k users, 1,500 paying after ~4 years; Readwise's $9.99 is the category price ceiling; Rewind/Limitless failed standalone on $33M+ raised. Against the founder's actual bar (strangers pay; 5–20 of them; career artifact first) this is fine. Against any TAM story it is not. Do not build the TAM story.

### 5b. Aggregate: civic/scientific infrastructure — reached through institutions, not through a data business

The evidence kills the direct commercial version (no buyer for organic-exposure measurement; radioactive legality of pooling feed captures — every feed is mostly *other people's* personal data, anonymization of social data is judged unachievable, consent doesn't override ToS per the NYU precedent, and a commercial entity lacks even the research-org exemptions). It equally confirms the *need* (§4) and supplies the model:

**Build the commonplace book; donate the telescope design.** The aggregate significance of this project is as **reference instrument**: the validated capture engine + provenance-first codebook + published eval harness that institutions who already own panels, governance, and legal cover can adopt. Every objection then converts to an asset: representativeness becomes the panel-owner's problem (NIO's probability panel), IRB/GDPR becomes the institution's problem, platform-retaliation risk stays distributed across individuals capturing their own data for personal use. If a pooled-data future ever materializes, it follows the Vanderbilt arc — contested capture, ratified later because it proved indispensable (CBS sued in 1973 and said it would destroy the tapes if it won; Congress instead wrote the archive's practice into the 1976 Copyright Act) — an *option* that requires a legal-ratification moment or an institutional partner, never a plan.

**Who would actually care, and when to talk to them** (after the eval harness has published numbers — that's the credibility artifact; before it, this is just another pitch):
- **National Internet Observatory** (Lazer et al., Northeastern) — they parse raw HTML snapshots into structured records; a validated multimodal normalization layer with confidence/NIL is exactly the layer they lack.
- **Digital Methods Initiative** (Peeters, Amsterdam — Zeeschuimer/4CAT) — closest living relative; complementary (they refuse the surfaces you own); a codebook they could emit to.
- **Data-donation lineage** (Boeschoten/Utrecht — PORT→Feldspar; OSD2F) — DDP-shaped records and live-capture records normalized into one schema is a paper begging to be written.
- **Human Screenome Project** (Ram/Reeves, Stanford) — their stated burden is extraction/categorization of 30M screenshots, not collection; your engine is aimed at their bottleneck.
- **ICPSR's SOMAR** — the deposit-format conversation.
- **AI Forensics** (ex-Tracking Exposed) and the **Knight First Amendment Institute** (defended the NYU researchers) — the EU-audit and legal-posture ends of the same architecture.

The ask in each case is small and concrete: *critique or adopt the codebook; run one pilot on donated, user-consented Commonplace exports.* Not "partner with me" — "here is an instrument; break it."

**On AI training data** (the third rail, named): labs demonstrably pay for structured human data (Surge >$1B revenue 2024; Scale $870M; Reddit ~$60M/yr from Google, $203M booked) — which confirms the *records* have market value and simultaneously why we never touch it: user-derived feed data is consent-chain-poisoned for resale. If that market ever matters here, it is opt-in, individually compensated, institutionally brokered — or it is nothing.

---

## 6. What this changes on the ground (and what it vindicates)

**Vindicated by evidence gathered this session — keep, and say louder:**
1. **Capture-first sequencing.** The corpus is the only non-regenerable asset (§1). Everything else can be redone later; capture missed is gone forever. The current capture-hardening work is aimed at the right subsystem.
2. **Local-first + one-click export.** Pocket (Oct 2025) and Limitless (Dec 2025) turned "platform-hosted archives are mortal" from a value into a fact pattern.
3. **Confidence / evidence / NIL as first-class states.** This is the exact discipline whose absence killed GDELT's validity, DSM's authority, and every "98% accurate" competitor claim. It is also the thing genuinely unbuilt anywhere in the prior-art matrix.
4. **The open eval harness.** It's the MRC-shaped move — the difference between *asserting* measurement and *governing* it. It is also the passport for every §5b conversation.
5. **Refusing feeds, scores, streaks.** Modes 4–5 in the failure taxonomy. The spec's "no engagement loops" clause turns out to be Goodhart-avoidance, not just taste.

**Changed by this investigation:**
1. **Stop calling the schema the moat — internally or externally.** The moat language shifts to: *capture depth on surfaces exports omit + the longitudinal corpus + the consent structure (describer = owner = beneficiary — occupied by no vendor and no panel company)*. The schema is the codebook. This also changes competitive anxiety: the save-app wave copying "AI analysis of your saves" is copying the commodity layer, not the asset.
2. **Demote the facets to hypotheses; protect the identifier core.** The Referent→durable-ID spine with confidence/NIL is condition-3-minimal and survives everything. The 9 facets are pre-corpus guesses sitting in the Cyc failure shape — keep them, but version them and let the first thousand real analyses restructure them without ceremony.
3. **Narrow the public claim.** Not "the first medium with no archive" (falsified by a Takeout) but: *no archive of exposure, attention, or the surfaces platforms cripple — and no independent measurement of any of it.* Precision here is armor; the overstated version invites the cheap rebuttal.
4. **Retrieval carries the burden of proof, not capture.** Bell's verdict localizes the failure of personal archives at retrieval software; LLMs-as-the-missing-software is *the* load-bearing unproven claim of this product. The sequence should reach a measurable retrieval proof (found-and-used, on the founder's own 4,661-item corpus) soon after capture hardening — that number, not more capture polish, is what converts the thesis from argument to demonstration.
5. **Personal-layer validation is behavioral or it is nothing** (§5a). Add the found-and-used metric to the eval methodology alongside entity-resolution P/R.

---

## 7. The graveyard, and the burden of proof

Read honestly, the closest analogs died or were absorbed within ~4 years, almost without exception: Citizen Browser ended 2022; Tracking Exposed dissolved 2023; Mozilla Rally shut 2023; Memex stalled 2024–25; Rewind/Limitless absorbed by Meta Dec 2025; Pocket killed 2025; even OpenAI's Atlas browser — memories, agent mode, the strongest brand in software — lasted ~9 months. The pattern is not "unoccupied because worthless"; it's "occupied repeatedly, then killed by adoption economics or acquisition." The burden is to say why this attempt differs, and the answer must be structural:

- Grant-funded analogs died of *funding cliffs* → this is user-paid from day one, at hobby-scale costs (solo, agentic build, local-first inference on the user's key).
- VC analogs died of *scale-or-die economics* → the explicit bar here is 5–20 paying strangers + a career artifact, which a prosumer niche clears.
- Platform-hosted analogs died *taking the data with them* → local-first + open export makes the product's own death non-catastrophic, which is itself a trust argument no incumbent can copy.
- Panel analogs died of *recruitment economics* → v1 needs no panel; each user's value is self-contained.

The unhedgeable risk remains platform hostility (NYU precedent; store-review risk) — mitigated, not eliminated, by the read-only/own-session/personal-use posture, and by never centralizing what users capture. That risk is the cost of standing at the only observation point left. Vanderbilt stood there for eight years before the law caught up.

---

## 8. Residual uncertainty — what would change this verdict

1. **The retrieval bet could fail.** If entity-resolved retrieval doesn't measurably beat text search on the founder's own corpus (the found-and-used test), the personal layer collapses back into Pocket-with-extra-steps, and the honest move is to say so. This is the single biggest open empirical question.
2. **DSA/DMA expansion could decompress the gap.** If portability APIs reach exposure-level data worldwide (today: EEA-only, action-graph-only), the capture moat narrows to dwell + crippled surfaces. Watch, don't bet either way.
3. **OS-vendor annexation.** Google Personal Intelligence already reasons over YouTube history natively; a Chrome-level "your browsing, analyzed" ships the zero-install version of the personal layer with unmatchable distribution. The surviving differentiation is cross-platform + user-owned + exportable — real, but a residue. If Chrome ships feed-record export, revisit.
4. **The consumer wave could get there first.** Stasht is one entity-resolution feature away from the four-way cell. The defense is the parts that are hard and unglamorous: session-level capture depth and published validation. If a competitor publishes an eval harness first, the career-artifact story loses its clearest exhibit.
5. **The verified-claims ledger** for everything load-bearing above lives in the workflow journal (18 checks: 16 confirmed, 2 corrected — the corrections are incorporated). Two medium-confidence figures to re-verify before any public use: the ICD upcoding +20% figure (single secondary source) and Cyc's $200M/2,000 person-years (estimate, widely repeated, thinly sourced).

---

*Written 2026-07-13 by Fable from a 29-agent grounded investigation; all quoted language verified against primary sources this session unless marked. This document argues; the spec governs. Nothing here opens a ratified gate.*
