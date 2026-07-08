import { describe, it, expect } from "vitest";
import { DEFAULT_CONFIG, loadConfig, saveConfig, type StorageLike } from "./config.js";

function memStorage(seed: Record<string, unknown> = {}): StorageLike & { data: Record<string, unknown> } {
  const data = { ...seed };
  return { data,
    async get(k) { return k in data ? { [k]: data[k] } : {}; },
    async set(o) { Object.assign(data, o); } };
}

describe("cp_config", () => {
  it("pins the frozen defaults", () => {
    expect(DEFAULT_CONFIG.managedModel).toBe("gemini-2.5-flash-lite");
    expect(DEFAULT_CONFIG.ingestion).toBe("keyframes_vtt");
    expect(DEFAULT_CONFIG.escalateNative).toBe(false);
    expect(DEFAULT_CONFIG.placesEnabled).toBe(false);
    expect(DEFAULT_CONFIG.concurrency).toBe(2);
  });
  it("loadConfig merges a stored partial over defaults", async () => {
    const s = memStorage({ cp_config: { engineLane: "local", geminiKey: "k" } });
    const c = await loadConfig(s);
    expect(c.engineLane).toBe("local");
    expect(c.geminiKey).toBe("k");
    expect(c.managedModel).toBe("gemini-2.5-flash-lite"); // default survives
  });
  it("saveConfig round-trips a patch under the cp_config key", async () => {
    const s = memStorage();
    await saveConfig(s, { placesEnabled: true, placesKey: "pk" });
    expect((s.data.cp_config as any).placesEnabled).toBe(true);
    expect((await loadConfig(s)).placesKey).toBe("pk");
  });
});
