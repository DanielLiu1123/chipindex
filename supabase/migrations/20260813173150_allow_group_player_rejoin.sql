alter table public.group_player
  drop constraint group_player_group_id_player_id_key;

create unique index group_player_group_id_player_id_unique
  on public.group_player (group_id, player_id)
  where deleted_at is null;
