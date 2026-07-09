# CWS submission checklist — Commonplace (dry-run)

This is the founder's ~10-minute submit path. Everything upstream is prepared: the zip is built by
`npm run package`, and the listing/permission/privacy text is written in this folder. The two gates
that are deliberately **founder-only** are the $5 developer account and the final submit click — a
$5 charge and an irreversible-ish store action are founder provisioning, not agent actions.

Submission is a **dry run**: ship **Unlisted** so nothing is public, but the upload absorbs review
queue time and starts the clocks (see the last section).

---

## Before you start (already done by the build)

- [x] `npm run package` produced `commonplace-cws-v0.1.0.zip` with `manifest.json` at the zip root.
- [x] `npm run audit` prints `AUDIT PASS` (key-exposure regression test, SPEC §25).
- [ ] The three dry-run screenshots are captured (capture HUD + options page + export) — 1280×800.
- [ ] Privacy policy is hosted at a public URL (paste the text from `privacy-policy.md`; the
      dashboard requires a URL, not a file).

## The 10-minute path

1. **Create the developer account ($5).** Go to the Chrome Web Store Developer Dashboard, sign in
   with the founder Google account, and pay the **one-time $5** registration fee. *(Founder gate.)*
2. **New item → upload the zip.** Click "New item" and upload `commonplace-cws-v0.1.0.zip`. Wait for
   the manifest to parse clean (permissions shown should match `permissions.md`).
3. **Paste the listing fields** from `listing.md`:
   - Name: `Commonplace — Export & Search Your TikTok Favorites`
   - Summary (≤132): the one-line summary from `listing.md`.
   - Description: the full description block from `listing.md`.
   - Category: **Productivity**.
   - Language: English.
4. **Upload screenshots.** The three dry-run shots (capture HUD, options, export). Replace with the
   annotated Phase-5 set when the library UI ships.
5. **Paste the privacy policy URL** (the hosted copy of `privacy-policy.md`) and complete the
   privacy practices form — answers are pre-written in `permissions.md` (per-permission
   justifications) and `privacy-policy.md` (data use). Declare: no data sale; single purpose =
   capture/organize/export the user's own saved videos.
6. **Set visibility → Unlisted.** This is the dry run: reachable only by direct link, not surfaced
   in search or the category — but still reviewed. *(Do not choose Public for the dry run.)*
7. **Submit for review.** *(Founder gate — the final click.)*

## What starts the clock (SPEC §18 / §25)

Two clocks start the moment you submit — this is *why* the dry run ships early rather than waiting
for the Phase-5 UI:

- **The review queue.** CWS review in 2026 is **multi-week with one appeal** and is treated as a
  standing release constraint (SPEC §25). Submitting now **absorbs that queue time** instead of
  paying it later on the critical path (SPEC §18: "submit an early minimal listing to absorb the
  multi-week 2026 review queue").
- **The rating clock.** Once live (even Unlisted), the listing can begin accumulating reviews and
  age — the ranking signals that feed CWS internal search, which drives 40–70% of installs (SPEC
  §18). Starting this early is the point of the dry run.

Keep the listing Unlisted until the public launch decision; flipping to Public is a later,
deliberate step, not part of this dry run.

---

## Banned-word self-check (SPEC §21)

Before pasting the listing fields, confirm `listing.md` contains neither **"downloader"** nor
**"AI-powered"** (SPEC §21 — "AI" stated plainly is fine): `grep -in "downloader\|AI-powered"
store/cws/listing.md` must return nothing. This is the self-check `listing.md` points at.
