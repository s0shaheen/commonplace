// Typed configuration over chrome.storage.local's `cp_config` key.
//
// This is the ONLY home for model IDs and lane/ingestion defaults (Phase-3 Global
// Constraints). Keys (Gemini, Places) live here at runtime only — never in source, never
// in a web_accessible_resource (SPEC §25 key-exposure posture). The options page reads and
// writes this via the real chrome.storage.local; tests use an in-memory StorageLike fake.

/** The four capture lanes, in the supervisor's frozen sweep order. Mirrors capture/supervisor's
 *  `Source` but is declared here independently so config carries no dependency on capture internals. */
export type CaptureSource = "favorites" | "likes" | "posts" | "reposts";

/** Which capture lanes a sweep is allowed to drive (options → SW reads this to skip unchecked lanes). */
export type CaptureSources = Record<CaptureSource, boolean>;

/** Scroll cadence preset the capture engine paces to. Normal is the tested default. */
export type CaptureSpeed = "conservative" | "normal" | "fast";

/** Enrichment tier (see src/lib/enrich). A ladder of the maximum lane a run may reach:
 *  off — no enrichment; free — official oEmbed only (the default, zero cost, no third party);
 *  depth — oEmbed + the user's own logged-in session (adds transcript via the control plane);
 *  paid — oEmbed + tikwm PRIMARY, Apify BACKUP on tikwm error/quota (third-party, opt-in). */
export type EnrichTier = "off" | "free" | "depth" | "paid";

export interface CpConfig {
  geminiKey: string | null;
  engineLane: "managed" | "local"; // default "managed"
  localModel: string; // default "qwen3-vl:8b"
  localEndpoint: string; // default "http://localhost:11434"
  managedModel: string; // default "gemini-3.6-flash" (recommended; user-selectable in options)
  ingestion: "keyframes_vtt" | "native"; // default "keyframes_vtt" — PROVISIONAL (Phase-4 ablation decides)
  escalateNative: boolean; // default false — cascade retracted (SPEC §13)
  placesEnabled: boolean; // default false — key not provisioned
  placesKey: string | null; // default null
  concurrency: number; // default 2
  // Capture self-driving mode (Task 5). false (default) = SEMI-AUTO: Sync drives the founder's
  // foreground TikTok tab, a human is present. true = AUTONOMOUS: the supervisor opens/focuses a
  // TikTok tab via chrome.tabs and drives it with no presence — opt-in behind the options toggle's
  // account-risk note (it puts the largest automated-scroll footprint on the real account).
  autonomousCapture: boolean; // default false
  // Which lanes a sweep drives. Default: all four. Unchecking a lane tells the supervisor to skip it.
  captureSources: CaptureSources;
  // Scroll cadence preset. Default "normal" (the tested pacing); "conservative"/"fast" scale it.
  captureSpeed: CaptureSpeed;
  // Background-tab resilience (Wave C). When a driven tab is HIDDEN and stops paginating (Chrome pauses
  // hidden-tab rendering/IntersectionObserver), false (default) = pause + notify "bring the tab forward"
  // and auto-resume when it's shown; true = the SW foregrounds the tab to keep capturing (more intrusive
  // — it steals focus — so opt-in). The SW-driven trusted-wheel WRITE survives backgrounding; TikTok's
  // own lazy-load may not, which is what this guards. NOTE: when captureBackground is ON (the default),
  // focus emulation keeps the hidden tab running, so this keepForeground path is effectively bypassed —
  // it only matters if the founder turns captureBackground OFF.
  captureKeepForeground: boolean;
  // Background CAPTURE via focus emulation (2026-07-13, research-confirmed). true (DEFAULT) = the SW, which
  // already holds chrome.debugger attached for the trusted-wheel scroll, sends Emulation.setFocusEmulationEnabled
  // (+ Page.setWebLifecycleState "active") so Chrome treats the driven tab as focused/visible even when it is
  // backgrounded or minimized — document.visibilityState stays "visible", visibilitychange never fires, and
  // TikTok never throttles its rendering/IntersectionObserver, so pagination keeps running unattended. This is
  // exactly what Playwright applies to every page by default (a standard technique, not a hack). false = skip
  // the emulation and fall back to the old pause-on-hidden safety net. The tab must still EXIST (backgrounded/
  // minimized is fine; a CLOSED tab is the separate DYD import lane).
  captureBackground: boolean;
  // Enrichment tier (2026-07-26 provider lock). Default "free" = official TikTok oEmbed only — makes
  // imported skeletons searchable at zero cost with no third party. "depth" additionally opens the
  // user's own session for transcripts (paced through the capture control plane); "paid" additionally
  // uses tikwm PRIMARY → Apify BACKUP. Paid lanes are OPT-IN and send only the public saved URL to the
  // third party (invariant). "off" disables enrichment entirely.
  enrichTier: EnrichTier;
  // OPTIONAL Apify API token for the paid BACKUP lane (used only on tikwm error/quota failover). Lives
  // here at runtime only — never in source, never in a web_accessible_resource (SPEC §25). null = the
  // Apify failover lane is unavailable (the policy never reaches it).
  apifyToken: string | null;
}

/** Frozen default: every lane on. */
export const DEFAULT_CAPTURE_SOURCES: CaptureSources = {
  favorites: true,
  likes: true,
  posts: true,
  reposts: true,
};

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
  managedModel: "gemini-3.6-flash",
  ingestion: "keyframes_vtt",
  escalateNative: false,
  placesEnabled: false,
  placesKey: null,
  concurrency: 2,
  autonomousCapture: false,
  captureSources: DEFAULT_CAPTURE_SOURCES,
  captureSpeed: "normal",
  captureKeepForeground: false,
  captureBackground: true,
  enrichTier: "free",
  apifyToken: null,
};

/** Read the stored partial and merge it over the frozen defaults. `captureSources` is deep-merged so
 *  a stored blob predating a lane (or written partially) still backfills every lane from the default. */
export async function loadConfig(storage: StorageLike): Promise<CpConfig> {
  const got = await storage.get(CONFIG_KEY);
  const stored = (got[CONFIG_KEY] ?? {}) as Partial<CpConfig>;
  const merged = { ...DEFAULT_CONFIG, ...stored };
  merged.captureSources = { ...DEFAULT_CAPTURE_SOURCES, ...(stored.captureSources ?? {}) };
  return merged;
}

/** Merge a patch over the current effective config and persist the full blob. */
export async function saveConfig(storage: StorageLike, patch: Partial<CpConfig>): Promise<CpConfig> {
  const next: CpConfig = { ...(await loadConfig(storage)), ...patch };
  await storage.set({ [CONFIG_KEY]: next });
  return next;
}
