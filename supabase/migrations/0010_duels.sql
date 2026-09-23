-- Wordleaf: asynchronous duels.
-- Two players, no need to be online at the same time. Each writes their clover whenever they
-- like; once both have submitted, each solves the other's clover alone (2 attempts, as in the
-- live game). The score is shared, so the best duel is 12. A player can have any number of
-- duels running, and duels have no heartbeat or timeout.
-- Duels live in their own tables, so none of the live-room rules (one room per player,
-- heartbeats, stale players) apply. Word selection and scoring are shared with live rooms.
--
--   waiting ──join──► writing ──both submitted──► guessing ──both solved──► finished
--
-- Every RPC that the other player should hear about writes a row to `notifications`.
-- 0011_push.sql turns those rows into push messages.

create table public.duels (
  id             text primary key,   -- 4-character code, shared with room codes
  card_lang      text not null default 'de' check (card_lang in ('en', 'de', 'fr')),
  level          int not null default 2 check (level between 1 and 3),
  allow_shuffle  boolean not null default true,
  status         text not null default 'waiting'
                 check (status in ('waiting', 'writing', 'guessing', 'finished', 'abandoned')),
  created_by     uuid references auth.users (id) on delete set null,
  rematch_id     text,               -- set once someone asks for a rematch
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create table public.duel_players (
  duel_id    text not null references public.duels (id) on delete cascade,
  user_id    uuid not null references auth.users (id) on delete cascade,
  name       text not null check (char_length(name) between 1 and 20),
  joined_at  timestamptz not null default now(),
  clues      text[],                            -- [top, right, bottom, left]
  submitted  boolean not null default false,
  shuffled   boolean not null default false,
  points     int,                               -- what the opponent scored on this clover; null = not solved yet
  primary key (duel_id, user_id)
);
create index on public.duel_players (user_id);

-- Same shape as cards/solutions
create table public.duel_cards (
  id          uuid primary key default gen_random_uuid(),
  duel_id     text not null references public.duels (id) on delete cascade,
  owner_id    uuid not null,
  words       text[] not null check (array_length(words, 1) = 4),
  tray_order  int not null
);
create index on public.duel_cards (duel_id, owner_id);

create table public.duel_solutions (
  card_id   uuid primary key references public.duel_cards (id) on delete cascade,
  duel_id   text not null references public.duels (id) on delete cascade,
  owner_id  uuid not null,
  slot      int check (slot between 0 and 3),
  rotation  int not null check (rotation between 0 and 3)
);
create index on public.duel_solutions (duel_id, owner_id);

-- Each player's own board for the opponent's clover (live rooms share one in rooms.guess_state)
create table public.duel_guesses (
  duel_id       text not null references public.duels (id) on delete cascade,
  guesser_id    uuid not null,
  owner_id      uuid not null,
  state         jsonb not null default '{}',   -- { "<card_id>": { "slot": 0-3|null, "rotation": 0-3 } }
  attempt       int not null default 1,
  locked_slots  int[] not null default '{}',
  done          boolean not null default false,
  updated_at    timestamptz not null default now(),
  primary key (duel_id, guesser_id)
);

-- Outbox for push messages to the other player (see 0011_push.sql). No client access.
create table public.notifications (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references auth.users (id) on delete cascade,
  kind        text not null check (kind in ('opponent_joined', 'opponent_submitted', 'opponent_solved', 'rematch', 'opponent_left')),
  duel_id     text not null,
  actor_name  text not null,
  points      int,
  created_at  timestamptz not null default now()
);

-- RLS -------------------------------------------------------------------------

alter table public.duels          enable row level security;
alter table public.duel_players   enable row level security;
alter table public.duel_cards     enable row level security;
alter table public.duel_solutions enable row level security;
alter table public.duel_guesses   enable row level security;
alter table public.notifications  enable row level security;

create or replace function public._is_duel_member(p_duel text)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from duel_players where duel_id = p_duel and user_id = auth.uid())
$$;
revoke all on function public._is_duel_member(text) from public, anon;
grant execute on function public._is_duel_member(text) to authenticated;

create policy "read own duels" on public.duels
  for select to authenticated using (_is_duel_member(id));
create policy "read players of own duels" on public.duel_players
  for select to authenticated using (_is_duel_member(duel_id));
create policy "read cards of own duels" on public.duel_cards
  for select to authenticated using (_is_duel_member(duel_id));
-- The author may watch the opponent's board, like in live rooms
create policy "read guesses of own duels" on public.duel_guesses
  for select to authenticated using (_is_duel_member(duel_id));
-- Solutions: your own, or a clover that has been solved
create policy "read own or solved duel solutions" on public.duel_solutions
  for select to authenticated
  using (
    _is_duel_member(duel_id)
    and (
      owner_id = auth.uid()
      or exists (
        select 1 from public.duel_players p
        where p.duel_id = duel_solutions.duel_id and p.user_id = duel_solutions.owner_id
          and p.points is not null
      )
    )
  );
-- notifications: no policy

alter publication supabase_realtime add table public.duels, public.duel_players, public.duel_guesses;

-- Codes -----------------------------------------------------------------------

-- Room and duel codes share one namespace, so a code is never ambiguous
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
    exit when not exists (select 1 from rooms where id = v_code)
          and not exists (select 1 from duels where id = v_code);
  end loop;
  return v_code;
end $$;

-- Internal helpers ------------------------------------------------------------

create or replace function public._lock_duel(p_duel text)
returns public.duels
language plpgsql security definer set search_path = public as $$
declare d duels;
begin
  select * into d from duels where id = upper(trim(p_duel)) for update;
  if not found then raise exception 'duel_not_found'; end if;
  return d;
end $$;

create or replace function public._require_duel_player(p_duel text)
returns uuid
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  if not exists (select 1 from duel_players where duel_id = upper(trim(p_duel)) and user_id = uid) then
    raise exception 'not_in_duel';
  end if;
  return uid;
end $$;

create or replace function public._duel_opponent(p_duel text, p_user uuid)
returns uuid
language sql stable security definer set search_path = public as $$
  select user_id from duel_players where duel_id = p_duel and user_id <> p_user limit 1
$$;

-- Tell the other player about something the caller did
create or replace function public._notify_opponent(p_duel text, p_kind text, p_points int default null)
returns void
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); v_other uuid; v_name text;
begin
  v_other := _duel_opponent(p_duel, uid);
  if v_other is null then return; end if;
  select name into v_name from duel_players where duel_id = p_duel and user_id = uid;
  insert into notifications (user_id, kind, duel_id, actor_name, points)
  values (v_other, p_kind, p_duel, coalesce(v_name, '?'), p_points);
end $$;

-- Deal 5 cards (4 on the board, 1 decoy) to one player. Same as _deal_clover in 0006.
create or replace function public._deal_duel_clover(p_duel text, p_user uuid, p_used text[])
returns text[]
language plpgsql security definer set search_path = public as $$
declare d duels; v_words text[]; v_rot int[]; v_roles int[]; k int; v_card uuid;
begin
  select * into d from duels where id = p_duel;
  select array_agg(floor(random() * 4)::int) into v_rot from generate_series(1, 4);
  v_words := _clover_words(d.card_lang, d.level, p_used, v_rot);
  if cardinality(v_words) < 20 then raise exception 'not_enough_words'; end if;
  select array_agg(x order by random()) into v_roles from unnest(array[0, 1, 2, 3, 4]) x;
  foreach k in array v_roles loop
    insert into duel_cards (duel_id, owner_id, words, tray_order)
    values (p_duel, p_user, v_words[k * 4 + 1 : k * 4 + 4], floor(random() * 1000000)::int)
    returning id into v_card;
    insert into duel_solutions (card_id, duel_id, owner_id, slot, rotation)
    values (v_card, p_duel, p_user,
            case when k = 4 then null else k end,
            case when k = 4 then 0 else v_rot[k + 1] end);
  end loop;
  return v_words;
end $$;

-- Deal both clovers and move to writing
create or replace function public._start_duel(p_duel text)
returns void
language plpgsql security definer set search_path = public as $$
declare v_used text[] := '{}'; p record;
begin
  delete from duel_cards where duel_id = p_duel;
  delete from duel_guesses where duel_id = p_duel;
  update duel_players set clues = null, submitted = false, shuffled = false, points = null
  where duel_id = p_duel;
  for p in select user_id from duel_players where duel_id = p_duel order by joined_at loop
    v_used := v_used || _deal_duel_clover(p_duel, p.user_id, v_used);
  end loop;
  update duels set status = 'writing', updated_at = now() where id = p_duel;
end $$;

-- Both clovers are in: give each player a board for the other's clover
create or replace function public._start_duel_guessing(p_duel text)
returns void
language plpgsql security definer set search_path = public as $$
declare p record; v_other uuid;
begin
  for p in select user_id from duel_players where duel_id = p_duel loop
    v_other := _duel_opponent(p_duel, p.user_id);
    insert into duel_guesses (duel_id, guesser_id, owner_id, state)
    values (p_duel, p.user_id, v_other, coalesce((
      select jsonb_object_agg(c.id::text,
               jsonb_build_object('slot', null, 'rotation', floor(random() * 4)::int))
      from duel_cards c where c.duel_id = p_duel and c.owner_id = v_other
    ), '{}'))
    on conflict (duel_id, guesser_id) do nothing;
  end loop;
  update duels set status = 'guessing', updated_at = now() where id = p_duel;
end $$;

revoke all on function public._lock_duel(text)                         from public, anon, authenticated;
revoke all on function public._require_duel_player(text)               from public, anon, authenticated;
revoke all on function public._duel_opponent(text, uuid)               from public, anon, authenticated;
revoke all on function public._notify_opponent(text, text, int)        from public, anon, authenticated;
revoke all on function public._deal_duel_clover(text, uuid, text[])    from public, anon, authenticated;
revoke all on function public._start_duel(text)                        from public, anon, authenticated;
revoke all on function public._start_duel_guessing(text)               from public, anon, authenticated;

-- RPCs ------------------------------------------------------------------------

-- Open a duel and wait for someone to join with the code. Returns the code.
-- Also clears out old duels: unanswered after 7 days, anything idle for 30.
create or replace function public.create_duel(
  p_name text, p_card_lang text default 'de', p_level int default 2, p_allow_shuffle boolean default true)
returns text
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); v_name text := trim(p_name); v_code text;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  if char_length(v_name) not between 1 and 20 then raise exception 'invalid_name'; end if;
  if p_card_lang not in ('en', 'de', 'fr') then raise exception 'invalid_lang'; end if;
  if p_level not between 1 and 3 then raise exception 'invalid_level'; end if;

  delete from duels
  where (status = 'waiting' and updated_at < now() - interval '7 days')
     or updated_at < now() - interval '30 days';
  delete from notifications where created_at < now() - interval '7 days';

  v_code := _new_code();
  insert into duels (id, card_lang, level, allow_shuffle, created_by)
  values (v_code, p_card_lang, p_level, coalesce(p_allow_shuffle, true), uid);
  insert into duel_players (duel_id, user_id, name) values (v_code, uid, v_name);
  return v_code;
end $$;

-- Join as the second player (deals the cards), or rename yourself in a duel you're in
create or replace function public.join_duel(p_duel text, p_name text)
returns void
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); d duels; v_name text := trim(p_name);
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  if char_length(v_name) not between 1 and 20 then raise exception 'invalid_name'; end if;
  d := _lock_duel(p_duel);

  if exists (select 1 from duel_players where duel_id = d.id and user_id = uid) then
    update duel_players set name = v_name where duel_id = d.id and user_id = uid;
    return;
  end if;
  if d.status <> 'waiting' then raise exception 'duel_full'; end if;

  insert into duel_players (duel_id, user_id, name) values (d.id, uid, v_name);
  perform _start_duel(d.id);
  perform _notify_opponent(d.id, 'opponent_joined');
end $$;

create or replace function public.shuffle_duel_clover(p_duel text)
returns void
language plpgsql security definer set search_path = public as $$
declare uid uuid; d duels; p duel_players; v_used text[];
begin
  uid := _require_duel_player(p_duel);
  d := _lock_duel(p_duel);
  if d.status <> 'writing' then raise exception 'wrong_phase'; end if;
  if not d.allow_shuffle then raise exception 'shuffle_disabled'; end if;
  select * into p from duel_players where duel_id = d.id and user_id = uid;
  if p.shuffled then raise exception 'already_shuffled'; end if;
  if p.submitted then raise exception 'already_submitted'; end if;

  select coalesce(array_agg(w), '{}') into v_used from duel_cards, unnest(words) w where duel_id = d.id;
  delete from duel_cards where duel_id = d.id and owner_id = uid;  -- cascades to solutions
  perform _deal_duel_clover(d.id, uid, v_used);
  -- Updating the player row last makes realtime refetch the new cards
  update duel_players set shuffled = true, clues = null where duel_id = d.id and user_id = uid;
  update duels set updated_at = now() where id = d.id;
end $$;

create or replace function public.submit_duel_clues(p_duel text, p_clues text[])
returns void
language plpgsql security definer set search_path = public as $$
declare uid uuid; d duels; c text; v_clues text[] := '{}';
begin
  uid := _require_duel_player(p_duel);
  d := _lock_duel(p_duel);
  if d.status <> 'writing' then raise exception 'wrong_phase'; end if;
  if coalesce(array_length(p_clues, 1), 0) <> 4 then raise exception 'need_4_clues'; end if;

  foreach c in array p_clues loop
    c := trim(c);
    if c is null or char_length(c) not between 1 and 30 or c ~ '\s' then
      raise exception 'clue_must_be_one_word';
    end if;
    v_clues := v_clues || c;
  end loop;

  update duel_players set clues = v_clues, submitted = true where duel_id = d.id and user_id = uid;
  update duels set updated_at = now() where id = d.id;

  if (select count(*) filter (where submitted) from duel_players where duel_id = d.id) = 2 then
    perform _start_duel_guessing(d.id);
    perform _notify_opponent(d.id, 'opponent_submitted');
  end if;
end $$;

-- Take your clues back while the other player is still writing
create or replace function public.edit_duel_clues(p_duel text)
returns void
language plpgsql security definer set search_path = public as $$
declare uid uuid; d duels;
begin
  uid := _require_duel_player(p_duel);
  d := _lock_duel(p_duel);
  if d.status <> 'writing' then raise exception 'wrong_phase'; end if;
  update duel_players set submitted = false where duel_id = d.id and user_id = uid;
  update duels set updated_at = now() where id = d.id;
end $$;

-- Place a card on your own board (p_slot 0-3), send it back to the tray (null) or rotate it
create or replace function public.move_duel_card(p_duel text, p_card uuid, p_slot int, p_rotation int)
returns void
language plpgsql security definer set search_path = public as $$
declare uid uuid; d duels; g duel_guesses; v_cur jsonb; v_state jsonb;
begin
  uid := _require_duel_player(p_duel);
  d := _lock_duel(p_duel);
  if d.status <> 'guessing' then raise exception 'wrong_phase'; end if;
  select * into g from duel_guesses where duel_id = d.id and guesser_id = uid;
  if not found or g.done then raise exception 'wrong_phase'; end if;
  if p_slot is not null and p_slot not between 0 and 3 then raise exception 'invalid_slot'; end if;
  if p_rotation not between 0 and 3 then raise exception 'invalid_rotation'; end if;

  v_cur := g.state -> p_card::text;
  if v_cur is null then raise exception 'unknown_card'; end if;
  if (v_cur ->> 'slot')::int = any (g.locked_slots) then raise exception 'card_locked'; end if;
  if p_slot = any (g.locked_slots) then raise exception 'slot_locked'; end if;

  select jsonb_object_agg(k,
           case
             when k = p_card::text then jsonb_build_object('slot', p_slot, 'rotation', p_rotation)
             when p_slot is not null and (v ->> 'slot')::int = p_slot
               then jsonb_set(v, '{slot}', 'null'::jsonb)
             else v
           end)
  into v_state
  from jsonb_each(g.state) e(k, v);

  update duel_guesses set state = v_state, updated_at = now() where duel_id = d.id and guesser_id = uid;
end $$;

-- Check your board. Same rules as submit_guess: perfect on attempt 1 = 6, otherwise correct
-- cards lock and attempt 2 scores 1 per correct card.
create or replace function public.submit_duel_guess(p_duel text)
returns void
language plpgsql security definer set search_path = public as $$
declare uid uuid; d duels; g duel_guesses; v_placed int; v_correct int[]; v_points int;
begin
  uid := _require_duel_player(p_duel);
  d := _lock_duel(p_duel);
  if d.status <> 'guessing' then raise exception 'wrong_phase'; end if;
  select * into g from duel_guesses where duel_id = d.id and guesser_id = uid;
  if not found or g.done then raise exception 'wrong_phase'; end if;

  select count(*) into v_placed from jsonb_each(g.state) e(k, v) where v ->> 'slot' is not null;
  if v_placed <> 4 then raise exception 'place_4_cards'; end if;

  select coalesce(array_agg((e.v ->> 'slot')::int), '{}') into v_correct
  from jsonb_each(g.state) e(k, v)
  join duel_solutions s on s.card_id = e.k::uuid
  where e.v ->> 'slot' is not null
    and s.slot = (e.v ->> 'slot')::int
    and s.rotation = (e.v ->> 'rotation')::int;

  if g.attempt = 1 and coalesce(array_length(v_correct, 1), 0) < 4 then
    update duel_guesses set
      attempt = 2,
      locked_slots = v_correct,
      state = (
        select jsonb_object_agg(k,
                 case when (v ->> 'slot')::int = any (v_correct) then v
                      else jsonb_set(v, '{slot}', 'null'::jsonb) end)
        from jsonb_each(g.state) e(k, v)
      ),
      updated_at = now()
    where duel_id = d.id and guesser_id = uid;
    update duels set updated_at = now() where id = d.id;
    return;
  end if;

  v_points := case when g.attempt = 1 then _points_perfect_first()
                   else coalesce(array_length(v_correct, 1), 0) * _points_per_card_second() end;

  update duel_guesses set done = true, locked_slots = v_correct, updated_at = now()
  where duel_id = d.id and guesser_id = uid;
  update duel_players set points = v_points where duel_id = d.id and user_id = g.owner_id;

  if not exists (select 1 from duel_guesses where duel_id = d.id and not done) then
    update duels set status = 'finished', updated_at = now() where id = d.id;
  else
    update duels set updated_at = now() where id = d.id;
  end if;
  perform _notify_opponent(d.id, 'opponent_solved', v_points);
end $$;

-- Same two players and settings, straight to writing. Both players calling it get the same
-- new duel. Returns its code.
create or replace function public.rematch_duel(p_duel text)
returns text
language plpgsql security definer set search_path = public as $$
declare uid uuid; d duels; v_code text;
begin
  uid := _require_duel_player(p_duel);
  d := _lock_duel(p_duel);
  if d.rematch_id is not null and exists (select 1 from duels where id = d.rematch_id) then
    return d.rematch_id;
  end if;
  if d.status <> 'finished' then raise exception 'wrong_phase'; end if;
  if (select count(*) from duel_players where duel_id = d.id) <> 2 then raise exception 'opponent_left'; end if;

  v_code := _new_code();
  insert into duels (id, card_lang, level, allow_shuffle, created_by)
  values (v_code, d.card_lang, d.level, d.allow_shuffle, uid);
  insert into duel_players (duel_id, user_id, name)
  select v_code, user_id, name from duel_players where duel_id = d.id;
  perform _start_duel(v_code);
  update duels set rematch_id = v_code, updated_at = now() where id = d.id;
  perform _notify_opponent(v_code, 'rematch');
  return v_code;
end $$;

-- Give up or remove a duel from your list. The other player sees it as abandoned
-- (unless it was already finished) and can remove it too; the last one out deletes it.
create or replace function public.leave_duel(p_duel text)
returns void
language plpgsql security definer set search_path = public as $$
declare uid uuid; d duels;
begin
  uid := _require_duel_player(p_duel);
  d := _lock_duel(p_duel);
  if d.status not in ('finished', 'abandoned', 'waiting') then
    perform _notify_opponent(d.id, 'opponent_left');
  end if;
  delete from duel_players where duel_id = d.id and user_id = uid;
  if not exists (select 1 from duel_players where duel_id = d.id) then
    delete from duels where id = d.id;
  elsif d.status <> 'finished' then
    update duels set status = 'abandoned', updated_at = now() where id = d.id;
  end if;
end $$;

-- The caller's duels for the overview, newest activity first
create or replace function public.my_duels()
returns table (
  id text, status text, opponent_name text, my_turn boolean, score int,
  card_lang text, level int, updated_at timestamptz
)
language sql stable security definer set search_path = public as $$
  select
    d.id, d.status, o.name,
    case d.status
      when 'writing'  then not me.submitted
      when 'guessing' then exists (
        select 1 from duel_guesses g where g.duel_id = d.id and g.guesser_id = me.user_id and not g.done)
      else false
    end,
    (select coalesce(sum(points), 0)::int from duel_players where duel_id = d.id),
    d.card_lang, d.level, d.updated_at
  from duel_players me
  join duels d on d.id = me.duel_id
  left join duel_players o on o.duel_id = d.id and o.user_id <> me.user_id
  where me.user_id = auth.uid()
  order by d.updated_at desc
$$;

grant execute on function
  public.create_duel(text, text, int, boolean), public.join_duel(text, text),
  public.shuffle_duel_clover(text), public.submit_duel_clues(text, text[]),
  public.edit_duel_clues(text), public.move_duel_card(text, uuid, int, int),
  public.submit_duel_guess(text), public.rematch_duel(text), public.leave_duel(text),
  public.my_duels()
to authenticated;
revoke execute on function
  public.create_duel(text, text, int, boolean), public.join_duel(text, text),
  public.shuffle_duel_clover(text), public.submit_duel_clues(text, text[]),
  public.edit_duel_clues(text), public.move_duel_card(text, uuid, int, int),
  public.submit_duel_guess(text), public.rematch_duel(text), public.leave_duel(text),
  public.my_duels()
from public, anon;
