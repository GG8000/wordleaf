-- Wordleaf: ready check and host timeout.
-- The game no longer starts by a host click: every player marks themselves ready, and the
-- game starts as soon as all of them are (2-10 players). Card language and level are stored
-- on the room so everyone sees them, and changing them clears all ready flags.
-- Clients send a heartbeat every 20 s. If the host has been silent for 2 minutes while the
-- room is in the lobby, the room is closed and everyone is removed.

alter table public.room_players add column ready boolean not null default false;

-- Kept out of room_players on purpose: heartbeats would otherwise trigger a realtime
-- refetch on every client every few seconds. Not readable by clients.
create table public.heartbeats (
  room_id    text not null,
  user_id    uuid not null,
  last_seen  timestamptz not null default now(),
  primary key (room_id, user_id),
  foreign key (room_id, user_id) references public.room_players (room_id, user_id) on delete cascade
);
alter table public.heartbeats enable row level security;

create or replace function public._host_timeout() returns interval
language sql immutable as $$ select interval '2 minutes' $$;

-- Internal helpers -------------------------------------------------------------

-- Returning to the lobby also clears every ready flag
create or replace function public._reset_game(p_room text)
returns void
language plpgsql security definer set search_path = public as $$
begin
  delete from clovers where room_id = p_room;  -- cascades to cards and solutions
  update room_players set ready = false where room_id = p_room and ready;
  update rooms set
    status = 'lobby', turn_order = '{}', current_turn = 0, attempt = 1,
    revealing = false, guess_state = '{}', locked_slots = '{}', updated_at = now()
  where id = p_room;
end $$;

-- Deal the clovers with the room's card language and level (was the public start_game)
create or replace function public._start_game(p_room text)
returns void
language plpgsql security definer set search_path = public as $$
declare
  r rooms; v_used text[] := '{}'; v_words text[];
  v_rot int[]; v_roles int[]; p record; k int; v_card uuid;
begin
  select * into r from rooms where id = p_room;
  delete from clovers where room_id = p_room;

  for p in select user_id, name from room_players where room_id = p_room loop
    insert into clovers (room_id, owner_id, owner_name) values (p_room, p.user_id, p.name);
    select array_agg(floor(random() * 4)::int) into v_rot from generate_series(1, 4);
    v_words := _clover_words(r.card_lang, r.level, v_used, v_rot);
    if cardinality(v_words) < 20 then raise exception 'not_enough_words'; end if;
    v_used := v_used || v_words;
    -- roles 0-3 = board slots, 4 = decoy; shuffled so insert order leaks nothing
    select array_agg(x order by random()) into v_roles from unnest(array[0, 1, 2, 3, 4]) x;
    foreach k in array v_roles loop
      insert into cards (room_id, owner_id, words, tray_order)
      values (p_room, p.user_id, v_words[k * 4 + 1 : k * 4 + 4], floor(random() * 1000000)::int)
      returning id into v_card;
      insert into solutions (card_id, room_id, owner_id, slot, rotation)
      values (v_card, p_room, p.user_id,
              case when k = 4 then null else k end,
              case when k = 4 then 0 else v_rot[k + 1] end);
    end loop;
  end loop;

  update rooms set
    status = 'writing', turn_order = '{}', current_turn = 0,
    attempt = 1, revealing = false, guess_state = '{}', locked_slots = '{}',
    score = 0, updated_at = now()
  where id = p_room;
end $$;

-- Start once everyone in the lobby is ready. Caller holds the room lock.
create or replace function public._maybe_start(p_room text)
returns void
language plpgsql security definer set search_path = public as $$
declare n int; n_ready int;
begin
  if (select status from rooms where id = p_room) <> 'lobby' then return; end if;
  select count(*), count(*) filter (where ready) into n, n_ready
  from room_players where room_id = p_room;
  if n between 2 and 10 and n_ready = n then
    perform _start_game(p_room);
  end if;
end $$;

-- Close the room if the host stopped sending heartbeats while in the lobby.
-- Returns true if it closed the room.
create or replace function public._close_if_host_gone(p_room text)
returns boolean
language plpgsql security definer set search_path = public as $$
declare r rooms; v_seen timestamptz;
begin
  select * into r from rooms where id = p_room;
  if r.status <> 'lobby' or r.host_id is null then return false; end if;
  select coalesce(h.last_seen, p.joined_at) into v_seen
  from room_players p left join heartbeats h using (room_id, user_id)
  where p.room_id = p_room and p.user_id = r.host_id;
  if v_seen is null or v_seen >= now() - _host_timeout() then return false; end if;

  -- Recheck under the lock; another call may have closed or changed the room meanwhile
  r := _lock_room(p_room);
  if r.status <> 'lobby' or r.host_id is null then return false; end if;
  if exists (
    select 1 from heartbeats
    where room_id = p_room and user_id = r.host_id and last_seen >= now() - _host_timeout()
  ) then return false; end if;

  delete from room_players where room_id = p_room;  -- cascades to heartbeats
  perform _reset_game(p_room);
  update rooms set host_id = null, score = 0 where id = p_room;
  return true;
end $$;

-- Same as before, plus: in the lobby, a leaving player can be the last one others waited for
create or replace function public._remove_player(p_room text, p_user uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare r rooms; v_pos int; v_new_host uuid;
begin
  r := _lock_room(p_room);
  delete from room_players where room_id = p_room and user_id = p_user;

  if not exists (select 1 from room_players where room_id = p_room) then
    perform _reset_game(p_room);
    update rooms set host_id = null, score = 0 where id = p_room;
    return;
  end if;

  if r.host_id = p_user then
    select user_id into v_new_host from room_players
    where room_id = p_room order by joined_at limit 1;
    update rooms set host_id = v_new_host where id = p_room;
  end if;

  if r.status = 'lobby' then
    perform _maybe_start(p_room);
  elsif r.status = 'writing' then
    delete from clovers where room_id = p_room and owner_id = p_user;
    if not exists (select 1 from clovers where room_id = p_room and not submitted) then
      perform _start_guessing(p_room);
    end if;
  elsif r.status = 'guessing' then
    v_pos := array_position(r.turn_order, p_user) - 1;  -- 0-based, null if absent
    if v_pos is not null and v_pos >= r.current_turn then
      -- Clover not yet played (or being played): drop it
      delete from clovers where room_id = p_room and owner_id = p_user;
      update rooms set turn_order = array_remove(turn_order, p_user) where id = p_room;
      if v_pos = r.current_turn then
        perform _setup_turn(p_room);
      end if;
    end if;
  end if;

  update rooms set updated_at = now() where id = p_room;
end $$;

revoke all on function public._host_timeout()               from public, anon, authenticated;
revoke all on function public._start_game(text)             from public, anon, authenticated;
revoke all on function public._maybe_start(text)            from public, anon, authenticated;
revoke all on function public._close_if_host_gone(text)     from public, anon, authenticated;

-- Public RPCs -----------------------------------------------------------------

-- Same as before, plus: a dead host's lobby is closed first, and joining counts as a heartbeat
create or replace function public.join_room(p_name text, p_room text default 'main')
returns void
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); r rooms; v_name text := trim(p_name);
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  if char_length(v_name) not between 1 and 20 then raise exception 'invalid_name'; end if;
  perform _close_if_host_gone(p_room);
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

-- Called by every client every 20 s. Also where a dead host's lobby gets noticed.
create or replace function public.heartbeat(p_room text default 'main')
returns void
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  insert into heartbeats (room_id, user_id)
  select p_room, uid where exists (select 1 from room_players where room_id = p_room and user_id = uid)
  on conflict (room_id, user_id) do update set last_seen = now();
  perform _close_if_host_gone(p_room);
end $$;

-- Host picks card language and level in the lobby. Everyone has to confirm again.
create or replace function public.set_settings(p_card_lang text, p_level int, p_room text default 'main')
returns void
language plpgsql security definer set search_path = public as $$
declare uid uuid; r rooms;
begin
  uid := _require_player(p_room);
  r := _lock_room(p_room);
  if r.host_id is distinct from uid then raise exception 'not_host'; end if;
  if r.status <> 'lobby' then raise exception 'wrong_phase'; end if;
  if p_card_lang not in ('en', 'de', 'fr') then raise exception 'invalid_language'; end if;
  if p_level not between 1 and 3 then raise exception 'invalid_level'; end if;
  if r.card_lang = p_card_lang and r.level = p_level then return; end if;

  update rooms set card_lang = p_card_lang, level = p_level, updated_at = now() where id = p_room;
  update room_players set ready = false where room_id = p_room and ready;
end $$;

create or replace function public.set_ready(p_ready boolean, p_room text default 'main')
returns void
language plpgsql security definer set search_path = public as $$
declare uid uuid; r rooms;
begin
  uid := _require_player(p_room);
  r := _lock_room(p_room);
  if r.status <> 'lobby' then raise exception 'wrong_phase'; end if;
  update room_players set ready = p_ready where room_id = p_room and user_id = uid;
  perform _maybe_start(p_room);
  update rooms set updated_at = now() where id = p_room;
end $$;

-- The host no longer starts the game directly
drop function public.start_game(text, text, int);

grant execute on function
  public.heartbeat(text), public.set_settings(text, int, text), public.set_ready(boolean, text)
to authenticated;
revoke execute on function
  public.heartbeat(text), public.set_settings(text, int, text), public.set_ready(boolean, text)
from public, anon;
