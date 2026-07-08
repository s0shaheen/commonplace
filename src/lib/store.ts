// The canonical library store: IndexedDB (`commonplace` v1) is the source of truth for
// captured items, their eagerly-fetched posters, the analysis/grounding job queue, and a
// small key/value `meta` store (the grounding cache lives here). This RETIRES the legacy
// `chrome.storage.local` `items` array — background.ts writes through here and keeps only the
// scalar `count` in chrome.storage for the content script's scroll-idle contract.
//
// Why eager posters: TikTok cover URLs are signed and expire in hours, so we capture the poster
// BYTES at save-time (background.ts fetches `item.cover` → Blob → putPoster). This module just
// stores/serves them; the fetch + concurrency bound live in background.ts.

import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { CapturedItem, Analysis, NamedEntityType } from "./types.js";
import type { GroundedEntity } from "./grounding.js";

/** One library row: the captured item plus its analysis lifecycle + poster pointer. */
export interface LibraryRecord {
  id: string;
  item: CapturedItem;
  status: "raw" | "analyzed" | "grounded";
  analysis?: Analysis;
  groundings?: GroundedEntity[];
  regroundPending?: NamedEntityType[];
  posterRef?: string;
  updatedAt: string;
}

/** One unit of engine work (analyze → ground) with retry bookkeeping. */
export interface JobRecord {
  id: string;
  itemId: string;
  status: "pending" | "analyzing" | "grounding" | "done" | "failed";
  attempts: number;
  nextAttemptAt: number;
  lastError?: string;
}

interface PosterRecord {
  id: string; // the item id — getPoster(id) reads this store directly
  blob: Blob;
}

interface MetaRecord {
  key: string;
  value: unknown;
}

interface CommonplaceDB extends DBSchema {
  items: { key: string; value: LibraryRecord };
  posters: { key: string; value: PosterRecord };
  jobs: { key: string; value: JobRecord };
  meta: { key: string; value: MetaRecord };
}

export const DB_NAME = "commonplace";
export const DB_VERSION = 1;

export interface CpStore {
  /** Merge-dedupe incoming captures by id: union `sources`, keep the freshest fields. */
  upsertItems(items: CapturedItem[], nowIso: string): Promise<{ added: number; merged: number }>;
  getRecord(id: string): Promise<LibraryRecord | undefined>;
  allRecords(): Promise<LibraryRecord[]>;
  saveAnalysis(id: string, analysis: Analysis): Promise<void>; // status → "analyzed"
  saveGroundings(id: string, g: GroundedEntity[], pending: NamedEntityType[]): Promise<void>; // status → "grounded"
  putPoster(id: string, blob: Blob): Promise<string>; // returns `poster:${id}`; also stamps record.posterRef
  getPoster(id: string): Promise<Blob | undefined>;
  putJobs(jobs: JobRecord[]): Promise<void>;
  getJobs(): Promise<JobRecord[]>;
  putJob(j: JobRecord): Promise<void>;
  getMeta<T>(key: string): Promise<T | undefined>;
  setMeta<T>(key: string, v: T): Promise<void>;
  count(): Promise<number>;
}

export async function openStore(dbName: string = DB_NAME): Promise<CpStore> {
  const db = await openDB<CommonplaceDB>(dbName, DB_VERSION, {
    upgrade(database) {
      database.createObjectStore("items", { keyPath: "id" });
      database.createObjectStore("posters", { keyPath: "id" });
      database.createObjectStore("jobs", { keyPath: "id" });
      database.createObjectStore("meta", { keyPath: "key" });
    },
  });
  return makeStore(db);
}

function makeStore(db: IDBPDatabase<CommonplaceDB>): CpStore {
  return {
    async upsertItems(incoming, nowIso) {
      let added = 0;
      let merged = 0;
      const tx = db.transaction("items", "readwrite");
      const store = tx.objectStore("items");
      for (const raw of incoming) {
        const item: CapturedItem = { ...raw, sources: [...(raw.sources ?? [])] };
        const prev = await store.get(item.id);
        if (prev) {
          merged++;
          // Same video seen under another tab: UNION sources, let the fresher capture win the
          // scalar fields, but preserve the record's analysis lifecycle + poster pointer.
          const sources = [...new Set([...(prev.item.sources ?? []), ...item.sources])];
          const nextItem: CapturedItem = { ...prev.item, ...item, sources };
          await store.put({ ...prev, item: nextItem, updatedAt: nowIso });
        } else {
          added++;
          await store.put({ id: item.id, item, status: "raw", updatedAt: nowIso });
        }
      }
      await tx.done;
      return { added, merged };
    },

    getRecord(id) {
      return db.get("items", id);
    },

    allRecords() {
      return db.getAll("items");
    },

    async saveAnalysis(id, analysis) {
      const rec = await db.get("items", id);
      if (!rec) return;
      rec.analysis = analysis;
      rec.status = "analyzed";
      rec.updatedAt = analysis.analyzedAt;
      await db.put("items", rec);
    },

    async saveGroundings(id, g, pending) {
      const rec = await db.get("items", id);
      if (!rec) return;
      rec.groundings = g;
      rec.regroundPending = pending;
      rec.status = "grounded";
      await db.put("items", rec);
    },

    async putPoster(id, blob) {
      const ref = `poster:${id}`;
      await db.put("posters", { id, blob });
      const rec = await db.get("items", id);
      if (rec) {
        rec.posterRef = ref;
        await db.put("items", rec);
      }
      return ref;
    },

    async getPoster(id) {
      const rec = await db.get("posters", id);
      return rec?.blob;
    },

    async putJobs(jobs) {
      const tx = db.transaction("jobs", "readwrite");
      for (const j of jobs) await tx.store.put(j);
      await tx.done;
    },

    getJobs() {
      return db.getAll("jobs");
    },

    async putJob(j) {
      await db.put("jobs", j);
    },

    async getMeta<T>(key: string): Promise<T | undefined> {
      const rec = await db.get("meta", key);
      return rec?.value as T | undefined;
    },

    async setMeta<T>(key: string, v: T): Promise<void> {
      await db.put("meta", { key, value: v });
    },

    count() {
      return db.count("items");
    },
  };
}
