// Options page controller. Reads/writes the typed cp_config over the REAL chrome.storage.local
// (which satisfies StorageLike). Keys entered here live only in local storage (SPEC §25).

import { loadConfig, saveConfig, type CpConfig, type StorageLike } from "./lib/config.js";
import { parseTikTokDydResult } from "./lib/capture/dydImport.js";

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
  $<HTMLInputElement>("geminiKey").value = cfg.geminiKey ?? "";
  $<HTMLInputElement>("escalateNative").checked = cfg.escalateNative; // disabled in the UI
  $<HTMLInputElement>("placesEnabled").checked = cfg.placesEnabled;
  $<HTMLInputElement>("placesKey").value = cfg.placesKey ?? "";
  $<HTMLInputElement>("concurrency").value = String(cfg.concurrency);
  $<HTMLInputElement>("autonomousCapture").checked = cfg.autonomousCapture;
}

function readForm(): Partial<CpConfig> {
  const engineLane = (document.querySelector<HTMLInputElement>('input[name="engineLane"]:checked')?.value ??
    "managed") as CpConfig["engineLane"];
  const ingestion = (document.querySelector<HTMLInputElement>('input[name="ingestion"]:checked')?.value ??
    "keyframes_vtt") as CpConfig["ingestion"];
  const geminiKey = $<HTMLInputElement>("geminiKey").value.trim();
  const placesKey = $<HTMLInputElement>("placesKey").value.trim();
  return {
    engineLane,
    ingestion,
    geminiKey: geminiKey || null,
    placesEnabled: $<HTMLInputElement>("placesEnabled").checked,
    placesKey: placesKey || null,
    concurrency: Math.max(1, Number($<HTMLInputElement>("concurrency").value) || 1),
    autonomousCapture: $<HTMLInputElement>("autonomousCapture").checked, // opt-in self-driving (Task 5)
    // escalateNative is intentionally NOT written from the UI — locked off (SPEC §13).
  };
}

// ── DYD import lane ───────────────────────────────────────────────────────────────────────────────
// Read the user's extracted user_data.json, parse it OFF the SW thread via the pure parseTikTokDyd,
// and hand the normalized CapturedItems to the SW to upsert. The pure parser is unit-tested; this is
// thin glue (file read → parse → send → show result), the same split the live lane uses.

interface DydImportResponse {
  ok: boolean;
  added?: number;
  merged?: number;
  total?: number;
  error?: string;
}

function setDydResult(text: string, kind: "ok" | "err"): void {
  const el = $("dydResult");
  el.textContent = text;
  el.className = kind;
}

async function handleDydFile(file: File): Promise<void> {
  setDydResult("Reading…", "ok");
  let json: unknown;
  try {
    json = JSON.parse(await file.text());
  } catch {
    setDydResult("Couldn't read that file — pick the extracted user_data.json (JSON format), not the .zip.", "err");
    return;
  }
  const { items, favoritesSeen, likesSeen, skipped } = parseTikTokDydResult(json);
  if (items.length === 0) {
    setDydResult(
      `No liked or favorited videos found in that file (favorites seen: ${favoritesSeen}, likes seen: ${likesSeen}). ` +
        "Make sure you exported JSON with the Activity data selected.",
      "err",
    );
    return;
  }
  setDydResult(`Importing ${items.length}…`, "ok");
  try {
    const res = (await chrome.runtime.sendMessage({ kind: "import_dyd", items })) as DydImportResponse | undefined;
    if (!res || !res.ok) {
      setDydResult(`Import failed${res?.error ? `: ${res.error}` : ""}.`, "err");
      return;
    }
    const skip = skipped ? `, skipped ${skipped} URL-less` : "";
    setDydResult(
      `Imported ${items.length} (added ${res.added}, merged ${res.merged}${skip}) — library total ${res.total}.`,
      "ok",
    );
  } catch (err) {
    setDydResult(`Import failed: ${(err as Error).message}`, "err");
  }
}

async function main() {
  populate(await loadConfig(storage));
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
    if (file) void handleDydFile(file);
  });
}

main().catch((err) => console.error("[commonplace] options init failed", err));
