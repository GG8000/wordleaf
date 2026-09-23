-- Wordleaf: stale players no longer block the room.
-- Before, only a silent host in the lobby was handled. A game whose players all closed their
-- tabs stayed in 'writing'/'guessing' forever, so nobody could join ('game_in_progress'),
-- and a silent non-host kept the lobby's ready check from ever completing.
-- Now, on every heartbeat and join:
--   * lobby: a silent host still closes the room; other players silent for 2 minutes are removed
--   * in a game: if nobody has sent a heartbeat for 2 minutes, the game was abandoned and the
--     room is reset; otherwise single players silent for 5 minutes are removed (longer, because
--     phones pause background tabs)

create or replace function public._player_timeout() returns interval
language sql immutable as $$ select interval '5 minutes' $$;

-- Last sign of life per player (join time if they never sent a heartbeat)
create or replace function public._last_seen(p_room text)
returns table (user_id uuid, last_seen timestamptz)
language sql stable security definer set search_path = public as $$
  select p.user_id, coalesce(h.last_seen, p.joined_at)
  from room_players p left join heartbeats h using (room_id, user_id)
  where p.room_id = p_room
$$;

create or replace function public._prune_stale(p_room text)
returns void
language plpgsql security definer set search_path = public as $$
declare r rooms; v_age interval; n int; n_stale int; n_fresh int; v_user uuid;
begin
  if _close_if_host_gone(p_room) then return; end if;

  -- Cheap check without the lock first: every client runs this every 20 s
  select * into r from rooms where id = p_room;
  if not found then return; end if;
  v_age := case when r.status = 'lobby' then _host_timeout() else _player_timeout() end;
  select count(*),
         count(*) filter (where last_seen < now() - v_age),
         count(*) filter (where last_seen >= now() - _host_timeout())
  into n, n_stale, n_fresh
  from _last_seen(p_room);
  if n = 0 or (n_stale = 0 and n_fresh > 0) then return; end if;

  -- Recheck under the lock; a heartbeat or another prune may have come in meanwhile
  r := _lock_room(p_room);
  v_age := case when r.status = 'lobby' then _host_timeout() else _player_timeout() end;

  if r.status <> 'lobby'
     and not exists (select 1 from _last_seen(p_room) where last_seen >= now() - _host_timeout()) then
    delete from room_players where room_id = p_room;  -- cascades to heartbeats
    perform _reset_game(p_room);
    update rooms set host_id = null, score = 0 where id = p_room;
    return;
  end if;

  for v_user in select user_id from _last_seen(p_room) where last_seen < now() - v_age loop
    perform _remove_player(p_room, v_user);
  end loop;
end $$;

revoke all on function public._player_timeout()    from public, anon, authenticated;
revoke all on function public._last_seen(text)     from public, anon, authenticated;
revoke all on function public._prune_stale(text)   from public, anon, authenticated;

-- Public RPCs -----------------------------------------------------------------

-- Same as before, but prunes all stale players. A returning player's own heartbeat is
-- refreshed first so they don't prune themselves.
create or replace function public.join_room(p_name text, p_room text default 'main')
returns void
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); r rooms; v_name text := trim(p_name);
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  if char_length(v_name) not between 1 and 20 then raise exception 'invalid_name'; end if;
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

create or replace function public.heartbeat(p_room text default 'main')
returns void
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  insert into heartbeats (room_id, user_id)
  select p_room, uid where exists (select 1 from room_players where room_id = p_room and user_id = uid)
  on conflict (room_id, user_id) do update set last_seen = now();
  perform _prune_stale(p_room);
end $$;
