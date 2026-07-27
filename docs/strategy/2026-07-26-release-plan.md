# Commonplace — the release plan

```
Date:   2026-07-26
Status: THE single execution doc. Read this one; everything else is reference.
Truth:  519 vitest tests + typecheck green (verified 2026-07-26). Engine, schema,
        grounding, resumable queue, TikTok live capture + TikTok DYD parser: built.
System: spec-driven development via OpenSpec. The roadmap below is 10 tracked
        changes; see them live with `openspec list` (never read a plan pile again).
```

> **You asked five questions. This doc answers them in order:** the product (§1), the roadmap (§2), how much I run alone (§3), what to hand me up front (§4), and the decisions you owe along the way (§5). §6 is how we actually work now.

---

## 1. What we are building and launching

**Commonplace v1**: a local-first Chrome extension plus an MCP server that

1. **gets your saved videos in** — live capture of your saved/liked TikToks from your own session, and import from the platform data-export ZIP so you are never gated on the scraper;
2. **understands them** — transcript, on-screen text, and entities resolved to real IDs with a confidence receipt and an honest "no match";
3. **makes them findable** — one search box over what is actually *in* each video (transcript, description, on-screen text), not just titles and hashtags;
4. **lets your AI use them** — an MCP server so your own Claude can query the library and build collections, with prompts we ship so the demo works out of the box;
5. **proves it is real** — a published accuracy page and an open-core repo (engine, schema, eval harness).

TikTok is the first platform end to end. Instagram comes in through the ZIP importer. The fully designed "Paper & Proof" library is the last piece and can even follow launch.

**Launch is done when:** you install it, capture and import your library, search it by content, run the MCP demo in Claude Desktop against your real corpus, read the accuracy page, and browse the public repo — and 5 to 20 strangers can do the same, some of whom pay. That is the whole bar. No MRR target, no TAM story.

**What it is not:** not a downloader, not a chatbot, not an AI-branded product, not a feed. The word "agent" describes two real systems (the capture control plane and the grounding pipeline) and the MCP demo, never a captive bot inside the extension.

---

## 2. The roadmap (10 tracked changes)

Each row is a real OpenSpec change. Run `openspec list` to see status; `openspec status --change <id>` for detail. Ordered by dependency. "Gate" means it needs you.

| # | Change (`openspec` id) | What ships | Runs how | Depends on |
|---|---|---|---|---|
| 1 | `capture-control-plane` | The audit's sensors are built + tested (banGuard, overlayClassifier, completeness, declaredCount, lease, deadline, scrollMotion, sessionRecovery, …). Remaining: the unifying observed-state classifier (treats platform "done" as evidence, not truth) + the single recovery spine, so the fake-done truncation is survived and incompleteness stays honest. | Autonomous | partly built |
| 2 | `zip-import-and-upload` | IG `saved_posts.json` importer + raw-`.zip` drop UX; TikTok DYD promoted to an onboarding lane with captured-vs-declared reconciliation. | Autonomous | 1 |
| 3 | `enrichment-lane` | Fills content on imported items: oEmbed free default, own-session depth via the control plane, **tikwm primary + Apify backup** paid fast. | Autonomous | 1, 2 |
| 4 | `content-search` | Search over transcript/description/on-screen-text + a minimal results and item-detail UI with the provenance strip. | Autonomous | 2, 3 |
| 5 | `pilot-gold-set` | Label ~150 items (different model family); first accuracy numbers; sets the v1 populate-cut. | **Gate: your spot-check** | 3 |
| 6 | `engine-tuning` | Tune extraction/grounding prompts against the harness; run the native-vs-VTT ablation. | Autonomous | 5 |
| 7 | `mcp-server` | MCP server (search/get_entity/resolve/list) + shipped prompts; the demo runs in Claude Desktop on your real corpus. | Autonomous | 4, 6 |
| 8 | `accuracy-page-and-open-core` | Public open-core repos (synthetic fixtures, secret scan) + the published accuracy page. | Autonomous | 6 |
| 9 | `library-ui` | The full Paper & Proof library: grid, entity lenses, cmdk, This-Week, every state. | **Gate: G2 design pick** | 4 |
| 10 | `launch` | CWS listing, 90-second demo video, the build essay, X + Reddit drafts. | **Gate: publish** | 7, 8 |

**Milestone 1 (launchable) = changes 1–8 plus the minimal UI from 7.** That is a working, installable, demoable, provable product. `library-ui` (9) makes it beautiful and can land just before or just after launch. `launch` (10) is the moment.

Publishing runs alongside, not after: the framing essay ("the feed is the first medium with no archive"), the receipts/NIL piece, and the eval write-up can post now. The capture forensics (the fake-done story) stay embargoed until after launch.

---

## 3. How much I run autonomously

Most of it. Seven of the ten changes (1, 2, 3, 4, 6, 7, 8) I can propose, build, verify, and archive without you, because every decision they need is already locked in `openspec/config.yaml` (the product, the stack, the capture posture, the tikwm/Apify call, the enrichment tiers). The loop per change is: `/opsx:propose` drafts the proposal, design, spec deltas, and task list; `/opsx:apply` implements until `npm test` and `npm run typecheck` are green and a real run or fixture exercises it; `/opsx:verify` checks it against its own spec; `/opsx:archive` folds the result into the specs. You say "run the roadmap" and I go change by change, stopping only at the three gates.

Three changes need you, and only briefly: `pilot-gold-set` (5) needs your data judgment on ~150 items; `library-ui` (9) needs your design pick; `launch` (10) needs your approval to publish. Everything else is mine.

The honest limits on autonomy: I cannot register accounts, hold API keys, or click "publish" for you. Those are the unblock list below. And I will not silently pass a gate, ship an unaudited accuracy claim, or fabricate a "done" — the config forbids it.

---

## 4. What to hand me up front (batch this once, and I can run 1→8)

- **tikwm**: nothing needed to start — the free tier needs no key. (A RapidAPI key only if we later want its paid tier.)
- **Apify token** (the backup lane): create an Apify account, drop the API token in when convenient. Not needed until tikwm is insufficient.
- **Google Places API key** (grounding for places): Google Cloud console, billing on. I keep it SKU-disciplined.
- **Gemini API key** (the engine's cloud lane) — or say "use Ollama-local for now" and I develop against local.
- **Your data exports in the repo**: the IG export is already here as a fixture; drop your **TikTok DYD ZIP** in when you can. These are the import fixtures and your pilot corpus.
- **Keep Chrome connected + TikTok/IG logged in** for live-capture testing.
- **Chrome Web Store dev account ($5)** — only needed near `launch`; batch it whenever.
- **One decision now** (unblocks the pilot): should I run a single paid enrichment pass on your own corpus so the gold set is rich fast — tikwm free over ~2 days, or ~$10 of Apify? Recommend yes, tikwm first.

Hand me the four keys/exports and I can take changes 1 through 4 to done and set up 5 without another word.

---

## 5. The decisions you owe (and when)

| When | Decision | Default if you stay silent |
|---|---|---|
| Now | Run a paid enrichment pass on your corpus for the pilot? (tikwm/Apify) | I use tikwm free over a couple days |
| Now | Confirm the agent framing in §1 (systems + MCP, no chatbot) | It stands as written |
| At change 5 | Spot-check ~150 labeled items (a few sittings); this sets accuracy + which entity types v1 ships | Blocks — I cannot judge your data for you |
| Before change 9 | G2 design pick: Paper & Proof as specced, or you want a different direction | Blocks the full library only, not launch |
| Before change 10 | Approve the public repo + accuracy page + a writing-voice sample, then publish | Blocks publish only |
| Deferred | G3 pricing (Free / $39 / $7-mo) | Deferred to post-launch, per the spec |

Nothing else stops the run. If a new fork appears mid-build, I surface it as one question with a recommendation, not a menu.

---

## 6. How we work now (so you never track a doc pile again)

**One progress surface.** `openspec list` shows every change and its state. `openspec view` is the dashboard. `openspec status --change <id>` drills in. That is the source of truth for "what is done and what is next" — not this doc, not the handoff, not a folder of plans.

**One loop per change.** `/opsx:propose <id>` → (glance if it is a gate) → `/opsx:apply` → `/opsx:verify` → `/opsx:archive`. The spec leads, the code follows, and the spec updates itself when the change lands.

**The reference docs still exist but you do not read them to track work.** `openspec/config.yaml` carries every locked decision. The deep specs (`docs/specs/*`) are the detail behind the changes. The strategy docs that led here are archived under `docs/archive/superseded/` — kept as the evidence trail, not as reading. This release plan is the only narrative you need.

**To start: say "run the roadmap,"** and I begin at `capture-control-plane`, moving through the autonomous changes and pausing at the three gates. Or name any change and I take just that one.
