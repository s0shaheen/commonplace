// RED-first tests for the observed-state classifier (capture-control-plane). The classifier demotes
// every sensor to an INPUT and returns exactly one observed state; no single sensor terminates a run.
// The load-bearing rule under test: a platform completion claim (hasMore:false) is EVIDENCE, corroborated
// (→ genuine done) only when the stream had DECELERATED (not at full velocity) OR the count reconciles.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  classify,
  atFullVelocity,
  isCorroborated,
  EMPTY_OK_NOT_VITAL,
  type CaptureStateInputs,
} from "./captureState.js";

/** A healthy, mid-capture baseline: items arriving, transport ok, grid vital, no walls. */
const base: CaptureStateInputs = {
  hasMoreClaim: true,
  transport: "ok",
  recentGrowth: 30,
  priorPageHadMore: true,
  priorPageGrew: true,
  requestIssued: true,
  vital: true,
  consecutiveEmptyOk: 0,
  overlayChallenge: false,
  banSignal: false,
  reconciled: false,
};

describe("classify — PROGRESSING", () => {
  it("new items arriving ⇒ PROGRESSING", () => {
    expect(classify({ ...base, recentGrowth: 24 }).state).toBe("PROGRESSING");
  });

  it("no growth but a request WAS issued (server backpressure) ⇒ PROGRESSING, not a nudge", () => {
    // The requestIssued discriminator, direction 1: we asked and are waiting — the glue backs off,
    // it is NOT the self-inflicted lazy-load stall that needs a motion nudge.
    expect(classify({ ...base, recentGrowth: 0, requestIssued: true }).state).toBe("PROGRESSING");
  });
});

describe("classify — STALLED_VITAL (self-inflicted lazy-load stall)", () => {
  it("no growth AND no request issued AND grid still vital ⇒ STALLED_VITAL", () => {
    // The requestIssued discriminator, direction 2: we did not even ask ⇒ re-arm the lazy-loader.
    expect(classify({ ...base, recentGrowth: 0, requestIssued: false, vital: true }).state).toBe("STALLED_VITAL");
  });
});

describe("classify — NOT_VITAL", () => {
  it("the grid went blank ⇒ NOT_VITAL", () => {
    expect(classify({ ...base, recentGrowth: 0, vital: false }).state).toBe("NOT_VITAL");
  });

  it("a run of empty_ok pages ⇒ NOT_VITAL", () => {
    expect(classify({ ...base, recentGrowth: 0, transport: "empty_ok", consecutiveEmptyOk: EMPTY_OK_NOT_VITAL }).state).toBe(
      "NOT_VITAL",
    );
  });
});

describe("classify — CHALLENGED wins over any completion claim", () => {
  it("a captcha/login overlay ⇒ CHALLENGED", () => {
    expect(classify({ ...base, overlayChallenge: true }).state).toBe("CHALLENGED");
  });

  it("a ban signal ⇒ CHALLENGED", () => {
    expect(classify({ ...base, banSignal: true }).state).toBe("CHALLENGED");
  });

  it("CHALLENGED even when the page ALSO claims hasMore:false (regardless of the claim)", () => {
    expect(classify({ ...base, hasMoreClaim: false, overlayChallenge: true }).state).toBe("CHALLENGED");
  });
});

describe("classify — CLAIMED_DONE and the corroboration gate", () => {
  it("hasMore:false at FULL velocity, unreconciled ⇒ CLAIMED_DONE but UNcorroborated (routes to the spine)", () => {
    const c = classify({ ...base, hasMoreClaim: false, priorPageHadMore: true, priorPageGrew: true, reconciled: false });
    expect(c.state).toBe("CLAIMED_DONE");
    expect(c.corroborated).toBe(false);
  });

  it("hasMore:false after the stream DECELERATED (prior page not growing) ⇒ corroborated (genuine done)", () => {
    const c = classify({ ...base, hasMoreClaim: false, priorPageGrew: false });
    expect(c.state).toBe("CLAIMED_DONE");
    expect(c.corroborated).toBe(true);
  });

  it("hasMore:false at full velocity but RECONCILED against declared/ZIP ⇒ corroborated (done)", () => {
    const c = classify({ ...base, hasMoreClaim: false, priorPageHadMore: true, priorPageGrew: true, reconciled: true });
    expect(c.state).toBe("CLAIMED_DONE");
    expect(c.corroborated).toBe(true);
  });

  it("hasMore:false decelerated but with a vitality drop ⇒ UNcorroborated", () => {
    const c = classify({ ...base, hasMoreClaim: false, priorPageGrew: false, vital: false });
    expect(c.corroborated).toBe(false);
  });

  it("a hasMore:false on a NON-ok transport is NOT a completion claim (never CLAIMED_DONE)", () => {
    // main-world only forwards hasMore:false off a healthy page; a wall/error must not read as done.
    expect(classify({ ...base, hasMoreClaim: false, transport: "challenge", overlayChallenge: false }).state).not.toBe(
      "CLAIMED_DONE",
    );
  });
});

describe("velocity fingerprint — both directions", () => {
  it("prior page hasMore:true AND growing ⇒ at full velocity", () => {
    expect(atFullVelocity({ ...base, priorPageHadMore: true, priorPageGrew: true })).toBe(true);
  });
  it("prior page not growing ⇒ NOT at full velocity (decelerated)", () => {
    expect(atFullVelocity({ ...base, priorPageHadMore: true, priorPageGrew: false })).toBe(false);
  });
  it("prior page already reported no-more ⇒ NOT at full velocity", () => {
    expect(atFullVelocity({ ...base, priorPageHadMore: false, priorPageGrew: true })).toBe(false);
  });
  it("isCorroborated: reconciliation always corroborates, even at full velocity", () => {
    expect(isCorroborated({ ...base, priorPageHadMore: true, priorPageGrew: true, reconciled: true })).toBe(true);
  });
});

describe("classify — totality & determinism", () => {
  it("returns one of the five states for any input, deterministically", () => {
    const states = new Set(["PROGRESSING", "STALLED_VITAL", "NOT_VITAL", "CHALLENGED", "CLAIMED_DONE"]);
    const a = classify(base);
    const b = classify(base);
    expect(a).toEqual(b);
    expect(states.has(a.state)).toBe(true);
  });
});

describe("purity", () => {
  it("no Date.now / Math.random / DOM references (grep-verified)", () => {
    const src = readFileSync(fileURLToPath(new URL("./captureState.ts", import.meta.url)), "utf8");
    expect(src).not.toMatch(/Math\.random/);
    expect(src).not.toMatch(/Date\.now/);
    expect(src).not.toMatch(/\bdocument\b/);
    expect(src).not.toMatch(/\bwindow\b/);
  });
});
