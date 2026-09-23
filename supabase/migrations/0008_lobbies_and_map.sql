-- Wordleaf: private lobbies with share codes, and the player map.
-- 'main' stays the public table. Any player can open a private lobby, which gets a 4-letter
-- code (also the room id) that others join with or via a link like /?room=K7QF.
-- A user is in at most one room: joining one removes you from any other.
-- Reading rooms and their contents now needs membership (except the public 'main' row), so
-- private codes can't be listed. get_room() returns a single room to anyone who knows its code.
-- The map shows the rough (IP-based, rounded to ~10 km) location of everyone playing right now,
-- as anonymous points.

-- Lobbies ---------------------------------------------------------------------

create or replace function public._is_member(p_room text)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from room_players where room_id = p_room and user_id = auth.uid())
$$;

-- 4 characters without look-alikes (0/O, 1/I/L)
create or replace function public._new_code()
returns text
language plpgsql volatile security definer set search_path = public as $$
declare
  v_chars constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  v_code text;
begin
  loop
    select string_agg(substr(v_chars, 1 + floor(random() * length(v_chars))::int, 1), '')
    into v_code from generate_series(1, 4);
    exit when not exists (select 1 from rooms where id = v_code);
  end loop;
  return v_code;
end $$;

-- Codes are typed by people: accept lower case and stray spaces
create or replace function public._normalize_room(p_room text)
returns text
language sql immutable as $$
  select case when lower(trim(p_room)) = 'main' then 'main' else upper(trim(p_room)) end
$$;

revoke all on function public._new_code()             from public, anon, authenticated;
revoke all on function public._normalize_room(text)   from public, anon, authenticated;
-- _is_member is used by RLS policies, so the client roles need to be able to run it
revoke all on function public._is_member(text)        from public, anon;
grant execute on function public._is_member(text)     to authenticated;

-- Same as before, plus: normalizes the code and leaves every other room first
create or replace function public.join_room(p_name text, p_room text default 'main')
returns void
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); r rooms; v_name text := trim(p_name); v_other text;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  if char_length(v_name) not between 1 and 20 then raise exception 'invalid_name'; end if;
  p_room := _normalize_room(p_room);
  if not exists (select 1 from rooms where id = p_room) then raise exception 'room_not_found'; end if;

  for v_other in select room_id from room_players where user_id = uid and room_id <> p_room loop
    perform _remove_player(v_other, uid);
  end loop;

  update heartbeats set last_seen = now() where room_id = p_room and user_id = uid;
  perform _prune_stale(p_room);
  r := _lock_room(p_room);

  if exists (select 1 from room_players where room_id = p_room and user_id = uid) then
    update room_players set name = v_name where room_id = p_room and user_id = uid;
  else
    if r.status not in ('lobby', 'finished') then raise exception 'game_in_progress'; end if;
    if (select count(*) from room_players where room_id = p_room) >= 10 then
      raise exception 'room_full';
    end if;

    insert into room_players (room_id, user_id, name) values (p_room, uid, v_name);

    if r.host_id is null
       or not exists (select 1 from room_players where room_id = p_room and user_id = r.host_id) then
      update rooms set host_id = uid where id = p_room;
    end if;
  end if;

  insert into heartbeats (room_id, user_id) values (p_room, uid)
  on conflict (room_id, user_id) do update set last_seen = now();
  update rooms set updated_at = now() where id = p_room;
end $$;

-- Opens a private lobby, joins it and returns its code.
-- Also clears out private lobbies that have been empty for a day.
create or replace function public.create_room(p_name text)
returns text
language plpgsql security definer set search_path = public as $$
declare v_code text;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  delete from rooms r
  where r.id <> 'main' and r.updated_at < now() - interval '1 day'
    and not exists (select 1 from room_players p where p.room_id = r.id);
  v_code := _new_code();
  insert into rooms (id) values (v_code);
  perform join_room(p_name, v_code);
  return v_code;
end $$;

-- One room by its exact code, for the join screen and for players who were just removed
create or replace function public.get_room(p_room text default 'main')
returns setof public.rooms
language sql stable security definer set search_path = public as $$
  select * from rooms where id = _normalize_room(p_room)
$$;

grant execute on function public.create_room(text), public.get_room(text) to authenticated;
revoke execute on function public.create_room(text), public.get_room(text) from public, anon;

-- Membership-based read access ------------------------------------------------

drop policy "read rooms"   on public.rooms;
drop policy "read players" on public.room_players;
drop policy "read clovers" on public.clovers;
drop policy "read cards"   on public.cards;
drop policy "read own or revealed solutions" on public.solutions;

create policy "read public or own room" on public.rooms
  for select to authenticated using (id = 'main' or _is_member(id));
create policy "read players of own room" on public.room_players
  for select to authenticated using (_is_member(room_id));
create policy "read clovers of own room" on public.clovers
  for select to authenticated using (_is_member(room_id));
create policy "read cards of own room" on public.cards
  for select to authenticated using (_is_member(room_id));
create policy "read own or revealed solutions of own room" on public.solutions
  for select to authenticated
  using (
    _is_member(room_id)
    and (
      owner_id = auth.uid()
      or exists (
        select 1 from public.clovers c
        where c.room_id = solutions.room_id and c.owner_id = solutions.owner_id and c.revealed
      )
    )
  );

-- Player map ------------------------------------------------------------------

-- Kept per user, not per room. Not readable by clients; player_map() only hands out
-- rounded, anonymous points of players with a recent heartbeat.
create table public.player_locations (
  user_id     uuid primary key references auth.users (id) on delete cascade,
  lat         real not null check (lat between -90 and 90),
  lon         real not null check (lon between -180 and 180),
  updated_at  timestamptz not null default now()
);
alter table public.player_locations enable row level security;

-- Stored rounded to 0.1° (about 10 km)
create or replace function public.set_location(p_lat double precision, p_lon double precision)
returns void
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  if p_lat is null or p_lon is null or p_lat not between -90 and 90 or p_lon not between -180 and 180 then
    raise exception 'invalid_location';
  end if;
  insert into player_locations (user_id, lat, lon)
  values (uid, round(p_lat::numeric, 1), round(p_lon::numeric, 1))
  on conflict (user_id) do update set lat = excluded.lat, lon = excluded.lon, updated_at = now();
  -- Locations of people who haven't played for a while aren't needed anymore
  delete from player_locations where updated_at < now() - interval '7 days';
end $$;

-- Everyone playing right now, grouped by point
create or replace function public.player_map()
returns table (lat real, lon real, players int)
language sql stable security definer set search_path = public as $$
  select l.lat, l.lon, count(distinct l.user_id)::int
  from player_locations l
  join heartbeats h on h.user_id = l.user_id
  where h.last_seen >= now() - _player_timeout()
  group by l.lat, l.lon
$$;

grant execute on function public.set_location(double precision, double precision) to authenticated;
revoke execute on function public.set_location(double precision, double precision) from public, anon;
grant execute on function public.player_map() to anon, authenticated;
