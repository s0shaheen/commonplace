// Popup controller — the capture dashboard. It polls `sync_status` once a second while open and paints
// a compact live view: library total, capture state, the per-source progress rows, the action-needed
// banner (the founder's #1 ask: SEE that capture is waiting on him), and state-appropriate controls.
//
// All the DECISIONS — the state label, which buttons are live, the banner text, the rows — come from
// the PURE `computeViewModel` (popup-view.ts, unit-tested). This file is glue: poll → compute → paint,
// and wire the buttons to the documented capture messages. It touches capture ONLY via that contract.

import { computeViewModel, type PopupViewModel, type SyncStatusRaw } from "./popup-view.js";

const $ = <T extends HTMLElement = HTMLElement>(id: string): T => {
  const el = document.getElementById(id);
  if (!el) throw new Error(`popup: missing #${id}`);
  return el as T;
};

// ── Live state: last-known status + whether the latest poll succeeded ─────────────────────────────
let lastStatus: SyncStatusRaw | null = null;
let lastConnected = false;

// ── Rendering (glue only — no decisions here) ─────────────────────────────────────────────────────
function renderBanner(vm: PopupViewModel): void {
  const banner = $("banner");
  if (!vm.banner) {
    banner.hidden = true;
    return;
  }
  banner.hidden = false;
  banner.dataset.kind = vm.banner.kind;
  $("bannerGlyph").textContent = vm.banner.kind === "halt" ? "⛔" : "⚠";
  $("bannerTitle").textContent = vm.banner.title;
  $("bannerReason").textContent = vm.banner.reason;
  // The big Resume lives in the banner only for a user-actionable pause.
  $("bannerResumeWrap").hidden = vm.banner.kind !== "paused";
}

function renderRows(vm: PopupViewModel): void {
  const ul = $("sources");
  ul.innerHTML = "";
  if (vm.rows.length === 0) return;
  for (const row of vm.rows) {
    const li = document.createElement("li");
    li.dataset.state = row.state;

    const mark = document.createElement("span");
    mark.className = "s-mark";
    mark.setAttribute("aria-hidden", "true");
    mark.textContent = row.state === "done" ? "✓" : row.state === "current" ? "" : "·";

    const name = document.createElement("span");
    name.className = "s-name";
    name.textContent = row.label;

    const detail = document.createElement("span");
    detail.className = "s-detail";
    if (row.state === "current") {
      const sp = document.createElement("span");
      sp.className = "spinner";
      sp.setAttribute("aria-hidden", "true");
      detail.append(sp, document.createTextNode(row.count > 0 ? String(row.count) : "capturing…"));
    } else {
      detail.textContent = row.detail;
    }

    li.append(mark, name, detail);
    ul.appendChild(li);
  }
}

function applyControl(btn: HTMLButtonElement, c: { visible: boolean; enabled: boolean; label: string }): void {
  btn.hidden = !c.visible;
  btn.disabled = !c.enabled;
  if (c.label) btn.textContent = c.label;
}

function render(vm: PopupViewModel): void {
  renderBanner(vm);
  $("count").textContent = vm.countLabel;
  $("stateLabel").textContent = vm.stateLabel;
  $("stateDot").dataset.tone = vm.stateTone;

  const conn = $("conn");
  conn.dataset.conn = vm.connection;
  conn.textContent = vm.connection === "reconnecting" ? "reconnecting…" : vm.connection === "connecting" ? "connecting…" : "live";

  renderRows(vm);

  applyControl($<HTMLButtonElement>("btnStart"), vm.controls.start);
  applyControl($<HTMLButtonElement>("btnResume"), vm.controls.resume);
  applyControl($<HTMLButtonElement>("btnPause"), vm.controls.pause);
  applyControl($<HTMLButtonElement>("btnStop"), vm.controls.stop);
}

function repaint(): void {
  render(computeViewModel(lastStatus, { connected: lastConnected }));
}

// ── Messaging (the documented capture contract only) ──────────────────────────────────────────────
async function poll(): Promise<void> {
  try {
    const st = (await chrome.runtime.sendMessage({ kind: "sync_status" })) as SyncStatusRaw | undefined;
    if (st && typeof st === "object") {
      lastStatus = st;
      lastConnected = true;
    } else {
      lastConnected = false;
    }
  } catch {
    // SW asleep / momentarily unreachable — keep the last paint but flag "reconnecting".
    lastConnected = false;
  }
  repaint();
}

let toastTimer: ReturnType<typeof setTimeout> | undefined;
function toast(text: string): void {
  const el = $("toast");
  el.textContent = text;
  el.hidden = false;
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (el.hidden = true), 2600);
}

// Fire a fire-and-forget capture command, then poll shortly after so the UI flips without waiting a
// full tick. Optimistically mark connected so a command right after opening doesn't read as offline.
function command(kind: "sync_start" | "sync_stop" | "sync_pause" | "sync_resume"): void {
  void chrome.runtime.sendMessage({ kind }).catch(() => {});
  setTimeout(() => void poll(), 180);
}

function main(): void {
  $("btnStart").addEventListener("click", () => command("sync_start"));
  $("btnResume").addEventListener("click", () => command("sync_resume"));
  $("bannerResume").addEventListener("click", () => command("sync_resume"));
  $("btnPause").addEventListener("click", () => command("sync_pause"));
  $("btnStop").addEventListener("click", () => command("sync_stop"));

  $("btnSettings").addEventListener("click", () => chrome.runtime.openOptionsPage());
  $("btnExport").addEventListener("click", () => {
    // The existing export path: the SW spins up the offscreen doc and downloads commonplace-export.json.
    void chrome.runtime.sendMessage({ kind: "export_open_schema" }).catch(() => {});
    toast("Export started — check your downloads for commonplace-export.json");
  });

  // Paint the connecting state immediately, then poll.
  repaint();
  void poll();
  setInterval(() => void poll(), 1000);
}

main();
