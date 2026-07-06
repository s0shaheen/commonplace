# RESUME POINTER (read me first after a /clear)

**Operating contract now lives in `CLAUDE.md`** (repo root, auto-loaded) — three gates: **Frame** (size the move to the mandate; "continue" ≠ a subsystem), **Truth** (reason from the problem + prior art; verify own-system claims; don't anchor on old work), **Verdict** (self-critique to the bar; lead with a recommendation, not a menu). The `memory/` notes hold the *why*. This supersedes the old "method standard" that used to live in this file. (CLAUDE.md is a v1 pending the founder's standard review.)

## Where things stand (2026-07-06)

- **Product strategy is DONE and canonical:** the 10-doc dossier (`docs/product/00–09` + `README.md`) and the ground-up engine design (`docs/product/_ENGINE-groundup-2026-07-02.md`). Consume, don't re-litigate.
- **The analysis system was re-opened ground-up** (NOT the old throwaway Gemini-2.5 spike — see memory `[[analysis-engine-is-a-datapoint-not-the-plan]]`). Headline: the model is a swappable commodity; the moat is a model-agnostic **grounding module** + a six-axis **measurement harness**. Managed primary = Gemini 3.1 Flash-Lite; open-core engine = Qwen3-VL (Apache).
- **Built + live-proven:** the grounding module — `src/lib/grounding.ts` + `grounding.test.ts` (route → candidate-gen → select → confidence gate → NIL + provenance). MusicBrainz resolver resolves real corpus songs → real MBIDs and correctly NILs on TikTok "original sound". **61 tests green, tsc strict clean.** Demo: `scripts/ground-demo.ts`. *(Committed + pushed 2026-07-06.)*
- **Hard constraint:** corpus media (video/audio/subtitle-text) was never persisted (expired signed URLs) — the video benchmark needs a fresh founder-in-loop re-capture. Metadata (incl. `music{name,author}`) is intact.
- **The full board:** an exhaustive **168-item branch map** across 8 workstreams → `docs/product/branch-map.json` + visual artifact: https://claude.ai/code/artifact/8804f895-137a-4644-beca-baab65d1fec1 — 3 done · 15 in-progress · 145 not-started · 5 blocked · **90 need founder input** · 16 open decisions · 27-step critical path · 7 risks.

## PIVOT (2026-07-06) — validation DROPPED; Fable owns the build

The founder called the Gate-0 consumer-validation track (wedge, recruiting, retrieval kill-test) **out of scope / over-engineered**. It's **dropped.** The `_GATE0-*.md` files stay as reference, off the path. New direction, founder-ratified:

- **Full v1, converge-to-plan, Fable-owned.** Founder pre-decided the big forks; Fable executes within the rails and converges to a **build-ready plan** (not code), backed by feasibility spikes on the two risky bets: **live IG capture** + **cross-device sync/backend**.
- **Settled forks:** primary user = the "understand & use all my saves" prosumer (Seg 2); **horizontal**, not a vertical/wedge; open-core engine = moat/credibility spine; ad-hoc exporters = SEO funnel; **agency API + live IG + sync + from-scratch design system are all IN v1** (promoted from deferred). Artifact-first / career-leaning.
- **The handoff is written → `docs/product/_FABLE-BRIEF.md`** (v3; supersedes the v2 brief + doc 09). Structured as the §7 hard-problems; validation stripped; current engine/repo state baked in. Doc 09 + the v2 brief are validation-flavored history now.
- The **168-item branch map** and the dossier's 16 "open decisions" were mostly validation constructs → superseded by the brief. Dossier docs 01–08 remain the *substance* the brief draws on.

**Repo hygiene DONE (2026-07-06):** live repo committed + pushed (5 clean commits; origin was 2 months stale). `attic-saas` + `attic-sandbox` **archived**; `attic-marketing` skipped (empty). Repo = `github.com/s0shaheen/attic` (private; rename to the brand when named).

## Ball is in the founder's court — provisioning gates the Fable launch (brief §10)

Nothing blocks Fable *writing/running* the spec; its run needs provisioning in parallel:
- 🔴 Fresh **corpus capture** (media expired) + logged-in **TikTok/IG/X** sessions + an **IG "Download Your Data" ZIP**.
- 🔴 (~30 sec each) Enable GitHub **"Include private contributions on my profile"**; confirm **risk #7** (rotate leaked Supabase/OpenAI keys + back up un-versioned vault) still applies.
- 🟡 Grounding-KB keys (TMDB/Spotify free, **Places = billing card**); an OSS-inference account; a Twelve Labs free account; a **backend** sandbox for the sync/agency spike; CWS dev account + domain.
- 🟢 Naming **delegated to Fable** (propose an availability-checked shortlist → founder picks); periodic design taste gut-checks.

Still open: **`CLAUDE.md` standard review**. `_FABLE-BRIEF.md` + this resume update are **uncommitted** (offered to commit — founder's call).

**No background workflows running.**
