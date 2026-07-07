# Block-0 Spike #2 — Zero-knowledge cross-device sync

**Result: PASS (both legs). The zero-knowledge sync backend is proven and now exists in `attic-dev`.**

## Protocol leg (in-memory) — `spike.mjs`, 200 real corpus items
AES-GCM-256, PBKDF2-SHA256 600k passphrase derivation, HMAC-opaqued item keys, per-item LWW + tombstones. 6/6: cold-start convergence · post-conflict convergence · LWW · tombstone · **server-blindness** (no captions/artists/IDs) · wrong-passphrase-fails-closed. ~1.78× ciphertext overhead (base64).

## Remote leg (live Supabase Postgres) — `remote.mjs`, 50 items, authenticated user + RLS
Ran 2026-07-07 against a restored `attic-dev` project through the real PostgREST API with a signed-in user's JWT (so `auth.uid()` RLS applied). Two devices encrypt client-side, push/pull ciphertext over the wire, converge:

```
rows pushed by device A            50
cold-start convergence (A==B)      PASS
post-conflict convergence (A==B)   PASS
LWW over real DB                   PASS
tombstone over real DB             PASS
rows persisted server-side         50
server-blindness (no plaintext)    PASS
```

**Independently confirmed at the storage layer** (`select … from sync_items`): keys are opaque HMAC (`et4b7mA6…`), `ct` is ciphertext only, a regex for `berlioz|yoo yee|original sound|favorites|likes` matched **nothing** (`any_plaintext_leak = false`). The server cannot read the library — verified, not asserted.

## The bug the remote leg caught (why you run it)
The first remote run FAILED post-conflict convergence while the in-memory leg passed. Cause: on an upsert **update**, Postgres does not bump the `seq` watermark (the client omits `seq`; `merge-duplicates` keeps the old value), so a pulling client whose cursor is already past that `seq` never sees the update. The in-memory transport masked this by always assigning a fresh incrementing seq on every write.
**Fix (now live in the schema):** a `before insert or update` trigger sets `seq := nextval(seq_seq)` on every write, so the monotonic cursor always advances. Re-run → 6/6 PASS. This is a genuine protocol correctness detail that only a real DB surfaces.

## What's now live in `attic-dev` (the real backend, not a throwaway)
`public.sync_items` (canonical DDL in `schema.sql`): opaque `key`, `rev`, `device_id`, `deleted`, `iv`, `ct`, monotonic `seq`, `updated_at`; **RLS** own-rows select/insert/update (3 policies); the seq-bump trigger. Test data truncated, throwaway auth user deleted. This table IS the sync + managed-inference + MCP backend the SPEC calls for (§7.I) — one project, agency-ready.

## Notes for production hardening (non-blocking)
- Swap PBKDF2 → **Argon2id** (wasm) before launch; protocol unchanged.
- `device_id` is stored in the clear (a label, not content) — opaque it too if device names are considered sensitive.
- Add a server-side `updated_at` retention/pagination policy; the cursor is `seq`-based and already incremental.
