// RED-first tests for the capture supervisor — the source-sequencing + resume state machine that
// drives favorites→likes→posts→reposts to completion, unattended and crash-survivable. Mirrors
// queue.ts's discipline: a PURE reducer (`nextAction`), all I/O injected in the glue, so "a mid-source
// service-worker death resumes the RIGHT source" is a deterministic unit test, not a live-run gamble.
import { describe, it, expect } from "vitest";
import {
  SOURCES,
  initialProgress,
  nextAction,
  arrivalDrivesRun,
  type SupervisorProgress,
  type Source,
} from "./supervisor.js";

// Drive one source to a terminal, returning the post-finish {progress, action}.
function finish(progress: SupervisorProgress, source: Source, captured = 100, status: "done" | "giveup" = "done") {
  return nextAction(progress, { kind: "source_finished", source, captured, status });
}

describe("supervisor.nextAction — the full 4-source sequence", () => {
  it("start → favorites → likes → posts → reposts → all_done, in order", () => {
    let p = initialProgress();

    // start picks the first source and marks it current.
    let r = nextAction(p, { kind: "start" });
    expect(r.action).toEqual({ kind: "capture_source", source: "favorites", resuming: false });
    expect(r.progress.current).toBe("favorites");
    p = r.progress;

    // each finish advances to the next undone source, in SOURCES order.
    const order: Source[] = ["likes", "posts", "reposts"];
    let finishedSoFar: Source = "favorites";
    for (const next of order) {
      r = finish(p, finishedSoFar);
      expect(r.action).toEqual({ kind: "capture_source", source: next, resuming: false });
      expect(r.progress.current).toBe(next);
      expect(r.progress.done).toContain(finishedSoFar);
      p = r.progress;
      finishedSoFar = next;
    }

    // finishing the last source ⇒ all_done, current cleared, every source recorded.
    r = finish(p, "reposts");
    expect(r.action).toEqual({ kind: "all_done" });
    expect(r.progress.current).toBeNull();
    expect([...r.progress.done].sort()).toEqual([...SOURCES].sort());
  });

  it("records per-source captured counts + status in `counts`", () => {
    let p = initialProgress();
    p = nextAction(p, { kind: "start" }).progress; // current favorites
    p = finish(p, "favorites", 1200, "done").progress;
    p = finish(p, "likes", 3400, "giveup").progress; // a partial source is still recorded + advanced past
    expect(p.counts.favorites).toEqual({ captured: 1200, status: "done" });
    expect(p.counts.likes).toEqual({ captured: 3400, status: "giveup" });
  });
});

describe("supervisor.nextAction — resume-after-crash", () => {
  it("`restarted` with a source left in flight returns THAT source, resuming:true", () => {
    // A crash left favorites mid-capture: persisted progress has current=favorites, done=[].
    const midRun: SupervisorProgress = { current: "favorites", done: [], counts: {} };
    const r = nextAction(midRun, { kind: "restarted" });
    // idempotent re-capture (dedup by id) makes re-scrolling the captured prefix safe; `resuming:true`
    // is the carry-forward-1 signal so that re-scroll doesn't prematurely giveup on all-dup pages.
    expect(r.action).toEqual({ kind: "capture_source", source: "favorites", resuming: true });
    expect(r.progress.current).toBe("favorites");
  });

  it("`restarted` mid-way through the sequence resumes the in-flight source, not the first", () => {
    // favorites+likes already done; posts was in flight when the worker died.
    const midRun: SupervisorProgress = {
      current: "posts",
      done: ["favorites", "likes"],
      counts: { favorites: { captured: 10, status: "done" }, likes: { captured: 20, status: "done" } },
    };
    const r = nextAction(midRun, { kind: "restarted" });
    expect(r.action).toEqual({ kind: "capture_source", source: "posts", resuming: true });
  });

  it("`restarted` with NOTHING in flight advances to the next undone source (fresh, not resuming)", () => {
    const between: SupervisorProgress = { current: null, done: ["favorites"], counts: {} };
    const r = nextAction(between, { kind: "restarted" });
    expect(r.action).toEqual({ kind: "capture_source", source: "likes", resuming: false });
  });
});

describe("supervisor.nextAction — idempotence, skip-completed, all_done", () => {
  it("skips already-completed sources: start with favorites+posts done → likes next", () => {
    const partial: SupervisorProgress = { current: null, done: ["favorites", "posts"], counts: {} };
    const r = nextAction(partial, { kind: "start" });
    expect(r.action).toEqual({ kind: "capture_source", source: "likes", resuming: false }); // first UNDONE in order
  });

  it("start when all four are done ⇒ all_done (a redundant Sync click is a no-op)", () => {
    const allDone: SupervisorProgress = { current: null, done: [...SOURCES], counts: {} };
    expect(nextAction(allDone, { kind: "start" }).action).toEqual({ kind: "all_done" });
  });

  it("start while a run is genuinely in flight ⇒ idle (never double-drives the live tab)", () => {
    const live: SupervisorProgress = { current: "likes", done: ["favorites"], counts: {} };
    const r = nextAction(live, { kind: "start" });
    expect(r.action).toEqual({ kind: "idle" }); // suspenders to the glue's supervisorRunning belt
    expect(r.progress).toEqual(live); // start does not mutate a live run
  });

  it("finishing a source twice does not duplicate it in `done`", () => {
    let p: SupervisorProgress = { current: "favorites", done: [], counts: {} };
    p = finish(p, "favorites").progress;
    p = finish(p, "favorites").progress; // a late/duplicate scroll_done
    expect(p.done.filter((s) => s === "favorites")).toHaveLength(1);
  });
});

// ── Carry-forward (2): source-tagged arrivals (Task-5, BINDING) ────────────────────────────────
// After switching sources, an in-flight item_list straggler from the PREVIOUS source can still be
// delivered. If it drove the new run's completion signals it would inject the old source's hasMore
// (a false `done`, or a phantom page). `arrivalDrivesRun` is the pure gate the content-script glue
// applies: only arrivals whose source matches the active run drive its scroll signals. (Items are
// still STORED regardless — idempotent upsert; this gates completion, not capture.)
describe("supervisor.arrivalDrivesRun — carry-forward 2", () => {
  it("accepts an arrival whose source matches the active run", () => {
    expect(arrivalDrivesRun("likes", "likes")).toBe(true);
  });

  it("REJECTS a straggler from the previous source (the false-hasMore-injection bug)", () => {
    expect(arrivalDrivesRun("likes", "favorites")).toBe(false); // late favorites page must not drive the likes run
  });

  it("a null expected-source (manual Alt+Shift+A dev run, no supervisor tag) accepts everything", () => {
    expect(arrivalDrivesRun(null, "favorites")).toBe(true);
    expect(arrivalDrivesRun(null, null)).toBe(true);
  });

  it("rejects an untagged/unknown arrival while a specific source is expected", () => {
    expect(arrivalDrivesRun("posts", null)).toBe(false);
    expect(arrivalDrivesRun("posts", undefined)).toBe(false);
    expect(arrivalDrivesRun("posts", "other")).toBe(false);
  });
});

describe("supervisor — persistence shape", () => {
  it("initialProgress is the empty, resumable starting point", () => {
    expect(initialProgress()).toEqual({ current: null, done: [], counts: {} });
  });

  it("SOURCES is the frozen favorites→likes→posts→reposts order", () => {
    expect(SOURCES).toEqual(["favorites", "likes", "posts", "reposts"]);
  });
});
