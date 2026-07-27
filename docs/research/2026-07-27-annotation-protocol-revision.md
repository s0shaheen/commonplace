# The annotation protocol, re-derived from evidence

```
Date:   2026-07-27
Ask:    "Why did we do this instead of testing with the actual model we want to use?
        How do the preannotator and subsequent calls work exactly? What is the
        research/production precedent? How were you planning to normalize/combine
        output between Claude and Gemini?"
Status: One misunderstanding I caused, one design flaw that is real. Both fixed below.
```

## 0. The short answers

1. **Claude's output and Gemini's output never combine.** There is no normalization, merging, or
   refinement step between them. They occupy two different roles that never touch. My earlier
   explanations did not make this explicit, which is my error (§1).
2. **Pre-annotating with Gemini — the model under test — would inflate our own scores.** This is
   not a methodological preference; it is an empirically measured effect (§2).
3. **But the founder's instinct is right about something real:** showing suggestions *before* the
   human judges biases the labels, and the speed benefit that supposedly justifies it may not
   exist. The protocol I shipped (50 assisted / 10 blind) is worse than it should be. Revised
   design in §4: **blind-first, then reveal.**

---

## 1. How it actually works — the exact data flow

Two pipelines. They share videos and nothing else.

```
GOLD (the answer key)                        SYSTEM UNDER TEST (what we score)
─────────────────────                        ────────────────────────────────
video ─► Claude (different family)           video ─► Gemini pipeline
          │                                            │
          ▼ suggestions (NOT labels)                    ▼ predictions
      FOUNDER accepts / corrects / rejects              │
      + verifies every ID against MusicBrainz /         │
        Wikidata / Maps                                 │
          │                                             │
          ▼                                             │
      gold.jsonl  ◄───────── scored against ────────────┘
                     (commonplace_eval: P/R/F1, NIL-F1, Φ_c)
```

**Claude never writes a gold label.** It writes a draft the human overrides. The human's output
*is* the gold. Gemini's predictions are then compared against that gold by a mechanical,
arm-blind scorer. There is no step where a Claude output and a Gemini output are reconciled,
averaged, or merged — that would be meaningless, because they are not the same kind of object
(one is a proposed answer key, the other is a system's answer being graded).

**Why involve a model at all, then?** Only for recall support: a human labelling from scratch
misses things through fatigue and inattention, and a missed gold entity silently becomes a false
positive against every system. The model is a second pair of eyes, not an authority.

---

## 2. Why NOT the model under test — the measured effect

This is the part that is not a matter of taste.

**Schroeder, Roy & Kabbara, *"Just Put a Human in the Loop?"* (ACL Findings 2025, arXiv 2507.15821)**
— pre-registered, 410 annotators, 7,000+ annotations, 3 assistance conditions, 2 models, 2 datasets:

> "Annotators strongly uptook suggestions, changing the label distribution to more closely resemble
> the LLM's proposed distribution. We also found that **using LLM-assisted labels to evaluate model
> performance resulted in much higher reported F1 scores** than when using a human crowd baseline…
> Obviously, **using labels influenced by the model to evaluate the model is not standard or
> advisable** in classic evaluation paradigms."

That is precisely the failure mode of "just pre-annotate with Gemini": we would grade Gemini
against labels shaped by Gemini, and our published accuracy number would be inflated by
construction. For a product whose entire differentiation is *published, honest accuracy*, that is
disqualifying.

**Preference leakage (arXiv 2502.01534)** extends it: contamination is measurable not only when
the generator and evaluator are the *same model*, but also under *inheritance* and *same model
family* — so "a different Gemini" would not fix it either. The family boundary is the right one.

**Eval-set contamination via production leakage (2026-04)** names the end state: *"The labels you
graded against were, traceably, produced or filtered by the very model family you were trying to
evaluate. Passing that eval is not evidence of quality. It is evidence that your model agrees with
its own past outputs."*

**Verdict:** different-family pre-annotation is correct and stays. Claude-for-Gemini is the right
pairing.

---

## 3. Where my design was wrong — the evidence cuts both ways

The same literature undercuts the *assisted-first* protocol I shipped.

- **Schroeder et al.:** LLM suggestions "**did not make them faster**", but did shift the label
  distribution toward the model's. The speed argument for pre-annotation — the entire reason to
  accept its bias — was not observed.
- **Francis et al. 2026 (doi 10.63317/4ab3uiguwubh):** pre-annotation produced a "drastic decrease
  in annotation time" but "a non-negligible increase in inter-annotator agreement and a
  significant shift in label distribution" — labels *converge* on the model's view. They conclude
  pre-annotation is "detrimental to tasks where nuance and subjectivity are valuable."
- **Rosbach et al. (MELBA 2026):** anchoring on AI advice is statistically significant and
  *intensifies under time pressure* — relevant to a founder labelling 60 items in bounded sittings.
- **Counterpoint, in fairness:** the clinical-NER study (PMC3994857) found *dictionary*-based
  pre-annotation gave 13.9–21.5% time savings with **no** statistically significant bias. Note the
  difference: a deterministic dictionary on a well-defined NER task, not an LLM on a subjective one.

**The distinction that matters for us:** our gold has both kinds of layer.
- **Objective-ish:** entity mentions and their IDs ("is *Chicago Cut* a place, and which one?"). The
  ID-verification gate already forces independent checking against the authoritative record.
- **Subjective:** facets (affect, intent, actionability) and claims. These are exactly the layers
  the literature shows collapse toward the model's distribution.

---

## 4. The revised protocol — blind-first, then reveal

Change the order. The human judges *before* seeing any suggestion; the model then acts as a recall
check that can only *add*, never retro-edit the primary judgment.

```
per item:
  1. BLIND PASS   — video + caption only. Founder labels what he sees. Saved as `blind_labels`.
  2. REVEAL       — Claude's suggestions appear. Founder may ADD missed items (flagged
                    `source: "model_assisted"`) but the blind labels stand as recorded.
  3. IDs          — every external ID verified against its authoritative record (unchanged).
```

**What this buys, concretely:**

| Property | Assisted-first (shipped) | **Blind-first + reveal (revised)** |
|---|---|---|
| Anchoring on primary judgment | yes, on 50/60 items | **none — the primary label precedes the suggestion** |
| Recall safety net | yes | **yes — the reveal pass still catches misses** |
| Bias measurable? | only on the 10 blind items | **on every item** (blind vs post-reveal delta) |
| Can we report both? | no | **yes — human-only gold AND assisted gold** |
| Subjective layers protected | no | **yes — facets/claims judged before exposure** |

The last row is the real prize: because every addition is flagged, we can score the arms twice —
against the strict human-only gold and against the assisted gold. **If the ranking of arms differs
between the two, that is itself a finding** and tells us the result is fragile. If it doesn't, the
result is robust to the protocol choice. That is a far stronger claim than either protocol alone
can support, and it costs nothing extra to compute.

**Cost:** slower per item than assisted-first — but Schroeder et al. found the assisted speed-up
did not materialize anyway, so the trade is smaller than it looks. Against the alternative of a
contaminated instrument that every downstream engine decision rests on, it is obviously worth it.

**This also directly answers "why not just test with the model we want to use":** we *are* testing
Gemini — that is the whole point. What we are not doing is letting Gemini write its own answer key.

---

## 5. What changes in the tool

1. Two-stage flow per item: blind entry, then a reveal step (a keypress) that surfaces suggestions.
2. Record `blind_labels` and post-reveal `additions` separately, with `source` on every element.
3. Suggestions are not fetched into the DOM until the reveal — no accidental peeking.
4. The existing ID-verification gate, NIL capture, and autosave are unchanged.
5. Emit both `gold.human.jsonl` and `gold.assisted.jsonl`; the harness scores both.

The 60 Claude suggestions already generated stay valid and are reused — they are just shown later
in the flow than before. Nothing is wasted.
