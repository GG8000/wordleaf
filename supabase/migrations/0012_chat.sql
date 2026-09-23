-- Wordleaf: room chat, kind words only.
-- The host can turn a chat on in the lobby; it stays on during the game. While a clover is
-- being guessed, its author stays silent, so they can't chat either. Every message goes through send_chat(), which
-- rejects anything on a small blocklist of insults, swear words and slurs (en/de/fr) with
-- 'chat_not_nice'. Before matching, the text is normalized so the usual tricks don't slip
-- through: case, accents, leetspeak (sh1t), punctuation inside words (f.u.c.k), spaced-out
-- letters (f u c k) and stretched letters (fuuuuck).
-- A room keeps its last 100 messages. They are cleared when the host turns the chat off and
-- when the last player leaves, so the next group at the public table starts fresh.

alter table public.rooms add column allow_chat boolean not null default false;

create table public.chat_messages (
  id          bigint generated always as identity primary key,
  room_id     text not null references public.rooms (id) on delete cascade,
  user_id     uuid not null references auth.users (id) on delete cascade,
  name        text not null,
  body        text not null check (char_length(body) between 1 and 200),
  created_at  timestamptz not null default now()
);
create index chat_messages_room_idx on public.chat_messages (room_id, id);

alter table public.chat_messages enable row level security;
create policy "read chat of own room" on public.chat_messages
  for select to authenticated using (_is_member(room_id));

alter publication supabase_realtime add table public.chat_messages;

-- Kindness filter ---------------------------------------------------------------

-- Lower case, no accents, leetspeak to letters ("!" and "|" only between letters, so "Hi!" stays
-- "hi"), other punctuation dropped, runs of 3+ equal letters squeezed to one ("fuuuck" -> "fuck"),
-- single spaces.
create or replace function public._chat_normalize(p text)
returns text
language sql immutable set search_path = public as $$
  select btrim(regexp_replace(regexp_replace(regexp_replace(
    translate(regexp_replace(lower(p), '([a-z0-9$@])[!|](?=[a-z0-9$@])', '\1i', 'g'),
      'äöüßàâáãéèêëîïíìôóòõûùúçñ0134578@$€',
      'aousaaaaeeeeiiiioooouuucnoieastbase'),
    '[^a-z[:space:]]', '', 'g'),
    '(.)\1{2,}', '\1', 'g'),
    '[[:space:]]+', ' ', 'g'))
$$;

-- term is stored normalized. prefix = also matches words starting with it (fuck -> fucking).
-- Terms may be phrases ("shut up"); they match whole words only, so "classic" is fine.
create table public.chat_blocklist (
  term    text primary key,
  prefix  boolean not null default false
);
alter table public.chat_blocklist enable row level security;  -- no policies: RPC only

insert into public.chat_blocklist (term, prefix)
select _chat_normalize(t), bool_or(p) from (values
  -- English
  ('fuck', true), ('fck', true), ('fuk', true), ('fk', false), ('stfu', false), ('gtfo', false),
  ('wtf', false), ('motherfuck', true), ('shit', true), ('bullshit', true), ('bitch', true),
  ('bastard', true), ('ass', false), ('asses', false), ('asshole', true), ('arse', false),
  ('arsehole', true), ('dumbass', true), ('jackass', true), ('dick', false), ('dickhead', true),
  ('cock', false), ('cunt', true), ('twat', true), ('prick', false), ('pussy', false),
  ('whore', true), ('slut', true), ('wanker', true), ('piss', true), ('crap', true), ('damn', true),
  ('idiot', true), ('stupid', true), ('moron', true), ('dumb', false), ('dummy', false),
  ('imbecile', true), ('retard', true), ('loser', true), ('noob', true), ('ugly', false),
  ('pathetic', false), ('worthless', false), ('useless', false), ('trash', false), ('jerk', false),
  ('shut up', false), ('stfu', false), ('you suck', false), ('u suck', false), ('suck it', false),
  ('i hate you', false), ('hate you', false), ('go die', false), ('kill yourself', false),
  ('kys', false), ('nazi', true), ('hitler', true), ('nigg', true), ('fag', false), ('faggot', true),
  ('tranny', true), ('kike', false), ('spic', false), ('chink', false),
  -- German
  ('arsch', true), ('arschloch', true), ('scheis', true), ('fick', true), ('wichs', true),
  ('fotze', true), ('hure', false), ('huren', true), ('hurensohn', true), ('schlampe', true),
  ('bastard', true), ('kack', true), ('idiot', true), ('vollidiot', true), ('depp', true),
  ('trottel', true), ('dummkopf', true), ('blöd', true), ('doof', true), ('spast', true),
  ('behindert', true), ('missgeburt', true), ('penner', true), ('mistkerl', true), ('drecks', true),
  ('wixer', true), ('pisser', true), ('halt die fresse', false), ('fresse', false),
  ('halts maul', false), ('halt maul', false), ('verpiss dich', false), ('ich hasse dich', false),
  ('stirb', false), ('neger', true), ('schwuchtel', true), ('kanake', true), ('zigeuner', true),
  ('sieg heil', false), ('heil hitler', false),
  -- French
  ('merde', true), ('putain', true), ('pute', true), ('salope', true), ('salaud', true),
  ('connard', true), ('connasse', true), ('conne', false), ('con', false), ('cul', false),
  ('encule', true), ('batard', true), ('abruti', true), ('cretin', true), ('debile', true),
  ('imbecile', true), ('nique', true), ('niquer', true), ('ta gueule', false),
  ('ferme ta gueule', false), ('fdp', false), ('fils de pute', false), ('tg', false),
  ('negre', true), ('bougnoule', true), ('pede', false), ('tapette', false), ('pd', false),
  ('je te deteste', false), ('va mourir', false)
) as v(t, p)
group by 1;

create or replace function public._chat_is_kind(p_body text)
returns boolean
language plpgsql stable security definer set search_path = public as $$
declare v_words text[] := '{}'; v_run text := ''; w text; v_text text;
begin
  -- Glue runs of single letters back together: "f u c k" -> "fuck"
  foreach w in array regexp_split_to_array(_chat_normalize(p_body), ' ') loop
    if char_length(w) = 1 then
      v_run := v_run || w;
    else
      if v_run <> '' then v_words := v_words || v_run; v_run := ''; end if;
      v_words := v_words || w;
    end if;
  end loop;
  if v_run <> '' then v_words := v_words || v_run; end if;

  v_text := ' ' || array_to_string(v_words, ' ') || ' ';
  return not exists (
    select 1 from chat_blocklist b
    where v_text like '% ' || b.term || case when b.prefix then '%' else ' %' end
  );
end $$;

revoke all on function public._chat_normalize(text) from public, anon, authenticated;
revoke all on function public._chat_is_kind(text)   from public, anon, authenticated;

-- Clear the chat once a room is empty (leave, kick, stale players, host timeout)
create or replace function public._clear_chat_if_empty()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from room_players where room_id = old.room_id) then
    delete from chat_messages where room_id = old.room_id;
  end if;
  return null;
end $$;

create trigger clear_chat_if_empty after delete on public.room_players
  for each row execute function public._clear_chat_if_empty();

-- RPCs ---------------------------------------------------------------------------

-- Host only. Turning it on happens in the lobby, turning it off works any time.
-- Unlike set_settings this keeps everyone's ready.
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

-- The author or the host can remove a message
create or replace function public.delete_chat(p_id bigint, p_room text default 'main')
returns void
language plpgsql security definer set search_path = public as $$
declare uid uuid; r rooms;
begin
  uid := _require_player(p_room);
  select * into r from rooms where id = p_room;
  delete from chat_messages
  where id = p_id and room_id = p_room and (user_id = uid or r.host_id = uid);
  if not found then raise exception 'not_allowed'; end if;
end $$;

grant execute on function
  public.set_chat(boolean, text), public.send_chat(text, text), public.delete_chat(bigint, text)
to authenticated;
revoke execute on function
  public.set_chat(boolean, text), public.send_chat(text, text), public.delete_chat(bigint, text)
from public, anon;
