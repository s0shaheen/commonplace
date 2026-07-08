// Typed configuration over chrome.storage.local's `cp_config` key.
//
// This is the ONLY home for model IDs and lane/ingestion defaults (Phase-3 Global
// Constraints). Keys (Gemini, Places) live here at runtime only — never in source, never
// in a web_accessible_resource (SPEC §25 key-exposure posture). The options page reads and
// writes this via the real chrome.storage.local; tests use an in-memory StorageLike fake.

export interface CpConfig {
  geminiKey: string | null;
  engineLane: "managed" | "local"; // default "managed"
  localModel: string; // default "qwen3-vl:8b"
  localEndpoint: string; // default "http://localhost:11434"
  managedModel: string; // default "gemini-2.5-flash-lite" (pinned, SPEC §15)
  ingestion: "keyframes_vtt" | "native"; // default "keyframes_vtt" — PROVISIONAL (Phase-4 ablation decides)
  escalateNative: boolean; // default false — cascade retracted (SPEC §13)
  placesEnabled: boolean; // default false — key not provisioned
  placesKey: string | null; // default null
  concurrency: number; // default 2
}

/** chrome.storage.local satisfies this shape. */
export interface StorageLike {
  get(k: string): Promise<Record<string, unknown>>;
  set(o: Record<string, unknown>): Promise<void>;
}

/** The storage key that holds the whole config blob. */
export const CONFIG_KEY = "cp_config";

/** Frozen defaults (Phase-3 Global Constraints; the model IDs live only here). */
export const DEFAULT_CONFIG: CpConfig = {
  geminiKey: null,
  engineLane: "managed",
  localModel: "qwen3-vl:8b",
  localEndpoint: "http://localhost:11434",
  managedModel: "gemini-2.5-flash-lite",
  ingestion: "keyframes_vtt",
  escalateNative: false,
  placesEnabled: false,
  placesKey: null,
  concurrency: 2,
};

/** Read the stored partial and merge it over the frozen defaults. */
export async function loadConfig(storage: StorageLike): Promise<CpConfig> {
  const got = await storage.get(CONFIG_KEY);
  const stored = (got[CONFIG_KEY] ?? {}) as Partial<CpConfig>;
  return { ...DEFAULT_CONFIG, ...stored };
}

/** Merge a patch over the current effective config and persist the full blob. */
export async function saveConfig(storage: StorageLike, patch: Partial<CpConfig>): Promise<CpConfig> {
  const next: CpConfig = { ...(await loadConfig(storage)), ...patch };
  await storage.set({ [CONFIG_KEY]: next });
  return next;
}
