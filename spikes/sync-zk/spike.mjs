// Block-0 spike #2 — zero-knowledge sync protocol proof (SPEC §24, D7)
// Proves client-side: AES-GCM-256 encrypt/decrypt (passphrase-derived, PBKDF2-SHA256 600k),
// HMAC-opaqued item keys (server never sees platform item IDs), per-item LWW + tombstones,
// two-device convergence through a transport that only ever holds ciphertext.
// Transports: MemoryTransport (this run) · SupabaseTransport (same interface; point at a
// project when provisioned — table DDL at bottom). Prod-path note: swap PBKDF2 → Argon2id
// (wasm) before launch; protocol unchanged.
//
// Run: node spikes/sync-zk/spike.mjs

import { readFileSync } from "node:fs";

const enc = new TextEncoder();
const dec = new TextDecoder();
const b64 = (buf) => Buffer.from(buf).toString("base64");
const unb64 = (s) => new Uint8Array(Buffer.from(s, "base64"));

// ── key material: one passphrase → AES key (encrypt) + HMAC key (opaque item keys) ──
async function deriveKeys(passphrase, saltB64) {
  const salt = unb64(saltB64);
  const base = await crypto.subtle.importKey("raw", enc.encode(passphrase), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations: 600_000 }, base, 512);
  const bytes = new Uint8Array(bits);
  const aesKey = await crypto.subtle.importKey("raw", bytes.slice(0, 32), "AES-GCM", false, ["encrypt", "decrypt"]);
  const macKey = await crypto.subtle.importKey("raw", bytes.slice(32), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return { aesKey, macKey };
}
const opaqueId = async (macKey, itemId) =>
  b64(await crypto.subtle.sign("HMAC", macKey, enc.encode(itemId))).slice(0, 43);

async function seal(aesKey, obj) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, aesKey, enc.encode(JSON.stringify(obj)));
  return { iv: b64(iv), ct: b64(ct) };
}
async function open_(aesKey, env) {
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64(env.iv) }, aesKey, unb64(env.ct));
  return JSON.parse(dec.decode(pt));
}

// ── transport interface: the server side. Holds ONLY {key, rev, deviceId, deleted, iv, ct} ──
class MemoryTransport {
  constructor() { this.rows = new Map(); this.cursor = 0; }
  async push(batch) {
    for (const r of batch) {
      const cur = this.rows.get(r.key);
      // server-side LWW guard is an optimization only; clients merge authoritatively
      if (!cur || r.rev > cur.rev || (r.rev === cur.rev && r.deviceId > cur.deviceId))
        this.rows.set(r.key, { ...r, seq: ++this.cursor });
    }
    return { cursor: this.cursor };
  }
  async pull(sinceCursor = 0) {
    return { rows: [...this.rows.values()].filter((r) => r.seq > sinceCursor), cursor: this.cursor };
  }
}

// SupabaseTransport — same interface, PostgREST-backed. Exercised once a project exists.
// eslint-disable-next-line no-unused-vars
class SupabaseTransport {
  constructor(url, anonKey, userJwt) { this.url = url; this.headers = { apikey: anonKey, Authorization: `Bearer ${userJwt}`, "Content-Type": "application/json", Prefer: "resolution=merge-duplicates" }; }
  async push(batch) {
    const res = await fetch(`${this.url}/rest/v1/sync_items`, { method: "POST", headers: this.headers, body: JSON.stringify(batch) });
    if (!res.ok) throw new Error(`push ${res.status}`);
    return {};
  }
  async pull(sinceSeq = 0) {
    const res = await fetch(`${this.url}/rest/v1/sync_items?seq=gt.${sinceSeq}&order=seq.asc`, { headers: this.headers });
    if (!res.ok) throw new Error(`pull ${res.status}`);
    const rows = await res.json();
    return { rows, cursor: rows.at(-1)?.seq ?? sinceSeq };
  }
}

// ── device: local library + sync client ──
class Device {
  constructor(name, keys) { this.name = name; this.keys = keys; this.items = new Map(); this.meta = new Map(); this.clock = 0; this.cursor = 0; }
  tick() { return ++this.clock; }
  async write(item, { deleted = false } = {}) {
    const rev = this.tick();
    this.items.set(item.id, deleted ? null : item);
    this.meta.set(item.id, { rev, deviceId: this.name, deleted });
  }
  async push(transport) {
    const batch = [];
    for (const [id, m] of this.meta) {
      if (m.pushed) continue;
      const env = await seal(this.keys.aesKey, { id, item: this.items.get(id) });
      batch.push({ key: await opaqueId(this.keys.macKey, id), rev: m.rev, deviceId: this.name, deleted: m.deleted, iv: env.iv, ct: env.ct });
      m.pushed = true;
    }
    if (batch.length) await transport.push(batch);
    return batch.length;
  }
  async pull(transport) {
    const { rows, cursor } = await transport.pull(this.cursor);
    this.cursor = cursor;
    let applied = 0;
    for (const r of rows) {
      const { id, item } = await open_(this.keys.aesKey, r);
      const mine = this.meta.get(id);
      const wins = !mine || r.rev > mine.rev || (r.rev === mine.rev && r.deviceId > mine.deviceId);
      if (!wins) continue;
      this.clock = Math.max(this.clock, r.rev); // lamport
      this.items.set(id, r.deleted ? null : item);
      this.meta.set(id, { rev: r.rev, deviceId: r.deviceId, deleted: r.deleted, pushed: true });
      applied++;
    }
    return applied;
  }
  snapshot() {
    return JSON.stringify([...this.items.entries()].filter(([, v]) => v).sort(([a], [b]) => a.localeCompare(b)));
  }
}

// ── the proof ──
const corpus = JSON.parse(readFileSync(new URL("../../attic-favorites.json", import.meta.url), "utf8")).slice(0, 200);
const salt = b64(crypto.getRandomValues(new Uint8Array(16)));
const keys = await deriveKeys("correct horse battery staple", salt);
const server = new MemoryTransport();
const A = new Device("laptop", keys);
const B = new Device("desktop", keys);

// 1) A captures 200 real items, pushes
for (const it of corpus) await A.write({ id: it.id, desc: it.desc, music: it.music, sources: it.sources });
const pushedA = await A.push(server);

// 2) B pulls cold → converges
await B.pull(server);
const converged1 = A.snapshot() === B.snapshot();

// 3) Conflict: both edit the same item offline; A also deletes one (tombstone)
const victim = corpus[0].id, dead = corpus[1].id;
await A.write({ id: victim, desc: "A-edit", music: corpus[0].music, sources: ["favorites"] });
await B.write({ id: victim, desc: "B-edit-later", music: corpus[0].music, sources: ["likes"] });
await B.tick(); await B.write({ id: victim, desc: "B-edit-later", music: corpus[0].music, sources: ["likes"] }); // B logically later
await A.write({ id: dead, desc: "", music: null, sources: [] }, { deleted: true });
await A.push(server); await B.push(server);
await A.pull(server); await B.pull(server);
// second round so both sides see each other's latest (push-pull-push settles)
await A.push(server); await B.push(server); await A.pull(server); await B.pull(server);
const converged2 = A.snapshot() === B.snapshot();
const lwwHeld = JSON.parse(A.snapshot()).find(([id]) => id === victim)?.[1].desc === "B-edit-later";
const tombstoneHeld = !JSON.parse(A.snapshot()).some(([id]) => id === dead) && !JSON.parse(B.snapshot()).some(([id]) => id === dead);

// 4) Server blindness: no plaintext substring appears anywhere server-side; keys are opaque
const serverBlob = JSON.stringify([...server.rows.values()]);
const leaks = ["Yoo Yee", "berlioz", "original sound", corpus[0].id, victim].filter((s) => serverBlob.includes(s));
const blind = leaks.length === 0;

// 5) Wrong passphrase must fail closed
let wrongFails = false;
try { await open_((await deriveKeys("wrong-passphrase", salt)).aesKey, [...server.rows.values()][0]); }
catch { wrongFails = true; }

// 6) Overhead accounting
const ptBytes = enc.encode(JSON.stringify(corpus.map((it) => ({ id: it.id, desc: it.desc, music: it.music, sources: it.sources })))).length;
const ctBytes = [...server.rows.values()].reduce((n, r) => n + r.ct.length + r.iv.length + r.key.length, 0);

console.log(`
ZERO-KNOWLEDGE SYNC SPIKE — protocol proof (MemoryTransport)
  items synced (real corpus)          ${pushedA}
  cold-start convergence (A==B)       ${converged1 ? "PASS" : "FAIL"}
  post-conflict convergence (A==B)    ${converged2 ? "PASS" : "FAIL"}
  LWW resolution (later edit wins)    ${lwwHeld ? "PASS" : "FAIL"}
  tombstone delete propagated         ${tombstoneHeld ? "PASS" : "FAIL"}
  server blindness (no plaintext/IDs) ${blind ? "PASS" : `FAIL — leaked: ${leaks.join(", ")}`}
  wrong passphrase fails closed       ${wrongFails ? "PASS" : "FAIL"}
  size: plaintext ${(ptBytes / 1024).toFixed(1)}KB → server-side ${(ctBytes / 1024).toFixed(1)}KB (${(ctBytes / ptBytes).toFixed(2)}x)
  REMOTE LEG: SupabaseTransport implemented, not yet exercised (needs a project).
`);
process.exit([converged1, converged2, lwwHeld, tombstoneHeld, blind, wrongFails].every(Boolean) ? 0 : 1);

/* Supabase DDL for the remote leg (run in SQL editor once the project exists):
create table sync_items (
  user_id uuid not null default auth.uid(),
  key text not null,             -- HMAC-opaqued item id (client-derived; server can't reverse)
  rev bigint not null,
  device_id text not null,
  deleted boolean not null default false,
  iv text not null,
  ct text not null,              -- AES-GCM ciphertext, base64
  seq bigserial,
  primary key (user_id, key)
);
alter table sync_items enable row level security;
create policy "own rows" on sync_items for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
*/
