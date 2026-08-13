create table public."group" (
  id uuid primary key default gen_random_uuid(),
  name text not null check (btrim(name) <> ''),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create unique index group_name_unique
  on public."group" (lower(btrim(name)));

create table public.group_player (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null,
  player_id uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (group_id, player_id)
);

create index group_player_group
  on public.group_player (group_id);

create index group_player_player
  on public.group_player (player_id);

alter table public.session add column group_id uuid;

with migrated_group as (
  insert into public."group" (name)
  values ('麻德')
  returning id
)
update public.session
set group_id = (select id from migrated_group);

insert into public.group_player (group_id, player_id)
select g.id, p.id
from public."group" g
cross join public.player p
where g.name = '麻德'
  and g.deleted_at is null
  and p.deleted_at is null
on conflict (group_id, player_id) do nothing;

alter table public.session
  alter column group_id set not null;

create index session_group_date
  on public.session (group_id, date desc);
