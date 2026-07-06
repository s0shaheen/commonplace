# Product Strategy Dossier — Morning Summary (2026-07-02, overnight)

Good morning. This folder is the thing you asked for: a **grounded, argued, front-to-back-readable** product-strategy dossier — not a requirements dump. Read this page first, then the docs.

## What I did overnight

I threw out the two-doc plan and ran a comprehensive, method-grounded workflow (53 agents, 0 errors, ~27 min):

1. **Grounded the *method* first** — synthesized the grading rubric *and* each document's outline from established frameworks (Minto Pyramid/SCQA, Amazon PRFAQ, Porter/PESTLE/JTBD/Blue Ocean, RFC/ADR, ML-eval-rubric literature). So nothing here is graded against a rubric I invented — that was your sharpest correction and it's now structural. See `00-method-and-rubrics.md`.
2. **Ran 10 grounded research tracks** (Exa-backed, cited), including the cross-domain prior-art hunt you specifically wanted.
3. **Wrote 10 documents**, each **draft → harsh grounded-critic (against the derived rubric) → revise until it passed.**

## My honest quality read (I promised I'd tell you plainly)

- **Deep-read cold, genuinely strong — vouch for these:** `01 Vision & Strategy` (Rumelt's kernel; confronts vitamin-vs-painkiller head-on; pre-registered kill-gates), `03 Engine: Classification Methodology & Prior Art` (answers your four questions; grounds the method in **12 disciplines + 5 media standards**; *derives* the schema instead of asserting it), `04 Engine: Analysis Architecture & Eval` (RFC-style, tied to the built code).
- **Strong on structural + citation check, not line-by-line read:** `02 Users/JTBD/Market` (36 refs, full Porter/PESTLE/TAM-SAM-SOM/JTBD/Blue-Ocean), `05 Product & UX` (17 refs, 12 sections).
- **Well-structured and framework-derived, name-cited rather than URL-cited (I have NOT line-by-line verified these):** `00`, `06 Business/Pricing/GTM`, `07 Architecture/Build/Ops`, `08 Phased Plan & Gates`, `09 Fable Orchestration`.
- I did **not** exhaustively cold-read all ten line-by-line. If you want, my next move is to finish gating 02/05–09 against the rubric and re-run any that don't clear it — say the word.

## The canonical index — read by TITLE, in this order

> ⚠️ **Known issue:** the docs were drafted in parallel, so their *inline* "(Doc 0X)" cross-references use inconsistent numbers (e.g., 01 calls Business "05", but Business is actually 06). **Trust the title, not the number.** This index is the source of truth; fixing the inline refs is the top cleanup item.

| # | Title | What it settles |
|---|---|---|
| 00 | Method and Rubrics | *Why trust this dossier* — the grounded rubric + outlines everything was graded against |
| 01 | Vision and Strategy | The thesis, the honest "should we build this," the moat, the kill-gates |
| 02 | Users, JTBD and Market | The 3 segments, jobs-to-be-done, competitive landscape, the validation method |
| 03 | Engine — Classification Methodology and Prior Art | How to classify/ground saved items, derived from cross-domain prior art |
| 04 | Engine — Analysis Architecture and Eval | The multi-stage grounded pipeline + the six-axis eval regime |
| 05 | Product and UX | Surfaces, the library experience, the multi-tool iterative design method |
| 06 | Business Model, Pricing and GTM | The one-engine/two-surface model, pricing, SEO/AEO + cold-start |
| 07 | Architecture, Build System and Ops | MV3 shell, capture, storage, the solo-founder build system, open-core |
| 08 | Phased Plan and Validation Gates | v1.0→v1.3 with pre-registered kill/pivot tripwires |
| 09 | Fable Orchestration | How to run the Fable session *on* this dossier (evaluate-then-build) |

## What's genuinely yours to decide (the docs commit to POVs; these are the forks)

1. **Confirm the objective/envelope** (01 §8 assumed: career-defining artifact first, revenue welcome; ~10–20 hrs/wk; no hard deadline). If wrong, 01/06/08 shift.
2. **The wedge: recipes-first, restaurants-second** (01 §5, 02 §5). Agree, or redirect?
3. **The pre-registered kill-gates** (01 §8 / 08 §5) — e.g., ≥~70% retrieval task-success + Sean-Ellis ≥40% before the heavy build. Endorse the thresholds or set your own.
4. **Agency tier = build-then-show to your contacts, deferred** (01 §5, 06). Confirm that's the motion.

## Known issues / caveats (honest)

- **Inline cross-reference numbers are unreliable** (see index above) — #1 cleanup.
- The docs **self-flag** a couple of figures to confirm before external citation (a GO-curation % in 03; per-platform API payload shapes are marked *verify-before-build*). Good hygiene, but note it.
- **Superseded:** the earlier `docs/superpowers/specs/2026-07-02-product-rebuild-brief-for-fable.md` (v2) and `docs/superpowers/plans/2026-07-02-fable-orchestration-plan.md` are folded into this dossier (01–08 and 09 respectively). I've banner-marked them.
- **Still pending (mechanical, needs you or a go-ahead):** rotate the leaked Supabase + OpenAI keys in the convo archive; back up the un-versioned assets (`/Dev/attic-marketing`, `~/Attic` vault). Nothing here touched those.

## How to proceed

Read `01` → `02` → `03`/`04` → `05` → `06` → `07` → `08` → `09`. Then pick one and tell me:
- **(a)** finish my cold-read gate on 02/05–09 + fix the cross-references, or
- **(b)** start the validation track (design the 5–10-user retrieval test from 01 §8 / 02 §8), or
- **(c)** hand `09` to a Fable session to run the design/build phase on this foundation.

Reference material (rubric, outlines, the 10 research tracks) is saved under the scratchpad `dossier/` folder if you want to see the grounding behind any claim.
