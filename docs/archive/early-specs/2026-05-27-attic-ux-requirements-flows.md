# Attic — UX Requirements & User Flows (pre-visual)

```
Date:     2026-05-27
Status:   Design approved → spec for review
Author:   Salman Shaheen (with Claude)
Scope:    Functional UX requirements + user flows for the v1 extension. NO visual design.
Parent:   docs/archive/early-specs/2026-05-26-attic-extension-pivot-design.md
          docs/archive/early-specs/2026-05-27-attic-enrichment-entities-design.md (engine, built)
Repo:     s0shaheen/attic  (local: /Users/s0shaheen/Dev/attic-extension)
Next:     Visual design / design kit (Claude Design / Figma) — then implementation plans.
```

## 0. How to read this doc

This defines **what the product must let users do, the journeys, and the states** — the input for the visual design phase. It deliberately contains **no color, type, component styling, layout aesthetics, or brand**. Those are decided from a clean slate in the design phase (the old Attic Parchment+Ink brand is explicitly *not* carried forward). Where this doc says "drawer," "grid," "card," etc., it means an **interaction pattern / information grouping**, not a visual treatment — the designer chooses the form.

## 1. North star & UX goals

**What Attic is for the user:** turn the pile of TikToks you saved-and-forgot into a **searchable, organized, exportable personal library** — so you can actually *find the restaurant / recipe / product you saved*, and take it anywhere (your notes app, your own ChatGPT/Claude). The enriched, browsable library **is** the product; there is no chat agent.

**Functional principles (these constrain the design):**

1. **Local-first, visibly.** Your data lives in your browser; nothing goes to Attic's servers. The only outbound traffic is *your own* Gemini calls when *you* enrich. The UI must make this legible, not just true — it's the core trust posture in a category poisoned by spyware.
2. **Find, don't scroll.** The payoff is retrieval: by entity ("Restaurants," "Places," "Books"), by TikTok Collection, by free-text, by filter. Browsing the raw pile is the fallback, not the goal.
3. **Capture is a means, not the product.** It should feel automatic and safe; the user's attention belongs on the library, not on babysitting a scraper.
4. **Honest, low-friction monetization.** Free proves the value on a real taste; Pro unlocks scale. Never trap the user (no "ran out of credits" walls in the core path).
5. **Resilient to interruption.** Capture and enrichment are long-running over a flaky platform; pause/resume and clear progress are first-class, not afterthoughts.

**Success criteria:** a new user can, in one session, capture their Favorites, enrich a meaningful subset, find a specific saved item by what's *in* it, and export — and understands what (if anything) left their browser.

## 2. Surfaces & navigation

Three surfaces, clean division of labor:

| Surface | Type | Role |
|---|---|---|
| **Popup** | Toolbar click (compact) | **Control + status** while on TikTok: capture state, counts, quick actions, key status. A remote control, not a workspace. |
| **Library** | Full-page tab (extension page) | **The workspace**: browse/find (by item, entity, collection), item detail, drive enrichment, export, settings. |
| **Onboarding** | Full page, first run | Welcome → choose path (export-only vs add-AI-key) → how-to-capture → land in Library. |

**Navigation relationships:**
- First install → **Onboarding** opens automatically (full tab).
- Toolbar click → **Popup**. Popup's "Open Library" → opens/focuses the **Library** tab.
- Popup "Capture" actions operate on the active/most-recent TikTok tab (or open one — see Flow B).
- **Settings** lives inside the Library (a section/route), reachable from both Popup and Library.
- The Popup and Library read the **same local store**, so counts/state are always consistent.

## 3. User flows

Each flow lists the **happy path**, **decision points**, and **states** (empty / loading / in-progress / error / blocked). Visual treatment is out of scope.

### Flow A — Onboarding (first run)

**Goal:** get the user from install to a confident first capture, and set up AI access (optional).

1. Install → Onboarding tab opens.
2. **Welcome**: one-screen "what Attic does" + the local-first promise (what leaves your browser: nothing, unless you add an AI key, in which case only your own Gemini calls).
3. **Path choice (decision point):**
   - **Export-only (Free, no AI):** skip key entirely → straight to capture how-to. (Honors the free tier; AI can be added anytime in Settings.)
   - **Add AI (BYO Gemini key):** short walkthrough — "get a free Gemini key" (link + 2-3 steps) → paste key → we validate it with a tiny test call → success/failure state.
4. **How-to-capture explainer**: brief, concrete — "we'll open your TikTok profile and collect your Favorites; you stay in control; nothing is posted or changed." Sets expectation that a TikTok tab will be used.
5. **Finish** → land in the **Library** (empty state) with a primary "Start capturing" affordance.

**States:** key validation loading / valid / invalid (bad key, network) with retry; "skip for now" always available; returning user who reinstalls sees a shortened version.

### Flow B — Capture

**Goal:** get the user's saved content into the local library as completely and safely as possible, hands-off when it can be.

**Pre-conditions / navigation:**
- The TikTok profile **defaults to the "Videos" tab**; Favorites and Collections are separate tabs (Collections shows its own count). Attic should, on the user's command, **open the profile and auto-select the Favorites tab** (and the chosen Collection, if scoped) rather than make the user navigate.
- **Capture scope (decision point):** `All Favorites` (default) · `A specific Collection` (list the user's Collections, with counts, from the Collections tab) · `Selected videos` (pick from what's already on screen / a future selection mode).

**Happy path (hybrid auto-scroll):**
1. User triggers capture (Popup or Library "Start capturing"), picks scope.
2. Attic ensures the right TikTok tab/tab-section is open (auto-navigate to Favorites / the Collection).
3. **Read the ground-truth target** from the tab button's listed count (e.g., "Favorites 1316").
4. Begin **paced, human-like auto-scroll** (jittered delays, varied scroll distance) while the MAIN-world interceptor skims TikTok's own `item_list` responses; normalized items stream into the local store with **live count + % of target**.
5. Continue until captured ≈ target (allowing for deleted items, which are unservable).
6. **Done state**: "Captured 1,313 of 1,316 (3 unavailable)" + next step (enrich / browse / export).

**Decision points & recovery states:**
- **Stall detection:** if scrolling stops yielding new items **well short of target** (e.g., the spike's ~360 soft-throttle), Attic first attempts the **scroll-up-then-down nudge** + backoff; if still stalled, it **prompts manual-assist**: "TikTok paused us — give the page a scroll to continue" (we keep capturing as they scroll). Manual-assist is always available as an explicit mode.
- **Soft-block / captcha detected:** pause, surface a clear "TikTok asked us to slow down — paused; resume when ready" state; never hammer.
- **Tab closed / navigated away mid-capture:** capture pauses; state is preserved; resuming continues from where it left off (dedupe by video id makes re-runs safe).
- **Free cap reached during capture:** capture continues into the local library (capture isn't the gated dimension by default — see §5), but the user is informed where caps *will* bite (export/AI). (Adjustable per entitlement preset.)

**States:** idle / navigating-to-Favorites / capturing (count, %, target) / nudging / paused-throttle / manual-assist / soft-blocked / done / error.

### Flow C — Enrichment

**Goal:** upgrade captured items from raw → text → (optionally) visual, on the user's terms, without surprise cost or breakage.

**Constraint that shapes the flow:** media/subtitle fetch needs a `tiktok.com` context. So enrichment runs via a **TikTok tab** (foreground or a quietly-managed background tab). "Enrich" from the Library must therefore **ensure a TikTok tab exists** (open one if needed), surfaced honestly ("Attic is using a TikTok tab to fetch video data"). *(Open question to verify in build: whether a background/extension fetch with host-permissions can carry TikTok cookies — if so, the tab requirement disappears. Until proven, design for the tab.)*

**Two tiers:**
- **Text tier** (default): caption + hashtags + subtitles → Gemini text call. Cheap, fast. The standard "enrich" action.
- **Visual tier** (selective): video bytes → Gemini multimodal (on-screen text, visual entities). Slower + more cost. **Never auto-on-all.**

**Happy path:**
1. In the Library, user selects items (multi-select, "all un-enriched," or a filtered set) → action bar: **"Enrich · text"** / **"Enrich · visual"**.
2. **Visual tier (decision point):** show an **upfront estimate** — item count, est. time, and est. cost *in the user's own Gemini spend* — and require confirm before running.
3. **Pre-flight gates:**
   - No AI key set → block with "Add a Gemini key to enrich" (link to Settings). (Free export-only users hit this here.)
   - Entitlement: `aiEnrichment` tier/limit checked (see §5) → if free taste exhausted or visual is Pro-gated → upgrade prompt (value-framed).
4. **Run**: queue with **live progress** (done / total, ok / failed, ETA, running cost estimate), **pause/resume**, and per-item status. Items upgrade in place (raw → text → visual); badges update live.
5. **Done state**: summary (enriched N, failed M with reasons) + retry-failed affordance.

**States & errors (engine never throws — failures are per-item and recorded):** queued / fetching-media / calling-Gemini / ok / failed{no_key, media_fetch_failed, gemini_threw, parse_fail, rate_limited} / paused. Rate-limit (429) → automatic backoff, surfaced as "slowing down to respect your Gemini limits," not an error.

### Flow D — Browse & find (the core value)

**Goal:** locate a specific saved item by what's *in* it, fast.

**Entry:** Library opens on the **item grid** (home) — all captured items, newest-saved first, each showing thumbnail, creator, caption, and an **enrichment badge** (raw / text / visual).

**Lenses over the same library (decision point — how the user wants to look):**
- **By item** (default grid).
- **By entity** — collections of extracted entities ("Restaurants," "Places," "Books," "Products," "Recipes," …). Pick an entity (e.g., *Lilia*) → the saved item(s) that mention it. This is the literal answer to "find the restaurant I saved."
- **By TikTok Collection** — the user's own groupings, preserved as a filter/lens.
- **Imports** — a read-only history ("312 captured from *Foodie spots*, May 27"), for audit / re-export of a past batch (the "C" in the A+C data model).

**Find tools (work across lenses):**
- **Global search** — free-text over caption + transcript + on-screen text + entity names.
- **Filters** — entity type, creator, hashtag, TikTok Collection, enrichment status, capture date.

**Item detail (decision point: keep context):** opening an item shows its detail **without losing the list** (an overlay/drawer-style interaction — visual form TBD): transcript, on-screen text, **linked entities** (click → that entity's items), takeaways, structured content (recipe/workout/list when present), original TikTok link, and an **enrich-this-item** affordance if still raw/text.

**States:** empty (nothing captured yet → prompt to capture) / un-enriched (items present but raw → "enrich to unlock search-by-content") / populated / no-search-results / loading.

### Flow E — Export

**Goal:** take the library (or a slice of it) out of Attic.

1. **Scope (decision point):** everything · current filter/search result · explicit selection.
2. **Format (decision point):** **JSON** (full schema + entity index) · **CSV** (+ optional entities.csv) · **Obsidian vault** (note per item + per entity, backlinked) · **.mp4 videos** (the actual files — AI-independent).
3. **Entitlement gates (see §5):** `exportLimit` cap (with a clear "exporting first N of M — upgrade for all") and `exportFormats` (e.g., Obsidian/.mp4 may be Pro). Value-framed upgrade prompt at the gate.
4. **Generate → download** (files / a ZIP for vault and videos). Progress for large/.mp4 exports.
5. **After**: a short "what now" nudge appropriate to format (e.g., "paste the JSON into your AI," "open the vault in Obsidian").

**States:** scope/format selection / generating (progress) / downloaded / capped (partial + upgrade) / error (per-file failures listed, partial success allowed).

## 4. Surface requirements

Functional requirements per surface — capabilities, states, interactions, constraints. No visual styling.

### 4.1 Popup (control + status)

- **Purpose:** at-a-glance status and quick actions while on TikTok.
- **Must show:** current context (on a TikTok tab? on Favorites?), captured count vs target, enriched count, AI-key status (set / not set), any in-progress job with live progress + pause/resume.
- **Must do:** start/stop capture (with scope quick-pick), trigger enrich (text) on un-enriched, quick export, **Open Library**, jump to Settings/key.
- **States:** not-on-TikTok (guide + "open my Favorites" button) / ready / capturing / enriching / paused / done / no-key.
- **Constraints:** compact (toolbar popup dimensions); never the home for browsing; everything heavy defers to the Library.

### 4.2 Library (workspace)

- **Purpose:** browse/find, drive enrichment, export, settings — the product's home.
- **Must provide:** the four lenses (item / entity / collection / imports), global search, the filter set, item detail (context-preserving), multi-select + action bar (enrich text/visual, export, with the visual cost-estimate confirm), export panel, live job progress, Settings (AI key, license/upgrade, data controls).
- **Capabilities that are entitlement-gated:** visual enrichment, export beyond cap, premium export formats — each shows a value-framed upgrade prompt at the gate, never a dead end.
- **States:** first-run empty / captured-but-unenriched / populated / searching / no-results / job-in-progress / offline-from-TikTok (enrichment needs a TikTok tab — prompt to allow opening one).
- **Constraints:** must remain responsive at multi-thousand-item scale (search/filter over the local store); browse is never gated.

### 4.3 Onboarding (first run)

- **Purpose:** confidence + setup, fast.
- **Must provide:** the value/trust intro, the path choice (export-only vs add-key), the BYO-key walkthrough with live validation, the capture how-to, and a clear hand-off into the Library.
- **States:** per Flow A (key loading/valid/invalid, skippable throughout).
- **Constraints:** skippable; re-openable from Settings ("show me the walkthrough again").

## 5. Data model & entitlements

### 5.1 Library data model (A + C)

- **One unified, deduped library** is the durable artifact, keyed by **video id**. Every capture/enrichment **writes into it**; re-runs fill gaps (dedup automatic). This is what every lens browses.
- **Provenance is first-class metadata** on each item: `source_scope` (`all-favorites` | `collection:<name>` | `manual`), `captured_at`, `enrichment.tier`, and **TikTok Collection membership** (preserved so "by Collection" is a real lens).
- **Imports history (the "C"):** a **read-only log** of capture/enrichment sessions ("what I captured from X on date Y"), enabling audit and re-export of a past batch. It is a *lens/record*, not a separate container — results always live in the one library.
- Capture/enrichment **jobs** are transient process objects (progress, pause/resume, resumable via checkpoint); their *output* is the library.

### 5.2 Entitlement layer (pricing as config, not flow logic)

Flows check **capabilities**, never "is this user Pro?". Tiers are named **presets** of one entitlement object, so pricing/packaging can change without touching flows.

```
entitlements = {
  captureLimit:       number | "unlimited",          // items allowed in the library
  exportLimit:        number | "unlimited",           // items per export
  exportFormats:      subset of [json, csv, obsidian, mp4],
  aiEnrichment:       "none" | "text" | "text+visual",
  aiEnrichmentLimit:  number | "unlimited",           // items enrichable
  aiDelivery:         subset of [byo-key, hosted-credits],
  creditsBalance:     number,                          // only if hosted-credits
  platforms:          subset of [tiktok, instagram],   // future
}
```

**Gate points (where flows consult entitlements):**
- Onboarding → path branch on `aiEnrichment` / `aiDelivery`.
- Capture → `captureLimit` (default: not the gated dimension).
- Enrich → `aiEnrichment === "none"` blocks; visual gated by tier; `aiEnrichmentLimit` caps the free taste; `aiDelivery` selects BYO-key vs credits.
- Export → `exportLimit` cap + `exportFormats` gating.
- Browse/find → **never gated**.

**Default presets (numbers tunable — this is the adjustable config):**

| Capability | Free ($0, BYO-key) | Pro ($19.99 lifetime, BYO-key) |
|---|---|---|
| Capture + browse | unlimited (local) | unlimited |
| AI enrichment | text tier, ~50-item taste | text + visual, unlimited |
| Export | ~500 items, JSON + CSV | unlimited, + Obsidian + .mp4 |

Rationale: rxliuli validates the **$19.99 one-time** anchor and a volume-capped free tier; **BYO-key makes AI ~free to us** (Gemini Flash-Lite ≈ single-digit dollars per 1,000 videos), so we let free users *taste* the enriched library (value-framed upgrade converts ~4× better) rather than wall AI off entirely.

### 5.3 Packaging & licensing decisions

- **Launch with one SKU: $19.99 lifetime, BYO-key, version-locked** (free 1.x updates; a future paid 2.0 funds perpetual TikTok-breakage maintenance — avoids the "lifetime-deal trap").
- **Hosted AI credits: deferred.** BYO-key covers v1; credits are a pure convenience tier to add *only if* non-technical users bounce on the key step. Reselling near-free Gemini is a "race to the bottom" — keep optional. The entitlement layer already supports it (`aiDelivery: hosted-credits` + `creditsBalance`) as a future preset.
- **Billing = Lemon Squeezy** (merchant-of-record: handles global VAT, license-key issuance/validation). **Correction to parent spec:** Lemon Squeezy has **no offline/Ed25519 validation** — every check is a live API call. So licensing must use a **grace-period cache** (validate periodically; allow offline use between checks; tolerate light key-sharing). Detailed in the licensing sub-project, later.

## 6. Cross-cutting requirements

- **Progress & status model** (shared by capture + enrichment + export): every long job exposes phase, count/total, %, ETA where possible, pause/resume, and per-item failure with reasons. Consistent across Popup and Library.
- **Permissions & errors:** clear, recoverable states for: no AI key, invalid key, TikTok soft-block/captcha, rate-limit (backoff, not error), tab closed mid-job, network loss. Never a dead end; always a next action.
- **Privacy surfacing (load-bearing for trust):** the UI states plainly what leaves the browser — **nothing to Attic's servers**; only *your own* Gemini API calls when *you* enrich (and only then do video bytes/text go to Google). Surface in onboarding and a Settings "data & privacy" view. No telemetry of user content.
- **Settings:** AI key management (set/replace/remove, validate), license/upgrade, data controls (export, **clear library**), re-show onboarding.
- **Accessibility:** keyboard navigation for the Library (grid, filters, detail), sufficient contrast (decided in design), focus management for the detail overlay, and non-color status cues (badges have text/icon, not color alone).
- **Empty/zero states** for every surface are first-class (they're the new user's first impression).

## 7. Out of scope (this doc / this phase)

- **All visual design**: color, type, components, layout aesthetics, motion, iconography, the design kit/mockups → the **Claude Design** phase, from a clean slate (old Attic brand not carried forward).
- Licensing/billing **screens** beyond the requirement (designed alongside the licensing sub-project).
- **Instagram** (fast-follow), **data-export ZIP import** (Mode B, later), **hosted AI credits** UI (deferred), marketing/landing site.
- The robust **offscreen resumable-queue** internals and the background-tab-fetch verification (engineering sub-projects; this doc only states the UX constraint they must satisfy).

## 8. Handoff notes for the design phase (Claude Design / Figma)

- **Screens to design:** Onboarding (welcome, path-choice, key-setup+validation, capture how-to); Popup (its ~6 states); Library (item-grid home, entity lens, collection lens, imports lens, search/filter, item detail overlay, multi-select action bar, visual-enrich cost-estimate confirm, export panel, settings); plus the shared **job-progress** and **upgrade-prompt** and **empty/error** patterns.
- **Design the visual identity from scratch** — no constraints inherited from the old product. Tone is open; the only fixed *functional* aesthetic principle is "the user's content (thumbnails) is the focus; chrome should not fight it."
- **Mock the load-bearing states**, not just happy paths: empty, capturing-with-throttle-nudge, enrich-in-progress, no-key block, export-capped-upgrade, no-search-results.
- This doc is the source of truth for *behavior*; the design owns *form*. Where they conflict, reconcile back here.
