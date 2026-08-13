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

create or replace function public.prevent_session_group_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.group_id is distinct from old.group_id then
    raise exception 'session group_id is immutable';
  end if;
  return new;
end;
$$;

create trigger session_group_id_immutable
before update of group_id on public.session
for each row execute function public.prevent_session_group_change();

-- The application currently uses a server-side anon client behind its own
-- shared-password API. Keep that access model for the new tables while making
-- their Data API exposure explicit (Supabase no longer auto-exposes tables).
grant select, insert, update on public."group" to anon;
grant select, insert, update on public.group_player to anon;

alter table public."group" enable row level security;
alter table public.group_player enable row level security;

create policy "shared app can read groups"
  on public."group" for select to anon using (true);
create policy "shared app can create groups"
  on public."group" for insert to anon with check (true);
create policy "shared app can update groups"
  on public."group" for update to anon using (true) with check (true);

create policy "shared app can read memberships"
  on public.group_player for select to anon using (true);
create policy "shared app can create memberships"
  on public.group_player for insert to anon with check (true);
create policy "shared app can update memberships"
  on public.group_player for update to anon using (true) with check (true);
