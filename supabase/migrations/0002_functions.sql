-- So Kleever: game logic as RPCs. Every function locks the room row first so
-- concurrent calls are serialised.

-- Scoring constants
create or replace function public._points_perfect_first() returns int
language sql immutable as $$ select 6 $$;
create or replace function public._points_per_card_second() returns int
language sql immutable as $$ select 1 $$;

-- Internal helpers -------------------------------------------------------------

create or replace function public._lock_room(p_room text)
returns public.rooms
language plpgsql security definer set search_path = public as $$
declare r rooms;
begin
  select * into r from rooms where id = p_room for update;
  if not found then raise exception 'room_not_found'; end if;
  return r;
end $$;

create or replace function public._require_player(p_room text)
returns uuid
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  if not exists (select 1 from room_players where room_id = p_room and user_id = uid) then
    raise exception 'not_in_room';
  end if;
  return uid;
end $$;

-- Reset the room to an empty lobby state (keeps players)
create or replace function public._reset_game(p_room text)
returns void
language plpgsql security definer set search_path = public as $$
begin
  delete from clovers where room_id = p_room;  -- cascades to cards and solutions
  update rooms set
    status = 'lobby', turn_order = '{}', current_turn = 0, attempt = 1,
    revealing = false, guess_state = '{}', locked_slots = '{}', updated_at = now()
  where id = p_room;
end $$;

-- Prepare the shared guessing board for the clover at current_turn
create or replace function public._setup_turn(p_room text)
returns void
language plpgsql security definer set search_path = public as $$
declare r rooms; v_owner uuid;
begin
  select * into r from rooms where id = p_room;
  if r.current_turn >= coalesce(array_length(r.turn_order, 1), 0) then
    update rooms set status = 'finished', revealing = false, guess_state = '{}',
      locked_slots = '{}', updated_at = now()
    where id = p_room;
    return;
  end if;

  v_owner := r.turn_order[r.current_turn + 1];
  update rooms set
    status = 'guessing', attempt = 1, revealing = false, locked_slots = '{}', updated_at = now(),
    guess_state = coalesce((
      select jsonb_object_agg(c.id::text,
               jsonb_build_object('slot', null, 'rotation', floor(random() * 4)::int))
      from cards c where c.room_id = p_room and c.owner_id = v_owner
    ), '{}')
  where id = p_room;
end $$;

-- Move from writing to guessing. Players who did not submit are dropped.
create or replace function public._start_guessing(p_room text)
returns void
language plpgsql security definer set search_path = public as $$
declare v_order uuid[];
begin
  delete from clovers where room_id = p_room and not submitted;
  select coalesce(array_agg(owner_id order by random()), '{}') into v_order
  from clovers where room_id = p_room;

  if array_length(v_order, 1) is null then
    perform _reset_game(p_room);
    return;
  end if;

  update rooms set turn_order = v_order, current_turn = 0 where id = p_room;
  perform _setup_turn(p_room);
end $$;

-- Remove a player from the room and repair game state around the gap
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

  if r.status = 'writing' then
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

revoke all on function public._lock_room(text)             from public, anon, authenticated;
revoke all on function public._require_player(text)        from public, anon, authenticated;
revoke all on function public._reset_game(text)            from public, anon, authenticated;
revoke all on function public._setup_turn(text)            from public, anon, authenticated;
revoke all on function public._start_guessing(text)        from public, anon, authenticated;
revoke all on function public._remove_player(text, uuid)   from public, anon, authenticated;

-- Public RPCs -----------------------------------------------------------------

create or replace function public.join_room(p_name text, p_room text default 'main')
returns void
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); r rooms; v_name text := trim(p_name);
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  if char_length(v_name) not between 1 and 20 then raise exception 'invalid_name'; end if;
  r := _lock_room(p_room);

  if exists (select 1 from room_players where room_id = p_room and user_id = uid) then
    update room_players set name = v_name where room_id = p_room and user_id = uid;
    return;
  end if;

  if r.status not in ('lobby', 'finished') then raise exception 'game_in_progress'; end if;
  if (select count(*) from room_players where room_id = p_room) >= 10 then
    raise exception 'room_full';
  end if;

  insert into room_players (room_id, user_id, name) values (p_room, uid, v_name);

  if r.host_id is null
     or not exists (select 1 from room_players where room_id = p_room and user_id = r.host_id) then
    update rooms set host_id = uid where id = p_room;
  end if;
  update rooms set updated_at = now() where id = p_room;
end $$;

create or replace function public.leave_room(p_room text default 'main')
returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  perform _remove_player(p_room, auth.uid());
end $$;

create or replace function public.kick_player(p_user uuid, p_room text default 'main')
returns void
language plpgsql security definer set search_path = public as $$
declare r rooms;
begin
  perform _require_player(p_room);
  select * into r from rooms where id = p_room;
  if r.host_id is distinct from auth.uid() then raise exception 'not_host'; end if;
  if p_user = auth.uid() then raise exception 'cannot_kick_self'; end if;
  perform _remove_player(p_room, p_user);
end $$;

create or replace function public.start_game(p_card_lang text, p_room text default 'main')
returns void
language plpgsql security definer set search_path = public as $$
declare
  uid uuid; r rooms; n int; w text[]; idx int := 1;
  p record; roles int[]; k int; v_card uuid;
begin
  uid := _require_player(p_room);
  r := _lock_room(p_room);
  if r.host_id is distinct from uid then raise exception 'not_host'; end if;
  if r.status not in ('lobby', 'finished') then raise exception 'game_in_progress'; end if;
  if p_card_lang not in ('en', 'de', 'fr') then raise exception 'invalid_language'; end if;

  select count(*) into n from room_players where room_id = p_room;
  if n < 2 or n > 10 then raise exception 'need_2_to_10_players'; end if;

  select array_agg(word) into w from (
    select word from words where lang = p_card_lang order by random() limit n * 20
  ) s;
  if coalesce(array_length(w, 1), 0) < n * 20 then raise exception 'not_enough_words'; end if;

  delete from clovers where room_id = p_room;

  for p in select user_id, name from room_players where room_id = p_room loop
    insert into clovers (room_id, owner_id, owner_name) values (p_room, p.user_id, p.name);
    -- roles 0-3 = board slots, 4 = decoy; shuffled so insert order leaks nothing
    select array_agg(x order by random()) into roles from unnest(array[0, 1, 2, 3, 4]) x;
    for k in 1..5 loop
      insert into cards (room_id, owner_id, words, tray_order)
      values (p_room, p.user_id, w[idx:idx + 3], floor(random() * 1000000)::int)
      returning id into v_card;
      idx := idx + 4;
      insert into solutions (card_id, room_id, owner_id, slot, rotation)
      values (v_card, p_room, p.user_id,
              case when roles[k] = 4 then null else roles[k] end,
              case when roles[k] = 4 then 0 else floor(random() * 4)::int end);
    end loop;
  end loop;

  update rooms set
    status = 'writing', card_lang = p_card_lang, turn_order = '{}', current_turn = 0,
    attempt = 1, revealing = false, guess_state = '{}', locked_slots = '{}',
    score = 0, updated_at = now()
  where id = p_room;
end $$;

create or replace function public.submit_clues(p_clues text[], p_room text default 'main')
returns void
language plpgsql security definer set search_path = public as $$
declare uid uuid; r rooms; c text; v_clues text[] := '{}';
begin
  uid := _require_player(p_room);
  r := _lock_room(p_room);
  if r.status <> 'writing' then raise exception 'wrong_phase'; end if;
  if coalesce(array_length(p_clues, 1), 0) <> 4 then raise exception 'need_4_clues'; end if;

  foreach c in array p_clues loop
    c := trim(c);
    if c is null or char_length(c) not between 1 and 30 or c ~ '\s' then
      raise exception 'clue_must_be_one_word';
    end if;
    v_clues := v_clues || c;
  end loop;

  update clovers set clues = v_clues, submitted = true
  where room_id = p_room and owner_id = uid;
  if not found then raise exception 'no_clover'; end if;

  if not exists (select 1 from clovers where room_id = p_room and not submitted) then
    perform _start_guessing(p_room);
  end if;
  update rooms set updated_at = now() where id = p_room;
end $$;

-- Let a player take back their clues while others are still writing
create or replace function public.edit_clues(p_room text default 'main')
returns void
language plpgsql security definer set search_path = public as $$
declare uid uuid; r rooms;
begin
  uid := _require_player(p_room);
  r := _lock_room(p_room);
  if r.status <> 'writing' then raise exception 'wrong_phase'; end if;
  update clovers set submitted = false where room_id = p_room and owner_id = uid;
end $$;

create or replace function public.force_guessing(p_room text default 'main')
returns void
language plpgsql security definer set search_path = public as $$
declare uid uuid; r rooms;
begin
  uid := _require_player(p_room);
  r := _lock_room(p_room);
  if r.host_id is distinct from uid then raise exception 'not_host'; end if;
  if r.status <> 'writing' then raise exception 'wrong_phase'; end if;
  perform _start_guessing(p_room);
end $$;

-- Place a card (p_slot 0-3) or put it back in the tray (p_slot null)
create or replace function public.move_card(
  p_card uuid, p_slot int, p_rotation int, p_room text default 'main')
returns void
language plpgsql security definer set search_path = public as $$
declare uid uuid; r rooms; v_cur jsonb; v_state jsonb;
begin
  uid := _require_player(p_room);
  r := _lock_room(p_room);
  if r.status <> 'guessing' or r.revealing then raise exception 'wrong_phase'; end if;
  if r.turn_order[r.current_turn + 1] = uid then raise exception 'author_cannot_guess'; end if;
  if p_slot is not null and p_slot not between 0 and 3 then raise exception 'invalid_slot'; end if;
  if p_rotation not between 0 and 3 then raise exception 'invalid_rotation'; end if;

  v_cur := r.guess_state -> p_card::text;
  if v_cur is null then raise exception 'unknown_card'; end if;
  if (v_cur ->> 'slot')::int = any (r.locked_slots) then raise exception 'card_locked'; end if;
  if p_slot = any (r.locked_slots) then raise exception 'slot_locked'; end if;

  -- Place the card; a card already in the target slot goes back to the tray
  select jsonb_object_agg(k,
           case
             when k = p_card::text then jsonb_build_object('slot', p_slot, 'rotation', p_rotation)
             when p_slot is not null and (v ->> 'slot')::int = p_slot
               then jsonb_set(v, '{slot}', 'null'::jsonb)
             else v
           end)
  into v_state
  from jsonb_each(r.guess_state) e(k, v);

  update rooms set guess_state = v_state, updated_at = now() where id = p_room;
end $$;

create or replace function public.submit_guess(p_room text default 'main')
returns void
language plpgsql security definer set search_path = public as $$
declare
  uid uuid; r rooms; v_owner uuid; v_placed int; v_correct int[]; v_points int;
begin
  uid := _require_player(p_room);
  r := _lock_room(p_room);
  if r.status <> 'guessing' or r.revealing then raise exception 'wrong_phase'; end if;
  v_owner := r.turn_order[r.current_turn + 1];
  if v_owner = uid then raise exception 'author_cannot_guess'; end if;

  select count(*) into v_placed
  from jsonb_each(r.guess_state) e(k, v) where v ->> 'slot' is not null;
  if v_placed <> 4 then raise exception 'place_4_cards'; end if;

  select coalesce(array_agg((e.v ->> 'slot')::int), '{}') into v_correct
  from jsonb_each(r.guess_state) e(k, v)
  join solutions s on s.card_id = e.k::uuid
  where e.v ->> 'slot' is not null
    and s.slot = (e.v ->> 'slot')::int
    and s.rotation = (e.v ->> 'rotation')::int;

  if r.attempt = 1 and coalesce(array_length(v_correct, 1), 0) < 4 then
    -- Keep correct cards locked in place, send the rest back to the tray
    update rooms set
      attempt = 2,
      locked_slots = v_correct,
      guess_state = (
        select jsonb_object_agg(k,
                 case when (v ->> 'slot')::int = any (v_correct) then v
                      else jsonb_set(v, '{slot}', 'null'::jsonb) end)
        from jsonb_each(r.guess_state) e(k, v)
      ),
      updated_at = now()
    where id = p_room;
    return;
  end if;

  v_points := case when r.attempt = 1 then _points_perfect_first()
                   else coalesce(array_length(v_correct, 1), 0) * _points_per_card_second() end;

  update clovers set points = v_points, revealed = true
  where room_id = p_room and owner_id = v_owner;
  update rooms set
    score = score + v_points, revealing = true, locked_slots = v_correct, updated_at = now()
  where id = p_room;
end $$;

-- After the reveal, anyone moves the table on to the next clover
create or replace function public.next_clover(p_room text default 'main')
returns void
language plpgsql security definer set search_path = public as $$
declare r rooms;
begin
  perform _require_player(p_room);
  r := _lock_room(p_room);
  if r.status <> 'guessing' or not r.revealing then raise exception 'wrong_phase'; end if;
  update rooms set current_turn = current_turn + 1 where id = p_room;
  perform _setup_turn(p_room);
end $$;

create or replace function public.back_to_lobby(p_room text default 'main')
returns void
language plpgsql security definer set search_path = public as $$
declare uid uuid; r rooms;
begin
  uid := _require_player(p_room);
  r := _lock_room(p_room);
  if r.host_id is distinct from uid then raise exception 'not_host'; end if;
  perform _reset_game(p_room);
end $$;

grant execute on function
  public.join_room(text, text), public.leave_room(text), public.kick_player(uuid, text),
  public.start_game(text, text), public.submit_clues(text[], text), public.edit_clues(text),
  public.force_guessing(text), public.move_card(uuid, int, int, text),
  public.submit_guess(text), public.next_clover(text), public.back_to_lobby(text)
to authenticated;

revoke execute on function
  public.join_room(text, text), public.leave_room(text), public.kick_player(uuid, text),
  public.start_game(text, text), public.submit_clues(text[], text), public.edit_clues(text),
  public.force_guessing(text), public.move_card(uuid, int, int, text),
  public.submit_guess(text), public.next_clover(text), public.back_to_lobby(text)
from public, anon;
