# Gate 0 — Turnkey Run-Kit

Everything you need to run the retrieval kill-gate. Thresholds live in `_GATE0-preregistration.md` (sign it before session 1). The strategic *why* is in `session-handoff.md`.

**The shape:** recruit-gate first (cheapest kill) → build the ~25–40h ugly floor *in parallel* → run the paired test → freeze the full build behind the gate.

| Stage | What | Gate to next | Your effort |
|---|---|---|---|
| **0 · Recruit-feasibility** | Zero build. Secure ≥5 qualified out-of-network heavy-savers. | Can't assemble the list → the constraint is **access, not product** → reroute to Export-Pass / agency. **Don't build for users who don't exist.** | ~3–6h DMs, over 1–2 wks — **start Day 0** |
| **1 · Ugly floor (parallel with 0)** | META-12 wire-in + recipe extraction + minimum-fairness search UI + timer. Capture is already built. | Runs end-to-end on your own corpus; pre-registration dated & locked. | ~25–40h over 2–4 wks |
| **2 · Part A + Part B test** | Recipes wedge, per user, own corpus captured live. | Persevere rule clears → Stage 3. Kill rule → vitamin → Export-Pass. | ~1–2h/session ×5–10 + ~15–25h analysis |
| **3 · Restaurant moat probe** *(only if recipes persevere)* | One Google Places resolver + Entity→Mention adapter + port the `ground-demo.ts` selector. **First test of the actual moat.** | Grounding differentiates re-find → fund the apparatus. No differentiation → validated-but-commoditized; reconsider before INST-6. | ~4–8h + Places key + sessions |
| **4 · INST-6, unbundled** *(post-Gate-0)* | Build WEMI / IndexedDB / grid / design-system **node-by-node**, each justified. | Each node gated by a **Gate-1 durability** signal — never up front. | ~250–400h, incremental |

> **RT2 pre-commit (do this before session 1):** write a one-paragraph *minimum-fairness UI spec* bounding how ugly the floor may be — instant client-side filter, legible result rows, one unambiguous resolved-answer affordance. This stops "the plain list is correct *because* it's ugly" from becoming a demand-characteristic confound.

---

## Stage 0 — Recruit-feasibility gate (do this first, this week, zero code)

**The question:** *Can you name and secure verbal commitment, this week, from ≥5 people **outside** your finance/tech/film network who are (a) density-screened heavy savers (30+ recipe saves in the last 30 days), (b) can recount **unprompted** a specific past re-find failure, and (c) will consent to live-capture of their own Saved folder?*

**Why it gates everything:** recruitment-invalidity is program risk #3 and it is **instrument-independent** — if you can't reach the beachhead, the concierge, the floor build, and INST-6 all run on the wrong users. Your own 6.2% food-save density is an *unrepresentative floor* set by a finance/tech/film corpus; it's a recruiting instruction, not a viability verdict. **PASS** → proceed. **HARD HALT** → pre-declare the binding constraint is distribution/access and reroute to the Export-Pass funnel or the warm-contact agency tier.

### Recruit message (reveals only the domain, never the hypothesis)

> **Paid 30-min research session — for people who save a LOT of cooking videos on TikTok / Instagram**
>
> I'm running a short research study on how people actually use the cooking videos they save on TikTok and Instagram Reels — the ones you bookmark meaning to make later. It's not a class, not a sales call, and I'm not showing you anything to buy. I just want to watch how you use your own saved folder.
>
> You're a fit if you: save cooking/recipe videos most weeks · already have a big pile built up over months · actually cook (or mean to) from them on weeknights.
>
> **How it works:** a 30-minute video call where we open *your own* saved folder together on your phone and I ask you to pull up a few specific recipes you saved a while back. I don't need your password, I won't post anything, nothing you've saved gets shared. **$25 (or a gift card) for your time.**
>
> Reply with two quick things and I'll send a scheduling link: (1) roughly how many cooking videos have you saved? (2) When did you last cook something you'd saved?

*Post to: buy-nothing / neighbourhood groups, r/recipes, r/EatCheapAndHealthy, home-cook Discords, meal-prep Facebook groups. **Never recruit from your own finance/tech/film network** — that population invalidates the test.*

### Screener (screen IN only if all pass)

1. **Density (≥~10):** "In the last 30 days, about how many cooking/recipe videos have you saved on TikTok and/or Instagram?" — density predicts retrieval-job frequency; corpus *share* is the wrong denominator.
2. **Recurring deadline (≥2):** "In a normal week, how many weeknight dinners do you cook yourself, vs takeout / eating out / leftovers?"
3. **Past-behaviour re-find (load-bearing):** "Tell me about the last time you went back to look for a specific recipe you'd saved a while ago. What were you trying to make, and what happened?" — Open-ended, past behaviour only. **Do not** say re-finding is hard. Screen IN only if they can, unprompted, name a real saved item they went back for. (Never-returned = save-and-forget = the vitamin population = wrong participant.)
4. **Own corpus, live-capturable:** "Do you have TikTok/IG on your phone, logged in, with your saved folder — and would you screen-share it on the call?"
5. **Corpus age (≥~3 months):** tasks anchor to genuinely old saves, so there must be an aged backlog.
6. **(Facilitator-side, don't ask aloud):** confirm NOT a friend/colleague/own-network contact.

---

## (Optional) Concierge kill-sniff — an even-cheaper demand read *before* the build

**This is optional and KILL-ONLY. It is not a gate and it cannot greenlight anything beyond the ~25–40h floor build.** Run it only if you want to de-risk demand before spending build-hours. You play the retrieval engine by hand at a *perfect human-oracle ceiling*, so `Value(engine) ≤ Value(concierge)` always — a flat reaction is a valid ceiling-kill ("even a flawless hand-delivered answer didn't move them"); a good reaction proves only that *a perfect answer* is valuable and leaves the engine's real answer-quality **untested**. Its time-delta is **not** valid evidence (you did the retrieval).

1. **Capture their corpus** (Alt+Shift+A to auto-scroll their Favorites, Alt+Shift+E to enrich → `attic-enriched.json`, Alt+Shift+S → `attic-favorites.json`). Grep those files — don't resolve from memory.
2. **Elicit** 2–3 specific past-saved recipes they later wanted (Mom-Test clean; don't suggest the pain).
3. **Time their baseline** on one named target ("find it the way you normally would"; stopwatch; 180s cap; say nothing).
4. **Play the engine** on a *different* target: grep the JSON, pull the exact video + extracted ingredients/steps, hand it back **deadpan** ("here it is — [dish], ingredients and steps"). Your delight is the confound, not the answer.
5. **Measure** the reaction to a perfect answer (genuine relief vs "I'd have just Googled it again") **and force one costly commitment** (deposit / name-and-message a friend now / install-and-keep).
6. **KILL** if a perfect answer to a real past-struggle lands flat with **zero commitments** → stop, don't build, pivot to Export-Pass. **PASS** (relief + ≥1 commitment) → earns only the right to build the ugly floor.

---

## Stage 2 — Session runbook (Part A discovery + Part B paired test)

0. **Pre-register once, dated, locked** (see `_GATE0-preregistration.md`). Locking before session 1 is what stops artifact-pride from bending the number later.
1. **Consent + neutral framing.** Screen-share on; consent to local capture (nothing posted, no password). Frame as "two different ways to look through your saves" — never "my product / the tool I built."
2. **Capture their OWN corpus, live.** Alt+Shift+A → Alt+Shift+E. Confirm N captured and that covers render in-session (URLs are fresh at capture; media-rot only bites a *return* visit, which this same-session test doesn't exercise).
3. **Elicit ≥3 distinct past-struggle targets — before they touch the instrument.** From memory, specific recipes saved a while ago and later wanted. Record verbatim; verify each against the capture; lock the exact ground-truth video per target.
4. **Randomise items across conditions (between-item — kills carryover).** Each target → Tool *or* Baseline, different items; never the same target twice. Counterbalance order across users (odd=Tool-first, even=Baseline-first); log it.
5. **Pin the baseline path** per user (native saved-search or memory), choosing targets where that path **historically failed** — so baseline is representative, not a strawman.
6. **Run BASELINE items.** "Find it the way you normally would," timer on "go." Stop on found-and-confirmed or give-up; 180s cap = fail. Collect 1–5 trust rating. **Founder silent.**
7. **Run TOOL items — machine resolves, you do not.** User drives the search box; software surfaces the resolved answer (recipe = structured ingredients/steps). Time to found-and-confirmed or give-up, 180s cap. Collect trust rating. **No coaching, no pointing.** A NIL on a genuinely-wanted target = a **fail**, pre-registered.
8. **Score objectively + record the ordered outcome.** Success = independently reached the pre-registered exact ground-truth entity, no hints. "Close enough" ≠ success. Keep the recording so scoring is auditable.
9. **Commitment ask — every session.** One costly currency: pay (deposit/pre-order at a real price — anchor Preplo $9.99/mo, $129 lifetime; Paprika ~$5; Dewey $50) / refer-by-name (name AND message a friend now) / retained install. Compliments don't count. Record currency + whether they actually did it.
10. **Seed the Gate-1 follow-up.** Schedule a 2-week retained-install re-check (Sean Ellis 40%). This is **Gate 1** (durability), not Gate 0 — don't let a pass masquerade as PMF.
11. **Log one row per user + attach the recording** (columns below) so the paired delta, sign test, and discordant-success are all recomputable.

### Results-sheet columns (one row per user)

`user_id` · `recruit_source` · `not_own_network` (bool) · `wedge` (recipe) · `recipe_density_30d` · `weeknight_meals_cooked` · `corpus_size_captured` · `condition_order` (Tool-first|Baseline-first) · `baseline_path` (native-search|memory) · `n_items_elicited` · `items_json` *(array of {target, condition, time_s, outcome: found|gaveup|nil, trust_1to5, historically_failed_in_baseline})* · `tool_time_median_s` · `baseline_time_median_s` · `time_delta_s` (baseline−tool; +=tool faster) · `pct_faster` · `faster_in_tool` (bool — the paired unit for the sign test) · `reversal_flag` · `tool_success_n / tool_items_n` · `baseline_success_n / baseline_items_n` · `nil_on_target_n` (fail) · `trust_mean_tool` · `trust_mean_baseline` · `trusted_success_share` (gate ≥~80%) · `vitamin_tell_quote` · `commitment_type` · `commitment_obtained` (bool) · `gate1_recheck_date` · `session_recording_link` · `notes`

---

## Mom-Test guardrails (tape these to the monitor)

1. **Don't pitch or name the hypothesis.** Never "re-finding saved recipes is hard," "grounded/searchable library," "fix your save graveyard." Reveal only the domain. Naming the pain manufactures the agreement.
2. **No hypotheticals/opinions/feature questions** — no "would you use…", "how much would you pay…", "wouldn't it be great if…". Only specific past events. Opinions about the future are kind and they lie.
3. **Don't fish for the pain.** If there's no felt pain, that silence **is** the finding — don't rescue it.
4. **Don't help during the Tool run.** No coaching, no pointing. The machine resolves or it fails. If you become the engine, you tested yourself.
5. **Don't score generously.** Exact pre-registered ground-truth, no "close enough." A NIL on a wanted item = fail, not admirable caution.
6. **Compliments ≠ validation.** "So cool, I'd totally use this" is free politeness. Only a costly commitment counts.
7. **Never search the same target twice** across conditions (memory contamination).
8. **Don't change task/baseline/thresholds mid-study** to flatter a result. The lock exists to prevent exactly this.
9. **No friends/colleagues/own-network.** Wrong population + politeness bias silently invalidates the gate.
10. **Don't fill silences or react with affect** ("yes!", "exactly!"). Neutral, minimal, **symmetric** acknowledgment across both arms so observation effects cancel in the paired difference.
11. **In the concierge sniff:** deliver the perfect answer deadpan. Read the reaction + commitment, not the smile — human delight manufactures love for *you*, not the tool.
12. **Don't over-claim a pass.** It validates demand + solution-sufficiency, not durability. Durability is Gate 1; flag it as a separate open dependency.
