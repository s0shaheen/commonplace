# First-iteration decision — the build order, and how it becomes the agent story

```
Date:     2026-07-21
Status:   DECIDED (founder answers, 2026-07-21) except §2, which is the argued
          default and stands unless the founder vetoes it.
Inputs:   docs/research/2026-07-13-deeper-framing-investigation.md (the framing verdict)
          docs/specs/capture-resilience.md (control-plane redesign, now ratified)
          Founder constraints (2026-07-21): an "agent" project he can put on a resume
          and talk about on X/Substack without nonsense; import parsing so the pipeline
          is not gated on the live extension; agency discovery calls happening but
          never gating; hybrid publishing.
Bookkeeping: DEC-029..031 appended to the decision log. Roadmap carries a re-cut
          note pointing here. This doc changes sequencing and narration; it does not
          reopen G1/G2/G3 or the spec.
```

---

## 1. The decision

**No pivot.** The product stays what SPEC v5 says it is: capture your saved media, understand it with receipts, keep it in a library you own. What changes is the order and the narration. Milestone 1 is re-cut so the agent-visible surface (MCP over the real corpus) and the accuracy numbers land **before** the full design-system library, and so the library can be populated from platform export files alone, with no live capture required. The career layer stops being a Phase-8 afterthought: safe posts start now, and every build step below is chosen to produce either a demo, a number, or a post.

Why this cut wins against the alternatives considered: the full-library-first order (old Phase 5 → 6) parks the agent story behind G2, the one gate that needs the founder's design time; the instrument-only cut (no consumer UI at all) forfeits the paying-strangers proof and the design half of the career artifact. This cut gets the agent demo and the accuracy page out on the earliest path, keeps the beautiful library in Milestone 1, and de-risks the whole pipeline by making import files a first-class front door.

---

## 2. The agent story (default unless vetoed)

The founder's open question: what makes this an "agent project" he can claim without keyword-stuffing and without building a chatbot. The answer is a definition, then three layers that already exist in the plan.

**The definition that survives a skeptical staff engineer:** an agent project is credible when you can show (1) a trace of autonomous multi-step behavior surviving something the builder did not script, (2) an eval with published numbers, and (3) a live demo a stranger can run. A chat wrapper has none of these. This project has all three, in two systems plus a surface:

**Layer 1 — the capture agent.** An autonomous system that operates a hostile web session toward a goal: perception (transport, DOM vitality, overlay classification), state estimation (PROGRESSING / STALLED-VITAL / NOT-VITAL / CHALLENGED / CLAIMED-DONE), a bounded response repertoire (continue, nudge, recovery spine, pause-for-human, verdict), and external ground truth (the DYD export reconciliation). The war story is real and documented: at item 5,191 of 5,989 the platform returned a well-formed "done" that was a lie, and the redesign exists because of it. The senior-judgment line to say out loud: an LLM sits in this loop only where classification is fuzzy; policy is deterministic, because a capture instrument must be reproducible.

**Layer 2 — the grounding agent.** Per item, a multi-step research run: transcript and on-screen text, candidate referents, knowledge-base queries (MusicBrainz, Wikidata, Places), evidence gathering, calibrated confidence, and an honest NIL when it cannot verify. The provenance strip makes every item page an agent trace. The claim nobody else in the category can make: published precision/recall and calibration, including the refusals.

**Layer 3 — the MCP surface.** The library exposed to the user's own agent: `search_library`, `get_entity`, `resolve_item`, `list_by_type`, plus **shipped MCP prompts** — curated deep queries ("map every restaurant in my saves," "pull every recipe into one file") that make the demo a product feature instead of a parlor trick. Packaged as an MCPB desktop extension and submitted to Anthropic's Connectors Directory (verified 2026-07-21: local servers submit as one-click desktop extensions; 300+ third-party connectors; all directory entries are eligible for in-chat suggestion). Claude Desktop is the one real distribution channel for this surface today; ChatGPT's app directory requires a hosted server and its discovery is weak per March 2026 reporting, so it waits.

**What we do not build:** a chatbot inside the extension, an "AI agent" rebrand, or any agent runtime of our own. The user's agent is Claude or whatever they run; we make their corpus usable by it. If demos create real pull for a built-in ask-your-library feature, that is a post-milestone decision.

**Resume paragraph (draft, for the founder to edit into his voice):**
> Built Commonplace, a local-first system that archives and understands a person's saved social media. An autonomous capture agent survives adversarial platform behavior (state-machine control plane, external ground-truth reconciliation against platform exports); an agentic grounding pipeline resolves what each video refers to against public knowledge bases, with published precision/recall and calibrated confidence including explicit "no match" refusals; an MCP server makes the library readable by any AI agent. Production corpus of 4,661 items; open-core engine and eval harness.

---

## 3. Milestone 1, re-cut (the build order)

Legend as in the roadmap: [AUTO] runs without the founder; [GATE] names what it needs.

**Step 1 — Capture control plane** · [AUTO] · *ratified 2026-07-21, in flight*
Build `docs/specs/capture-resilience.md` as argued: sensors demoted to inputs, observed-state classification, the single recovery spine, pause-for-human, verdicts. Exit: a full-library run that either completes or reports an honest shortfall against DYD ground truth, and the resume-after-flag discriminator run tells us whether the 5.2k wall is a session flag or a hard cap.

**Step 2 — Import lanes become a first-class front door** · [AUTO] · *parallel with Step 1; founder requirement 2026-07-21*
The extension is one door into the library; a platform export file is the other. Work: (a) Instagram ZIP importer — fields verified in the spike (`URL · Caption · Title · Hashtags · Owner` + collections + timestamps); fixture is the founder's own export already in the repo root; permalink is the join key for later live enrichment. (b) TikTok DYD promoted from dev lane to onboarding path, plus the reconciliation report (captured vs export, the diff that feeds Step 1's ground truth). Honesty note for copy and docs: export lanes ship a text-first library (captions, titles, links); media depth (posters, transcripts, frames) comes from the live lane or later enrichment, because platforms do not include other people's media in your export. Exit: a fresh install populates a searchable library from files alone, zero live capture.

**Step 3 — Pilot gold set + engine tuning** · [GATE: founder spot-check, a few bounded sittings]
Unchanged from the roadmap (Phases 2 and 4). The corpus comes from Steps 1–2. Output: the first real accuracy numbers, the v1 populate-cut, the tuned engine. This gate is the founder's single highest-leverage block of hours in the milestone.

**Step 4 — MCP + minimal inspection UI** · [AUTO] · *moved ahead of the full library*
The MCP server with shipped prompts (Layer 3 above), packaged as MCPB, directory submission prepared. Alongside it a deliberately plain UI: a list with search and an item page with the provenance strip. This is not the design system; it exists so the demo has a face and the founder can inspect records. Exit: the restaurant-map beat runs in Claude Desktop against the founder's real corpus, on video.

**Step 5 — Public artifacts** · [AUTO]
Open-core carve (engine + schema + eval harness repos), synthetic fixtures, secret scan, THE ACCURACY PAGE. Exit: a stranger can read the numbers and run the harness.

**Step 6 — The library, for real** · [GATE: G2 design pick]
The full Paper & Proof build (grid, entity lenses, This-Week shelf, cmdk, every state), then the CWS listing and the assembled career layer (demo video, essay, one-pager, thread drafts). G2 stays a gate; it just no longer gates the agent demo or the accuracy page.

**Still deferred, unchanged:** cross-device sync, billing and G3, X bookmarks, the Instagram live lane (its spike passed; it follows in Milestone 2). Nielsen-for-feeds and any aggregate-data ambitions stay dead per the framing verdict.

---

## 4. Publishing (hybrid, decided)

Posts begin now, from material that exposes no capture tactics:
1. The framing essay — "the feed is the first mass medium with no archive," cut down from the 2026-07-13 investigation. This is the Substack opener and the piece the founder can hand to anyone who asks what he is building.
2. Receipts over vibes — why every claim carries confidence, evidence, and a designed "no match," against the category's unaudited "98% accurate" claims.
3. The eval writeup — how the harness works, then the accuracy page when Step 5 lands.

**Embargoed until after launch:** the fake-done forensics, trusted-scroll mechanics, throttle behavior, anything that reads as a how-to for platform countermeasures. It is the best story we have; it is also the playbook, and it keeps.

Needed from the founder once, soon: a writing-voice sample (any essay or thread he likes of his own), so drafts sound like him.

---

## 5. Agency discovery calls (no code, no gating)

The founder is arranging calls with agency operators he knows. Ground rules: listen, do not sell, and nothing in the build accommodates agencies until someone tries to pay. Questions worth the call time:
1. Do you archive your own or client accounts today? What breaks or goes missing?
2. When a platform, account, or post disappears, what did it cost you last time?
3. What would a complete, searchable, exportable archive of accounts you operate be worth per month?
4. Who owns the accounts you would connect, and who would need to consent?
5. What do clients actually ask you to report on that you cannot answer today?
6. If your tools' AI (Claude, ChatGPT) could read that archive directly, does that change any workflow you run weekly?

A yes-shaped answer looks like a number in response to Q3 and a named weekly workflow in Q6. Verbatims go in a note in `docs/research/`; nothing else changes until money shows up.

---

## 6. Explicitly not doing

- No agent rebrand and no chatbot. The word "agent" describes the systems and the demo, never the brand.
- No agency features in v1 (DEC below records the discovery-calls-only posture).
- No aggregate-data or measurement-currency work, per the framing verdict.
- No TAM story. The personal wedge is priced for a prosumer niche and judged by the founder's own bar: strangers pay, the artifact reads senior.

## 7. Open items on the founder

| Item | Blocks | When |
|---|---|---|
| Veto or confirm §2 (agent framing default) | Narration in posts/resume drafts | Whenever; default stands meanwhile |
| Pilot spot-check sittings | Step 3 → accuracy numbers | When Step 1–2 corpus is ready |
| G2 design sprint + pick | Step 6 only | After Step 4 demo exists, ideally |
| Google Places key · CWS account ($5) | Place grounding · listing | Batchable, unchanged |
| Writing-voice sample | Post drafts sounding like him | Soon; posts start on §4 order |
