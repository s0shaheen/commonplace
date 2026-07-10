// RED-first tests for the completion state machine — THIS module is the §2.1 fix as a unit test.
// The invariant under test: `done` is reachable ONLY via a page_captured carrying hasMore:false.
// A stall (tick / no-growth) NEVER yields done — it backs off, and after a bounded number of
// exhausted cycles yields a DISTINCT, reason-carrying `giveup` (a reported incomplete).
import { describe, it, expect } from "vitest";
import {
  initialScrollState,
  step,
  GIVEUP_STALL_CYCLES,
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

// ── Carry-forward (1): the resume-stall distinction (Task-5, BINDING) ──────────────────────────
// A crash-resume re-scroll walks the ALREADY-captured prefix first: every page ARRIVES with
// hasMore:true but its items all dedupe away (count never grows). Under the normal reducer each such
// zero-new arrival is a stall, so ~GIVEUP_STALL_CYCLES pages in we'd hit `giveup` — long before the
// uncaptured tail. The fix: a run-level `resuming` flag. During resume, a zero-new page that ARRIVED
// (TikTok answered → it is paginating FORWARD) counts as PROGRESS (stall reset), so the re-scroll can
// reach the tail. Only genuine SILENCE (ticks, no arrival) still accrues stall → the giveup safety net
// survives even during resume.
describe("scrollState.step — resume run (carry-forward 1)", () => {
  const resuming: ScrollDeps = { now: () => 1_000, resuming: true };

  it("under resuming, a long run of zero-new arrivals (hasMore:true) NEVER gives up — each is progress", () => {
    let s = initialScrollState();
    ({ state: s } = step(s, { kind: "page_captured", newCount: 500, hasMore: true }, resuming)); // captured prefix tip
    // Re-scroll delivers 3× GIVEUP_STALL_CYCLES all-duplicate pages: count is pinned, hasMore stays true.
    for (let i = 0; i < GIVEUP_STALL_CYCLES * 3; i++) {
      const r = step(s, { kind: "page_captured", newCount: 500, hasMore: true }, resuming);
      s = r.state;
      expect(r.action).toEqual({ kind: "scroll" }); // progress, not wait/giveup
      expect(s.stall).toBe(0); // stall never accrues on an arrival during resume
      expect(s.status).toBe("scrolling");
    }
  });

  it("under resuming, the SAME zero-new sequence WOULD give up without the flag (contrast)", () => {
    // Identical events, default (non-resume) deps: zero-new arrivals ARE stalls → bounded giveup.
    let last = step(initialScrollState(), { kind: "page_captured", newCount: 500, hasMore: true }, deps);
    for (let i = 0; i < GIVEUP_STALL_CYCLES; i++) {
      last = step(last.state, { kind: "page_captured", newCount: 500, hasMore: true }, deps);
    }
    expect(last.action.kind).toBe("giveup");
  });

  it("under resuming, SILENCE (ticks with no arrival) still bounds out to giveup — the safety net holds", () => {
    let last = step(initialScrollState(), { kind: "tick" }, resuming);
    for (let i = 1; i < GIVEUP_STALL_CYCLES; i++) {
      last = step(last.state, { kind: "tick" }, resuming);
    }
    expect(last.action.kind).toBe("giveup"); // resume does NOT disable the incomplete-report path
  });

  it("under resuming, hasMore:false after the prefix still completes cleanly (reaches the tail)", () => {
    let s = initialScrollState();
    ({ state: s } = step(s, { kind: "page_captured", newCount: 500, hasMore: true }, resuming));
    for (let i = 0; i < 12; i++) ({ state: s } = step(s, { kind: "page_captured", newCount: 500, hasMore: true }, resuming));
    // tail: new items, then the honest hasMore:false end.
    ({ state: s } = step(s, { kind: "page_captured", newCount: 540, hasMore: true }, resuming));
    const { state, action } = step(s, { kind: "page_captured", newCount: 540, hasMore: false }, resuming);
    expect(action).toEqual({ kind: "done" });
    expect(state.status).toBe("done");
    expect(state.lastCount).toBe(540);
  });
});
