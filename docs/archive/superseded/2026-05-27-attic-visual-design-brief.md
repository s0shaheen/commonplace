# Attic — Visual Design Brief (for Claude Design / Figma)

```
Date:    2026-05-27
Use:     Paste into Claude Design / Figma to (1) create the visual identity + design kit
         from scratch, and (2) produce high-fidelity mockups of the screens & states below.
Source:  Behavior, IA, flows, and states are FIXED by the UX spec
         (docs/archive/early-specs/2026-05-27-attic-ux-requirements-flows.md).
         This brief hands over FORM. Where this and the UX spec conflict, the UX spec wins on behavior.
Status:  No prior brand. Design the identity from a clean slate.
```

## 0. The one rule

**Behavior is fixed; form is yours.** This brief gives you the product, the screens, the content each screen carries, and the states to mock. You own the visual identity, the design system, and every aesthetic choice. There is **no existing brand to honor** — start clean and commit to a distinctive point of view.

## 1. The product in one breath

**Attic** is a Chrome/Edge extension that turns the TikToks a person saved-and-forgot into a **private, searchable, organized library** they can actually mine — "find the restaurant I saved," "pull every recipe," "export it all to my notes." It captures the user's *own* saved content, stores it **locally** (nothing on our servers), and optionally enriches each item with AI (transcript, on-screen text, named entities, takeaways) using the user's own API key. The browsable, enriched library *is* the product.

**Audience:** prosumers, creators, researchers, organized-hoarder types — people with hundreds-to-thousands of saves and a "second brain" instinct. Comfortable with browsers; many comfortable getting an API key.

**The feeling to evoke:** *calm, trustworthy, personal — a private archive you own.* This is the load-bearing emotional requirement: the "TikTok export/downloader" category was poisoned by a 2025 spyware wave, so the design must read **safe, premium, and personal — explicitly NOT a sketchy grabber/downloader tool.** Trust is a feature; make it visible.

## 2. Identity to create (from scratch)

Commit to **one** intentional aesthetic direction and execute it precisely. Avoid generic "AI default" aesthetics: no Inter/Roboto/system-font defaults, no purple-gradient-on-white, no cookie-cutter SaaS dashboard look.

**Fixed functional principles (these constrain the aesthetic, not the style):**
- **Content is the color.** The user's TikTok thumbnails and entity imagery bring the saturation and life. The chrome should **frame** that content, not compete with it. A restrained, confident shell lets a wall of thumbnails sing.
- **Trust is visible.** The privacy posture ("nothing leaves your browser") should be felt in the calm, deliberate, non-aggressive design — not loud, not adware-y.
- **Readable at density.** The Library can hold thousands of items; the system must stay legible and calm when dense, and feel intentional when sparse.
- **An "Attic" concept is available, not mandatory** — the metaphor of a loft/archive where you keep things worth keeping. Use it if it inspires a distinctive direction; ignore it if a stronger idea emerges.

**Aesthetic dimensions to decide and own:**
- **Typography** — a distinctive display/heading voice paired with a refined, highly-legible body face; a mono face for data (counts, IDs, durations) if it suits the direction. Make characterful choices.
- **Color & theme** — a cohesive palette with **light and dark** modes. Because content brings the color, the chrome palette can be confident and restrained; commit to it via tokens.
- **Spatial composition** — the grid, density, and rhythm; how a thumbnail wall, an entity collection, and a focused detail view each breathe.
- **Motion** — restrained and purposeful. One well-orchestrated reveal (e.g., the library populating, capture progress) beats scattered micro-interactions. Progress and state changes should feel alive but never busy.
- **Depth & texture** — your call on borders/dividers vs shadows vs subtle texture; pick an approach and apply it consistently.
- **A signature** — one memorable element that makes Attic recognizably itself (a mark, a motion, a way entities are presented, a capture animation — something).

**Three candidate moods (springboards — pick one and commit, or invent your own):**
1. **Quiet archive / editorial** — refined and library-like: generous negative space, a serif or editorial display voice, restrained palette, the feel of a well-kept personal collection.
2. **Modern utility / crisp** — clean and confident, high legibility, monospace accents for data, structured and fast-feeling; tool-as-instrument.
3. **Warm & collected / tactile** — cozy "scrapbook/attic" warmth, soft materiality, the feel of curating things you love.

Do **not** blend these — choose a clear direction.

## 3. Form factors & platform constraints

- **Popup** — a small fixed window (design for ~360–420px wide, height variable/compact). Glanceable; a control panel, not a workspace.
- **Library** — a full browser tab. Responsive; must work calm-when-sparse and legible-when-dense (thousands of items).
- **Onboarding** — a full page, focused and linear.
- Browser-extension context (Chrome/Edge). Support **light + dark**. Respect platform conventions (it lives in a browser, not a native app shell).

## 4. Design system / kit to produce

Establish a reusable kit (this is half the deliverable):
- **Tokens:** semantic color (light + dark), type scale + pairing, spacing scale, radii, border/elevation approach, motion durations/easings.
- **Components:** buttons (primary/secondary/ghost/destructive), inputs + the API-key field (with validation states), item **card** (thumbnail, creator, caption, status badge, duration), **entity card/row**, **chips/tags** (hashtags, entity types, filters), **status badges** (three enrichment states: *raw* / *text* / *visual* — must be distinguishable without relying on color alone), **progress** (determinate job progress + counts), **modal & detail-overlay** patterns, **empty states**, **toasts/alerts**, **upgrade prompt** pattern, table/list rows.
- **Iconography:** a coherent set; include the few domain icons (capture, enrich, entity types, export formats, collection).

## 5. Screens to design — with content & required states

For each screen: design the happy path **and** the load-bearing states listed. Content blocks are specified; arrange and style them as your direction dictates.

### Onboarding (full page, linear)
- **Welcome** — what Attic does (one line), the local-first/trust promise (plainly: *nothing goes to our servers; if you add an AI key, only your own AI calls leave your browser*), primary "Get started."
- **Path choice** — two clear options: **"Just export"** (free, no AI, skip the key) and **"Add AI"** (BYO Gemini key for transcripts/entities/search). Either is fine; you can add AI later.
- **Key setup** (if "Add AI") — short "get a free Gemini key" steps + a paste field. *States:* validating / valid (success) / invalid (bad key) / network error / "skip for now."
- **Capture how-to** — brief, reassuring: "we'll open your TikTok profile and collect your Favorites; you stay in control; nothing is posted or changed." → "Open my Favorites."

### Popup (compact control + status) — design these states
- **Not on TikTok** — guidance + "Open my TikTok Favorites" button.
- **Ready** — captured count vs target, enriched count, AI-key status; actions: Capture (with scope quick-pick: All Favorites / a Collection / Selected), Enrich, Export, **Open Library**, Settings.
- **Capturing** — live progress (count, % of target), pause/stop, the **throttle-nudge** state ("give the page a scroll to continue").
- **Enriching** — progress (done/total, ok/failed), pause.
- **Paused / soft-blocked** — calm "TikTok asked us to slow down — paused" + resume.
- **Done** — short summary + next step.
- **No key** — prompt to add a key (deep-link to Settings) when an AI action is attempted.

### Library (full tab) — the workspace
- **Item-grid home** — the wall of saved items (thumbnail, creator, caption, **enrichment badge**, duration), newest-saved first. *States:* first-run empty ("nothing captured yet → Start capturing") / captured-but-unenriched ("enrich to unlock search-by-content") / populated / loading.
- **Lens switcher** — by **Item** (default) / by **Entity** / by **Collection** / **Imports** (read-only capture history).
- **Entity lens** — collections of extracted entities ("Restaurants," "Places," "Books," "Products," "Recipes," …); pick one → the saved items that mention it. (This is the "find the restaurant I saved" payoff — make it feel like the product's magic.)
- **Collection lens** — the user's own TikTok Collections as groupings.
- **Imports lens** — a quiet, read-only log: "Captured 312 from *Foodie spots*, May 27" with a re-export affordance.
- **Search + filters** — prominent global search (over caption + transcript + on-screen text + entity names); filters: entity type, creator, hashtag, collection, enrichment status, capture date. *State:* no-results.
- **Item detail** — opens **without losing the list** (an overlay/drawer-style interaction — you choose the form): transcript, on-screen text, linked entities (clickable → that entity), takeaways, structured content (recipe/workout/list when present), original TikTok link, and an "enrich this" affordance if still raw/text.
- **Multi-select + action bar** — select items → **Enrich · text** / **Enrich · visual** / **Export**.
- **Visual-enrich confirm** — a modal showing the **upfront estimate** before a visual run: item count, est. time, and est. cost *in the user's own AI spend*. (Visual is slower/pricier; this is the guardrail.)
- **Export panel** — choose scope (all / current filter / selection) and format (**JSON / CSV / Obsidian vault / .mp4 videos**); show the cap state for free tier ("exporting first 500 of 1,313 — upgrade for all"); progress for large/.mp4 exports.
- **Settings** — AI key (set/replace/remove + validate), **license/upgrade** (free vs $19.99 lifetime Pro), **data & privacy** (what leaves the browser; export; **clear library**), "show onboarding again."
- **Job progress** (shared) — a consistent in-progress treatment for capture/enrich/export with phase, counts, %, pause/resume, and per-item failure visibility.
- **Upgrade prompt** (shared) — a **value-framed** prompt shown at gates (visual enrich, export beyond cap, premium formats): show what they unlock, never a dead-end wall.

## 6. Cross-cutting patterns to nail

- **Status badges** for the three enrichment states (raw / text / visual) — legible without color alone.
- **Empty/zero states** everywhere — they're the new user's first impression; make them inviting, not barren.
- **Error/permission states** — no key, invalid key, TikTok throttle/soft-block, rate-limit (framed as "slowing down to respect your limits," not an error), tab-closed mid-job, network loss. Always recoverable, always a next action.
- **Privacy surfacing** — a clear, calm way to communicate "nothing leaves your browser except your own AI calls." This is a trust centerpiece, not fine print.
- **Upgrade moments** — consistent, honest, value-first.

## 7. Fixed vs. yours

| Fixed (from the UX spec) | Yours (this design pass) |
|---|---|
| The 3 surfaces and their roles | The entire visual identity |
| The flows, IA, and lenses | The design system / kit (tokens + components) |
| What content each screen carries | Layout, composition, density, rhythm |
| The states that must exist | How every state looks and animates |
| Local-first / trust posture (as a *requirement*) | How trust is *expressed* visually |

## 8. Deliverables to request from Claude Design

1. **A visual identity + design system** (tokens + the component library in §4), light + dark.
2. **High-fidelity mockups** of every screen in §5, including the load-bearing **states** in §5–§6 (not just happy paths — explicitly mock: empty, capturing-with-throttle-nudge, enrich-in-progress, no-key block, visual-enrich cost confirm, export-capped-upgrade, no-search-results).
3. **The signature element** from §2 applied consistently.

When the mockups + kit come back, they feed the implementation phase (we'll write the MV3-shell build plan toward them). Behavior questions route back to the UX spec; aesthetic decisions are owned here.
