// Tests for the enrichment ORCHESTRATION core — the loop that ties tierPolicy + the lane runners +
// merge together. Lane runners are INJECTED, so the whole ladder (skip, oembed base, tikwm→apify
// failover, honest partial, per-lane checkpoint) is exercised end-to-end with no network. This is where
// the spec's skip-path and provider-fallback scenarios are proven against the REAL policy + merge.
import { describe, it, expect, vi } from "vitest";
import { enrichItem, type LaneRunner } from "./enrichItem.js";
import type { CapturedItem } from "../types.js";
import type { EnrichResult } from "./types.js";

function skeleton(): CapturedItem {
  return {
    id: "1",
    sources: ["favorites"],
    desc: "",
    createTime: null,
    author: null,
    authorName: null,
    url: "https://www.tiktok.com/@a/video/1",
    playUrl: null,
    downloadUrl: null,
    cover: null,
    durationSec: null,
    hasSubtitles: false,
    subtitleUrl: null,
    isSlideshow: false,
    music: null,
    hashtags: [],
    stats: { plays: null, likes: null, comments: null, shares: null, collects: null },
  };
}

const ok = (value: Partial<CapturedItem>): LaneRunner => vi.fn(async (): Promise<EnrichResult> => ({ ok: true, value }));
const fail = (error: string, quota = false): LaneRunner => vi.fn(async (): Promise<EnrichResult> => ({ ok: false, error, quota }));

describe("enrichItem — skip path", () => {
  it("a content-rich live item never calls a lane (skip, no network)", async () => {
    const live: CapturedItem = { ...skeleton(), desc: "cooking dinner", cover: "https://cdn/c.jpg" };
    const oembed = ok({ desc: "SHOULD NOT RUN" });
    const out = await enrichItem(live, { setting: "free", lanes: { oembed } });
    expect(oembed).not.toHaveBeenCalled();
    expect(out.status).toBe("skipped");
    expect(out.item.desc).toBe("cooking dinner"); // untouched
  });

  it("setting=off never enriches even a skeleton", async () => {
    const oembed = ok({ desc: "x" });
    const out = await enrichItem(skeleton(), { setting: "off", lanes: { oembed } });
    expect(oembed).not.toHaveBeenCalled();
    expect(out.status).toBe("skipped");
  });
});

describe("enrichItem — free default", () => {
  it("oEmbed fills a skeleton's caption + poster (item becomes searchable)", async () => {
    const oembed = ok({ desc: "pasta night #pasta", cover: "https://cdn/c.jpg", author: "chef", hashtags: ["pasta"] });
    const out = await enrichItem(skeleton(), { setting: "free", lanes: { oembed } });
    expect(oembed).toHaveBeenCalledTimes(1);
    expect(out.item.desc).toBe("pasta night #pasta");
    expect(out.item.cover).toBe("https://cdn/c.jpg");
    expect(out.filled).toEqual(["oembed"]);
    // transcript is beyond oEmbed's reach on the free tier → an honest partial, never a fake-complete.
    expect(out.status).toBe("partial");
  });
});

describe("enrichItem — paid provider fallback", () => {
  it("tikwm quota → fails over to Apify, which fills the transcript (end-to-end)", async () => {
    const calls: string[] = [];
    const oembed: LaneRunner = vi.fn(async (): Promise<EnrichResult> => {
      calls.push("oembed");
      return { ok: true, value: { desc: "cap", cover: "https://cdn/c.jpg" } };
    });
    const tikwm: LaneRunner = vi.fn(async (): Promise<EnrichResult> => {
      calls.push("tikwm");
      return { ok: false, error: "tikwm_quota", quota: true };
    });
    const apify: LaneRunner = vi.fn(async (): Promise<EnrichResult> => {
      calls.push("apify");
      return { ok: true, value: { subtitleUrl: "https://cdn/s.vtt", stats: { plays: 10, likes: 5, comments: 1, shares: 0, collects: null } } };
    });

    const out = await enrichItem(skeleton(), { setting: "paid", apifyAvailable: true, lanes: { oembed, tikwm, apify } });

    expect(calls).toEqual(["oembed", "tikwm", "apify"]); // the exact ladder + failover order
    expect(out.item.subtitleUrl).toBe("https://cdn/s.vtt");
    expect(out.item.hasSubtitles).toBe(true);
    expect(out.item.desc).toBe("cap"); // oEmbed's fill preserved through the chain
    expect(out.status).toBe("enriched"); // fully filled
    expect(out.lanesTried).toEqual(["oembed", "tikwm", "apify"]);
  });

  it("both paid providers fail → keeps oEmbed fields, marked partial (never fake-complete)", async () => {
    const out = await enrichItem(skeleton(), {
      setting: "paid",
      apifyAvailable: true,
      lanes: {
        oembed: ok({ desc: "cap", cover: "https://cdn/c.jpg" }),
        tikwm: fail("tikwm_error"),
        apify: fail("apify_error"),
      },
    });
    expect(out.item.desc).toBe("cap"); // oEmbed's fields retained
    expect(out.item.subtitleUrl).toBeNull(); // transcript never obtained
    expect(out.status).toBe("partial");
  });

  it("does not fail over to Apify when tikwm succeeds (no needless third call)", async () => {
    const apify = ok({ desc: "SHOULD NOT RUN" });
    const out = await enrichItem(skeleton(), {
      setting: "paid",
      apifyAvailable: true,
      lanes: {
        oembed: ok({ desc: "cap", cover: "https://cdn/c.jpg" }),
        tikwm: ok({ subtitleUrl: "https://cdn/s.vtt" }),
        apify,
      },
    });
    expect(apify).not.toHaveBeenCalled();
    expect(out.status).toBe("enriched");
  });
});

describe("enrichItem — checkpointing", () => {
  it("persists the item after each successful lane (a resumable checkpoint)", async () => {
    const persist = vi.fn();
    await enrichItem(skeleton(), {
      setting: "paid",
      apifyAvailable: true,
      lanes: {
        oembed: ok({ desc: "cap", cover: "https://cdn/c.jpg" }),
        tikwm: ok({ subtitleUrl: "https://cdn/s.vtt", stats: { plays: 1, likes: 1, comments: 1, shares: 1, collects: 1 } }),
      },
      persist,
    });
    expect(persist).toHaveBeenCalledTimes(2); // once per successful lane (oembed, tikwm)
  });
});

describe("enrichItem — depth defers to the control plane", () => {
  it("depth: oEmbed fills caption/poster, own_session defers → partial, worklist runner was invoked", async () => {
    const ownSession = fail("own_session_deferred");
    const out = await enrichItem(skeleton(), {
      setting: "depth",
      lanes: { oembed: ok({ desc: "cap", cover: "https://cdn/c.jpg" }), own_session: ownSession },
    });
    expect(ownSession).toHaveBeenCalledTimes(1);
    expect(out.status).toBe("partial");
    expect(out.item.desc).toBe("cap");
  });
});
