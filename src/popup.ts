// Popup controller (Task 5) — the "Sync" front door. One button starts/continues the capture
// supervisor; a 1s poll paints live status (current source, per-source counts + state, library total,
// poster-pass activity). Plain DOM, no framework, matching options.ts's style. All decision logic
// lives in the pure supervisor + SW glue; this is a thin view over `sync_status`.

import { SOURCES, type Source, type SupervisorProgress } from "./lib/capture/supervisor.js";
import { loadConfig, type StorageLike } from "./lib/config.js";

interface SyncStatus {
  progress: SupervisorProgress;
  running: boolean;
  posterRunning: boolean;
  count: number;
}

const storage: StorageLike = {
  get: (k) => chrome.storage.local.get(k),
  set: (o) => chrome.storage.local.set(o),
};

const $ = <T extends HTMLElement = HTMLElement>(id: string): T => {
  const el = document.getElementById(id);
  if (!el) throw new Error(`popup: missing #${id}`);
  return el as T;
};

const SOURCE_LABEL: Record<Source, string> = {
  favorites: "Favorites",
  likes: "Likes",
  posts: "Posts",
  reposts: "Reposts",
};

function sourceState(p: SupervisorProgress, src: Source): { label: string; cls: string } {
  const rec = p.counts[src];
  if (rec) return { label: `${rec.status === "giveup" ? "partial" : "done"} · ${rec.captured}`, cls: rec.status };
  if (p.current === src) return { label: "capturing…", cls: "current" };
  return { label: "pending", cls: "pending" };
}

function render(st: SyncStatus): void {
  const { progress } = st;
  // Honest headline (fix round 1, critical): "all sources synced" ONLY when every source ended with
  // TikTok's own hasMore:false. A sweep containing any giveup ("partial") says so — a throttled-out
  // source has an uncaptured tail, and the headline must never paper over it. (The next Sync click
  // starts a fresh sweep that re-attempts the partial sources first.)
  const partials = SOURCES.filter((s) => progress.counts[s]?.status === "giveup").length;
  const state = st.running
    ? progress.current
      ? `capturing ${SOURCE_LABEL[progress.current]}…`
      : "working…"
    : progress.done.length >= SOURCES.length
      ? partials > 0
        ? `synced — ${partials} partial (Sync retries them)`
        : "all sources synced"
      : "idle";
  $("state").textContent = state;
  $("count").textContent = String(st.count);

  const ul = $("sources");
  ul.innerHTML = "";
  for (const src of SOURCES) {
    const { label, cls } = sourceState(progress, src);
    const li = document.createElement("li");
    const name = document.createElement("span");
    name.textContent = SOURCE_LABEL[src];
    const badge = document.createElement("span");
    badge.className = `badge ${cls}`;
    badge.textContent = label;
    li.append(name, badge);
    ul.appendChild(li);
  }

  const posterRow = $("poster-row");
  if (st.posterRunning) {
    posterRow.hidden = false;
    $("poster").textContent = "fetching…";
  } else {
    posterRow.hidden = true;
  }

  // Disable Sync while a run is in flight (the SW also guards, but a disabled button reads clearly).
  ($("sync") as HTMLButtonElement).disabled = st.running;
  ($("sync") as HTMLButtonElement).textContent = st.running ? "Syncing…" : "Sync now";
}

async function poll(): Promise<void> {
  try {
    const st = (await chrome.runtime.sendMessage({ kind: "sync_status" })) as SyncStatus | undefined;
    if (st) render(st);
  } catch {
    // SW asleep or momentarily unreachable — leave the last paint up; the next tick retries.
  }
}

async function main(): Promise<void> {
  const cfg = await loadConfig(storage);
  $("mode").textContent = cfg.autonomousCapture
    ? "Autonomous mode ON — Sync drives a TikTok tab unattended."
    : "Semi-auto: open your TikTok saved page, then Sync.";

  $("sync").addEventListener("click", () => {
    void chrome.runtime.sendMessage({ kind: "sync_start" });
    // Optimistic: repaint shortly after so the button flips without waiting a full poll tick.
    setTimeout(() => void poll(), 200);
  });

  $("settings").addEventListener("click", () => chrome.runtime.openOptionsPage());

  await poll();
  setInterval(() => void poll(), 1000);
}

void main();
