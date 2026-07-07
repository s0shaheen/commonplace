// Block-0 spike #2 — REMOTE leg. Exercises the real Supabase/PostgREST transport end-to-end:
// two devices encrypt client-side, push/pull ciphertext through live Postgres, converge; then
// we read the rows back server-side and prove the store holds ONLY ciphertext (zero-knowledge).
//
// Env: SUPABASE_URL, SUPABASE_KEY (anon/publishable), SUPABASE_JWT (a signed-in user's access
// token so auth.uid() satisfies RLS). Run: node spikes/sync-zk/remote.mjs
import { readFileSync } from "node:fs";

const { SUPABASE_URL, SUPABASE_KEY, SUPABASE_JWT } = process.env;
if (!SUPABASE_URL || !SUPABASE_KEY || !SUPABASE_JWT) { console.error("need SUPABASE_URL / SUPABASE_KEY / SUPABASE_JWT"); process.exit(2); }

const enc = new TextEncoder(), dec = new TextDecoder();
const b64 = (b) => Buffer.from(b).toString("base64");
const unb64 = (s) => new Uint8Array(Buffer.from(s, "base64"));
async function deriveKeys(pass, saltB64) {
  const base = await crypto.subtle.importKey("raw", enc.encode(pass), "PBKDF2", false, ["deriveBits"]);
  const bits = new Uint8Array(await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: unb64(saltB64), iterations: 600_000 }, base, 512));
  return {
    aesKey: await crypto.subtle.importKey("raw", bits.slice(0, 32), "AES-GCM", false, ["encrypt", "decrypt"]),
    macKey: await crypto.subtle.importKey("raw", bits.slice(32), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]),
  };
}
const opaque = async (mac, id) => b64(await crypto.subtle.sign("HMAC", mac, enc.encode(id))).replace(/[+/=]/g, "").slice(0, 43);
async function seal(k, o) { const iv = crypto.getRandomValues(new Uint8Array(12)); const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, k, enc.encode(JSON.stringify(o))); return { iv: b64(iv), ct: b64(ct) }; }
async function open_(k, r) { return JSON.parse(dec.decode(await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64(r.iv) }, k, unb64(r.ct)))); }

// real PostgREST transport
const H = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_JWT}`, "Content-Type": "application/json" };
const REST = `${SUPABASE_URL}/rest/v1/sync_items`;
async function push(rows) {
  const r = await fetch(REST, { method: "POST", headers: { ...H, Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify(rows) });
  if (!r.ok) throw new Error(`push ${r.status}: ${(await r.text()).slice(0, 200)}`);
}
async function pullSince(seq) {
  const r = await fetch(`${REST}?select=key,rev,device_id,deleted,iv,ct,seq&seq=gt.${seq}&order=seq.asc`, { headers: H });
  if (!r.ok) throw new Error(`pull ${r.status}: ${(await r.text()).slice(0, 200)}`);
  return r.json();
}

class Device {
  constructor(name, keys) { this.name = name; this.keys = keys; this.items = new Map(); this.meta = new Map(); this.clock = 0; this.cursor = 0; }
  async write(item, deleted = false) { const rev = ++this.clock; this.items.set(item.id, deleted ? null : item); this.meta.set(item.id, { rev, deviceId: this.name, deleted, pushed: false }); }
  async push() {
    const batch = [];
    for (const [id, m] of this.meta) { if (m.pushed) continue; const e = await seal(this.keys.aesKey, { id, item: this.items.get(id) }); batch.push({ key: await opaque(this.keys.macKey, id), rev: m.rev, device_id: this.name, deleted: m.deleted, iv: e.iv, ct: e.ct }); m.pushed = true; }
    if (batch.length) await push(batch);
    return batch.length;
  }
  async pull() {
    const rows = await pullSince(this.cursor); let applied = 0;
    for (const r of rows) { this.cursor = Math.max(this.cursor, r.seq); const { id, item } = await open_(this.keys.aesKey, r); const mine = this.meta.get(id); const wins = !mine || r.rev > mine.rev || (r.rev === mine.rev && r.device_id > mine.deviceId); if (!wins) continue; this.clock = Math.max(this.clock, r.rev); this.items.set(id, r.deleted ? null : item); this.meta.set(id, { rev: r.rev, deviceId: r.device_id, deleted: r.deleted, pushed: true }); applied++; }
    return applied;
  }
  snapshot() { return JSON.stringify([...this.items.entries()].filter(([, v]) => v).sort(([a], [b]) => a.localeCompare(b))); }
}

const corpus = JSON.parse(readFileSync(new URL("../../attic-favorites.json", import.meta.url), "utf8")).slice(0, 50);
const salt = b64(crypto.getRandomValues(new Uint8Array(16)));
const keys = await deriveKeys("correct horse battery staple", salt);
const A = new Device("laptop", keys), B = new Device("desktop", keys);

for (const it of corpus) await A.write({ id: it.id, desc: it.desc, music: it.music, sources: it.sources });
const pushed = await A.push();
await B.pull();
const converged1 = A.snapshot() === B.snapshot();

// conflict + tombstone over the real DB
const victim = corpus[0].id, dead = corpus[1].id;
await A.write({ id: victim, desc: "A-edit", music: corpus[0].music, sources: ["favorites"] });
await B.write({ id: victim, desc: "B-later", music: corpus[0].music, sources: ["likes"] }); await B.write({ id: victim, desc: "B-later", music: corpus[0].music, sources: ["likes"] });
await A.write({ id: dead, desc: "", music: null, sources: [] }, true);
await A.push(); await B.push(); await A.pull(); await B.pull(); await A.push(); await B.push(); await A.pull(); await B.pull();
const converged2 = A.snapshot() === B.snapshot();
const lww = JSON.parse(A.snapshot()).find(([id]) => id === victim)?.[1].desc === "B-later";
const tomb = !JSON.parse(A.snapshot()).some(([id]) => id === dead);

// server-blindness on the REAL rows: pull raw and scan for any plaintext
const raw = await pullSince(0);
const blob = JSON.stringify(raw);
const leaks = ["berlioz", "Yoo Yee", "original sound", corpus[0].id, victim, "favorites", "likes"].filter((s) => blob.includes(s));

console.log(`
ZERO-KNOWLEDGE SYNC — REMOTE leg (live Supabase Postgres @ ${SUPABASE_URL.replace('https://','').split('.')[0]})
  rows pushed by device A            ${pushed}
  cold-start convergence (A==B)      ${converged1 ? "PASS" : "FAIL"}
  post-conflict convergence (A==B)   ${converged2 ? "PASS" : "FAIL"}
  LWW over real DB                   ${lww ? "PASS" : "FAIL"}
  tombstone over real DB             ${tomb ? "PASS" : "FAIL"}
  rows persisted server-side         ${raw.length}
  server-blindness (no plaintext)    ${leaks.length === 0 ? "PASS" : "FAIL — leaked: " + leaks.join(", ")}
`);
process.exit([converged1, converged2, lww, tomb, leaks.length === 0].every(Boolean) ? 0 : 1);
