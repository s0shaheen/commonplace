// RED-first tests for the single recovery spine (capture-control-plane). ONE budgeted, idempotent path
// answers every recoverable bad state: continue · nudge · reload_resume (once per source, full-jitter
// backoff) · pause_for_human · verdict(done|incomplete). The invariants under test: verdict(done) ONLY on
// a corroborated completion; verdict(incomplete, reason) — never a fake done — when the budget is spent;
// a challenge freezes the counters and auto-resumes; reload is at most once per source per run.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  step,
  initialSpineState,
  fullJitterBackoffMs,
  DEFAULT_SPINE_BUDGET,
  type SpineInput,
  type SpineDeps,
} from "./recoverySpine.js";

const deps: SpineDeps = { now: () => 1_000, rng: () => 0.5 };

const inp = (over: Partial<SpineInput>): SpineInput => ({
  observed: "PROGRESSING",
  corroborated: false,
  cursor: null,
  captured: 100,
  declared: null,
  ...over,
});

describe("recoverySpine — healthy lanes", () => {
  it("PROGRESSING ⇒ continue", () => {
    const { command } = step(initialSpineState(), inp({ observed: "PROGRESSING" }), DEFAULT_SPINE_BUDGET, deps);
    expect(command.kind).toBe("continue");
  });

  it("STALLED_VITAL ⇒ a bounded motion nudge", () => {
    const { command } = step(initialSpineState(), inp({ observed: "STALLED_VITAL" }), DEFAULT_SPINE_BUDGET, deps);
    expect(command.kind).toBe("nudge");
  });
});

describe("recoverySpine — completion requires corroboration", () => {
  it("a CORROBORATED CLAIMED_DONE ⇒ verdict done (the ONLY done)", () => {
    const { command } = step(
      initialSpineState(),
      inp({ observed: "CLAIMED_DONE", corroborated: true }),
      DEFAULT_SPINE_BUDGET,
      deps,
    );
    expect(command).toEqual({ kind: "verdict", verdict: "done" });
  });

  it("an UNcorroborated CLAIMED_DONE ⇒ reload_resume (never done) while the budget holds", () => {
    const { state, command } = step(
      initialSpineState(),
      inp({ observed: "CLAIMED_DONE", corroborated: false, cursor: "c-wall" }),
      DEFAULT_SPINE_BUDGET,
      deps,
    );
    expect(command.kind).toBe("reload_resume");
    if (command.kind === "reload_resume") expect(command.backoffMs).toBeGreaterThanOrEqual(0);
    expect(state.reloadsUsed).toBe(1);
    expect(state.lastWallCursor).toBe("c-wall");
  });

  it("NOT_VITAL also recovers via reload_resume", () => {
    const { command } = step(initialSpineState(), inp({ observed: "NOT_VITAL" }), DEFAULT_SPINE_BUDGET, deps);
    expect(command.kind).toBe("reload_resume");
  });
});

describe("recoverySpine — at most one reload per source per run", () => {
  it("a second uncorroborated claim after the reload is SPENT ⇒ verdict incomplete (never done)", () => {
    let s = initialSpineState();
    const first = step(s, inp({ observed: "CLAIMED_DONE", corroborated: false, cursor: "c-wall" }), DEFAULT_SPINE_BUDGET, deps);
    s = first.state;
    expect(first.command.kind).toBe("reload_resume");
    // Re-walls at the SAME cursor with the budget spent → honest, reason-labeled incomplete.
    const second = step(
      s,
      inp({ observed: "CLAIMED_DONE", corroborated: false, cursor: "c-wall", captured: 5191, declared: 5989 }),
      DEFAULT_SPINE_BUDGET,
      deps,
    );
    expect(second.command.kind).toBe("verdict");
    if (second.command.kind === "verdict") {
      expect(second.command.verdict).toBe("incomplete");
      if (second.command.verdict === "incomplete") {
        expect(second.command.reason).toMatch(/5191/);
        expect(second.command.reason).toMatch(/5989/);
        expect(second.command.reason).toMatch(/same cursor|re-wall/i);
      }
    }
    expect(s.reloadsUsed).toBe(1); // never a SECOND reload — anti-hammer
  });

  it("only ONE reload_resume is ever emitted across repeated uncorroborated claims", () => {
    let s = initialSpineState();
    let reloads = 0;
    for (let i = 0; i < 5; i++) {
      const r = step(s, inp({ observed: "CLAIMED_DONE", corroborated: false, cursor: "c" }), DEFAULT_SPINE_BUDGET, deps);
      s = r.state;
      if (r.command.kind === "reload_resume") reloads++;
    }
    expect(reloads).toBe(1);
  });

  it("budget exhaustion with an unknown declared count ⇒ incomplete with a captured-only reason", () => {
    let s = initialSpineState();
    ({ state: s } = step(s, inp({ observed: "NOT_VITAL", captured: 42, declared: null }), DEFAULT_SPINE_BUDGET, deps));
    const r = step(s, inp({ observed: "NOT_VITAL", captured: 42, declared: null }), DEFAULT_SPINE_BUDGET, deps);
    expect(r.command.kind).toBe("verdict");
    if (r.command.kind === "verdict" && r.command.verdict === "incomplete") {
      expect(r.command.reason).toMatch(/42/);
    }
  });
});

describe("recoverySpine — challenge freezes counters and auto-resumes", () => {
  it("CHALLENGED ⇒ pause_for_human, and the reload budget is FROZEN (not consumed)", () => {
    const s = initialSpineState();
    const { state, command } = step(s, inp({ observed: "CHALLENGED" }), DEFAULT_SPINE_BUDGET, deps);
    expect(command.kind).toBe("pause_for_human");
    expect(state.paused).toBe(true);
    expect(state.reloadsUsed).toBe(0); // a challenge NEVER burns a reload
  });

  it("a healthy arrival after a pause auto-resumes ⇒ continue, paused cleared", () => {
    let s = initialSpineState();
    ({ state: s } = step(s, inp({ observed: "CHALLENGED" }), DEFAULT_SPINE_BUDGET, deps));
    const { state, command } = step(s, inp({ observed: "PROGRESSING" }), DEFAULT_SPINE_BUDGET, deps);
    expect(command.kind).toBe("continue");
    expect(state.paused).toBe(false);
  });
});

describe("recoverySpine — full-jitter backoff", () => {
  it("full jitter spans [0, capped]: rng=0 ⇒ 0, rng=1 ⇒ the capped ceiling", () => {
    expect(fullJitterBackoffMs(0, () => 0)).toBe(0);
    expect(fullJitterBackoffMs(0, () => 1)).toBeGreaterThan(0);
  });

  it("an injected backoffMs is honored", () => {
    const d: SpineDeps = { now: () => 0, rng: () => 0.5, backoffMs: () => 4242 };
    const r = step(initialSpineState(), inp({ observed: "NOT_VITAL" }), DEFAULT_SPINE_BUDGET, d);
    if (r.command.kind === "reload_resume") expect(r.command.backoffMs).toBe(4242);
    else throw new Error("expected reload_resume");
  });
});

describe("recoverySpine — determinism & purity", () => {
  it("is deterministic for a fixed (state, input, deps)", () => {
    const a = step(initialSpineState(7), inp({ observed: "PROGRESSING" }), DEFAULT_SPINE_BUDGET, deps);
    const b = step(initialSpineState(7), inp({ observed: "PROGRESSING" }), DEFAULT_SPINE_BUDGET, deps);
    expect(a).toEqual(b);
  });

  it("no Date.now / Math.random / DOM references (grep-verified)", () => {
    const src = readFileSync(fileURLToPath(new URL("./recoverySpine.ts", import.meta.url)), "utf8");
    expect(src).not.toMatch(/Math\.random/);
    expect(src).not.toMatch(/Date\.now/);
    expect(src).not.toMatch(/\bdocument\b/);
  });
});
