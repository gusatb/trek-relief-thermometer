-- Dream "cheers" (+1 on an existing pin). Run once in Supabase:
--   Dashboard → SQL → New query → paste all → Run
--
-- If the app still says "schema cache", wait ~30s or: Settings → API → Reload schema
--
-- Optional live updates: Database → Replication → supabase_realtime → add map_pin_shares

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

grant select, insert on table public.map_pin_shares to anon, authenticated;
grant all on table public.map_pin_shares to service_role;
