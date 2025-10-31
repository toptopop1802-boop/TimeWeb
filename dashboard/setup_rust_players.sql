-- Rust Players schema (Supabase / Postgres)
-- Run this in Supabase SQL editor once

create table if not exists public.rust_players (
  steam_id text primary key,
  name text,
  ip text,
  team_id text,
  team_members jsonb,
  grid text,
  x double precision,
  y double precision,
  z double precision,
  online boolean default false,
  server_name text,
  last_seen timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists rust_players_updated_at_idx on public.rust_players(updated_at desc);
create index if not exists rust_players_online_idx on public.rust_players(online);

-- Row level security optional (loose) – allow service/API routes to operate via auth middleware
alter table public.rust_players enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'rust_players' and policyname = 'Allow all with authenticated token') then
    create policy "Allow all with authenticated token" on public.rust_players
      for all
      to authenticated
      using (true)
      with check (true);
  end if;
end $$;


