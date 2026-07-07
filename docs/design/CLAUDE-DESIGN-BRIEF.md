# Claude Design sprint — brief + runbook (Commonplace, G2)

> **What this is:** everything needed to run the v1 design sprint in Claude Design. §A is your runbook (how to drive the sprint). §B is the brief itself — paste it into Claude Design verbatim as the opening prompt. The sprint's output is **direction artifacts, not production code**: per SPEC §20, code-in-repo is the source of truth; whatever wins here gets translated into oklch tokens + the shared React kit by the build session.

---

## A. Runbook (founder-facing)

**Session 1 — DIVERGE.** Paste §B into Claude Design. Ask for **three directions** (defined in the brief: *Paper & Proof*, *Quiet Modern*, *Card Catalog*) rendered as the **same two screens each** — the Library grid and the Item detail with provenance strip — using the real content in the brief. Six artifacts total. Don't polish; compare postures.

**Your gate (G2).** Pick the direction (or name the hybrid: "A's type + C's card geometry"). Judge against the six principles and the kill-list in §B.4 — if a screen would look at home in a generic AI SaaS template, it fails. Gut-check prompts: *Would I screenshot this? Does it feel like a place I own? Does the receipt read as a receipt?*

**Session 2 — CONVERGE.** Same Claude Design project, winning direction only: render the full screen set (§B.5) including the empty library, the NIL state, and the Deep Scan upgrade card. Iterate copy and spacing until it feels inevitable. Export/share every final frame.

**Handoff back.** Drop exports (or the share link) anywhere in the repo or the chat; the build session translates the winner into `tokens.css` + the React kit and writes the one-page **design constitution** that binds every future build session (SPEC §20).

**Rules of engagement while iterating:** never accept a first render; push at least two revisions per screen; kill anything on the §B.4 list on sight; when in doubt, remove ornament and enlarge the user's media.

---

## B. THE BRIEF (paste from here down into Claude Design)

### B.1 What you are designing

**Commonplace** — *a commonplace book for the video age.* A browser-extension product that turns a person's saved/liked TikTok + Instagram media into a private, beautiful library where every item is deeply understood: transcript, on-screen text, and the real-world things it refers to — each resolved to a durable public ID (a MusicBrainz recording, a Google Place, a Wikidata film) with **confidence, evidence, and an honest "no match" when the system can't verify**. Local-first; the user owns everything; export is always free.

The interface should feel like **a well-lit reading room in the user's own house** — an archive *with apparatus*: paper, two inks, receipts, catalog geometry. It is emphatically **not** an AI product aesthetic and **not** a SaaS dashboard. The user's saved media supplies all the color; the interface is paper and ink around it.

One pattern is sacred and appears everywhere: **the provenance strip ("the receipt")** — every AI claim carries its evidence, its confidence, a live link to the real-world ID it resolved to, or a designed refusal (`∅ no match`). Design it so a screenshot of the receipt alone is recognizable as this product.

### B.2 The three directions to diverge

- **Direction A — Paper & Proof (the thesis).** Warm paper ground, two inks, **no grotesque sans anywhere**: Literata (variable; optical sizing for display/text, upright italic for brand moments, tracked small-caps for labels) + IBM Plex Mono for receipts/IDs/numbers. Rubrication logic: one madder-red accent used the way medieval scribes used red ink — sparingly, for what matters (resolved-ID chips, the active lens, the correction affordance). Catalog-card geometry: hairline rules, tabular alignment, generous margins. Tokens: paper `oklch(0.965 0.01 90)` · ink `oklch(0.23 0.015 60)` · dark "den" mode ground `oklch(0.21 0.01 60)` · accent `oklch(0.50 0.13 30)` · amber = uncertain · hollow gray = NIL.
- **Direction B — Quiet Modern (the control).** The tasteful-restraint hand: a warm neutral ground, one excellent grotesk (e.g., Söhne-class or Schibsted), mymind-adjacent softness, media-forward, almost chromeless. Tests whether the serif thesis is actually load-bearing or whether restraint alone carries it. Must still render the receipt in mono.
- **Direction C — Card Catalog (the push).** Paper & Proof pushed toward editorial brutalism: visible grid and rules, index-card items with stamped metadata, oversized serif display, Are.na × Letterboxd energy. Tests how far the apparatus can go before calm breaks.

All three obey the same six principles: **a place, not a feed · your stuff is the interface · receipts over vibes · calm density · warm, not cute · every state designed.**

### B.3 Real content (use exactly this — no lorem, no stock)

Library scale: **4,661 items** (this is a real library). Grid items are TikTok posters (portrait 9:16, varied) with quiet source marks (♥ favorites / 👍 likes / both).

**Item 1 — the resolved-music card (detail screen A):**
- Creator video, 29s, saved to *favorites*. Song: **"jazz is for ordinary people" — berlioz**.
- Receipt (resolved): `♪ jazz is for ordinary people — berlioz` → chip `MBID 2d6bce14` · confidence **1.00 · high** · evidence: *matched from audio track metadata* · actions: `Open ↗` `Not right? Fix it`
- This MBID is real — treat the receipt as ground truth.

**Item 2 — the restaurant card (detail screen B, and the Entity page):**
- Save with caption: *"Yoo Yee is worth every bit of the hype to the point where I want to try the whole menu…"* — sources: favorites + likes. Song: "Coffee & Vinyl — Emi Izumi."
- Entity: **Yoo Yee (restaurant)** → receipt: `⌖ Yoo Yee — Restaurant` → chip `Place ID` (representative) · confidence **0.87 · high** · evidence: caption line highlighted + frame at 0:04 showing storefront text · actions: `Open in Maps ↗` `Not right? Fix it`
- Entity page header: *"Yoo Yee — saved 3 times"*, its posts beneath, external links row.
- Music receipt on this item: `∅ no match — "Coffee & Vinyl" — Emi Izumi · nearest: none above threshold` (hollow-gray NIL state, evidence still shown).

**Item 3 — the honest refusal (NIL, must appear in every direction):**
- `♪ original sound — sunny` → `∅ no match — original sounds have no public identifier` · confidence 0.00 · the evidence (audio metadata) still displayed. NIL is a designed state, not an error toast: quiet, factual, dignified.

**Search moment (for the cmdk screen):** query *“brown butter pasta”* → results ranked with **matched transcript lines** shown ("…so you brown the butter until it smells nutty…"), matched-on badges (transcript / caption / on-screen text / entity).

### B.4 Kill on sight (hard rejects, all directions)

Purple/blue AI gradients · glassmorphism · sparkle/wand icons or any "✨ AI magic" framing · Inter-by-default body type · the 2026 "AI-tasteful" uniform (cream ground + italic display serif + **terracotta** accent — our madder red must not read terracotta-orange) · dashboard stat tiles/KPI rows · engagement chrome (badges, streaks, red dots) · mascots/emoji confetti · generic empty states ("Nothing here yet!") · confidence as a naked percentage without evidence · any card drowning its poster in metadata chips.

### B.5 Screens

**Diverge set (all 3 directions × both):**
1. **Library grid** — the home. Row-based justified grid of real-feel posters at 60fps density (Apple-Photos density, not masonry chaos); lens rail (`All · This Week · Search · Entities · Collections · Imports`); quiet counts ("4,661 items · 1,367 favorites"); one calm capture-status pill.
2. **Item detail overlay** — poster/player left, understanding right: title/creator/save-context, transcript excerpt, on-screen-text extract, themes — and the **receipt block** (Items 1 or 2 above) as the visual anchor. Overlay, not page: the library stays visible behind (shared-element morph from the grid tile).

**Converge set (winning direction adds):**
3. **Entity page** — "Yoo Yee — saved 3 times": referent header + receipt, its posts, external links.
4. **Search (cmdk)** — the *brown butter pasta* moment with matched-line evidence.
5. **This Week shelf** — the calm digest: "This week: 14 saves · 3 places · 2 recipes · 4 songs."
6. **Empty library** (first-run hero: warm, instructional, zero shame) + **capture-interrupted** state.
7. **Onboarding beat 3** — the "first grounded wow": first capture done, first receipts appearing (uses the 100 free credits).
8. **Capture HUD** — the in-page overlay on tiktok.com: progress, counts per source, stall-nudge, calm.
9. **Deep Scan moment** — the one upgrade card: "Understand everything you've ever saved · $39 once · ~4,661 items" with the paywall line verbatim: *"You pay for our compute and our servers — never for your data."*
10. **Settings** — engine lane picker (Local / Your key / Managed), sync, telemetry (default off), export.

**States discipline:** every screen shows its loading (ThumbHash blur-up), empty, and error variants. Motion note for mockups: the only theatrical moment is the grid→detail morph; annotate it, keep everything else ≤300ms-feeling.

### B.6 Voice (use in all copy)

Plain, warm, precise. Privacy as fact: *"We can't read your library. That's the architecture, not a promise."* Never "downloader," never "AI-powered," no exclamation-mark enthusiasm. Limits reframed as care ("We pace captures to be gentle on your session").
