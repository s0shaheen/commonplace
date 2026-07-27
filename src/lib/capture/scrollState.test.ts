// RED-first tests for the completion state machine — THIS module is the §2.1 fix as a unit test.
// The invariant under test: `done` is reachable ONLY via a page_captured carrying hasMore:false.
// A stall (tick / no-growth) NEVER yields done — it backs off, and after a bounded number of
// exhausted cycles yields a DISTINCT, reason-carrying `giveup` (a reported incomplete).
import { describe, it, expect } from "vitest";
import {
  initialScrollState,
  step,
  GIVEUP_STALL_CYCLES,
  MAX_GRACE_SCROLLS,
  type ScrollState,
  type ScrollDeps,
} from "./scrollState.js";

const deps: ScrollDeps = { now: () => 1_000 };

describe("scrollState.step — completion is hasMore:false ONLY", () => {
  it("page_captured with hasMore:false ⇒ done (the ONLY completion path)", () => {
    const { state, action } = step(initialScrollState(), { kind: "page_captured", newCount: 60, hasMore: false }, deps);
    expect(action).toEqual({ kind: "done" });
    expect(state.status).toBe("done");
  });

  it("page_captured with growth (newCount > lastCount) ⇒ reset stall, scroll", () => {
    let s = initialScrollState();
    // build up a stall first
    ({ state: s } = step(s, { kind: "tick" }, deps));
    ({ state: s } = step(s, { kind: "tick" }, deps));
    expect(s.stall).toBe(2);
    const { state, action } = step(s, { kind: "page_captured", newCount: 30, hasMore: true }, deps);
    expect(action).toEqual({ kind: "scroll" });
    expect(state.stall).toBe(0); // growth RESETS the stall counter
    expect(state.lastCount).toBe(30);
    expect(state.status).toBe("scrolling");
  });

  it("a stall NEVER equals done: tick with hasMore:true ⇒ wait, incrementing stall", () => {
    const { state, action } = step(initialScrollState(), { kind: "tick" }, deps);
    expect(action.kind).toBe("wait");
    expect(state.status).toBe("waiting");
    expect(state.stall).toBe(1);
    expect(state.status).not.toBe("done");
  });

  it("page_captured with NO growth + hasMore:true is a stall (wait), not done", () => {
    let s = initialScrollState();
    ({ state: s } = step(s, { kind: "page_captured", newCount: 40, hasMore: true }, deps)); // grow to 40
    const { state, action } = step(s, { kind: "page_captured", newCount: 40, hasMore: true }, deps); // no growth
    expect(action.kind).toBe("wait");
    expect(state.stall).toBe(1);
    expect(state.status).toBe("waiting");
  });

  it("wait carries a positive backoff ms; injected backoffMs is honored", () => {
    const withBackoff: ScrollDeps = { now: () => 0, backoffMs: (stall) => stall * 100 };
    const { action } = step(initialScrollState(), { kind: "tick" }, withBackoff);
    expect(action).toEqual({ kind: "wait", ms: 100 });
  });

  it("default placeholder backoff is exponential and positive (Task 2 supplies the real pacing)", () => {
    let s = initialScrollState();
    const seen: number[] = [];
    for (let i = 0; i < 4; i++) {
      const r = step(s, { kind: "tick" }, deps);
      s = r.state;
      if (r.action.kind === "wait") seen.push(r.action.ms);
    }
    expect(seen.length).toBeGreaterThanOrEqual(3);
    expect(seen[0]!).toBeGreaterThan(0);
    for (let i = 1; i < seen.length; i++) {
      expect(seen[i]!).toBeGreaterThan(seen[i - 1]!); // grows with stall
    }
  });

  it("after GIVEUP_STALL_CYCLES consecutive stalls ⇒ giveup, DISTINCT from done, with a reason", () => {
    let s = initialScrollState();
    let last = step(s, { kind: "tick" }, deps);
    for (let i = 1; i < GIVEUP_STALL_CYCLES; i++) {
      last = step(last.state, { kind: "tick" }, deps);
    }
    expect(last.action.kind).toBe("giveup");
    if (last.action.kind !== "giveup") throw new Error("unreachable");
    expect(last.action.reason).toMatch(/more may remain/i);
    expect(last.state.status).toBe("giveup");
    expect(last.state.status).not.toBe("done"); // an incomplete NEVER masquerades as success
  });

  it("hasMore:false wins even when the final page also carries new items", () => {
    let s = initialScrollState();
    ({ state: s } = step(s, { kind: "page_captured", newCount: 20, hasMore: true }, deps));
    const { state, action } = step(s, { kind: "page_captured", newCount: 25, hasMore: false }, deps);
    expect(action).toEqual({ kind: "done" });
    expect(state.status).toBe("done");
    expect(state.lastCount).toBe(25);
  });

  it("page_captured with NO growth + hasMore:false ⇒ done (an all-duplicates final page still completes)", () => {
    // Pins the arrival-keyed glue contract: a crash-resume re-scroll delivers pages whose records
    // all dedupe away (count never grows). The final page's hasMore:false must STILL complete —
    // the reducer checks hasMore before growth, so a fully-deduped last page is a clean done.
    let s = initialScrollState();
    ({ state: s } = step(s, { kind: "page_captured", newCount: 40, hasMore: true }, deps));
    const { state, action } = step(s, { kind: "page_captured", newCount: 40, hasMore: false }, deps);
    expect(action).toEqual({ kind: "done" });
    expect(state.status).toBe("done");
    expect(state.lastCount).toBe(40);
  });

  it("terminal states are absorbing (done stays done; giveup stays giveup)", () => {
    const done = step(initialScrollState(), { kind: "page_captured", newCount: 1, hasMore: false }, deps).state;
    expect(step(done, { kind: "tick" }, deps).action).toEqual({ kind: "done" });

    // giveup is absorbing too: no later event (not even a page_captured) re-opens capture,
    // and the action keeps carrying the original reason.
    let g = step(initialScrollState(), { kind: "tick" }, deps);
    while (g.action.kind !== "giveup") g = step(g.state, { kind: "tick" }, deps);
    const after = step(g.state, { kind: "page_captured", newCount: 999, hasMore: true }, deps);
    expect(after.action.kind).toBe("giveup");
    if (after.action.kind !== "giveup") throw new Error("unreachable");
    expect(after.action.reason).toMatch(/more may remain/i);
    expect(after.state.status).toBe("giveup");
  });

  it("is deterministic for a given injected now()", () => {
    const a = step(initialScrollState(), { kind: "tick" }, { now: () => 42 });
    const b = step(initialScrollState(), { kind: "tick" }, { now: () => 42 });
    expect(a).toEqual(b);
    expect(a.state.updatedAt).toBe(42); // now() flows into the state, deterministically
  });
});

// ── capture-control-plane: a hasMore:false at FULL VELOCITY is a CLAIM, not a done ──────────────
// The §2.1 bug: line 163 sent EVERY hasMore:false straight to `done`, blindly trusting the platform.
// The fix: the branch now consults corroboration. An uncorroborated claim (arrived at full velocity,
// unreconciled) yields a NEW non-terminal `claimed` status the glue routes to the recovery spine —
// never `done`. Corroborated/normal paths (decelerated, reconciled, or NO velocity signal at all) still
// complete exactly as before, so every existing test above is untouched.
describe("scrollState.step — completion requires corroboration (capture-control-plane)", () => {
  it("hasMore:false at FULL velocity, unreconciled ⇒ `claimed` (non-terminal), NOT done", () => {
    let s = initialScrollState();
    ({ state: s } = step(s, { kind: "page_captured", newCount: 5100, hasMore: true }, deps));
    const { state, action } = step(
      s,
      { kind: "page_captured", newCount: 5191, hasMore: false, atFullVelocity: true },
      deps,
    );
    expect(action).toEqual({ kind: "claimed" });
    expect(state.status).toBe("claimed");
    expect(state.status).not.toBe("done");
  });

  it("hasMore:false at full velocity but RECONCILED ⇒ done (reconciliation corroborates)", () => {
    const { state, action } = step(
      initialScrollState(),
      { kind: "page_captured", newCount: 5989, hasMore: false, atFullVelocity: true, reconciled: true },
      deps,
    );
    expect(action).toEqual({ kind: "done" });
    expect(state.status).toBe("done");
  });

  it("hasMore:false with the stream DECELERATED (atFullVelocity:false) ⇒ done", () => {
    const { state, action } = step(
      initialScrollState(),
      { kind: "page_captured", newCount: 60, hasMore: false, atFullVelocity: false },
      deps,
    );
    expect(action).toEqual({ kind: "done" });
    expect(state.status).toBe("done");
  });

  it("hasMore:false with NO velocity signal ⇒ done (backward-compatible — today's behavior)", () => {
    const { state, action } = step(initialScrollState(), { kind: "page_captured", newCount: 60, hasMore: false }, deps);
    expect(action).toEqual({ kind: "done" });
    expect(state.status).toBe("done");
  });

  it("`claimed` is NON-absorbing: a subsequent growth page resumes scrolling (the wall was fake)", () => {
    let s = initialScrollState();
    ({ state: s } = step(s, { kind: "page_captured", newCount: 5100, hasMore: true }, deps));
    ({ state: s } = step(s, { kind: "page_captured", newCount: 5191, hasMore: false, atFullVelocity: true }, deps));
    expect(s.status).toBe("claimed");
    // The glue reloads/resumes and a real page with new items arrives → back to scrolling.
    const { state, action } = step(s, { kind: "page_captured", newCount: 5230, hasMore: true }, deps);
    expect(action).toEqual({ kind: "scroll" });
    expect(state.status).toBe("scrolling");
  });
});

// ── Carry-forward (1): the resume-stall distinction (Task-5, BINDING; bounded in fix round 1) ───
// A crash-resume re-scroll walks the ALREADY-captured prefix first: every page ARRIVES with
// hasMore:true but its items all dedupe away (count never grows). Under the normal reducer each such
// zero-new arrival is a stall, so ~GIVEUP_STALL_CYCLES pages in we'd hit `giveup` — long before the
// uncaptured tail. The fix: a run-level `resuming` flag. During resume, a zero-new page that ARRIVED
// (TikTok answered → it is paginating FORWARD) counts as PROGRESS (stall reset), so the re-scroll can
// reach the tail. The grace is BOUNDED (fix round 1 — an unattended autonomous run must never scroll
// forever): (a) it DROPS on the first count growth (growth proves the prefix is behind us — from
// there normal stall/giveup bounding applies), and (b) a repeated identical non-null cursor is
// non-progress even under resume (a throttle serving the same stale page repeats the cursor; real
// forward pagination advances it). Genuine SILENCE (ticks) always accrues stall.
//
// Baseline: the resume run starts from the PERSISTED count (initialScrollState(initialCount)) — so
// the prefix's zero-new pages read as zero-new, not as a first-page "growth" from 0 that would
// instantly burn the grace.
describe("scrollState.step — resume run (carry-forward 1)", () => {
  const resuming: ScrollDeps = { now: () => 1_000, resuming: true };

  it("under resuming, a long run of zero-new arrivals (hasMore:true, advancing cursor) NEVER gives up", () => {
    let s = initialScrollState(500); // resume from the persisted 500-item baseline
    // Re-scroll delivers 3× GIVEUP_STALL_CYCLES all-duplicate pages: count pinned, cursor ADVANCING.
    for (let i = 0; i < GIVEUP_STALL_CYCLES * 3; i++) {
      const r = step(s, { kind: "page_captured", newCount: 500, hasMore: true, cursor: `c${i}` }, resuming);
      s = r.state;
      expect(r.action).toEqual({ kind: "scroll" }); // progress, not wait/giveup
      expect(s.stall).toBe(0); // stall never accrues on a forward arrival during resume
      expect(s.status).toBe("scrolling");
    }
  });

  it("under resuming, the SAME zero-new sequence WOULD give up without the flag (contrast)", () => {
    // Identical events, default (non-resume) deps: zero-new arrivals ARE stalls → bounded giveup.
    let last = step(initialScrollState(500), { kind: "page_captured", newCount: 500, hasMore: true }, deps);
    for (let i = 0; i < GIVEUP_STALL_CYCLES; i++) {
      last = step(last.state, { kind: "page_captured", newCount: 500, hasMore: true }, deps);
    }
    expect(last.action.kind).toBe("giveup");
  });

  it("under resuming, SILENCE (ticks with no arrival) still bounds out to giveup — the safety net holds", () => {
    let last = step(initialScrollState(500), { kind: "tick" }, resuming);
    for (let i = 1; i < GIVEUP_STALL_CYCLES; i++) {
      last = step(last.state, { kind: "tick" }, resuming);
    }
    expect(last.action.kind).toBe("giveup"); // resume does NOT disable the incomplete-report path
  });

  it("under resuming, hasMore:false after the prefix still completes cleanly (reaches the tail)", () => {
    let s = initialScrollState(500);
    for (let i = 0; i < 12; i++) {
      ({ state: s } = step(s, { kind: "page_captured", newCount: 500, hasMore: true, cursor: `c${i}` }, resuming));
    }
    // tail: new items, then the honest hasMore:false end.
    ({ state: s } = step(s, { kind: "page_captured", newCount: 540, hasMore: true, cursor: "t1" }, resuming));
    const { state, action } = step(s, { kind: "page_captured", newCount: 540, hasMore: false, cursor: "t2" }, resuming);
    expect(action).toEqual({ kind: "done" });
    expect(state.status).toBe("done");
    expect(state.lastCount).toBe(540);
  });

  it("the resume grace DROPS on the first growth: post-growth zero-new arrivals stall → bounded giveup", () => {
    // Fix round 1(a): once newCount > lastCount, the prefix is provably behind us — from there a
    // zero-new arrival is a stall again, so a throttle after the tail can't spin an unattended
    // resumed run forever. The run must bound out to a REPORTED giveup.
    let s = initialScrollState(500);
    for (let i = 0; i < 5; i++) {
      ({ state: s } = step(s, { kind: "page_captured", newCount: 500, hasMore: true, cursor: `c${i}` }, resuming));
    }
    ({ state: s } = step(s, { kind: "page_captured", newCount: 540, hasMore: true, cursor: "t1" }, resuming)); // GROWTH
    // Now: zero-new arrivals with ADVANCING cursors — the grace is gone, these must accrue stall.
    let last = step(s, { kind: "page_captured", newCount: 540, hasMore: true, cursor: "t2" }, resuming);
    expect(last.action.kind).toBe("wait"); // a stall, not grace-scroll
    expect(last.state.stall).toBe(1);
    for (let i = 0; last.action.kind !== "giveup" && i < GIVEUP_STALL_CYCLES + 2; i++) {
      last = step(last.state, { kind: "page_captured", newCount: 540, hasMore: true, cursor: `t${i + 3}` }, resuming);
    }
    expect(last.action.kind).toBe("giveup"); // bounded, reported — never an infinite unattended scroll
  });

  it("a REPEATED identical cursor is non-progress even under resume (stalls accrue → giveup)", () => {
    // Fix round 1(b): a throttle serving the same stale page repeats the cursor; real pagination
    // advances it. Repeated-cursor arrivals must NOT reset the stall counter during resume.
    const s = initialScrollState(500);
    let last = step(s, { kind: "page_captured", newCount: 500, hasMore: true, cursor: "stuck" }, resuming);
    expect(last.action).toEqual({ kind: "scroll" }); // first sight of "stuck" is still a forward grace
    for (let i = 0; last.action.kind !== "giveup" && i < GIVEUP_STALL_CYCLES + 2; i++) {
      last = step(last.state, { kind: "page_captured", newCount: 500, hasMore: true, cursor: "stuck" }, resuming);
      if (last.action.kind === "wait") expect(last.state.stall).toBeGreaterThan(0);
    }
    expect(last.action.kind).toBe("giveup"); // a stuck cursor can never be mistaken for progress
  });

  it("a null/absent cursor carries no repeat signal — the grace still applies (defensive default)", () => {
    // The cursor's on-wire shape is recon-unverified; when it's missing we can't distinguish a stale
    // repeat, so the grace holds (the growth-drop + silence bounds still protect the run) UNTIL the
    // absolute cap (below) — kept well under MAX_GRACE_SCROLLS so this stays a pure grace test.
    let s = initialScrollState(500);
    for (let i = 0; i < GIVEUP_STALL_CYCLES + 2; i++) {
      const r = step(s, { kind: "page_captured", newCount: 500, hasMore: true }, resuming);
      s = r.state;
      expect(r.action).toEqual({ kind: "scroll" });
    }
  });

  it("ABSOLUTE grace cap: null-cursor + perpetual zero-growth arrivals still TERMINATE (fix round 2)", () => {
    // The residual hole after fix round 1: with a null cursor the repeat-guard can't fire, and if
    // pages keep ARRIVING (never silence) with zero growth, grace was granted forever → an unattended
    // resumed run could bot-scroll indefinitely. Fix: an absolute per-run cap on grace-granted
    // scrolls. Past the cap, grace stops and normal stall/giveup bounding takes over → the run ends.
    let last = step(initialScrollState(500), { kind: "page_captured", newCount: 500, hasMore: true }, resuming);
    let scrolls = 0;
    // Feed far more than the cap; the machine MUST reach giveup within cap + GIVEUP_STALL_CYCLES + slack.
    for (let i = 0; last.action.kind !== "giveup" && i < MAX_GRACE_SCROLLS + GIVEUP_STALL_CYCLES + 10; i++) {
      if (last.action.kind === "scroll") scrolls++;
      last = step(last.state, { kind: "page_captured", newCount: 500, hasMore: true }, resuming);
    }
    expect(last.action.kind).toBe("giveup"); // terminates — never an unbounded scroll
    // Grace was granted a bounded number of times (never more than the cap).
    expect(scrolls).toBeLessThanOrEqual(MAX_GRACE_SCROLLS);
    // …and the cap is actually the thing that bit (we walked most of it), not an accidental early stop.
    expect(scrolls).toBeGreaterThanOrEqual(MAX_GRACE_SCROLLS - 1);
  });

  it("the grace cap counts only GRACE scrolls — growth-driven scrolls don't consume it", () => {
    // A run that keeps making REAL progress (growth) must never be capped: the cap targets the
    // pathological zero-growth-forever resume, not a healthy long capture.
    let s = initialScrollState(500);
    for (let i = 0; i < MAX_GRACE_SCROLLS + 50; i++) {
      const r = step(s, { kind: "page_captured", newCount: 500 + i + 1, hasMore: true, cursor: `c${i}` }, resuming);
      s = r.state;
      expect(r.action).toEqual({ kind: "scroll" }); // growth → always scroll, cap untouched
    }
  });

  it("initialScrollState(initialCount) baselines lastCount so a resume's first prefix page is zero-new", () => {
    expect(initialScrollState(500).lastCount).toBe(500);
    expect(initialScrollState().lastCount).toBe(0); // manual fresh run unchanged
  });
});
