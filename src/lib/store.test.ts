import "fake-indexeddb/auto";
import { describe, it, expect } from "vitest";
import { openStore } from "./store.js";
import type { CapturedItem, Analysis } from "./types.js";
import type { GroundedEntity } from "./grounding.js";

// A minimal CapturedItem; `over` patches any field (incl. `sources`).
function mkItem(id: string, over: Partial<CapturedItem> = {}): CapturedItem {
  return {
    id,
    sources: [],
    desc: "",
    createTime: null,
    author: null,
    authorName: null,
    url: null,
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
    ...over,
  };
}

function mkAnalysis(over: Partial<Analysis> = {}): Analysis {
  return {
    output: { mentions: [], concepts: [], facets: [], claims: [], structured: [] },
    lane: "managed",
    ingestion: "keyframes_vtt",
    model: "gemini-2.5-flash-lite",
    promptVersion: "extract@v1",
    analyzedAt: "2026-07-08T00:00:00Z",
    ...over,
  };
}

describe("CpStore", () => {
  it("upsertItems dedupes by id and unions sources", async () => {
    const s = await openStore("t1");
    await s.upsertItems([mkItem("a", { sources: ["favorites"] })], "2026-07-08T00:00:00Z");
    const r = await s.upsertItems(
      [mkItem("a", { sources: ["likes"] }), mkItem("b", { sources: ["likes"] })],
      "2026-07-08T00:01:00Z",
    );
    expect(r).toEqual({ added: 1, merged: 1 });
    expect((await s.getRecord("a"))!.item.sources.sort()).toEqual(["favorites", "likes"]);
    expect(await s.count()).toBe(2);
  });

  it("upsertItems keeps the freshest fields on merge and bumps updatedAt", async () => {
    const s = await openStore("t1-fresh");
    await s.upsertItems([mkItem("a", { desc: "old", playUrl: "u1" })], "2026-07-08T00:00:00Z");
    await s.upsertItems([mkItem("a", { desc: "new", playUrl: "u2", sources: ["likes"] })], "2026-07-08T00:05:00Z");
    const rec = (await s.getRecord("a"))!;
    expect(rec.item.desc).toBe("new");
    expect(rec.item.playUrl).toBe("u2");
    expect(rec.updatedAt).toBe("2026-07-08T00:05:00Z");
  });

  it("saveAnalysis advances status raw→analyzed; saveGroundings →grounded with pending types", async () => {
    const s = await openStore("t2");
    await s.upsertItems([mkItem("a")], "2026-07-08T00:00:00Z");
    expect((await s.getRecord("a"))!.status).toBe("raw");

    await s.saveAnalysis("a", mkAnalysis());
    const analyzed = (await s.getRecord("a"))!;
    expect(analyzed.status).toBe("analyzed");
    expect(analyzed.analysis).toBeDefined();

    await s.saveGroundings("a", [] as GroundedEntity[], ["place"]);
    const grounded = (await s.getRecord("a"))!;
    expect(grounded.status).toBe("grounded");
    expect(grounded.regroundPending).toEqual(["place"]);
  });

  it("putPoster stores the blob and stamps posterRef", async () => {
    const s = await openStore("t3");
    await s.upsertItems([mkItem("a")], "2026-07-08T00:00:00Z");
    const ref = await s.putPoster("a", new Blob(["x"], { type: "image/jpeg" }));
    expect(ref).toBe("poster:a");
    expect((await s.getPoster("a"))!.type).toBe("image/jpeg");
    expect((await s.getRecord("a"))!.posterRef).toBe("poster:a");
  });

  it("getPoster is undefined when no poster was stored", async () => {
    const s = await openStore("t3-empty");
    await s.upsertItems([mkItem("a")], "2026-07-08T00:00:00Z");
    expect(await s.getPoster("a")).toBeUndefined();
  });

  it("concurrent saveAnalysis + saveGroundings on the same id: neither write is lost", async () => {
    // Regression for the Critical lost-update race. saveAnalysis and saveGroundings each do a
    // read-modify-write on the SAME `items` record. Under the old code each read-then-wrote in
    // SEPARATE auto-committing transactions: interleaving two writers, the second put clobbers
    // the record the first writer never saw, silently dropping a field. Here both writers `get`
    // the record first, so the old separate-tx code demonstrably drops `analysis` (verified: the
    // groundings put overwrites the analysis put). With each RMW in ONE transaction both survive.
    // fake-indexeddb runs real IDB transaction semantics, so this genuinely exercises the race.
    const s = await openStore("t-race-ag");
    await s.upsertItems([mkItem("a")], "2026-07-08T00:00:00Z");

    await Promise.all([s.saveAnalysis("a", mkAnalysis()), s.saveGroundings("a", [] as GroundedEntity[], ["place"])]);

    const rec = (await s.getRecord("a"))!;
    expect(rec.analysis).toBeDefined(); // dropped by the old separate-tx code
    expect(rec.regroundPending).toEqual(["place"]);
  });

  it("concurrent saveAnalysis + putPoster on the same id: both survive (no lost update)", async () => {
    // putPoster's RMW spans two stores (posters + items) — under the fix that whole read-stamp-put
    // is one transaction, so a concurrent writer to the same record can't drop the posterRef stamp
    // (nor can putPoster drop the analysis). Assert the invariant the fix guarantees; separate-tx
    // code could drop one of these two fields depending on scheduling.
    const s = await openStore("t-race-ap");
    await s.upsertItems([mkItem("a")], "2026-07-08T00:00:00Z");

    await Promise.all([s.saveAnalysis("a", mkAnalysis()), s.putPoster("a", new Blob(["x"], { type: "image/jpeg" }))]);

    const rec = (await s.getRecord("a"))!;
    expect(rec.analysis).toBeDefined();
    expect(rec.posterRef).toBe("poster:a");
    expect((await s.getPoster("a"))!.type).toBe("image/jpeg");
  });

  it("jobs and meta round-trip", async () => {
    const s = await openStore("t4");
    await s.putJobs([
      { id: "j1", itemId: "a", status: "pending", attempts: 0, nextAttemptAt: 0 },
      { id: "j2", itemId: "b", status: "analyzing", attempts: 1, nextAttemptAt: 123 },
    ]);
    expect((await s.getJobs()).length).toBe(2);

    await s.putJob({ id: "j1", itemId: "a", status: "done", attempts: 2, nextAttemptAt: 0 });
    const jobs = await s.getJobs();
    expect(jobs.length).toBe(2);
    expect(jobs.find((j) => j.id === "j1")!.status).toBe("done");

    await s.setMeta<{ hits: number }>("grounding:place:paris", { hits: 3 });
    expect(await s.getMeta<{ hits: number }>("grounding:place:paris")).toEqual({ hits: 3 });
    expect(await s.getMeta("missing")).toBeUndefined();
  });

  it("allRecords returns every stored record", async () => {
    const s = await openStore("t5");
    await s.upsertItems([mkItem("a"), mkItem("b")], "2026-07-08T00:00:00Z");
    const all = await s.allRecords();
    expect(all.map((r) => r.id).sort()).toEqual(["a", "b"]);
  });
});
