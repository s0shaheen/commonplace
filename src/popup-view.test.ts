import { describe, it, expect } from "vitest";
import {
  computeViewModel,
  countLabel,
  formatInt,
  sourceLabel,
  DEFAULT_SOURCE_ORDER,
  type SyncStatusRaw,
} from "./popup-view.js";

const base: SyncStatusRaw = {
  count: 0,
  running: false,
  paused: null,
  halt: null,
  notice: null,
  progress: { order: [...DEFAULT_SOURCE_ORDER], done: [], current: null, counts: {} },
};

describe("completeness display (expected + quality)", () => {
  it("a clean done source shows 'N of ~M' when the declared count is known", () => {
    const vm = computeViewModel(
      { ...base, running: false, progress: { order: ["favorites"], done: ["favorites"], current: null, counts: { favorites: 1300 }, expected: { favorites: 1367 }, statuses: { favorites: "done" } } },
      { connected: true },
    );
    const row = vm.rows.find((r) => r.source === "favorites")!;
    expect(row.expected).toBe(1367);
    expect(row.quality).toBe("done");
    expect(row.detail).toBe("1,300 of ~1,367");
    expect(vm.state).toBe("done");
    expect(vm.stateLabel).toBe("All caught up");
  });

  it("a suspicious (short) source flags '· short' and the headline warns, not 'all caught up'", () => {
    const vm = computeViewModel(
      { ...base, running: false, progress: { order: ["favorites", "likes"], done: ["favorites", "likes"], current: null, counts: { favorites: 1367, likes: 500 }, expected: { favorites: 1367, likes: 4132 }, statuses: { favorites: "done", likes: "suspicious" } } },
      { connected: true },
    );
    const likes = vm.rows.find((r) => r.source === "likes")!;
    expect(likes.quality).toBe("suspicious");
    expect(likes.detail).toBe("500 of ~4,132 · short");
    expect(vm.state).toBe("done");
    expect(vm.stateTone).toBe("warn");
    expect(vm.stateLabel).toBe("Captured — some lists came up short");
  });

  it("a clean done source meaningfully below declared surfaces the '~K unavailable' gap (still 'All caught up')", () => {
    const vm = computeViewModel(
      { ...base, running: false, progress: { order: ["favorites"], done: ["favorites"], current: null, counts: { favorites: 900 }, expected: { favorites: 1367 }, statuses: { favorites: "done" } } },
      { connected: true },
    );
    const row = vm.rows.find((r) => r.source === "favorites")!;
    expect(row.quality).toBe("done");
    // Verified terminal → we reached the end; the 467 gap is deleted/private items, not truncation.
    expect(row.detail).toBe("900 of ~1,367 · ~467 unavailable");
    // A clean terminal with an unavailable gap is still a complete capture of what's available.
    expect(vm.state).toBe("done");
    expect(vm.stateLabel).toBe("All caught up");
    expect(vm.stateTone).toBe("done");
  });

  it("a clean done source within the drift tolerance shows a plain 'N of ~M' (no 'unavailable' noise)", () => {
    const vm = computeViewModel(
      { ...base, running: false, progress: { order: ["favorites"], done: ["favorites"], current: null, counts: { favorites: 1350 }, expected: { favorites: 1367 }, statuses: { favorites: "done" } } },
      { connected: true },
    );
    const row = vm.rows.find((r) => r.source === "favorites")!;
    expect(row.detail).toBe("1,350 of ~1,367");
  });

  it("a giveup source reads '· incomplete'; unknown expected shows just the count", () => {
    const vm = computeViewModel(
      { ...base, progress: { order: ["posts"], done: ["posts"], current: null, counts: { posts: 12 }, statuses: { posts: "giveup" } } },
      { connected: true },
    );
    const posts = vm.rows.find((r) => r.source === "posts")!;
    expect(posts.expected).toBeNull();
    expect(posts.detail).toBe("12 · incomplete");
  });

  it("older replies without expected/statuses degrade to the plain count (backward compatible)", () => {
    const vm = computeViewModel(
      { ...base, progress: { order: ["favorites"], done: ["favorites"], current: null, counts: { favorites: 800 } } },
      { connected: true },
    );
    const row = vm.rows.find((r) => r.source === "favorites")!;
    expect(row.quality).toBeNull();
    expect(row.detail).toBe("800");
    expect(vm.stateLabel).toBe("All caught up");
  });
});

describe("formatInt / countLabel", () => {
  it("groups thousands deterministically", () => {
    expect(formatInt(0)).toBe("0");
    expect(formatInt(999)).toBe("999");
    expect(formatInt(1000)).toBe("1,000");
    expect(formatInt(4661)).toBe("4,661");
    expect(formatInt(1234567)).toBe("1,234,567");
  });
  it("coerces junk to 0 and floors", () => {
    expect(formatInt(NaN)).toBe("0");
    expect(formatInt(-5)).toBe("0");
    expect(formatInt(12.9)).toBe("12");
  });
  it("pluralizes the library headline", () => {
    expect(countLabel(0)).toBe("No videos captured yet");
    expect(countLabel(1)).toBe("1 video in your library");
    expect(countLabel(4661)).toBe("4,661 videos in your library");
  });
});

describe("connecting state (no reply yet)", () => {
  it("null status → connecting, no crash, disabled Start", () => {
    const vm = computeViewModel(null, { connected: false });
    expect(vm.state).toBe("connecting");
    expect(vm.connection).toBe("connecting");
    expect(vm.rows).toEqual([]);
    expect(vm.banner).toBeNull();
    expect(vm.controls.start.visible).toBe(true);
    expect(vm.controls.start.enabled).toBe(false);
  });
});

describe("idle state", () => {
  it("fresh library, nothing running → idle with an enabled Start", () => {
    const vm = computeViewModel({ ...base, count: 12 }, { connected: true });
    expect(vm.state).toBe("idle");
    expect(vm.stateTone).toBe("idle");
    expect(vm.connection).toBe("live");
    expect(vm.countLabel).toBe("12 videos in your library");
    expect(vm.controls.start).toEqual({ visible: true, enabled: true, label: "Start capture" });
    expect(vm.controls.stop.visible).toBe(false);
    expect(vm.controls.pause.visible).toBe(false);
    expect(vm.controls.resume.visible).toBe(false);
    expect(vm.rows.map((r) => r.state)).toEqual(["pending", "pending", "pending", "pending"]);
  });
});

describe("capturing state", () => {
  const st: SyncStatusRaw = {
    ...base,
    count: 1200,
    running: true,
    progress: {
      order: ["favorites", "likes", "posts", "reposts"],
      done: ["favorites"],
      current: "likes",
      counts: { favorites: 800, likes: 400 },
    },
  };
  it("labels the current source and shows Stop + Pause", () => {
    const vm = computeViewModel(st, { connected: true });
    expect(vm.state).toBe("capturing");
    expect(vm.stateLabel).toBe("Capturing Likes…");
    expect(vm.stateTone).toBe("active");
    expect(vm.controls.stop.visible).toBe(true);
    expect(vm.controls.pause.visible).toBe(true);
    expect(vm.controls.start.visible).toBe(false);
    expect(vm.controls.resume.visible).toBe(false);
  });
  it("per-source rows reflect done / current / pending with counts", () => {
    const vm = computeViewModel(st, { connected: true });
    const [fav, likes, posts, reposts] = vm.rows;
    expect(fav).toMatchObject({ label: "Favorites", state: "done", count: 800, detail: "800" });
    expect(likes).toMatchObject({ label: "Likes", state: "current", detail: "capturing…" });
    expect(posts).toMatchObject({ state: "pending", detail: "pending" });
    expect(reposts).toMatchObject({ state: "pending" });
  });
});

describe("paused state — the action-needed banner (the #1 ask)", () => {
  const st: SyncStatusRaw = {
    ...base,
    count: 500,
    running: true, // even while the loop is technically live, a pause takes precedence
    paused: { level: "passcode", reason: "TikTok's screen-time passcode is up — enter it in the tab, then Resume." },
    progress: { order: [...DEFAULT_SOURCE_ORDER], done: ["favorites"], current: "likes", counts: { favorites: 500 } },
  };
  it("surfaces a paused banner carrying the reason", () => {
    const vm = computeViewModel(st, { connected: true });
    expect(vm.state).toBe("paused");
    expect(vm.stateTone).toBe("warn");
    expect(vm.banner).not.toBeNull();
    expect(vm.banner!.kind).toBe("paused");
    expect(vm.banner!.title).toBe("Passcode — action needed");
    expect(vm.banner!.reason).toContain("passcode");
  });
  it("shows Resume (primary) + Stop, hides Start + Pause", () => {
    const vm = computeViewModel(st, { connected: true });
    expect(vm.controls.resume).toEqual({ visible: true, enabled: true, label: "Resume" });
    expect(vm.controls.stop.visible).toBe(true);
    expect(vm.controls.start.visible).toBe(false);
    expect(vm.controls.pause.visible).toBe(false);
  });
  it("falls back to a helpful reason when none is provided", () => {
    const vm = computeViewModel({ ...st, paused: { level: "unknown" } }, { connected: true });
    expect(vm.banner!.title).toBe("Action needed");
    expect(vm.banner!.reason.length).toBeGreaterThan(0);
  });
});

describe("halted state (unrecoverable)", () => {
  it("halt outranks everything and shows a distinct halt banner", () => {
    const st: SyncStatusRaw = {
      ...base,
      running: true,
      paused: { level: "passcode", reason: "x" },
      halt: { reason: "Storage is full." },
    };
    const vm = computeViewModel(st, { connected: true });
    expect(vm.state).toBe("halted");
    expect(vm.stateTone).toBe("error");
    expect(vm.banner!.kind).toBe("halt");
    expect(vm.banner!.reason).toBe("Storage is full.");
    expect(vm.controls.start.enabled).toBe(false);
    expect(vm.controls.stop.visible).toBe(false);
  });
  it("synthesizes a reason when the halt payload is opaque", () => {
    const vm = computeViewModel({ ...base, halt: {} }, { connected: true });
    expect(vm.banner!.reason.length).toBeGreaterThan(0);
  });
});

describe("done state", () => {
  it("all sources done → All caught up + Sync again", () => {
    const st: SyncStatusRaw = {
      ...base,
      count: 4661,
      running: false,
      progress: {
        order: ["favorites", "likes", "posts", "reposts"],
        done: ["favorites", "likes", "posts", "reposts"],
        current: null,
        counts: { favorites: 2000, likes: 2000, posts: 400, reposts: 261 },
      },
    };
    const vm = computeViewModel(st, { connected: true });
    expect(vm.state).toBe("done");
    expect(vm.stateLabel).toBe("All caught up");
    expect(vm.controls.start.label).toBe("Sync again");
    expect(vm.controls.start.enabled).toBe(true);
    expect(vm.rows.every((r) => r.state === "done")).toBe(true);
  });
});

describe("reconnecting (a poll failed after a prior success)", () => {
  it("keeps the last-known picture but flags reconnecting", () => {
    const vm = computeViewModel({ ...base, count: 99, running: true, progress: { current: "likes", order: [...DEFAULT_SOURCE_ORDER], done: [], counts: {} } }, { connected: false });
    expect(vm.connection).toBe("reconnecting");
    expect(vm.state).toBe("capturing"); // still shows the live picture
    expect(vm.count).toBe(99);
  });
});

describe("defensive tolerance", () => {
  it("missing progress.order falls back to the default order", () => {
    const vm = computeViewModel({ count: 3 }, { connected: true });
    expect(vm.rows.map((r) => r.source)).toEqual([...DEFAULT_SOURCE_ORDER]);
  });
  it("tolerates the legacy {captured} counts object shape", () => {
    const vm = computeViewModel(
      { ...base, progress: { order: ["favorites"], done: ["favorites"], current: null, counts: { favorites: { captured: 42 } } } },
      { connected: true },
    );
    expect(vm.rows[0]!.count).toBe(42);
    expect(vm.rows[0]!.detail).toBe("42");
  });
  it("handles an unknown source label by title-casing it", () => {
    expect(sourceLabel("bookmarks")).toBe("Bookmarks");
    const vm = computeViewModel({ ...base, progress: { order: ["bookmarks"], done: [], current: "bookmarks", counts: {} }, running: true }, { connected: true });
    expect(vm.rows[0]!.label).toBe("Bookmarks");
    expect(vm.stateLabel).toBe("Capturing Bookmarks…");
  });
});
