-- Orbitspace — Supabase (Postgres) schema
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor → New query),
-- once, on a fresh free project. Then seed the data (see README):
--   cd backend && npm install && npm run seed
-- All data is simulated. Decision support only — not a medical device.

create table if not exists crew (
  id text primary key,
  name text not null,
  role text not null,
  avatar text not null default 'k'
);

create table if not exists baselines (
  astronaut_id text primary key references crew (id) on delete cascade,
  hr_mean numeric not null, hr_sd numeric not null,
  hrv_mean numeric not null, hrv_sd numeric not null,
  sleep_mean numeric not null, sleep_sd numeric not null,
  spo2_mean numeric not null, spo2_sd numeric not null,
  bone_mean numeric not null, bone_sd numeric not null
);

create table if not exists daily_readings (
  id bigint generated always as identity primary key,
  astronaut_id text not null references crew (id) on delete cascade,
  day int not null check (day between 1 and 180),
  hr numeric not null,
  hrv numeric not null,
  sleep numeric not null,
  spo2 numeric not null,
  bone numeric not null,
  radiation numeric not null,
  unique (astronaut_id, day)
);
create index if not exists daily_readings_astronaut_day_idx
  on daily_readings (astronaut_id, day);

create table if not exists self_checks (
  id bigint generated always as identity primary key,
  astronaut_id text not null references crew (id) on delete cascade,
  day int not null check (day between 1 and 180),
  energy int not null check (energy between 1 and 5),
  mood int not null check (mood between 1 and 5),
  stress int not null check (stress between 1 and 5),
  created_at timestamptz not null default now()
);
create index if not exists self_checks_astronaut_day_idx
  on self_checks (astronaut_id, day, created_at desc);

-- Row-level security: the API reads with the anon key and writes with the
-- service-role key (which bypasses RLS). These policies let anyone read the
-- simulated mission data and submit a self-check, and nothing else.
alter table crew enable row level security;
alter table baselines enable row level security;
alter table daily_readings enable row level security;
alter table self_checks enable row level security;

drop policy if exists "crew readable" on crew;
create policy "crew readable" on crew for select using (true);
drop policy if exists "baselines readable" on baselines;
create policy "baselines readable" on baselines for select using (true);
drop policy if exists "readings readable" on daily_readings;
create policy "readings readable" on daily_readings for select using (true);
drop policy if exists "self-checks readable" on self_checks;
create policy "self-checks readable" on self_checks for select using (true);
drop policy if exists "self-checks insertable" on self_checks;
create policy "self-checks insertable" on self_checks for insert with check (true);
