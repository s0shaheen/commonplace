# Capture — Live Proof Run (Task 6, founder session)

> This is the ONE step of the capture rebuild that needs you at the browser. Everything else (Tasks 0–5, the whole-subsystem review, and a pre-live safety wave) is committed and green: **248 unit tests + 8 capture tests + the key-exposure audit all pass.** The rebuild is designed to work; this run is where it meets your real library and confirms the handful of things that can only be verified live.

## Why a human is needed here
The code was built without a TikTok session (you chose to wait for the hardened tool rather than hand-drive a capture). Six things are, by nature, only checkable against live TikTok — they're on the watchlist below. None can cause silent data loss or a false "done" (the review verified that adversarially); the worst case is an honest "incomplete, N captured" that you re-run.

## Setup (≈2 min)
1. Build the extension: I've run `npm run build`; the loadable extension is in `dist/`.
2. Chrome → `chrome://extensions` → enable **Developer mode** → **Load unpacked** → select `…/attic-extension/dist`.
3. Open **`chrome://serviceworker-internals`** in a tab (you'll use it to watch logs and to kill the worker for the resume test).
4. Log into TikTok; go to your own profile's **Favorites** (or Likes) saved view.

## The main run (semi-auto — the default mode)
5. Click the **Commonplace** toolbar icon → the popup → **Sync**. (Or, for a single source, the dev hotkey **Alt+Shift+A** on the saved page.)
6. Watch the **in-page HUD** (bottom-right): it shows `captured · source · more:yes/no · heap · dom · state · evicted`. This is your live proof:
   - **captured** should climb steadily and NOT stall permanently while `more:yes`.
   - **heap** and **dom** should stay roughly FLAT as captured climbs into the thousands — that's the crash fix (DOM eviction). If heap/dom grow without bound, that's the old failure and I want the numbers.
   - **state** shows `scrolling` / `waiting out a rate-limit… Ns` (a backoff — this is normal, it's working, not frozen) / `done` / `incomplete`.
7. Let it run. A few-thousand-item source should take **several minutes** at human cadence (that's deliberate — it's what dodges TikTok's throttle). It ends on TikTok's own "no more" signal, not a timeout.

## The resume test (proves crash-survival)
8. Mid-run, go to `chrome://serviceworker-internals` → find the Commonplace worker → **Stop** it (simulates the crash). Within ~1 minute the revive alarm should wake it and capture should continue where the store left off — no lost items (dedup makes re-scroll safe).

## What to send me afterward
- The final HUD line (or a screenshot) per source: **captured count + state (done vs incomplete)**.
- Whether **heap/dom stayed flat** (the headline — did the 3k crash actually go away?).
- Chrome DevTools → Application → IndexedDB → `commonplace` → **items** count (the durable truth) and whether **posters** populated.
- Any source that ended **incomplete** and roughly where it stalled.
- If you tried **autonomous mode** (options → toggle, with the risk note): did it open a tab and drive it?

## Live watchlist (what this run confirms — my job, from your report)
1. TikTok's real `hasMore`/`cursor` field names (code parses defensively; if the guess is off, a source ends `incomplete` rather than wrong — we then fix one parser line).
2. Human-cadence actually clears the ~360-item throttle; real items-per-page → real wall-clock.
3. Cross-source sub-tab navigation selectors (favorites→likes→posts→reposts) — the fragile part; a miss = that source reports incomplete, never corrupts.
4. Heap/DOM stay flat across a full large capture (the crash fix, measured).
5. Cross-source overlap (likes after favorites) doesn't prematurely stop — self-heals on the next Sync if it does.
6. The HUD renders; autonomous mode opens+drives a tab.

## After the run
Your report closes Task 6: I update **SPEC §7** to the confirmed capture contract, patch any field-shape/selector that missed, mark the roadmap's **Phase 2A complete**, and this capture then produces the **Phase 2 pilot corpus**. If anything ended incomplete for a real reason (not a parser miss), that's a scoped follow-up, not a redo — the architecture and the tests hold underneath.
