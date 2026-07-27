# The interface and the thin slice, backtested against the real corpus

```
Date:     2026-07-22
Status:   Argued recommendation. Supersedes the "agent = capture extension"
          framing in the 2026-07-21 decision doc §2 (that framing is withdrawn;
          see §1 here). Everything else in the 2026-07-21 doc (build order,
          publishing, agencies) stands.
Method:   Backtest run on the founder's real 4,661-item favorites corpus
          (attic-favorites.json), 2026-07-22. Numbers are reproducible from that
          file. Prior art figures carried from 2026-07-13-deeper-framing-investigation.md.
```

---

## 1. The agent framing was wrong. Withdrawing it.

Calling the MV3 capture extension an "agent" is a stretch that a skeptical engineer sees through in one question. It is a control loop with good state handling. Withdraw the word from that layer.

The founder's counter-proposal is the honest version: an agent is a model pursuing a goal across steps, taking real action, adapting when something breaks. Sorted against that bar, his three ideas split cleanly:

- **Capture/refresh orchestrator that writes and repairs scripts** (his strongest idea). This is a real agent. Its honest home is **maintenance time, not the user's browser.** An LLM authoring and running scripts against a user's authenticated TikTok/Instagram session is a trust, cost, and reproducibility liability, and it contradicts the capture principle already settled in the spec (deterministic policy, model only where classification is fuzzy). The defensible build: a dev/CI agent that detects when a platform's response shape or DOM breaks the deterministic parser, drafts a fix, tests it against fixtures, and ships an update. Optionally a runtime escalation where the capture control plane, on hitting an unfamiliar wall, calls a model to propose a recovery step under a strict budget. This is a genuinely good resume story ("an agent that keeps the scrapers alive as platforms shift") and it is honest. It is not a user-facing interface.
- **Playlist / analysis / collection builder** ("pull my saved items, group them holistically, find more"). Real user value, and the backtest below proves the need. But the build is **Claude over MCP, not a captive agent we write.** The founder said this himself. We expose the library and ship the prompts; the user's own agent does the work.
- **How-to assistant.** He killed it as "a chatbot thing, just MCP." Agreed.

Conclusion carried forward: **we do not build a user-facing agent. The user's agent is Claude on their machine, driving our MCP.** The agent we build and can claim on a resume is the capture/maintenance orchestrator plus the grounding pipeline. The word "agent" describes those systems and the MCP demo, never a chatbot bolted into the extension.

---

## 2. The backtest: what he actually saved

Computed on all 4,661 favorited videos. This is the reality any interface has to survive.

**Text is abundant. Entities are a minority. Half the corpus is dark matter.**

| Signal | Coverage | Reading |
|---|---|---|
| Non-empty description | 94% | Text substrate is there for almost everything |
| Description ≥ 40 chars | 78% | Real, searchable text, not just an emoji |
| Subtitles available (transcript) | 53% | Deep content analysis possible on half |
| Named music track (not "original sound") | ~39% | The music entity-resolution demo fuel; real but a minority |
| Actionable-entity slice (food OR place OR product) | **12%** | The "restaurants on a map" demo lives here. It is a cherry-pick of the corpus, not the corpus. |
| Professional slice (AI/tech/startup/coding/career) | 11% | The most "him," and the best demo for a technical audience |
| No category matched from metadata | **51%** | Dark matter |

**The dark matter is not noise.** Sampling the 2,668 uncategorized-but-described videos shows what metadata matching missed: Better Call Saul edits (tagged in Thai), consulting and MBB recruiting advice, a Mehdi Hasan debate on Xinjiang, David Goggins motivation, a Pakistan history explainer, personal-growth clips, health tips, travel bucket lists tagged only with place names. This content is highly findable and often useful. Keyword and hashtag matching missed it because it is tagged in other languages, or tagged with proper nouns instead of categories (#bettercallsaul, not #tv), or carries no hashtags and lives entirely in the transcript.

**Three consequences that change the product's center of gravity:**

1. **"Your saves are a treasure box of recipes and places" is false for this user, and probably for most.** People save a firehose: a strong professional/tech spine, heavy entertainment (film edits, sports, memes), and a long tail of one-offs. An interface premised on the actionable 12% is optimizing for the wrong 88%.
2. **The founder's instinct is correct and now evidenced: pure vector/semantic search on thin metadata will miss the dark matter.** You need a model reading the actual content (transcript + description + on-screen text) to understand that a clip is "advice on breaking into consulting" or "a bucket list of surreal landscapes." That is exactly the work an LLM does well and keyword/embedding-over-captions does badly.
3. **The entity-resolution moat is real but it is a proof-of-rigor, not the universal user promise.** It shines on music (~39%) and on the places/food/products where they appear. Position it as the receipts that make the product trustworthy and the accuracy page that makes it legit, demoed where it is strong. Do not sell it as the organizing principle of a corpus that is 51% dark matter.

---

## 3. The interface, worked backwards from tangible use

What the user tangibly did: saved thousands of videos, 71% likes-only (browse-and-forget), across tech and entertainment. What he tangibly cannot do today: find one of them again, get any overview of the pile, get them out before losing the account, or use the useful ones without rewatching. What he will tangibly pick up: the thing that pays off on the first session with his real chaos, before he has tagged or organized anything, because nobody tags.

**The thin slice: "Everything you saved, searchable by what's actually in it, and readable by your AI."**

Three parts, in dependency order, each usable the moment it lands:

1. **Get it in.** Capture plus import (the IG ZIP and TikTok DYD lanes already decided). Proven pickup: myfaveTT at ~100k installs, Dewey at ~40k users, all on the ban-scare backup intent. This is the doorway, and it works because loss aversion is a real trigger.
2. **Find it by content.** One search box that searches transcript, description, and on-screen text, not titles and hashtags. This is the part that pays off on session one on a messy corpus (text is present on 78 to 94% of items), and it is honestly differentiated: the consumer wave (sftir, Stasht, ReelRecall) searches captions and auto-tags, which the dark-matter finding shows is not enough. Entities and the provenance receipt ride on top of this where they exist.
3. **Let your agent use it.** The MCP server from day one, with shipped prompts. This is where the "playlist / analysis / make sense of the mess" value the founder described actually gets delivered, by Claude, without us building a captive agent. It is also a genuinely new retention vector: the user does not have to come back and browse; their agent pulls from the library while they work somewhere else.

**What the UI is in this slice:** deliberately plain. A search box, a result list, an item page with the provenance strip. Not the full Paper & Proof library. On a corpus that is half dark matter and heavy on memes and edits, a beautiful browsable grid is mostly a beautiful grid of memes; the value is in search and agent, not in the grid. (Open question for the founder in §6: whether the full library build is even the right next investment after this, or whether making search and the agent surface excellent beats it.)

**Reframe the hero demo.** Away from "map every restaurant in my saves" (a 12% cherry-pick) and toward two demos that are true to real data:
- For users: "find that thing you saved and forgot," including something only findable by transcript.
- For a technical audience and X: "point Claude at 4,661 saved videos and have it pull the professional-development spine out of the chaos, or organize the film edits by film, with a receipt on every claim." This reflects better on him than restaurants, and it runs on the clusters his corpus actually has.

---

## 4. Does it get used, and does it reflect well on him? Honest simulation.

**Pickup:** the backup/export doorway has demonstrated pull at 100k-install scale, so getting people in the door is a solved problem in this category. The differentiator (content search + agent) is additive on top of an intent that already converts.

**Retention is the real risk, and I will not pretend otherwise.** The framing research was blunt that save-tools die because people do not come back (Pocket). The mitigation here is not "come back and browse." It is retrieval at a moment of need (stronger for actionable video than for Pocket's articles, because a saved recipe or tool has real recurrence) plus agent-ambient use via MCP (your agent brings the library to where you already are). That second vector barely exists in the market yet, which is both the opportunity and the reason I cannot prove it before shipping. Treat retention as the hypothesis to test, not a claim to make.

**Reflects well on him:** to users, "get your saves out and actually find them" is a clean, honest, non-scammy promise with no AI branding. To recruiters and X, the artifact is the capture engineering (surviving a platform that returns a well-formed lie), the grounding engine with published accuracy and honest NIL (which nobody in the category publishes), the maintenance agent, and the MCP-native design. Same code, two framings. The failure mode to avoid is building a captive chatbot to look like an "AI agent product," which impresses neither audience and reads as the slop he wants to avoid.

---

## 5. What this changes from the 2026-07-21 plan

Only two things. Everything else (build order, hybrid publishing, agency discovery calls) stands.

1. The agent framing in §2 of that doc is withdrawn and replaced by §1 here.
2. The hero demo and the product copy move from "recipes/places/restaurants" to "search the chaos by content + agent makes sense of it," and the entity/accuracy layer is repositioned as proof-of-rigor rather than the universal promise. The engine work does not change; how we point it and describe it does.

The build order already puts MCP and a plain UI before the full library, which is exactly right for this slice. The backtest strengthens the case: search plus MCP is the product; the fancy library is a later, separately-justified bet.

---

## 6. What I need from the founder

| Item | Why it matters |
|---|---|
| Confirm the reframe: search-the-chaos + MCP as the hero, entities as receipts | Sets the demo, the copy, and the first posts |
| Ruling: is the maintenance/repair agent worth building as an explicit, claimable piece? | It is the strongest honest "agent" artifact; costs real effort; you may prefer it stays plumbing |
| Reconsider whether the full Paper & Proof library is the right investment after search+MCP, or a Milestone-2 bet | Frees or confirms the G2 design sprint as the critical path |
| Still open from 2026-07-21: writing-voice sample, pilot spot-check when the corpus lands, Places key, CWS account | Unchanged |
```
