// THE HEADLINE REGRESSION (capture-control-plane) — the live 2026-07-13 fake-done, end to end.
//
// What happened: at 5,191 of 5,989 saved likes (86.7% — ABOVE the 85% ratio tolerance) TikTok returned a
// well-formed 2xx hasMore:false at +24 items/s, with hasMore:true one beat prior, then a black screen. The
// old code sent that straight to `done`, 798 items short. A ratio check alone CANNOT catch it. This test
// pins the fix across the four touched decision points: the classifier (evidence, not truth), the spine
// (reload once → honest incomplete), completeness (suspicious, not done), and scrollState (`claimed`, not
// `done`). The composed guarantee: this shape NEVER reaches `done`.
import { describe, it, expect } from "vitest";
import { classify, type CaptureStateInputs } from "./captureState.js";
import { step, initialSpineState, DEFAULT_SPINE_BUDGET, type SpineDeps } from "./recoverySpine.js";
import { assessCompleteness } from "./completeness.js";
import { initialScrollState, step as scrollStep, type ScrollDeps } from "./scrollState.js";

const CAPTURED = 5191;
const DECLARED = 5989; // 5191 / 5989 = 86.7% — inside the 85% ratio tolerance, so the ratio guard is blind

const scrollDeps: ScrollDeps = { now: () => 1_000 };
const spineDeps: SpineDeps = { now: () => 1_000, rng: () => 0.5 };

/** The healthy, mid-velocity baseline the moment BEFORE the fake-done page arrives. */
const flying: CaptureStateInputs = {
  hasMoreClaim: true,
  transport: "ok",
  recentGrowth: 24,
  priorPageHadMore: true,
  priorPageGrew: true,
  requestIssued: true,
  vital: true,
  consecutiveEmptyOk: 0,
  overlayChallenge: false,
  banSignal: false,
  reconciled: false,
};

describe("fake-done regression — the live shape never reaches done", () => {
  it("steady growth at velocity ⇒ PROGRESSING (the run is healthy right up to the wall)", () => {
    expect(classify(flying).state).toBe("PROGRESSING");
  });

  it("the fake-done beat: hasMore:false at full velocity, unreconciled ⇒ classifier says UNcorroborated", () => {
    const c = classify({ ...flying, hasMoreClaim: false, recentGrowth: 0 });
    expect(c.state).toBe("CLAIMED_DONE");
    expect(c.corroborated).toBe(false);
  });

  it("the spine routes the uncorroborated claim to reload_resume, NOT to verdict(done)", () => {
    const c = classify({ ...flying, hasMoreClaim: false, recentGrowth: 0 });
    const { command } = step(
      initialSpineState(),
      { observed: c.state, corroborated: c.corroborated, cursor: "wall-cursor", captured: CAPTURED, declared: DECLARED },
      DEFAULT_SPINE_BUDGET,
      spineDeps,
    );
    expect(command.kind).toBe("reload_resume");
  });

  it("after the reload RE-WALLS at the same cursor, the spine yields honest INCOMPLETE (never done)", () => {
    const c = classify({ ...flying, hasMoreClaim: false, recentGrowth: 0 });
    const claim = {
      observed: c.state,
      corroborated: c.corroborated,
      cursor: "wall-cursor",
      captured: CAPTURED,
      declared: DECLARED,
    };
    let s = initialSpineState();
    const first = step(s, claim, DEFAULT_SPINE_BUDGET, spineDeps);
    s = first.state;
    expect(first.command.kind).toBe("reload_resume");
    const second = step(s, claim, DEFAULT_SPINE_BUDGET, spineDeps);
    expect(second.command.kind).toBe("verdict");
    if (second.command.kind === "verdict") {
      expect(second.command.verdict).toBe("incomplete"); // NEVER "done"
      if (second.command.verdict === "incomplete") {
        expect(second.command.reason).toMatch(/5191/);
        expect(second.command.reason).toMatch(/5989/);
      }
    }
  });

  it("completeness: the ratio guard would pass (86.7% > 85%) but velocity makes it SUSPICIOUS, not done", () => {
    // Prove the ratio alone is blind: without the velocity signal this exact count is 'done'…
    expect(assessCompleteness({ terminalDone: true, captured: CAPTURED, declared: DECLARED })).toBe("done");
    // …and WITH the velocity signal it is correctly 'suspicious'.
    expect(
      assessCompleteness({ terminalDone: true, captured: CAPTURED, declared: DECLARED, terminalAtVelocity: true }),
    ).toBe("suspicious");
  });

  it("scrollState: the fake-done page yields `claimed` (routed to the spine), never `done`", () => {
    let s = initialScrollState(5100);
    ({ state: s } = scrollStep(s, { kind: "page_captured", newCount: 5161, hasMore: true }, scrollDeps));
    const { state, action } = scrollStep(
      s,
      { kind: "page_captured", newCount: CAPTURED, hasMore: false, atFullVelocity: true },
      scrollDeps,
    );
    expect(action).toEqual({ kind: "claimed" });
    expect(state.status).not.toBe("done");
  });
});
