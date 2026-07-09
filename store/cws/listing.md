# Chrome Web Store listing — Commonplace (dry-run, prepared NOT submitted)

The fields below are copy-paste-ready for the CWS developer dashboard. Distribution strategy
and the title/summary keyword rationale are SPEC §18 (win CWS internal search on the
favorites/saved/export cluster). Banned words (SPEC §21) are absent by construction — see the
self-check at the bottom of `checklist.md`.

---

## Name

```
Commonplace — Export & Search Your TikTok Favorites
```

Rationale (SPEC §18): the title is relevance-loaded on the proven favorites/saved/export intent
cluster — the same intent myfaveTT rode to 100,000 users. "Commonplace" carries the brand; the
tail carries the search terms a person actually types.

## Summary (132 characters max)

```
Export your TikTok favorites to a free, local-first archive you own — searchable, structured, receipts on every claim.
```

Contains the ranking terms **export**, **favorites**, and **free** (SPEC §18), within the 132-char
CWS limit.

## Category

```
Productivity
```

## Description

```
Your TikTok favorites are a reading list you can't read. Commonplace turns them into a
searchable, structured archive that lives on your machine and belongs to you.

FREE FOREVER TO EXPORT. Your library exports to an open, documented schema — plain files you
can open in any tool, take to any app, or keep forever. No lock-in, no paywall on your own data,
no account required to get everything out.

LOCAL-FIRST BY ARCHITECTURE. Your library is stored on your own device. We can't read it —
that's the architecture, not a promise. Nothing about your saved content is sent to us.

RECEIPTS, NOT VIBES. Every entity Commonplace identifies — a song, a place, a product, a person
— is resolved to a real, durable public ID and carries its evidence and a confidence level. When
it isn't sure, it shows an honest "unknown" instead of a confident guess. You can always see why
a claim was made, and check it.

WHAT YOU GET
• One-click capture of the videos you save on TikTok, into a private local library.
• Structured understanding: what each video is about, the entities in it, and where that came from.
• Full-text and structured search across everything you've saved.
• Export to an open schema — yours to keep, yours to leave with.

BRING YOUR OWN KEY (OPTIONAL). Deeper analysis runs through an AI model you choose. You can run
a fully local model so nothing leaves your machine, or supply your own provider key — the key is
stored locally and used only for your own requests. Basic capture and export never require one.

HONEST LIMITS. TikTok first; more platforms later. We publish a measured accuracy report rather
than claim a number. If a capture breaks, there's a one-tap way to tell us.

A commonplace book for the video age.
```

## Screenshots

CWS accepts up to 5 screenshots (1280×800 or 640×400). The full annotated set is produced in
**Phase 5**, once the library UI exists — 5 shots, by scene:

- [ ] **1 — The library (hero).** The justified media grid of a real saved-video collection; the
      empty-state framing ("a place, not a feed"). Annotation: "Everything you saved, in one place
      you own." *(Phase 5 — needs the library UI.)*
- [ ] **2 — The receipt / provenance strip.** A single item's detail with the provenance strip:
      entity → durable public ID → evidence → confidence, and one honest `∅` NIL state. Annotation:
      "Every claim wears its evidence — or admits it doesn't know." *(Phase 5 — needs the item overlay.)*
- [ ] **3 — Search.** A structured + full-text query resolving across the library. Annotation:
      "Search what you saved, the way you remember it." *(Phase 5 — needs the search UI.)*
- [ ] **4 — Export.** The open-schema export dialog and a peek at the resulting file. Annotation:
      "Free forever to export. Yours to keep, yours to leave with." *(Phase 5 — final UI framing.)*
- [ ] **5 — Local-first / BYO-key.** The options page showing local-model / bring-your-own-key
      choice and the local-first posture. Annotation: "Runs on your machine. We can't read your
      library." *(Phase 5 — final options framing.)*

**Dry-run shipping set (available now, before the Phase-5 UI):** the **capture HUD** over a TikTok
favorites page, the **options page** (local-model / BYO-key + posture), and an **export** shot of
the open-schema output. These three carry the listing until the annotated Phase-5 set replaces them.

## Promotional / support fields

- **Support / contact email:** hello@commonplacehq.com *(pending founder confirmation — see checklist.md)*
- **Homepage / website:** https://commonplacehq.com
- **Privacy policy URL:** hosted copy of `privacy-policy.md` (see checklist.md step for the URL).
- **Visibility (dry-run):** Unlisted.
