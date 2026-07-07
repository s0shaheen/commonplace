-- Canonical zero-knowledge sync backend schema (proven live in attic-dev, 2026-07-07).
-- Applied via Supabase migrations: zk_sync_items, sync_items_bump_seq_on_write.
-- The server stores ONLY ciphertext + an opaque HMAC key; it cannot read the library.

create table if not exists public.sync_items (
  user_id    uuid    not null default auth.uid(),
  key        text    not null,          -- HMAC-opaqued item id (client-derived; server can't reverse)
  rev        bigint  not null,          -- client Lamport rev for LWW
  device_id  text    not null,
  deleted    boolean not null default false,
  iv         text    not null,          -- AES-GCM nonce, base64
  ct         text    not null,          -- AES-GCM ciphertext, base64 (the whole item payload)
  seq        bigserial,                 -- server monotonic watermark for incremental pull
  updated_at timestamptz not null default now(),
  primary key (user_id, key)
);

alter table public.sync_items enable row level security;
create policy "own rows select" on public.sync_items for select using (auth.uid() = user_id);
create policy "own rows insert" on public.sync_items for insert with check (auth.uid() = user_id);
create policy "own rows update" on public.sync_items for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index if not exists sync_items_user_seq on public.sync_items (user_id, seq);

-- CRITICAL (found by the remote-leg spike): bump seq on EVERY write, incl. upsert-update,
-- or incremental pull-by-cursor silently misses updates.
create or replace function public.sync_items_bump_seq() returns trigger as $$
begin
  new.seq := nextval('public.sync_items_seq_seq');
  new.updated_at := now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists sync_items_bump on public.sync_items;
create trigger sync_items_bump
  before insert or update on public.sync_items
  for each row execute function public.sync_items_bump_seq();
