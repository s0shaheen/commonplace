// Options page controller. Reads/writes the typed cp_config over the REAL chrome.storage.local
// (which satisfies StorageLike). Keys entered here live only in local storage (SPEC §25).

import { loadConfig, saveConfig, type CpConfig, type StorageLike } from "./lib/config.js";

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
    // escalateNative is intentionally NOT written from the UI — locked off (SPEC §13).
  };
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
}

main().catch((err) => console.error("[commonplace] options init failed", err));
