-- Wordleaf: the chat stays on during the game.
-- The host still turns it on in the lobby, but can turn it off any time. While a clover is
-- being guessed, its author stays silent, so they can't chat either.

-- Host only. Unlike set_settings this keeps everyone's ready.
create or replace function public.set_chat(p_enabled boolean, p_room text default 'main')
returns void
language plpgsql security definer set search_path = public as $$
declare uid uuid; r rooms;
begin
  uid := _require_player(p_room);
  r := _lock_room(p_room);
  if r.host_id is distinct from uid then raise exception 'not_host'; end if;
  if r.allow_chat = p_enabled then return; end if;
  if p_enabled and r.status <> 'lobby' then raise exception 'wrong_phase'; end if;
  update rooms set allow_chat = p_enabled, updated_at = now() where id = p_room;
  if not p_enabled then delete from chat_messages where room_id = p_room; end if;
end $$;

create or replace function public.send_chat(p_body text, p_room text default 'main')
returns void
language plpgsql security definer set search_path = public as $$
declare uid uuid; r rooms; v_body text; v_name text;
begin
  uid := _require_player(p_room);
  select * into r from rooms where id = p_room;
  if not r.allow_chat then raise exception 'chat_disabled'; end if;
  -- The author of the clover being guessed must not give hints
  if r.status = 'guessing' and not r.revealing and r.turn_order[r.current_turn + 1] = uid then
    raise exception 'author_must_be_silent';
  end if;
  v_body := btrim(regexp_replace(coalesce(p_body, ''), '[[:space:]]+', ' ', 'g'));
  if char_length(v_body) not between 1 and 200 then raise exception 'invalid_message'; end if;
  if not _chat_is_kind(v_body) then raise exception 'chat_not_nice'; end if;
  -- At most 5 messages per 10 seconds per player
  if (select count(*) from chat_messages
      where room_id = p_room and user_id = uid and created_at > now() - interval '10 seconds') >= 5
  then raise exception 'chat_too_fast'; end if;

  select name into v_name from room_players where room_id = p_room and user_id = uid;
  insert into chat_messages (room_id, user_id, name, body) values (p_room, uid, v_name, v_body);
  delete from chat_messages
  where room_id = p_room
    and id <= (select id from chat_messages where room_id = p_room order by id desc offset 100 limit 1);
end $$;
