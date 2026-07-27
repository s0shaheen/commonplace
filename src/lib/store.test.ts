import "fake-indexeddb/auto";
import { describe, it, expect } from "vitest";
import { openDB } from "idb";
import { openStore, recoverStore, StorageUnrecoverableError, type StoreOpener } from "./store.js";
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

  it("round-trips the optional platform + collections tags (XPLAT-01) through upsert", async () => {
    const s = await openStore("t-xplat");
    await s.upsertItems(
      [mkItem("CxAMPLE001", { platform: "instagram", collections: ["Recipes"], sources: ["saved"] })],
      "2026-07-08T00:00:00Z",
    );
    const ig = (await s.getRecord("CxAMPLE001"))!;
    expect(ig.item.platform).toBe("instagram");
    expect(ig.item.collections).toEqual(["Recipes"]);

    // A pre-XPLAT TikTok item carries no platform field — it stays absent (defaults to tiktok on export).
    await s.upsertItems([mkItem("7111111111111111111", { sources: ["favorites"] })], "2026-07-08T00:00:00Z");
    const tt = (await s.getRecord("7111111111111111111"))!;
    expect(tt.item.platform).toBeUndefined();

    // A TikTok numeric id and an IG shortcode are naturally disjoint — both coexist, no key collision.
    expect(await s.count()).toBe(2);
  });

  it("allRecords returns every stored record", async () => {
    const s = await openStore("t5");
    await s.upsertItems([mkItem("a"), mkItem("b")], "2026-07-08T00:00:00Z");
    const all = await s.allRecords();
    expect(all.map((r) => r.id).sort()).toEqual(["a", "b"]);
  });
});

// STORE-01 / S-DB-2 — treat the on-disk DB as adversarial: openStore must self-heal a store-less /
// partial DB (the class that actually bricked the dev DB) or halt loudly, never silently proceed.
describe("openStore self-healing", () => {
  const has = (db: Awaited<ReturnType<typeof openDB>>, n: string) => db.objectStoreNames.contains(n);

  it("self-heals a store-less v1 DB → all four stores end present and usable", async () => {
    // Plant the exact failure mode: a v1 `commonplace` DB that exists WITHOUT its stores (a bare
    // open at version 1 with no upgrade callback creates none). The version-gated upgrade can never
    // fix this on its own — openStore must detect the gap and reopen at version+1 to create them.
    const planted = await openDB("heal-storeless", 1, {});
    expect(has(planted, "items")).toBe(false); // genuinely store-less
    planted.close();

    const s = await openStore("heal-storeless");
    // Every store works → all four were created during the self-heal reopen.
    await s.upsertItems([mkItem("a")], "2026-07-08T00:00:00Z");
    expect(await s.count()).toBe(1);
    await s.putJobs([{ id: "j", itemId: "a", status: "pending", attempts: 0, nextAttemptAt: 0 }]);
    expect((await s.getJobs()).length).toBe(1);
    await s.setMeta("k", { v: 1 });
    expect(await s.getMeta("k")).toEqual({ v: 1 });
    await s.putPoster("a", new Blob(["x"], { type: "image/jpeg" }));
    expect((await s.getPoster("a"))!.type).toBe("image/jpeg");

    const raw = await openDB("heal-storeless");
    expect(["items", "posters", "jobs", "meta"].every((n) => has(raw, n))).toBe(true);
    raw.close();
  });

  it("a healthy existing DB opens WITHOUT a version bump", async () => {
    await openStore("heal-healthy"); // fresh → creates all four at v1
    const r1 = await openDB("heal-healthy");
    const v1 = r1.version;
    r1.close();

    await openStore("heal-healthy"); // healthy → assessStores→ok, no reopen_upgrade
    const r2 = await openDB("heal-healthy");
    const v2 = r2.version;
    r2.close();

    expect(v1).toBe(1);
    expect(v2).toBe(1); // no phantom version bump on an already-healthy DB
  });

  it("a guarded version+ upgrade from a POPULATED store preserves existing rows (no data loss)", async () => {
    // v1 WITH all four stores + a populated item.
    const v1db = await openDB("heal-populated", 1, {
      upgrade(db) {
        db.createObjectStore("items", { keyPath: "id" });
        db.createObjectStore("posters", { keyPath: "id" });
        db.createObjectStore("jobs", { keyPath: "id" });
        db.createObjectStore("meta", { keyPath: "key" });
      },
    });
    await v1db.put("items", {
      id: "keep-me",
      item: mkItem("keep-me", { desc: "precious" }),
      status: "raw",
      updatedAt: "2026-07-08T00:00:00Z",
    });
    v1db.close();

    // Simulate partial corruption: drop ONE store at v2 while items stays populated.
    const v2db = await openDB("heal-populated", 2, {
      upgrade(db) {
        db.deleteObjectStore("jobs");
      },
    });
    expect(has(v2db, "jobs")).toBe(false);
    v2db.close();

    // openStore must reopen at v3 with the contains()-guarded upgrade: recreate ONLY `jobs`, leaving
    // the populated `items` store — and its rows — untouched.
    const s = await openStore("heal-populated");
    const kept = await s.getRecord("keep-me");
    expect(kept).toBeDefined();
    expect(kept!.item.desc).toBe("precious"); // row survived the reopen
    expect(await s.count()).toBe(1);
    // the recreated store is usable again
    await s.putJobs([{ id: "j1", itemId: "keep-me", status: "pending", attempts: 0, nextAttemptAt: 0 }]);
    expect((await s.getJobs()).length).toBe(1);
  });

  it("throws StorageUnrecoverableError when neither upgrade nor rebuild restores the stores", async () => {
    // A real fake-indexeddb never reaches the terminal rung (its guarded upgrade always succeeds), so
    // drive recoverStore with an injected opener that ALWAYS returns a store-less handle: rung 1
    // (reopen_upgrade) and rung 2 (rebuild) both fail to produce stores → the loop must give up and
    // throw the typed error the caller uses to HALT capture (never present a swallowed write as done).
    const storelessDb = (version: number) =>
      ({
        objectStoreNames: { contains: () => false },
        version,
        close() {},
      }) as unknown as Awaited<ReturnType<StoreOpener["open"]>>;

    let opens = 0;
    let deletes = 0;
    const opener: StoreOpener = {
      open: async (version?: number) => {
        opens++;
        return storelessDb(version ?? 1);
      },
      deleteDatabase: async () => {
        deletes++;
      },
    };

    await expect(recoverStore(opener)).rejects.toBeInstanceOf(StorageUnrecoverableError);
    expect(deletes).toBe(1); // the rebuild rung was attempted exactly once before giving up
    expect(opens).toBe(3); //   first open + version+1 reopen + post-rebuild reopen
  });
});
