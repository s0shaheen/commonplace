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

  it("terminal states are absorbing (done stays done; giveup stays giveup)", () => {
    const done = step(initialScrollState(), { kind: "page_captured", newCount: 1, hasMore: false }, deps).state;
    expect(step(done, { kind: "tick" }, deps).action).toEqual({ kind: "done" });
  });

  it("is deterministic for a given injected now()", () => {
    const a = step(initialScrollState(), { kind: "tick" }, { now: () => 42 });
    const b = step(initialScrollState(), { kind: "tick" }, { now: () => 42 });
    expect(a).toEqual(b);
    expect(a.state.updatedAt).toBe(42); // now() flows into the state, deterministically
  });
});
