-- Wordleaf: schema, RLS and realtime.
-- All writes go through the security-definer RPCs in 0002_functions.sql;
-- clients only get SELECT access here.

create extension if not exists pgcrypto;

-- Word pool per card language
create table public.words (
  id    bigint generated always as identity primary key,
  lang  text not null check (lang in ('en', 'de', 'fr')),
  word  text not null,
  unique (lang, word)
);

-- One row per lobby. The MVP uses a single row with id 'main'.
create table public.rooms (
  id            text primary key,
  host_id       uuid references auth.users (id) on delete set null,
  status        text not null default 'lobby'
                check (status in ('lobby', 'writing', 'guessing', 'finished')),
  card_lang     text not null default 'de' check (card_lang in ('en', 'de', 'fr')),
  turn_order    uuid[] not null default '{}',   -- clover owners in guessing order
  current_turn  int not null default 0,         -- 0-based index into turn_order
  attempt       int not null default 1,         -- 1 or 2
  revealing     boolean not null default false, -- current clover scored, solution shown
  guess_state   jsonb not null default '{}',    -- { "<card_id>": { "slot": 0-3|null, "rotation": 0-3 } }
  locked_slots  int[] not null default '{}',    -- slots confirmed correct after attempt 1
  score         int not null default 0,
  updated_at    timestamptz not null default now()
);

insert into public.rooms (id) values ('main');

create table public.room_players (
  room_id    text not null references public.rooms (id) on delete cascade,
  user_id    uuid not null references auth.users (id) on delete cascade,
  name       text not null check (char_length(name) between 1 and 20),
  joined_at  timestamptz not null default now(),
  primary key (room_id, user_id)
);

-- One clover per player per game
create table public.clovers (
  room_id    text not null references public.rooms (id) on delete cascade,
  owner_id   uuid not null references auth.users (id) on delete cascade,
  owner_name text not null,
  clues      text[],                            -- [top, right, bottom, left]
  submitted  boolean not null default false,
  points     int,
  revealed   boolean not null default false,
  primary key (room_id, owner_id)
);

-- Word cards: 5 per clover (4 placed + 1 decoy). Public, holds no solution.
create table public.cards (
  id          uuid primary key default gen_random_uuid(),
  room_id     text not null,
  owner_id    uuid not null,
  words       text[] not null check (array_length(words, 1) = 4), -- [top, right, bottom, left] at rotation 0
  tray_order  int not null,
  foreign key (room_id, owner_id) references public.clovers (room_id, owner_id) on delete cascade
);

-- Secret placement of each card. slot null = decoy.
create table public.solutions (
  card_id   uuid primary key references public.cards (id) on delete cascade,
  room_id   text not null,
  owner_id  uuid not null,
  slot      int check (slot between 0 and 3),
  rotation  int not null check (rotation between 0 and 3)
);

create index on public.cards (room_id, owner_id);
create index on public.solutions (room_id, owner_id);

-- RLS -------------------------------------------------------------------------

alter table public.words        enable row level security;
alter table public.rooms        enable row level security;
alter table public.room_players enable row level security;
alter table public.clovers      enable row level security;
alter table public.cards        enable row level security;
alter table public.solutions    enable row level security;

create policy "read rooms"   on public.rooms        for select to authenticated using (true);
create policy "read players" on public.room_players for select to authenticated using (true);
create policy "read clovers" on public.clovers      for select to authenticated using (true);
create policy "read cards"   on public.cards        for select to authenticated using (true);

-- Solutions: only your own, or any clover that has already been revealed
create policy "read own or revealed solutions" on public.solutions
  for select to authenticated
  using (
    owner_id = auth.uid()
    or exists (
      select 1 from public.clovers c
      where c.room_id = solutions.room_id and c.owner_id = solutions.owner_id and c.revealed
    )
  );

-- words: no policy, so it is only reachable via RPCs

-- Realtime --------------------------------------------------------------------

alter publication supabase_realtime add table public.rooms, public.room_players, public.clovers;
