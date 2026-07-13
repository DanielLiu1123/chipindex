-- ChipIndex schema. Run in Supabase → SQL Editor → New query → Run.
-- Rerunnable: drops and recreates all tables. WARNING: destroys existing data.
-- App connects with the anon key and enforces access at the app layer
-- (SPACES-based space scoping), so RLS below is permissive on purpose.

create extension if not exists "pgcrypto";

drop table if exists buy_in cascade;
drop table if exists session_participant cascade;
drop table if exists session cascade;
drop table if exists player cascade;

-- ── players ──────────────────────────────────────────────────────
create table player (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  deleted_at timestamptz
);

-- ── sessions ─────────────────────────────────────────────────────
create table session (
  id            uuid primary key default gen_random_uuid(),
  space         text not null,
  date          date not null,
  description   text,
  exchange_rate numeric not null,
  buy_in_unit   numeric,
  status        text not null default 'OPEN',   -- OPEN | SETTLED
  started_at    timestamptz,
  ended_at      timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz,
  deleted_at    timestamptz
);

-- ── session participants ─────────────────────────────────────────
create table session_participant (
  id          uuid primary key default gen_random_uuid(),
  session_id  uuid not null references session(id) on delete cascade,
  player_id   uuid not null references player(id)  on delete cascade,
  final_chips numeric,
  settled_at  timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz,
  deleted_at  timestamptz
);

-- ── buy-ins ──────────────────────────────────────────────────────
create table buy_in (
  id         uuid primary key default gen_random_uuid(),
  session_id uuid not null references session(id) on delete cascade,
  player_id  uuid not null references player(id)  on delete cascade,
  amount     numeric not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  deleted_at timestamptz
);

create index idx_sp_session on session_participant(session_id);
create index idx_sp_player  on session_participant(player_id);
create index idx_bi_session on buy_in(session_id);
create index idx_bi_player  on buy_in(player_id);
create index if not exists idx_session_space on session(space);

-- ── RLS: allow the anon key full access (app-layer auth) ─────────
alter table player               enable row level security;
alter table session              enable row level security;
alter table session_participant  enable row level security;
alter table buy_in               enable row level security;

create policy anon_all on player              for all to anon using (true) with check (true);
create policy anon_all on session             for all to anon using (true) with check (true);
create policy anon_all on session_participant for all to anon using (true) with check (true);
create policy anon_all on buy_in              for all to anon using (true) with check (true);

-- ── Migration for an existing DB that already has session rows ────
-- Run these three statements INSTEAD of recreating the table, then
-- replace '<默认空间名>' with the space your existing data belongs to
-- (must match a name configured in the SPACES env var).
--
-- alter table session add column if not exists space text;
-- update session set space = '<默认空间名>' where space is null;
-- alter table session alter column space set not null;
-- create index if not exists idx_session_space on session(space);
