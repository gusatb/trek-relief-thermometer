-- Dream "cheers" (+1 on an existing pin). Run once in Supabase:
--   Dashboard → SQL → New query → paste all → Run
--
-- If the app still says "schema cache", wait ~30s or: Settings → API → Reload schema
--
-- Live cheer updates (instant on /map and thermometer when enabled):
--   Dashboard → Database → Replication → supabase_realtime → enable map_pin_shares
--   OR run once in SQL (ignore error if already added):
-- alter publication supabase_realtime add table public.map_pin_shares;
--
-- The TV embed also polls every ~6s, so cheers still update if Realtime is off.

create table if not exists public.map_pin_shares (
  id bigint generated always as identity primary key,
  pin_id bigint not null references public.map_pins (id) on delete cascade,
  shared_by text not null,
  created_at timestamptz not null default now(),
  constraint map_pin_shares_shared_by_len check (char_length(trim(shared_by)) > 0)
);

create index if not exists map_pin_shares_pin_id_idx on public.map_pin_shares (pin_id);

alter table public.map_pin_shares enable row level security;

drop policy if exists "map_pin_shares_select_public" on public.map_pin_shares;
create policy "map_pin_shares_select_public"
  on public.map_pin_shares for select
  to anon, authenticated
  using (true);

drop policy if exists "map_pin_shares_insert_public" on public.map_pin_shares;
create policy "map_pin_shares_insert_public"
  on public.map_pin_shares for insert
  to anon, authenticated
  with check (true);

drop policy if exists "map_pin_shares_update_public" on public.map_pin_shares;
create policy "map_pin_shares_update_public"
  on public.map_pin_shares for update
  to anon, authenticated
  using (true)
  with check (char_length(trim(shared_by)) > 0);

drop policy if exists "map_pin_shares_delete_public" on public.map_pin_shares;
create policy "map_pin_shares_delete_public"
  on public.map_pin_shares for delete
  to anon, authenticated
  using (true);

grant select, insert, update, delete on table public.map_pin_shares to anon, authenticated;
grant all on table public.map_pin_shares to service_role;
