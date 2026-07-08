# Commonplace — Design Scope (full inventory, living doc)

> **What this is, and what it isn't.** `CLAUDE-DESIGN-BRIEF.md` is the tight, paste-in-verbatim prompt for a Claude Design session. `SPEC.md` is the single governing document — it decides principles, tokens, voice, and pricing, and it wins on any conflict with this file. **This doc is neither.** It's the exhaustive inventory of every screen, state, receipt shape, and component the product actually needs designed — built by cross-checking the brief against the frozen schema, the roadmap, and the UX-flows spec — so nothing gets discovered mid-build. Edit it freely; when a section stabilizes, port the relevant slice into `CLAUDE-DESIGN-BRIEF.md` §B before a session, or straight into the design constitution if it doesn't need a bespoke render. This file doesn't get pasted into Claude Design wholesale.
>
> **Status:** draft, unreconciled — every open question in §8 is a real fork, not a rhetorical one. **Governs under:** `docs/product/SPEC.md` (v5) · `docs/design/CLAUDE-DESIGN-BRIEF.md` · `docs/product/_ONTOLOGY.md` (v3) · `schema/vocab/*.json` (rc.6). **Supersedes:** nothing — this is additive coverage, not a new decision layer.

---

## 0. Why this exists

The existing brief was scoped when the product's understanding-layer was "an entity resolves to an external ID, or doesn't." Since then, Phase 1 froze the real schema (`schema/json/*.schema.json`, 1.0.0-rc.5/rc.6, 194 eval-harness tests green) and it turned out to be richer than the brief assumed: **four Referent kinds**, not one; **nine facets**, not zero; a **fourth receipt state** the brief never named. None of that richness is fabricated for this doc — every fact below is cited to a file. §1 lists exactly what's missing and where it's verified, so you're not taking my word for it.

## 1. Verified gaps (grounded, not guessed)

| # | Gap | Where verified |
|---|---|---|
| 1 | The schema has **four Referent kinds** — NamedEntity, Concept, Claim, StructuredContent — but the brief's receipt (§B.3) only shows NamedEntity examples (the song, the restaurant). | `_ONTOLOGY.md` §3 |
| 2 | **Nine facets** are frozen with real value lists (`topic`, `intent`, `genre`, `affect`, `creator_role`, `viewer_orientation`, `presentation`, `content_provenance`, `actionability`) and have no visual treatment anywhere. | `schema/vocab/facets.json` (rc.6) |
| 3 | A **fourth receipt state** exists beyond resolved / uncertain / NIL: `regroundPending` — a mention whose resolver is unavailable (e.g., Places is flag-gated and defaults `false`). This is NOT the same as NIL: NIL means "we looked and found nothing"; pending means "we haven't looked yet." | `docs/superpowers/plans/2026-07-08-phase3-mv3-wiring.md` Global Constraints ("never a fake NIL") |
| 4 | The **enrichment badge model changed**: the old `raw / text / visual` tiers (UX-flows doc, now superseded on this point) are retired; the real item status is `raw / analyzed / grounded` (`LibraryRecord.status`). Any card badge design using the old three-tier language is stale. | Phase-3 plan Task 1 (`enrich.test.ts` deleted, `EnrichmentTier` deleted) + Task 3 (`store.ts` `LibraryRecord.status`) |
| 5 | SPEC §8 names **Imports/audit** as a v1 screen and **exactly two** upgrade moments (Deep Scan + cross-device sync). The brief's screen list (§B.5) covers Deep Scan but has no Imports screen and no sync-upgrade screen. | `SPEC.md` §8, §24 Block 2 |
| 6 | Capture now has **two guaranteed lanes per platform** (live interception + official ZIP/DYD export) — SPEC §7 confirms both TikTok and Instagram ship a ZIP importer in v1. No import-flow screens exist anywhere yet. | `SPEC.md` §7 |
| 7 | **Popup** (the toolbar-click surface, ~7 states) is a named surface in the UX-flows behavioral spec but is **absent from SPEC v5's explicit §8 screens list** and absent from the design brief. Likely a continuity omission (doc 05 Appendix A explicitly "carries forward" the three original extension surfaces), not a deliberate cut — flagged as an open question in §8 below, not assumed either way. | `docs/superpowers/specs/2026-05-27-attic-ux-requirements-flows.md` §4.1 vs. `SPEC.md` §8 |
| 8 | **Multi-select + action bar**, the **export panel**, and the **correction ("Fix it") interaction** are named functional requirements with zero visual design. The correction flow specifically feeds the golden-set flywheel (SPEC §9) — it's not a minor affordance. | UX-flows §4.2, §3 Flow E · `SPEC.md` §9 |
| 9 | The dark **"den" mode** token exists (`oklch(0.21 0.01 60)`) but no screen in the diverge or converge set asks for a dark-mode render. Tokens without a rendered check are exactly how a rubrication red goes muddy on a dark ground and nobody notices until implementation. | `SPEC.md` §20 |

## 2. Surface inventory

| Surface | Role | In current brief? | Priority here |
|---|---|---|---|
| **Library** | the workspace, full-tab | Yes — primary focus | keep as-is |
| **Onboarding** | confidence + setup, first run | Partial — only the "wow" beat (3 of 3) | expand (§3) |
| **Settings** | config, inside Library | Yes, underspecified | tighten field list (§3) |
| **Capture HUD** | in-page overlay on the platform tab | Yes, underspecified | expand states (§3) |
| **Popup** | toolbar-click remote control | Not mentioned | **open question §8.2** |
| **Web** | public live-resolve facade (doc 05 proposal) | Not mentioned | confirmed deferred — SPEC v5's §8 screens list doesn't carry doc 05's web surface into v1; treat as intentionally out of scope until a build phase names it |

## 3. Full screens & states checklist

Legend for **Priority**: **G2-core** = render in the CONVERGE (winning-direction) set · **G2-diverge** = also needs all 3 directions in DIVERGE · **constitution** = build directly from tokens/kit once G2 is picked, no bespoke Claude Design render needed · **deferred** = later build phase, don't design yet.

### Library surface

| # | Screen | States to cover | Priority | Note |
|---|---|---|---|---|
| 1 | **Library grid** (home) | loading (ThumbHash blur-up) · empty (first-run hero) · populated · searching · no-results · capture-interrupted banner | G2-diverge + G2-core | brief §B.5.1, unchanged |
| 2 | **Item detail overlay** | per-receipt-kind states, see §4 | G2-diverge + G2-core | brief §B.5.2 — **must gain the Concept/Claim/StructuredContent variants**, not just NamedEntity |
| 3 | **Entity page** (NamedEntity referent) | populated · single-save vs. multi-save header copy | G2-core | brief §B.5.3, unchanged |
| 4 | **Search (cmdk)** | empty query · results with matched-line highlight · no-results | G2-core | brief §B.5.4, unchanged |
| 5 | **This Week shelf** | populated · nothing-new-this-week | G2-core | brief §B.5.5, unchanged |
| 6 | **Empty library** (first-run hero) | — | G2-core | brief §B.5.6, split cleanly from #7 below |
| 7 | **Capture-interrupted state** | — | G2-core | was bundled with #6 in the brief; give it its own render — it's a trust moment ("we didn't lose anything"), not a decoration |
| 8 | **Onboarding — beat 3** ("first grounded wow") | key-valid · key-invalid+retry | G2-core | brief §B.5.7, unchanged |
| 9 | **Onboarding — beats 1–2** (pick your lane; capture how-to) | path-choice · BYO-key walkthrough+validate · capture explainer | constitution | simple forms/explainers; low novelty, doesn't need a bespoke render — build once the constitution + kit exist |
| 10 | **Capture HUD** (in-page overlay) | idle · navigating-to-Favorites · capturing (count/%/target) · nudging · paused-throttle · manual-assist · soft-blocked · done · error | G2-core (3–4 representative states) | brief §B.5.8 only names "progress, counts, stall-nudge" — the full 9-state model is in UX-flows Flow B; render the calm-progress, the stall-nudge, and the soft-blocked states (the three that most risk reading as alarmist), let the rest inherit the pattern |
| 11 | **Deep Scan upgrade moment** | — | G2-core | brief §B.5.9, unchanged |
| 12 | **Sync upgrade moment** (second device appears) | — | **G2-core — new** | SPEC §8 names this as one of "exactly two" upgrade moments; the brief only has one |
| 13 | **Settings** | see field list below | G2-core (primary rows) / constitution (advanced rows) | brief §B.5.10, tighten (below) |
| 14 | **Imports / audit lens** | populated list ("312 captured from Foodie spots, May 27") · empty | G2-core (one render) | **new — named in SPEC §8, missing from the brief.** Cheap to add: reuses the item-card and count language already designed for the grid |
| 15 | **ZIP import flow** (TikTok DYD / IG DYD) | upload/drop · parsing progress · done ("imported 4,132 saves") · error (wrong file / unrecognized export) | deferred | Block 3 in the build sequence, after Block 2 design (`SPEC.md` §24) — design from the constitution once it's live; the "done" state should reuse the receipt/count grammar, not invent new language |
| 16 | **Capture-scope picker** (All Favorites / a Collection / Selected videos) | — | constitution | a radio/list picker, not a novel visual language |
| 17 | **Multi-select + action bar** | selection count · enrich (text/ground) action · visual/native-escalation cost-estimate confirm | G2-core (one render) | risk: this is exactly the kind of persistent toolbar chrome the kill-list rejects ("dashboard stat tiles / engagement chrome") if it's not deliberately designed to feel like an archive tool, not a SaaS bulk-actions bar |
| 18 | **Export panel** | scope/format picker · generating (progress) · downloaded · **capped + upgrade** · per-file error | constitution, except the capped+upgrade state (G2-core) | the capped+upgrade moment is the one that has to nail ADR-05's tone ("exporting the first 500 of 1,313 — upgrade for all," never "out of credits") — worth getting right once in the design tool |
| 19 | **Correction ("Fix it") flow** | closed affordance (on the receipt) · open (candidate picker or free-text override) · submitted confirmation | **G2-core — new** | this feeds the golden-set flywheel (SPEC §9) and fires on every low-confidence card — it is not a minor affordance, and its interaction shape (modal / inline / drawer) is an undesigned open question (§8.5) |
| 20 | **Dark "den" mode pass** | Library grid + Item detail, at minimum | **G2-core — new** | the token exists (SPEC §20); nothing has rendered it yet |

### Popup surface (contingent on §8.2)

| State | Source |
|---|---|
| not-on-TikTok (guide + "open my Favorites") | UX-flows §4.1 |
| ready | " |
| capturing | " |
| enriching | " |
| paused | " |
| done | " |
| no-key | " |

## 4. The receipt, in all four shapes

The brief's receipt design (resolved / amber-uncertain / hollow-gray NIL) is correct as far as it goes — it just only covers one of four Referent kinds, and is missing the fourth state.

**The four states, which apply to every kind:**

| State | Meaning | Visual (per brief §B.2 Direction A) |
|---|---|---|
| **Resolved** | grounded to a durable external ID (or, for Claim/Concept, fully extracted) | rubrication-red accent chip, live link |
| **Uncertain** | resolved below the confidence gate | amber |
| **NIL** | *we looked and found nothing* — a designed abstention | hollow gray, `∅` |
| **Pending** *(new — not in the brief)* | *we haven't looked yet* — resolver unavailable (e.g., Places disabled) | needs its own hollow treatment, visually distinct from NIL — recommend a dotted/outline chip vs. NIL's solid hollow, so a user scanning the library can tell "nothing here" from "check back after enabling Places" |

**The four Referent kinds, each with a different receipt shape:**

- **NamedEntity** (brief's existing examples — keep verbatim): live external ID, confidence, evidence, `Open ↗` / `Not right? Fix it`.
- **Concept** *(new)* — grounds to an internal subject vocabulary or Wikidata class, **not a live external link** in the NamedEntity sense. Needs its own affordance — likely "see other saves about this" rather than "open ↗." Placeholder, schema-accurate, **swap for a real captured item before running the sprint**: *Concept: "sourdough hydration" (subject) — evidence: transcript 0:41, "this is a 78% hydration dough" — related: 3 other saves.*
- **Claim** *(new — but the content already exists in the brief, no fabrication needed)* — a proposition, scored on faithfulness/coverage, evidence-only, no external ID. **Item 2's own caption is already a claim**: *"Yoo Yee is worth every bit of the hype"* — this can render as a Claim card on the same item-detail screen as its NamedEntity (Yoo Yee, the place) and its Concept (whatever cuisine/genre concept applies), demonstrating that one item carries multiple referent kinds at once, which is the actual point of the four-kind model.
- **StructuredContent** *(new)* — a schema.org-shelled shape (Recipe / HowTo / ExercisePlan / etc.), slot-filling, where **each slot value is itself an Observation** (value + observedAt + source) — meaning a structured card isn't just a list, it's a list of dated claims. Placeholder, **needs a real recipe or workout save from the corpus** to render honestly: *[ingredient/step list, each row citing its evidence timestamp]*.

## 5. Facets — the real vocabulary, and where they surface

Real values, frozen in `schema/vocab/facets.json` (rc.6) — not invented for this doc:

| Facet | Values |
|---|---|
| `topic` | food · travel · fitness · fashion · tech · finance · home · entertainment · education · other |
| `intent` | how_to · review · recommendation · haul · demo · meme · explainer · storytime · news · inspiration · other |
| `genre` | tutorial · vlog · skit · edit · compilation · reaction · interview · documentary · performance · slideshow · other |
| `affect` | funny · heartwarming · motivational · calming · exciting · sad · outrage · awe · cringe · neutral |
| `creator_role` | expert · enthusiast · brand · journalist · entertainer · educator · unknown |
| `viewer_orientation` | do · buy · go · watch · learn · feel · save_for_later |
| `presentation` | talking_head · voiceover · text_overlay · cinematic · tutorial_demo · skit · compilation · reaction · slideshow · before_after · pov · room_tour · outfit_showcase · edit · other |
| `content_provenance` | original · repost · clipped · ai_generated · ai_assisted · unknown |
| `actionability` | genuine_rec · informational · entertainment_only · promotional · **ragebait_suspect** |

`actionability: ragebait_suspect` is worth calling out specifically — it's a trust signal nobody else in the field ships (SPEC §19), and it's exactly the kind of honest, slightly uncomfortable label the brand voice should be able to render without flinching.

No facet design exists yet anywhere. See §8.6 for the open question on where they surface.

## 6. Component pattern library

Hand this list to whoever builds the Figma kit / shared React kit (SPEC §20) so it isn't rediscovered piecemeal per screen:

- **Item card** (grid) — poster + ThumbHash placeholder + quiet source mark (♥/👍) + status dot (raw/analyzed/grounded, corrected per §1.4)
- **Provenance strip** — 4 kind-variants (§4) × 4 state-variants (§4); most collapse to shared grammar, but Concept and StructuredContent need distinct layouts, not just a re-skinned NamedEntity strip
- **Confidence tier chip**
- **NIL chip** and **pending chip** — visually distinct from each other (§4)
- **Facet chip**
- **Status/progress bar** — ONE shared component across capture/enrich/export (phase, count/total, %, ETA, pause/resume) — UX-flows §6 requires this consistency explicitly; don't let three surfaces invent three progress bars
- **Empty-state pattern** — warm, instructional, zero shame
- **Error-state pattern** — always a recoverable next action, never a dead end
- **Upgrade-prompt pattern** — value-framed; exactly 2 instances (Deep Scan, sync)
- **Multi-select action bar**
- **Search result row** — matched-line highlight + matched-on badge (transcript / caption / on-screen-text / entity)
- **Settings row** — label + control + validation state
- **Onboarding step indicator**
- **Correction ("Fix it") affordance** — closed + its expanded interaction (shape TBD, §8.5)

## 7. Content requirements (extends brief §B.3)

- Keep Items 1–3 from the brief verbatim — real, verified, ground-truth MBID.
- **Free addition, no new content needed:** render Item 2's caption as its Claim receipt (§4) alongside its existing NamedEntity receipt — demonstrates multi-kind referents on one item at zero content cost.
- **Gap — needs a real item:** a Concept example. Template to fill: `surface term · one evidence quote + timestamp · which other saves it links`.
- **Gap — needs a real item:** a StructuredContent example (a recipe or workout save). Template to fill: `schema.org type · slot/value list, each with its own evidence timestamp`.
- **Gap — can be constructed from existing content:** a facet-tagged example. Item 2 alone plausibly carries `topic: food`, `intent: recommendation`, `actionability: genuine_rec` — worth confirming against the real video rather than asserting.
- **Open question, not decided here:** should an Instagram-shaped card (square/portrait, carousel) enter the diverge set now, or stay TikTok-only since IG capture is Block 3, after Block 2 design (`SPEC.md` §24)? Recommendation: TikTok-only for DIVERGE/CONVERGE, but the card component **must** accept non-9:16 aspect ratios without a later redesign — a constitution requirement, not a render requirement.
- **If Popup makes the sprint (§8.2):** use real corpus numbers already in SPEC's appendix (e.g., "Favorites 1,367 · capturing 214 (16%)"), not invented counts.

## 8. Open questions — real forks, not decided here

1. **Concept/Claim/StructuredContent: separate lens/pages, or item-detail-only?** SPEC §8's ENTITIES lens names only NamedEntity groupings (Places · Food & Recipes · Music · Film/TV · Products · Books). *Recommendation:* item-detail-only for v1 — keeps the lens set unchanged, avoids scope creep before the Phase-2 pilot shows how numerous Concepts actually are in the real corpus. Revisit after that data exists.
2. **Popup: in the Claude Design sprint, or built from the constitution?** SPEC v5's own screens list omits it; the UX-flows behavioral spec still requires it. *Recommendation:* build from the constitution + one reference render — it's compact and low-novelty, and the omission from SPEC v5's list should be treated as intentional unless you say otherwise.
3. **Dark "den" mode: required in CONVERGE, or a fast-follow?** *Recommendation:* required, minimum Library grid + Item detail — catching a token failure (muddy red on dark ground) before implementation is cheap; catching it after is not.
4. **ZIP-import + Imports/audit: render now or defer?** *Recommendation:* defer the upload flow itself to Block 3 (constitution-built then); include one Imports/audit render now in CONVERGE since it's nearly free (reuses existing item-card/receipt language).
5. **Correction ("Fix it") interaction shape — modal, inline edit, or drawer?** This is a product-feel decision, not a style one — it fires constantly and it's the golden-set flywheel. *Recommendation:* a drawer (Vaul, already in the SPEC §20 stack), consistent with the item-detail's own overlay so the library stays visible underneath — but this deserves your call, not a default.
6. **Facet visibility — filter-only, or also tags on cards/detail?** *Recommendation:* filter-first; at most 1–2 quiet tags on item-detail; **none on the grid card** — protects density and the kill-list's "no card drowning in metadata chips" rule.

## 9. Priority tiers summary

- **DIVERGE (3 directions × screens):** unchanged from brief §B.5 — Library grid + Item detail. Keep this cheap on purpose.
- **CONVERGE (winning direction only), full list:** brief's existing #3–10, **plus**: sync-upgrade moment, the Concept/Claim/StructuredContent receipt variants, one dark-mode pass, the correction/fix-it interaction, one Imports/audit render, the multi-select action bar, the export panel's capped+upgrade state, the capture-interrupted state (split from empty-library).
- **Build from the constitution (no bespoke render):** Popup (pending §8.2), onboarding beats 1–2, capture-scope picker, ZIP-import upload flow, export panel (minus the capped+upgrade state), settings' advanced/local-model rows.
- **Deferred past Milestone 1 — don't design yet:** agency/API screens, hosted-credits balance UI detail, live-chat/co-produced-content UI (already in `_ONTOLOGY.md` §9's own deferred list), non-TikTok/IG platform card shapes (Reddit/X/Substack/YouTube).

## 10. Change log

- 2026-07-08 — initial draft, grounded against `SPEC.md` v5, `_ONTOLOGY.md` v3, `schema/vocab/facets.json` (rc.6), `docs/superpowers/plans/2026-07-08-phase3-mv3-wiring.md`, and the UX-flows / product-and-ux dossier docs.
