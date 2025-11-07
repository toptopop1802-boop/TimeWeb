-- Player Statistics schema (Supabase / Postgres)
-- Run this in Supabase SQL editor once

-- Таблица для убийств
create table if not exists public.player_kills (
    id uuid primary key default gen_random_uuid(),
    initiator_steam_id text not null,
    target_steam_id text not null,
    game_time text,
    distance float,
    weapon text,
    is_headshot boolean default false,
    created_at timestamptz default now()
);

create index if not exists player_kills_initiator_idx on public.player_kills(initiator_steam_id);
create index if not exists player_kills_target_idx on public.player_kills(target_steam_id);
create index if not exists player_kills_created_at_idx on public.player_kills(created_at desc);

-- Таблица для комбатлога (детали боевых событий)
create table if not exists public.combat_logs (
    id uuid primary key default gen_random_uuid(),
    kill_id uuid references public.player_kills(id) on delete cascade,
    time float,
    attacker_steam_id text,
    target_steam_id text,
    attacker text,
    target text,
    weapon text,
    ammo text,
    bone text,
    distance float,
    hp_old float,
    hp_new float,
    info text,
    proj_hits int,
    pi float,
    proj_travel float,
    pm float,
    desync int,
    ad boolean,
    created_at timestamptz default now()
);

create index if not exists combat_logs_kill_id_idx on public.combat_logs(kill_id);
create index if not exists combat_logs_attacker_idx on public.combat_logs(attacker_steam_id);
create index if not exists combat_logs_target_idx on public.combat_logs(target_steam_id);

-- Таблица для статистики игроков (агрегированные данные)
create table if not exists public.player_statistics (
    steam_id text primary key,
    total_kills int default 0,
    total_deaths int default 0,
    headshots int default 0,
    torso_hits int default 0,
    limb_hits int default 0,
    total_reports int default 0,
    total_hours_played float default 0,
    last_updated timestamptz default now()
);

create index if not exists player_statistics_updated_idx on public.player_statistics(last_updated desc);

-- Row level security
alter table public.player_kills enable row level security;
alter table public.combat_logs enable row level security;
alter table public.player_statistics enable row level security;

do $$ begin
    if not exists (select 1 from pg_policies where tablename = 'player_kills' and policyname = 'Allow all with authenticated token') then
        create policy "Allow all with authenticated token" on public.player_kills
        for all
        to authenticated
        using (true)
        with check (true);
    end if;
    
    if not exists (select 1 from pg_policies where tablename = 'combat_logs' and policyname = 'Allow all with authenticated token') then
        create policy "Allow all with authenticated token" on public.combat_logs
        for all
        to authenticated
        using (true)
        with check (true);
    end if;
    
    if not exists (select 1 from pg_policies where tablename = 'player_statistics' and policyname = 'Allow all with authenticated token') then
        create policy "Allow all with authenticated token" on public.player_statistics
        for all
        to authenticated
        using (true)
        with check (true);
    end if;
end $$;

