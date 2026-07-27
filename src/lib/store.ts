// The canonical library store: IndexedDB (`commonplace` v1) is the source of truth for
// captured items, their eagerly-fetched posters, the analysis/grounding job queue, and a
// small key/value `meta` store (the grounding cache lives here). This RETIRES the legacy
// `chrome.storage.local` `items` array — background.ts writes through here and keeps only the
// scalar `count` in chrome.storage for the content script's scroll-idle contract.
//
// Why eager posters: TikTok cover URLs are signed and expire in hours, so we capture the poster
// BYTES at save-time (background.ts fetches `item.cover` → Blob → putPoster). This module just
// stores/serves them; the fetch + concurrency bound live in background.ts.

import { openDB, deleteDB, type DBSchema, type IDBPDatabase } from "idb";
import type { CapturedItem, Analysis, NamedEntityType } from "./types.js";
import type { GroundedEntity } from "./grounding.js";
import { assessStores, REQUIRED_STORES, type StoreName } from "./capture/storageHealth.js";

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
// Baseline schema version. NOTE: the self-heal opener no longer PINS the first open to this — it opens
// at the DB's existing version (or creates fresh at 1) and inspects the actual stores, then reopens at
// `existingVersion + 1` to add any missing store. Pinning a fixed version would throw the moment a
// prior self-heal had already bumped the on-disk version above it, so this stays a documentation
// baseline, not an open() argument.
export const DB_VERSION = 1;

// keyPath per store: items/posters/jobs are keyed by `id`, the meta k/v store by `key`. Used by the
// contains()-guarded idempotent upgrade so a re-create uses the SAME keyPath the original did.
const STORE_KEYPATHS: Record<StoreName, string> = {
  items: "id",
  posters: "id",
  jobs: "id",
  meta: "key",
};

/**
 * Thrown when the `commonplace` DB is missing required object stores and neither a guarded version+1
 * upgrade NOR a full deleteDB rebuild could restore them (assessStores → `unrecoverable`). The caller
 * MUST let this propagate: capture halts and the reason surfaces to the popup — a swallowed write must
 * never present as done (invariant 4). Distinct + typed so glue can branch on it (`instanceof`).
 */
export class StorageUnrecoverableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StorageUnrecoverableError";
  }
}

/**
 * The physical DB opener the self-heal loop drives. Injectable so `recoverStore`'s ladder — including
 * the terminal `StorageUnrecoverableError` throw, which a real fake-indexeddb will never reach because
 * its guarded upgrade always succeeds — is unit-testable without a real IndexedDB.
 */
export interface StoreOpener {
  /** Open at an explicit `version` (a self-heal reopen) or at the existing/fresh version (no arg). */
  open(version?: number): Promise<IDBPDatabase<CommonplaceDB>>;
  /** Delete the whole DB (the `rebuild` rung — last resort, loses data). */
  deleteDatabase(): Promise<void>;
}

export interface CpStore {
  /** Merge-dedupe incoming captures by id: union `sources`, keep the freshest fields. */
  upsertItems(items: CapturedItem[], nowIso: string): Promise<{ added: number; merged: number }>;
  getRecord(id: string): Promise<LibraryRecord | undefined>;
  allRecords(): Promise<LibraryRecord[]>;
  saveEnrichment(id: string, item: CapturedItem, nowIso: string): Promise<void>; // fills content fields; status stays "raw"
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

// The real idb opener: a single guarded upgrade + full versionchange handler set, reused across every
// (re)open in the recovery loop. `current` is the live handle — the `blocking` handler closes it so a
// newer version in another context isn't deadlocked (S-DB-2), and `deleteDatabase` closes it first.
function makeIdbOpener(dbName: string): StoreOpener {
  let current: IDBPDatabase<CommonplaceDB> | null = null;
  const upgrade = (database: IDBPDatabase<CommonplaceDB>, oldVersion: number): void => {
    // IDEMPOTENT, contains()-guarded, oldVersion-aware (S-DB-2): create ONLY the stores that are
    // missing. Safe to run at ANY version transition — a fresh 0→1 open creates all four; a self-heal
    // v→v+1 reopen creates just the gap and never re-creates or clobbers a populated store. oldVersion
    // is threaded for future per-version data migrations; today the create is purely existence-driven.
    void oldVersion;
    for (const name of REQUIRED_STORES) {
      if (!database.objectStoreNames.contains(name)) {
        database.createObjectStore(name, { keyPath: STORE_KEYPATHS[name] });
      }
    }
  };
  return {
    async open(version?: number) {
      current = await openDB<CommonplaceDB>(dbName, version, {
        upgrade,
        blocked(currentVersion, blockedVersion) {
          console.warn(
            `[commonplace] store open BLOCKED (on-disk v${currentVersion}, want v${blockedVersion ?? "?"}) — another context holds an older connection`,
          );
        },
        blocking() {
          // A newer version wants to open; let it proceed by dropping our handle (idb docs pattern).
          console.warn("[commonplace] store connection is BLOCKING a newer version — closing this handle");
          current?.close();
        },
        terminated() {
          console.warn("[commonplace] store connection was TERMINATED by the browser (abnormal close)");
        },
      });
      return current;
    },
    deleteDatabase() {
      current?.close();
      current = null;
      return deleteDB(dbName, {
        blocked() {
          console.warn("[commonplace] deleteDB BLOCKED — another connection is still open");
        },
      });
    },
  };
}

/**
 * Drive the storage self-heal ladder against an injected opener. Treats the on-disk DB as ADVERSARIAL
 * (STORE-01): after each open it ASSERTS all four stores exist and, per `assessStores`, climbs the
 * rungs — guarded version+1 upgrade → deleteDB rebuild → throw. Exported for unit testing the ladder
 * (a real fake-indexeddb never reaches the throw because its guarded upgrade always creates the gap).
 */
export async function recoverStore(opener: StoreOpener): Promise<IDBPDatabase<CommonplaceDB>> {
  let attempt = 0;
  let db = await opener.open(); // first open: existing on-disk version, or a fresh DB created at v1
  for (;;) {
    // ASSERT via contains() rather than enumerating — works on any DOMStringList-like handle.
    const present = REQUIRED_STORES.filter((name) => db.objectStoreNames.contains(name));
    const action = assessStores(present, attempt);

    if (action.kind === "ok") return db;

    if (action.kind === "unrecoverable") {
      db.close();
      throw new StorageUnrecoverableError(
        `commonplace DB still missing object stores after ${attempt} recovery attempt(s) — halting capture to avoid silent data loss`,
      );
    }

    if (action.kind === "reopen_upgrade") {
      // Rung 1: reopen one version up so the guarded upgrade fires and creates just the missing stores.
      const nextVersion = db.version + 1;
      console.warn(
        `[commonplace] store missing [${action.missing.join(", ")}] — reopening at v${nextVersion} to self-heal (guarded upgrade)`,
      );
      db.close();
      attempt++;
      db = await opener.open(nextVersion);
      continue;
    }

    // Rung 2 (action.kind === "rebuild"): the version+1 upgrade did NOT restore the stores. Last
    // resort — delete + recreate. This LOSES existing data, so it is logged loudly and only ever
    // reached after the non-destructive upgrade rung already failed.
    console.error(
      "[commonplace] STORAGE REBUILD — commonplace DB unrecoverable via upgrade; deleting + recreating (EXISTING DATA LOST). This should never happen in normal operation.",
    );
    db.close();
    await opener.deleteDatabase();
    attempt++;
    db = await opener.open(); // fresh DB → the guarded upgrade creates all four stores
  }
}

/**
 * Open the canonical library store, SELF-HEALING a store-less / partial / corrupt on-disk DB (the
 * §6.2 STORE-01 fix). The old opener created stores only inside idb's version-gated `upgrade`, so a v1
 * DB that existed WITHOUT its stores (a bare `indexedDB.open` with no version — this actually happened
 * to the dev DB) was unrecoverable and bricked capture+analysis+resume+export while STILL showing
 * arrivals → silent total data loss. This drives `recoverStore`'s ladder instead: assert → guarded
 * upgrade → rebuild → throw `StorageUnrecoverableError` (which the caller must NOT swallow).
 */
export async function openStore(dbName: string = DB_NAME): Promise<CpStore> {
  const db = await recoverStore(makeIdbOpener(dbName));
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

    async saveEnrichment(id, item, nowIso) {
      // Single-transaction RMW (see saveAnalysis): write the enriched item onto the record, leaving the
      // analysis lifecycle (status "raw" until analyze), poster pointer, and groundings untouched. The
      // enrich glue computes the monotonic merge (enrich/merge.ts); this only persists the checkpoint.
      // Missing record → no-op (never creates one — enrichment only fills captured items).
      const tx = db.transaction("items", "readwrite");
      const store = tx.objectStore("items");
      const rec = await store.get(id);
      if (rec) {
        rec.item = item;
        rec.updatedAt = nowIso;
        await store.put(rec);
      }
      await tx.done;
    },

    async saveAnalysis(id, analysis) {
      // Read-modify-write in ONE transaction so a concurrent writer to the same record
      // between the get and the put cannot silently drop this analysis (lost update).
      const tx = db.transaction("items", "readwrite");
      const store = tx.objectStore("items");
      const rec = await store.get(id);
      if (rec) {
        rec.analysis = analysis;
        rec.status = "analyzed";
        rec.updatedAt = analysis.analyzedAt;
        await store.put(rec);
      }
      await tx.done;
    },

    async saveGroundings(id, g, pending) {
      // Single-transaction RMW: see saveAnalysis. Missing record → no-op (don't create one).
      const tx = db.transaction("items", "readwrite");
      const store = tx.objectStore("items");
      const rec = await store.get(id);
      if (rec) {
        rec.groundings = g;
        rec.regroundPending = pending;
        rec.status = "grounded";
        await store.put(rec);
      }
      await tx.done;
    },

    async putPoster(id, blob) {
      const ref = `poster:${id}`;
      // Span BOTH stores in one transaction so the poster blob and the record's posterRef
      // stamp commit atomically, and the item RMW can't lose a concurrent write to the record.
      const tx = db.transaction(["posters", "items"], "readwrite");
      await tx.objectStore("posters").put({ id, blob });
      const items = tx.objectStore("items");
      const rec = await items.get(id);
      if (rec) {
        rec.posterRef = ref;
        await items.put(rec);
      }
      await tx.done;
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
