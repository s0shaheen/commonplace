// Options page controller. Reads/writes the typed cp_config over the REAL chrome.storage.local
// (which satisfies StorageLike). Keys entered here live only in local storage (SPEC §25).

import { loadConfig, saveConfig, type CpConfig, type StorageLike } from "./lib/config.js";
import { unzipSync } from "fflate";
import { routeZipImport, routeBareJson, type RoutedImport } from "./lib/capture/importRouter.js";

// chrome.storage.local satisfies StorageLike (get(key) -> object, set(object) -> void).
const storage: StorageLike = {
  get: (k) => chrome.storage.local.get(k),
  set: (o) => chrome.storage.local.set(o),
};

const $ = <T extends HTMLElement = HTMLElement>(id: string): T => {
  const el = document.getElementById(id);
  if (!el) throw new Error(`options: missing #${id}`);
  return el as T;
};
const radio = (name: string, value: string) =>
  document.querySelector<HTMLInputElement>(`input[name="${name}"][value="${value}"]`);

function populate(cfg: CpConfig) {
  radio("engineLane", cfg.engineLane)!.checked = true;
  radio("ingestion", cfg.ingestion)!.checked = true;
  radio("captureSpeed", cfg.captureSpeed)!.checked = true;
  $<HTMLInputElement>("geminiKey").value = cfg.geminiKey ?? "";
  $<HTMLSelectElement>("managedModel").value = cfg.managedModel;
  $<HTMLInputElement>("escalateNative").checked = cfg.escalateNative; // disabled in the UI
  $<HTMLInputElement>("placesEnabled").checked = cfg.placesEnabled;
  $<HTMLInputElement>("placesKey").value = cfg.placesKey ?? "";
  $<HTMLInputElement>("concurrency").value = String(cfg.concurrency);
  $<HTMLInputElement>("autonomousCapture").checked = cfg.autonomousCapture;
  $<HTMLInputElement>("captureFavorites").checked = cfg.captureSources.favorites;
  $<HTMLInputElement>("captureLikes").checked = cfg.captureSources.likes;
  $<HTMLInputElement>("capturePosts").checked = cfg.captureSources.posts;
  $<HTMLInputElement>("captureReposts").checked = cfg.captureSources.reposts;
}

function readForm(): Partial<CpConfig> {
  const engineLane = (document.querySelector<HTMLInputElement>('input[name="engineLane"]:checked')?.value ??
    "managed") as CpConfig["engineLane"];
  const ingestion = (document.querySelector<HTMLInputElement>('input[name="ingestion"]:checked')?.value ??
    "keyframes_vtt") as CpConfig["ingestion"];
  const captureSpeed = (document.querySelector<HTMLInputElement>('input[name="captureSpeed"]:checked')?.value ??
    "normal") as CpConfig["captureSpeed"];
  // The model <select> only offers vetted values, but fall back to the pinned default defensively.
  const managedModel = $<HTMLSelectElement>("managedModel").value || "gemini-3.6-flash";
  const geminiKey = $<HTMLInputElement>("geminiKey").value.trim();
  const placesKey = $<HTMLInputElement>("placesKey").value.trim();
  return {
    engineLane,
    ingestion,
    captureSpeed,
    managedModel,
    geminiKey: geminiKey || null,
    placesEnabled: $<HTMLInputElement>("placesEnabled").checked,
    placesKey: placesKey || null,
    concurrency: Math.max(1, Number($<HTMLInputElement>("concurrency").value) || 1),
    autonomousCapture: $<HTMLInputElement>("autonomousCapture").checked, // opt-in self-driving (Task 5)
    captureSources: {
      favorites: $<HTMLInputElement>("captureFavorites").checked,
      likes: $<HTMLInputElement>("captureLikes").checked,
      posts: $<HTMLInputElement>("capturePosts").checked,
      reposts: $<HTMLInputElement>("captureReposts").checked,
    },
    // escalateNative is intentionally NOT written from the UI — locked off (SPEC §13).
  };
}

// ── Import lane (cross-platform, ZIP or extracted JSON) ─────────────────────────────────────────────
// Accept the platform's RAW data-export .zip (TikTok or Instagram) — or an already-extracted .json —
// decompress + route + parse entirely OFF the SW thread via the pure importRouter, then hand the
// normalized, platform-tagged CapturedItems to the SW to upsert + reconcile. fflate.unzipSync reads the
// zip CONTAINER (central directory + many entries) — DecompressionStream cannot (it's a single-stream
// codec). The pure router/parsers/reducer are all unit-tested; this is thin glue (read → route → send →
// show), the same split the live lane uses. Invariant: a local file read — no network, nothing uploaded.

interface ImportItemsResponse {
  ok: boolean;
  added?: number;
  merged?: number;
  alreadyPresent?: number;
  parsed?: number;
  declaredInZip?: number;
  total?: number;
  error?: string;
}

function setDydResult(text: string, kind: "ok" | "err"): void {
  const el = $("dydResult");
  el.textContent = text;
  el.className = kind;
}

/** A dropped file is a zip if its name ends `.zip` or its first bytes are the PK\x03\x04 signature. */
function looksLikeZip(name: string, bytes: Uint8Array): boolean {
  if (/\.zip$/i.test(name)) return true;
  return bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04;
}

/** Decompress + route a raw export .zip. Decodes only the entries the router chooses to read. */
function routeZipFile(bytes: Uint8Array): RoutedImport | null {
  const files = unzipSync(bytes); // { entryPath: Uint8Array } — off the SW thread
  const decoder = new TextDecoder();
  const readJson = (path: string): unknown => JSON.parse(decoder.decode(files[path]!));
  return routeZipImport(Object.keys(files), readJson);
}

async function handleImportFile(file: File): Promise<void> {
  setDydResult("Reading…", "ok");
  let route: RoutedImport | null;
  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    route = looksLikeZip(file.name, bytes)
      ? routeZipFile(bytes)
      : routeBareJson(JSON.parse(new TextDecoder().decode(bytes)));
  } catch {
    setDydResult("Couldn't read that file — drop the export .zip the platform gave you, or an extracted .json.", "err");
    return;
  }
  if (!route) {
    setDydResult(
      "That .zip didn't contain a recognized export (looked for TikTok user_data.json or Instagram saved_posts.json).",
      "err",
    );
    return;
  }
  const { platform, items, declared, skipped } = route;
  const label = platform === "instagram" ? "Instagram" : "TikTok";
  if (items.length === 0) {
    setDydResult(
      `No saved posts found in that ${label} export (${declared} entries seen). ` +
        "Make sure you exported JSON with your saved/activity data selected.",
      "err",
    );
    return;
  }
  setDydResult(`Importing ${items.length} from ${label}…`, "ok");
  try {
    const res = (await chrome.runtime.sendMessage({
      kind: "import_items",
      platform,
      items,
      declared,
    })) as ImportItemsResponse | undefined;
    if (!res || !res.ok) {
      setDydResult(`Import failed${res?.error ? `: ${res.error}` : ""}.`, "err");
      return;
    }
    // The reconciliation report: what the export recovered vs the library vs the export's declared index.
    const skip = skipped ? `, skipped ${skipped} unparseable` : "";
    setDydResult(
      `Imported ${res.parsed} from ${label} (added ${res.added} new, merged ${res.merged}${skip}) — ` +
        `your library already held ${res.alreadyPresent}; the export listed ${res.declaredInZip}. Library total ${res.total}.`,
      "ok",
    );
  } catch (err) {
    setDydResult(`Import failed: ${(err as Error).message}`, "err");
  }
}

// About/Status: extension version (from the manifest) + live library count (via sync_status). Both are
// best-effort — a sleeping SW leaves the count as a dash rather than blocking the page.
async function populateAbout(): Promise<void> {
  try {
    $("extVersion").textContent = `v${chrome.runtime.getManifest().version}`;
  } catch {
    $("extVersion").textContent = "—";
  }
  try {
    const st = (await chrome.runtime.sendMessage({ kind: "sync_status" })) as { count?: number } | undefined;
    const n = typeof st?.count === "number" ? st.count : null;
    $("libCount").textContent = n == null ? "—" : `${n.toLocaleString("en-US")} ${n === 1 ? "item" : "items"}`;
  } catch {
    $("libCount").textContent = "—";
  }
}

async function main() {
  populate(await loadConfig(storage));
  void populateAbout();

  const form = $<HTMLFormElement>("cfg");
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const saved = await saveConfig(storage, readForm());
    populate(saved);
    const status = $("status");
    status.textContent = "Saved ✓";
    setTimeout(() => (status.textContent = ""), 1800);
  });

  const dydInput = $<HTMLInputElement>("dydFile");
  dydInput.addEventListener("change", () => {
    const file = dydInput.files?.[0];
    if (file) void handleImportFile(file);
  });

  // Export the whole library via the existing offscreen open-schema export path (fire-and-forget; the
  // SW spins up the offscreen doc and downloads commonplace-export.json).
  $("exportBtn").addEventListener("click", () => {
    const el = $("exportResult");
    void chrome.runtime.sendMessage({ kind: "export_open_schema" }).catch(() => {});
    el.textContent = "Export started — check your downloads for commonplace-export.json";
    el.className = "ok";
    setTimeout(() => {
      el.textContent = "";
      el.className = "";
    }, 5000);
  });
}

main().catch((err) => console.error("[commonplace] options init failed", err));
