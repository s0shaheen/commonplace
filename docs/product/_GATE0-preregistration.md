# Gate 0 — Retrieval Kill-Gate: Pre-Registration

> **Sign & date this BEFORE session 1. Thresholds lock here; no post-hoc edits.**
> Signed: ________________   Date: ____________
>
> This is critical-path step 5 ("sign & date the kill-gate pre-registration"). It reconciles the two places the dossier defined Gate 0 — doc 08 §5 (within-subject delta) and doc 02 §8 (≥70% absolute rate) — into one authoritative instrument. The operational runbook is `_GATE0-kit.md`; the sequencing rationale is `_RESUME.md`.

---

## 0. The metric, settled (resolves the doc-02 vs doc-08 contradiction)

**The within-subject PAIRED time-to-find delta is the single primary persevere/kill instrument.** Each user is their own control: their time/success *in the tool* vs the same user on the same class of task against their native-app search or memory. The **~70% absolute task-success rate is demoted to a directional sanity floor only — it is NOT a gate.**

Why (this is not a preference, it's the statistics):
- At N=5–10 a marginal success *rate* is uninterpretable. At N=5 the only attainable rates are 60% (3/5) or 80% (4/5) — 70% isn't even reachable — and the Wilson 95% CI on 4/5 is ≈[0.38, 0.96], which straddles the 70% line. The verdict would flip inside its own sampling noise.
- NN/g puts benchmark *rate* estimation at ~20+ users. The "5-user rule" is Nielsen–Landauer problem **discovery** (1−(1−0.31)⁵ ≈ 0.85), a detection model — conflating the two is a category error (this was doc 08 §5's correction of an earlier draft).
- A **one-tailed sign test on paired deltas** cancels the dominant between-user variance and has real power exactly when the painkiller prediction holds (a large, consistent effect): significant at **5/5 (p≈.031), 7/8 (p≈.035), or 9/10 (p≈.011)**. So N=5–10 is *too small for a rate and adequate for a large paired effect* — a big consistent win is provable at N≈8; anything short reads honestly as "not a painkiller" instead of being laundered into a "close-to-70%" persevere.

**Doc hygiene:** doc 02 line ~206 ("persevere iff ≥~70% task success across 5–10 users") is a stale pre-correction artifact — edit it to make the paired delta primary and reword "~70%" as "directional sanity floor only," cross-referencing doc 08 §5.

---

## 1. Objective & leap-of-faith

Determine whether re-finding a specific, actionable item a user previously saved on TikTok/Instagram (**a recipe to cook**) is a felt **painkiller** that this engine's retrieval removes measurably better than the user's status-quo path — i.e. **kill or persevere the consumer thesis before the INST-6 build.**

The null we are trying hard to confirm: it's a **vitamin** (the save-graveyard; the read-later 18–22% plateau; Pocket's 2025 shutdown). Gate 0 exists to kill the consumer thesis cheaply. The engine remains a career artifact either way — which is exactly what makes it safe to judge the *product* harshly.

**Wedge for this run: recipes.** (See §5 caveat — a recipe pass validates the *pain* but not the *grounding moat*; restaurants is the mandatory follow-on moat probe.)

---

## 2. Part A — Qualitative discovery (Mom-Test-clean, behaviour over opinion)

On each recruited user's **OWN corpus, captured LIVE in-session** (media intact via the eager-capture path — the internal 1,313-item corpus and the founder's own expired-media corpus are **invalid** here):

- Elicit **≥3 distinct, NAMED past-struggle items** the user recounts **unprompted** ("the miso-salmon recipe you saved and couldn't re-find") — never a hypothetical.
- Confirm corpus density on the wedge.
- **No founder-as-oracle hand-delivery.**

**Demand-floor KILL:** if **no user across the cohort** can name a single lost save they actually wanted back → the thesis is a vitamin. Halt here, before any Stage-3 build.

---

## 3. Part B — Within-subject paired retrieval

Recipes wedge. **The software** (`enrich.ts` → `grounding.ts` pipeline: route → candidates → select → confidence-gate → NIL + provenance), **not the founder**, does the resolution. Founder silent and scripted.

- **Between-item design:** the ≥3 elicited items are randomly assigned to **Tool** vs the user's own **native-app-search / memory baseline**. **Never search the same item twice** (a found item is memory-contaminated).
- **Counterbalance order:** odd users Tool-first, even users Baseline-first; log order and check it as a carryover covariate.
- **Baseline = the user's actual status-quo path**, with target items chosen where that path **historically failed** them (so the baseline is representative, not a strawman — otherwise TikTok's near-useless in-app search hands the tool an unearned win).
- Both arms timed; **180 s ceiling censored as fail**; per-retrieval **trust rating** (1–5) collected.
- **A NIL on an item the user genuinely wanted is scored a retrieval FAIL** (not a confidence-gate win).
- Sessions **recorded** for auditable scoring.
- **Every session closes in a commitment ask** (pay / refer-by-name / retained install).
- **Primary statistic:** one-tailed sign / Wilcoxon on paired deltas. **Secondary:** McNemar on discordant success pairs (catches the fast-but-wrong failure mode).

---

## 4. The decision rules (locked)

**PERSEVERE iff ALL of:**
1. Cohort **median within-subject time-to-find ≥ ~40–50% faster** in Tool than each user's own baseline; **AND**
2. **Directional consistency** significant by one-tailed sign test — concretely **≥5/5, ≥7/8, or ≥9/10 users faster** (i.e. **≤1 reversal at N≈8–10**); **AND**
3. Users reach a resolved, actionable answer they say they **trust on ≥~80% of successful retrievals**; **AND**
4. **≥1 real commitment** (pay / refer-by-name / retained install) per satisfied user.

*Sanity floor (NOT a gate):* absolute success ~70% — if success falls far below this even where the delta looks good, flag **fast-but-wrong** and investigate before persevering.

**KILL / PIVOT iff ANY of:** paired delta small (**< ~20–25%**) · inconsistent (reversals in **≥ ~1/3** of users) · reversed · users don't trust the resolved answer · **zero** commitments across satisfied users · the Part A demand-floor fires.
→ Verdict = **vitamin.** Pivot to the one-time Dewey-style **Export-Pass funnel** ($50 48-hr / $225 lifetime) plus the agency tier. Do **not** proceed to Stage 3/4.

**AMBIGUOUS** (delta positive but ~+20–40%, or mixed reversals): do **not** default to chasing a true rate at N≈15–20 — that recruit exceeds what the wedge warrants. First sharpen the **qualitative read** (Part A) and the **commitment** signal, which discriminate painkiller from vitamin better than a marginal small-N rate. Escalate to N≈15–20 only if a genuine population rate estimate is decision-critical, and record that it is a larger, harder recruit than the beachhead warrants.

---

## 5. Scope of a pass — what Gate 0 does NOT license (honesty locks)

- **A pass ≠ product-market fit.** It validates *acute demand* + *solution-sufficiency* — **not** the "removes it **durably**" clause. Durability is **Gate 1** (2-week retained install, Sean Ellis ≥40% "very disappointed"), which collides with the zero-telemetry/no-accounts paradox. Never let a Gate-0 pass masquerade as PMF or license the WEMI/IndexedDB/design-system spend.
- **A recipe pass ≠ moat validation.** Verified in the code: `grounding.ts` only resolves `type === "media"` (`grounding.ts:148`); a `recipe` mention finds no resolver and NILs (`grounding.ts:83`). **A recipe grounds to itself** — the value is structured ingredient/step extraction, so `grounding.ts` is entirely off the recipe retrieval path. Recipe extraction is also red-ocean (Preplo / ReciMe / Némos already ship it). So a recipe pass proves the *pain* is real but says **nothing** about the grounding moat. **The restaurant→Places probe (Stage 3) is the first test that exercises the moat, and is mandatory before any INST-6/grounding spend.**
- **No answer-quality floor exists yet** — no golden set, ~0% grounding coverage on the wedge domains. Pre-register an expected NIL-rate / accuracy band, or the persevere lacks a quality pass/fail line.
- **Freshly-ingested-vs-lived-in asymmetry:** the Tool arm runs on a just-captured library; the Baseline on the user's lived-in account. Neutralised by choosing targets where the native path historically failed and pre-registering the baseline definition.
- **Demand characteristics + founder-as-oracle** inflate the tool and stated liking. Mitigation: founder silent/scripted, software resolves, objective ground-truth scoring, recorded sessions, and the **costly commitment ask as the load-bearing filter** that separates politeness from demand.
