// Tests for the flagged-session empty-200 → auto-refresh recovery ladder (SESS-01/CHAL-UX, spec §6.5).
// The load-bearing invariants: (a) N consecutive empty-200s before acting, (b) exactly ONE reload per
// run — reloadsUsed is monotonic and a healthy arrival never refills it, (c) still-empty-after-reload
// escalates to the challenge path (pause+notify), never giveup-as-stall, and (d) `challenged` auto-resumes
// on the next healthy arrival.
import { describe, it, expect } from "vitest";
import {
  initialRecoveryState,
  stepRecovery,
  EMPTY_STREAK_TO_ACT,
  MAX_RELOADS_PER_RUN,
  type RecoveryState,
} from "./sessionRecovery.js";

const NOW = 1_000;
const deps = { now: NOW };
const init = () => initialRecoveryState(0);

describe("constants pin the account-safe bounds", () => {
  it("acts after 2 consecutive empty-200s and allows exactly one reload", () => {
    expect(EMPTY_STREAK_TO_ACT).toBe(2);
    expect(MAX_RELOADS_PER_RUN).toBe(1);
  });
});

describe("initialRecoveryState", () => {
  it("starts healthy with a fresh streak and no reloads spent", () => {
    expect(initialRecoveryState(NOW)).toEqual({
      phase: "healthy",
      emptyStreak: 0,
      reloadsUsed: 0,
      updatedAt: NOW,
    });
  });
});

describe("empty_ok ladder — suspect → refreshing → challenged", () => {
  it("a single empty_ok is 'suspect' + continue (one empty page is a fluke, not a flag)", () => {
    const { state, command } = stepRecovery(init(), "empty_ok", deps);
    expect(state.phase).toBe("suspect");
    expect(state.emptyStreak).toBe(1);
    expect(state.reloadsUsed).toBe(0); // no reload consumed below the threshold
    expect(command).toEqual({ kind: "continue" });
  });

  it("the 2nd consecutive empty_ok triggers ONE bounded reload (the automated manual refresh)", () => {
    let s: RecoveryState = init();
    s = stepRecovery(s, "empty_ok", deps).state; // streak 1 → suspect
    const { state, command } = stepRecovery(s, "empty_ok", deps); // streak 2 → refreshing
    expect(state.phase).toBe("refreshing");
    expect(state.emptyStreak).toBe(2);
    expect(state.reloadsUsed).toBe(1);
    expect(command).toEqual({ kind: "reload" });
  });

  it("still empty AFTER the reload (budget spent) → pause_notify challenge path, never a reload loop", () => {
    let s: RecoveryState = init();
    s = stepRecovery(s, "empty_ok", deps).state; // suspect (1)
    s = stepRecovery(s, "empty_ok", deps).state; // refreshing (2), reloadsUsed 1
    const { state, command } = stepRecovery(s, "empty_ok", deps); // (3) reload exhausted → challenged
    expect(state.phase).toBe("challenged");
    expect(state.reloadsUsed).toBe(1); // NOT a second reload — bounded to one
    expect(command.kind).toBe("pause_notify");
    if (command.kind === "pause_notify") {
      expect(command.reason).toMatch(/empty pages after a refresh/i);
      expect(command.reason).toMatch(/flagged/i);
    }
  });
});

describe("healthy_arrival clears a suspect streak (a transient empty followed by data is not a flag)", () => {
  it("resets emptyStreak to 0 and returns to healthy + continue", () => {
    let s: RecoveryState = init();
    s = stepRecovery(s, "empty_ok", deps).state; // suspect (streak 1)
    const { state, command } = stepRecovery(s, "healthy_arrival", deps);
    expect(state.phase).toBe("healthy");
    expect(state.emptyStreak).toBe(0);
    expect(command).toEqual({ kind: "continue" });
  });

  it("does NOT refill the reload budget — reloadsUsed is monotonic within a run (anti-hammer)", () => {
    let s: RecoveryState = init();
    s = stepRecovery(s, "empty_ok", deps).state; // suspect
    s = stepRecovery(s, "empty_ok", deps).state; // refreshing, reloadsUsed 1
    s = stepRecovery(s, "healthy_arrival", deps).state; // recovers, but budget stays spent
    expect(s.reloadsUsed).toBe(1);
    // A later flag can no longer reload — it escalates straight to the challenge path.
    s = stepRecovery(s, "empty_ok", deps).state; // suspect again (streak 1)
    const { state, command } = stepRecovery(s, "empty_ok", deps); // streak 2, but reload spent
    expect(state.phase).toBe("challenged");
    expect(state.reloadsUsed).toBe(1);
    expect(command.kind).toBe("pause_notify");
  });
});

describe("challenge signal → pause_notify (freeze giveup) + auto-resume", () => {
  it("a challenge pauses+notifies with the solve-in-tab reason", () => {
    const { state, command } = stepRecovery(init(), "challenge", deps);
    expect(state.phase).toBe("challenged");
    expect(command.kind).toBe("pause_notify");
    if (command.kind === "pause_notify") {
      expect(command.reason).toMatch(/solve it in the TikTok tab/i);
      expect(command.reason).toMatch(/resumes automatically/i);
    }
  });

  it("ABSORBING-ISH: once challenged, a healthy_arrival auto-resumes → healthy + continue", () => {
    const challenged = stepRecovery(init(), "challenge", deps).state;
    expect(challenged.phase).toBe("challenged");
    const { state, command } = stepRecovery(challenged, "healthy_arrival", deps);
    expect(state.phase).toBe("healthy");
    expect(state.emptyStreak).toBe(0);
    expect(command).toEqual({ kind: "continue" });
  });
});

describe("offline → pause_notify without consuming a reload", () => {
  it("pauses+notifies and does NOT spend a reload or advance the empty streak", () => {
    let s: RecoveryState = init();
    s = stepRecovery(s, "empty_ok", deps).state; // suspect, streak 1
    const { state, command } = stepRecovery(s, "offline", deps);
    expect(command.kind).toBe("pause_notify");
    if (command.kind === "pause_notify") expect(command.reason).toMatch(/offline/i);
    expect(state.reloadsUsed).toBe(0); // no reload consumed
    expect(state.emptyStreak).toBe(1); // streak not advanced by an offline drop
  });

  it("auto-resumes on the next healthy arrival (offline is not absorbing)", () => {
    const paused = stepRecovery(init(), "offline", deps).state;
    const { state, command } = stepRecovery(paused, "healthy_arrival", deps);
    expect(state.phase).toBe("healthy");
    expect(command).toEqual({ kind: "continue" });
  });
});

describe("updatedAt is stamped from the injected now (pure — no Date.now)", () => {
  it("carries the injected timestamp on each transition", () => {
    const { state } = stepRecovery(init(), "empty_ok", { now: 4242 });
    expect(state.updatedAt).toBe(4242);
  });
});
