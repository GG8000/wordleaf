-- Wordleaf: card shuffle.
-- If the host allows it, every player may swap their clover for five new cards once
-- per game while writing (before submitting). The new cards follow the room's level.
-- clovers.shuffled is public so the other players can see (and animate) the shuffle.

alter table public.rooms add column allow_shuffle boolean not null default true;
alter table public.clovers add column shuffled boolean not null default false;

-- Deal 5 cards (4 on the board, 1 decoy) to one player. Returns the words used.
create or replace function public._deal_clover(p_room text, p_user uuid, p_used text[])
returns text[]
language plpgsql security definer set search_path = public as $$
declare r rooms; v_words text[]; v_rot int[]; v_roles int[]; k int; v_card uuid;
begin
  select * into r from rooms where id = p_room;
  select array_agg(floor(random() * 4)::int) into v_rot from generate_series(1, 4);
  v_words := _clover_words(r.card_lang, r.level, p_used, v_rot);
  if cardinality(v_words) < 20 then raise exception 'not_enough_words'; end if;
  -- roles 0-3 = board slots, 4 = decoy; shuffled so insert order leaks nothing
  select array_agg(x order by random()) into v_roles from unnest(array[0, 1, 2, 3, 4]) x;
  foreach k in array v_roles loop
    insert into cards (room_id, owner_id, words, tray_order)
    values (p_room, p_user, v_words[k * 4 + 1 : k * 4 + 4], floor(random() * 1000000)::int)
    returning id into v_card;
    insert into solutions (card_id, room_id, owner_id, slot, rotation)
    values (v_card, p_room, p_user,
            case when k = 4 then null else k end,
            case when k = 4 then 0 else v_rot[k + 1] end);
  end loop;
  return v_words;
end $$;

create or replace function public._start_game(p_room text)
returns void
language plpgsql security definer set search_path = public as $$
declare v_used text[] := '{}'; p record;
begin
  delete from clovers where room_id = p_room;
  for p in select user_id, name from room_players where room_id = p_room loop
    insert into clovers (room_id, owner_id, owner_name) values (p_room, p.user_id, p.name);
    v_used := v_used || _deal_clover(p_room, p.user_id, v_used);
  end loop;

  update rooms set
    status = 'writing', turn_order = '{}', current_turn = 0,
    attempt = 1, revealing = false, guess_state = '{}', locked_slots = '{}',
    score = 0, updated_at = now()
  where id = p_room;
end $$;

revoke all on function public._deal_clover(text, uuid, text[]) from public, anon, authenticated;

create or replace function public.shuffle_clover(p_room text default 'main')
returns void
language plpgsql security definer set search_path = public as $$
declare uid uuid; r rooms; c clovers; v_used text[];
begin
  uid := _require_player(p_room);
  r := _lock_room(p_room);
  if r.status <> 'writing' then raise exception 'wrong_phase'; end if;
  if not r.allow_shuffle then raise exception 'shuffle_disabled'; end if;
  select * into c from clovers where room_id = p_room and owner_id = uid;
  if not found then raise exception 'no_clover'; end if;
  if c.shuffled then raise exception 'already_shuffled'; end if;
  if c.submitted then raise exception 'already_submitted'; end if;

  -- Every word in play stays taken, including the old ones, so the new cards are fresh
  select coalesce(array_agg(w), '{}') into v_used from cards, unnest(words) w where room_id = p_room;
  delete from cards where room_id = p_room and owner_id = uid;  -- cascades to solutions
  perform _deal_clover(p_room, uid, v_used);
  -- Updating the clover row last makes realtime refetch the new cards
  update clovers set shuffled = true, clues = null where room_id = p_room and owner_id = uid;
end $$;

-- set_settings gains p_allow_shuffle (null = keep)
drop function public.set_settings(text, int, text);

create function public.set_settings(
  p_card_lang text, p_level int, p_room text default 'main', p_allow_shuffle boolean default null
) returns void
language plpgsql security definer set search_path = public as $$
declare uid uuid; r rooms; v_shuffle boolean;
begin
  uid := _require_player(p_room);
  r := _lock_room(p_room);
  if r.host_id is distinct from uid then raise exception 'not_host'; end if;
  if r.status <> 'lobby' then raise exception 'wrong_phase'; end if;
  if p_card_lang not in ('en', 'de', 'fr') then raise exception 'invalid_language'; end if;
  if p_level not between 1 and 3 then raise exception 'invalid_level'; end if;
  v_shuffle := coalesce(p_allow_shuffle, r.allow_shuffle);
  if r.card_lang = p_card_lang and r.level = p_level and r.allow_shuffle = v_shuffle then return; end if;

  update rooms set card_lang = p_card_lang, level = p_level, allow_shuffle = v_shuffle, updated_at = now()
  where id = p_room;
  update room_players set ready = false where room_id = p_room and ready;
end $$;

grant execute on function
  public.shuffle_clover(text), public.set_settings(text, int, text, boolean)
to authenticated;
revoke execute on function
  public.shuffle_clover(text), public.set_settings(text, int, text, boolean)
from public, anon;
