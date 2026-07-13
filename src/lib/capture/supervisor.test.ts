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

  it("start when all four are terminal RESETS to a fresh sweep — never a permanent no-op", () => {
    // Fix round 1 (CRITICAL): a terminal sweep must not brick Sync. New saves accrue after a sweep;
    // the next Sync click starts over (idempotent dedup makes the re-sweep cheap and safe).
    const allDone: SupervisorProgress = {
      current: null,
      done: [...SOURCES],
      counts: {
        favorites: { captured: 10, status: "done" },
        likes: { captured: 20, status: "done" },
        posts: { captured: 5, status: "done" },
        reposts: { captured: 2, status: "done" },
      },
    };
    const r = nextAction(allDone, { kind: "start" });
    expect(r.action).toEqual({ kind: "capture_source", source: "favorites", resuming: false });
    expect(r.progress.done).toEqual([]); // fresh sweep
    expect(r.progress.counts).toEqual({}); // fresh per-source records
    expect(r.progress.current).toBe("favorites");
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

// ── Fix round 1 (CRITICAL): a giveup is NOT terminal-forever ────────────────────────────────────
// Sequencing PAST a giveup within one sweep is correct (never loop on a throttled source). The
// defect was permanence: `done[]` never reset, so a partial source's uncaptured tail was skipped on
// every future Sync, and once all four were terminal Sync was a permanent no-op. Fix: `start` with
// every source terminal RESETS progress into a fresh sweep — previously-partial ("giveup") sources
// first, and driven with resuming:true so the re-scroll can get past their captured prefix to the
// uncaptured tail (carry-forward 1). Previously-done sources re-sweep fresh (resuming:false).
describe("supervisor.nextAction — fresh sweep after a terminal sweep (giveup re-sync)", () => {
  const sweptWithPartials: SupervisorProgress = {
    current: null,
    done: [...SOURCES],
    counts: {
      favorites: { captured: 1200, status: "done" },
      likes: { captured: 3400, status: "giveup" }, // throttled — uncaptured tail remains
      posts: { captured: 80, status: "done" },
      reposts: { captured: 15, status: "giveup" }, // throttled too
    },
  };

  it("start after a partial sweep resets and re-attempts the GIVEUP sources FIRST, resuming:true", () => {
    const r = nextAction(sweptWithPartials, { kind: "start" });
    // likes is the first previously-partial source in SOURCES order → it leads the new sweep, and
    // it resumes (its prefix is captured; the tail is the target).
    expect(r.action).toEqual({ kind: "capture_source", source: "likes", resuming: true });
    expect(r.progress.current).toBe("likes");
    expect(r.progress.done).toEqual([]);
    expect(r.progress.counts).toEqual({});
  });

  it("the fresh sweep walks partials first (resuming), then the rest (fresh), then all_done", () => {
    let p = nextAction(sweptWithPartials, { kind: "start" }).progress; // current: likes
    let r = nextAction(p, { kind: "source_finished", source: "likes", captured: 3900, status: "done" });
    expect(r.action).toEqual({ kind: "capture_source", source: "reposts", resuming: true }); // 2nd partial
    p = r.progress;
    r = nextAction(p, { kind: "source_finished", source: "reposts", captured: 20, status: "done" });
    expect(r.action).toEqual({ kind: "capture_source", source: "favorites", resuming: false }); // rest, fresh
    p = r.progress;
    r = nextAction(p, { kind: "source_finished", source: "favorites", captured: 1210, status: "done" });
    expect(r.action).toEqual({ kind: "capture_source", source: "posts", resuming: false });
    p = r.progress;
    r = nextAction(p, { kind: "source_finished", source: "posts", captured: 82, status: "done" });
    expect(r.action).toEqual({ kind: "all_done" });
  });

  it("a mid-fresh-sweep crash still resumes the in-flight source (retry ordering survives persistence)", () => {
    const p = nextAction(sweptWithPartials, { kind: "start" }).progress; // current: likes (a retry)
    const r = nextAction(p, { kind: "restarted" });
    expect(r.action).toEqual({ kind: "capture_source", source: "likes", resuming: true });
  });

  it("a sweep is NOT reset while un-attempted sources remain (reset only fires when ALL are terminal)", () => {
    const partway: SupervisorProgress = {
      current: null,
      done: ["favorites", "likes"],
      counts: { favorites: { captured: 1, status: "done" }, likes: { captured: 2, status: "giveup" } },
    };
    // likes gave up, but posts/reposts haven't run yet — start continues the sweep (posts), it does
    // NOT restart likes; the giveup retry belongs to the NEXT sweep.
    const r = nextAction(partway, { kind: "start" });
    expect(r.action).toEqual({ kind: "capture_source", source: "posts", resuming: false });
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

// ── Item 1: source selection (config.captureSources → enabled Source[]) ─────────────────────────────
// The options UI lets the founder pick which lanes a sweep drives. `nextAction`'s third arg carries the
// enabled set; a disabled source is NEVER driven and NEVER blocks completion. Default = SOURCES so an
// omitted arg (and every existing call site) behaves exactly as before.
describe("supervisor.nextAction — enabled source selection (item 1)", () => {
  const twoSources: Source[] = ["favorites", "likes"];

  it("a 2-source sweep drives only the enabled sources, in order, then all_done", () => {
    let p = initialProgress();
    let r = nextAction(p, { kind: "start" }, twoSources);
    expect(r.action).toEqual({ kind: "capture_source", source: "favorites", resuming: false });
    p = r.progress;
    r = nextAction(p, { kind: "source_finished", source: "favorites", captured: 10, status: "done" }, twoSources);
    expect(r.action).toEqual({ kind: "capture_source", source: "likes", resuming: false });
    p = r.progress;
    // Finishing the last ENABLED source completes the sweep — posts/reposts (disabled) never block it.
    r = nextAction(p, { kind: "source_finished", source: "likes", captured: 20, status: "done" }, twoSources);
    expect(r.action).toEqual({ kind: "all_done" });
    expect(r.progress.done).toEqual(["favorites", "likes"]);
  });

  it("a disabled source is skipped entirely (never becomes current, never appears in the sweep)", () => {
    // Enable favorites + posts only; likes + reposts are off.
    const favPosts: Source[] = ["favorites", "posts"];
    let p = initialProgress();
    let r = nextAction(p, { kind: "start" }, favPosts);
    expect(r.action).toEqual({ kind: "capture_source", source: "favorites", resuming: false });
    p = r.progress;
    r = nextAction(p, { kind: "source_finished", source: "favorites", captured: 1, status: "done" }, favPosts);
    // likes is disabled → the next enabled source is posts, NOT likes.
    expect(r.action).toEqual({ kind: "capture_source", source: "posts", resuming: false });
    p = r.progress;
    r = nextAction(p, { kind: "source_finished", source: "posts", captured: 2, status: "done" }, favPosts);
    expect(r.action).toEqual({ kind: "all_done" });
    expect(r.progress.done).not.toContain("likes");
    expect(r.progress.done).not.toContain("reposts");
  });

  it("the partials-first retry ordering holds AMONG the enabled sources after a complete sweep", () => {
    const twoDone: SupervisorProgress = {
      current: null,
      done: ["favorites", "likes"],
      counts: {
        favorites: { captured: 100, status: "done" },
        likes: { captured: 30, status: "giveup" }, // the partial
      },
      order: ["favorites", "likes"],
    };
    // A fresh Sync over the same 2 sources: the partial (likes) leads, resuming; favorites re-sweeps fresh.
    let r = nextAction(twoDone, { kind: "start" }, twoSources);
    expect(r.action).toEqual({ kind: "capture_source", source: "likes", resuming: true });
    r = nextAction(r.progress, { kind: "source_finished", source: "likes", captured: 40, status: "done" }, twoSources);
    expect(r.action).toEqual({ kind: "capture_source", source: "favorites", resuming: false });
  });

  it("a `suspicious` source is retried first on the next fresh sweep, exactly like a giveup", () => {
    const swept: SupervisorProgress = {
      current: null,
      done: ["favorites", "likes"],
      counts: {
        favorites: { captured: 100, status: "done" },
        likes: { captured: 5, status: "suspicious", expected: 1000 }, // grossly short → suspicious
      },
      order: ["favorites", "likes"],
    };
    const r = nextAction(swept, { kind: "start" }, twoSources);
    expect(r.action).toEqual({ kind: "capture_source", source: "likes", resuming: true });
  });

  it("newly-enabling a source after a completed sweep drives it on the next Sync", () => {
    // A prior sweep ran favorites+likes only; the founder now also enables posts.
    const twoDone: SupervisorProgress = {
      current: null,
      done: ["favorites", "likes"],
      counts: { favorites: { captured: 1, status: "done" }, likes: { captured: 2, status: "done" } },
      order: ["favorites", "likes"],
    };
    const threeSources: Source[] = ["favorites", "likes", "posts"];
    const r = nextAction(twoDone, { kind: "start" }, threeSources);
    // posts is the only undone enabled source → it is driven (favorites/likes are already done).
    expect(r.action).toEqual({ kind: "capture_source", source: "posts", resuming: false });
  });
});

// ── Item 2: completeness accounting — expected (declared) count recorded per source ─────────────────
describe("supervisor.nextAction — records expected (declared) count + suspicious status (item 2)", () => {
  it("source_finished carries the declared count into counts[source].expected", () => {
    let p = initialProgress();
    p = nextAction(p, { kind: "start" }).progress;
    p = nextAction(p, {
      kind: "source_finished",
      source: "favorites",
      captured: 900,
      status: "done",
      expected: 1000,
    }).progress;
    expect(p.counts.favorites).toEqual({ captured: 900, status: "done", expected: 1000 });
  });

  it("a suspicious terminal is recorded with its captured/expected", () => {
    let p = initialProgress();
    p = nextAction(p, { kind: "start" }).progress;
    p = nextAction(p, {
      kind: "source_finished",
      source: "favorites",
      captured: 50,
      status: "suspicious",
      expected: 1000,
    }).progress;
    expect(p.counts.favorites).toEqual({ captured: 50, status: "suspicious", expected: 1000 });
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
