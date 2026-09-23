# 🍀 Wordleaf

A cooperative online word-association game for 2–10 friends. Everyone links pairs of words on their own leaf board with one-word clues, then the group works together to rebuild each other's boards. There's one shared lobby, and joining takes seconds with just a nickname.

I built Wordleaf because I wanted to play this game online with my friends while I was on a semester abroad in France.

## Credits and inspiration

Wordleaf is an unofficial fan project **inspired by the board game *So Clover!*** (German edition: *So Kleever!*), designed by François Romain and published by [Repos Production](https://www.rprod.com). If you enjoy Wordleaf, please buy and play the original.

- Wordleaf is **not affiliated with, endorsed by or sponsored by** Repos Production, Asmodee or the designer. *So Clover!* and *So Kleever!* are their trademarks.
- The name, code, visual design, rules text and word list are original. No artwork, card text or rules text from the published game are used.
- It's meant for private, non-commercial play.

## Install it as an app (Android & iOS)

Wordleaf is a Progressive Web App (PWA), so you can add it to your home screen. It then opens full screen, without the browser bar, and gets its own 🍀 icon. There's no app store and nothing to download. Game data still comes from the server, so you need an internet connection to play.

The easiest way is the **📲 Install app** button at the bottom of the page. Where the browser supports it (Chrome, Edge, Samsung Internet), it opens the install dialog right away. Otherwise it shows the steps below for your phone. The button is hidden when Wordleaf is already running as an installed app.

**Android (Chrome)**
1. Open the Wordleaf URL in Chrome.
2. Tap the **⋮** menu in the top-right corner.
3. Tap **Install app** (on some phones it's called **Add to Home screen**) and confirm with **Install**.
4. Open Wordleaf from your home screen or app drawer.

Samsung Internet, Edge and Firefox work the same way: find **Add to Home screen** or **Install** in the browser menu.

**iPhone & iPad (Safari)**
1. Open the Wordleaf URL in **Safari**. On iOS 16.3 and older, only Safari can add web apps to the home screen.
2. Tap the **Share** button (the square with an arrow pointing up). It's at the bottom of the screen on iPhone and at the top on iPad.
3. Scroll down and tap **Add to Home Screen**. If you don't see it, tap **Edit Actions…** and add it.
4. Leave **Open as Web App** turned on (iOS 26 and newer), then tap **Add**.
5. Open Wordleaf from your home screen.

To remove the app, long-press its icon and choose **Uninstall** (Android) or **Delete Bookmark** / **Remove App** (iOS).

> **For self-hosters:** installing only works over **HTTPS** (or on `localhost`). The PWA setup is `public/manifest.webmanifest`, the icons in `public/` (you can regenerate them with `scripts/make-icons.sh`) and the `apple-*` meta tags in `index.html`. If you change the name or colors, update both places.
>
> **Updates:** `vite-plugin-pwa` builds a service worker (`sw.js`) that caches each build. Installed apps check for a new version every hour and each time they come back to the foreground. Outside a room, the update applies on its own. Inside a room, players see an **Update** banner, so nobody gets reloaded in the middle of a round. Make sure your host doesn't cache `sw.js` for a long time. The Vercel and Netlify defaults are fine.

---

## 1. Game rules (as implemented)

### The clover
Every player gets a **clover**: a 2×2 board with 4 **word cards**. Each card has a word on each of its 4 edges, and it can sit on the board in any of 4 rotations.

```
            [ TOP leaf ]
          ┌──────┬──────┐
 [LEFT    │  TL  │  TR  │   [RIGHT
  leaf]   ├──────┼──────┤    leaf]
          │  BL  │  BR  │
          └──────┴──────┘
           [ BOTTOM leaf ]
```

Each **leaf** touches the outward-facing word of two cards:

| Leaf   | Words it links              |
|--------|-----------------------------|
| Top    | TL top edge + TR top edge   |
| Right  | TR right edge + BR right edge |
| Bottom | BR bottom edge + BL bottom edge |
| Left   | BL left edge + TL left edge |

The inner edges of the cards are not used.

### Phase 1: Writing (everyone at the same time)
- Each player sees their own clover. The server picks the cards and their rotations at random.
- For each leaf, the player writes **one clue that is a single word** (no spaces, max 30 characters) and links the two words.
- A player can take clues back and edit them until everyone has submitted.
- The host can **"Start guessing now"** to skip AFK players. Clovers that were not submitted are dropped.
- **Card shuffle** (the host can turn it off in the lobby): once per game, before submitting, a player can swap their 5 cards for new ones. The new cards follow the level, and the player's clues are cleared. Everyone else sees a card-flurry animation with the player's name, and a 🔀 next to their name.

### Phase 2: Guessing (one clover at a time, in random order)
1. The author's 4 cards and **1 decoy card** are shuffled and put in the tray with random rotations.
2. All other players solve it **together** on one shared board. Every move shows up live for everyone.
   - To place a card: tap it, then tap a slot. Tap ↻ to rotate it.
   - Placing a card on a filled slot sends the card that was there back to the tray.
3. The **author only watches and has to stay silent.** The server rejects any move from the author.
4. **Check** needs 4 placed cards. A card only counts if it is in the right **slot with the right rotation**.

### Levels
Every word in the pool has a theme category (animals, food, weather, …). The host picks a level in the lobby, and the room keeps it for the next game.

| Level | Clover words | Decoy card |
|-------|--------------|------------|
| 🍀 Easy | random | only themes that are **not** on the clover, so it stands out |
| 🍀🍀 Medium (default) | random | each word shares a theme with a different word next to a clue, so it looks like it belongs |
| 🍀🍀🍀 Hard | all from about 3 themes (max 7 words per theme) | from the same themes, so every card looks like it could fit |

The selection logic is `_clover_words()` in `supabase/migrations/0004_levels.sql`. New words without a category go into `misc`.

### Scoring (team score)

| Result | Points |
|--------|--------|
| All 4 right on the **1st attempt** | **6** |
| Otherwise: correct cards stay locked 🔒, the rest go back to the tray, then a **2nd attempt** | **1 per correct card** (0–4) |

- After scoring, the solution is **revealed** next to the team's guess, with correct cards green and wrong ones red. Anyone can move on to the next clover.
- The **maximum score** is `6 × number of clovers`.
- The results screen shows a rating from "Wilted leaves" to "Four-leaf legends".
- The scoring constants are the SQL functions `_points_perfect_first()` and `_points_per_card_second()` in `supabase/migrations/0002_functions.sql`.

---

## 2. Scope

### MVP (implemented)
- Login is a **nickname only**, using Supabase anonymous auth. The session is kept in the browser, so a reload keeps your seat.
- There is a **public table** (`rooms.id = 'main'`) plus any number of **private lobbies**, each for 2–10 players.
  - **Create a private lobby** on the join screen to get a 4-character code (like `K7QF`, no look-alike characters). Share the code or the invite link (`/?room=K7QF`) with your group. Codes are case-insensitive.
  - A player is in one room at a time: joining a room leaves any other.
  - Only members can read a private lobby (RLS), so codes can't be listed. Private lobbies that stay empty for a day are deleted the next time someone creates one.
  - The first player to join becomes host 👑.
  - If the host leaves, the host role passes to the player who has been there longest.
  - The host can remove players, for example someone who is AFK.
- The host picks the **card language** (German, English or French) and the **level**. Both are saved on the room right away, so everyone sees them, and the room keeps them for the next game.
- **Ready check:** every player clicks **Ready**, and the game starts automatically as soon as all players in the lobby are ready (2–10 players). Changing a setting clears everyone's ready. If the last player who isn't ready leaves, the game starts too.
- **Host timeout:** every client sends a heartbeat every 20 s. If the host sends none for **2 minutes** while the room is in the lobby, the room is closed: everyone is removed and sees a notice, and the next person to join becomes host of a fresh room.
- **Stale players:** in the lobby, other players who have been silent for 2 minutes are removed, so they can't hold up the ready check. During a game, a player silent for **5 minutes** is removed as if they had left. If **nobody** in a running game has sent a heartbeat for 2 minutes, the game counts as abandoned and the room is reset, so the next person can join. These checks run on every heartbeat and every join.
- **Loading screen:** on startup, a short animated story plays once in full (8 s): a pencil links words on a clover, the board turns and the next pair gets awkward. It's `WordleafLoader`, pure CSS and SVG. With reduced motion, the app skips the wait.
- **Bot protection:** new players solve a Cloudflare Turnstile check before the anonymous sign-in, and Supabase Auth verifies the token. Players who already have a session never see it.
- **Installable (PWA):** the app has a web app manifest and icons, so it can be added to the home screen on Android and iOS and opens full screen. There is no service worker, because the game needs a live connection anyway.
- **Player map:** the 🌍 button in the footer opens a world map (Leaflet + OpenStreetMap tiles, no API key needed, loaded only when opened) with anonymous dots where people have played in the last year, across all rooms. Dots are colored by the most recent game there (playing now, last 7 days, earlier), sized by the number of players, and a legend with counts toggles each group. On joining, the browser looks up its rough location from its IP address at [GeoJS](https://www.geojs.io/) once per session; the server rounds it to 0.1° (about 10 km) and only hands out grouped counts per point, without names. "Now" means a heartbeat in the last 5 minutes. Locations not refreshed for a year are deleted.
- **UI language** can be English, German or French. Each player picks it themselves with the switcher, and it is saved in the browser.
- Game state syncs **in real time**, and online dots show who is connected (Supabase Presence).
- **Leaving mid-game** is handled:
  - During writing, the player's clover is dropped.
  - During guessing, a clover that has not been played yet is removed from the queue.
  - If the current author leaves, the game skips to the next clover.
- After a game, the host takes everyone back to the lobby, and a new round starts with the ready check.
- The layout works on mobile: tapping replaces drag-and-drop, and the boards resize.
- **Animations** (CSS only, turned off when the device asks for reduced motion): cards deal onto the board, drop into slots and spin when rotated; a splash announces the round and each clover; correct cards cheer and wrong ones shake on reveal; a perfect clover rains 🍀, zero points drops 🍂; the final score counts up; ready ticks pop; the author's 🤫 wiggles; and the 🍀 in the header spins when you tap it. Full-screen effects live in `src/lib/effects.ts` + `src/components/Effects.tsx`.

### Duels (asynchronous, 1 vs 1)
For friends who can't be online at the same time. There are no heartbeats and no timeouts, and each player can have any number of duels running.

```
waiting ──join──► writing ──both submitted──► guessing ──both solved──► finished
```

- On the join screen, **⚔️ Start a duel** creates a duel and shows a code plus an invite link (`/?duel=K7QF`). The other person joins with the link or types the code into the same code field used for lobbies. Room and duel codes share one namespace.
- Each player writes their own clover whenever they like. Card shuffle works as in the live game.
- Once both clovers are in, each player solves the **other's** clover **alone** on their own board (`duel_guesses`), with the same 2 attempts and scoring. The author can watch their opponent's board. The team score is the sum of both (max 12).
- After the duel, **Rematch** starts a new duel with the same two players; both players pressing it end up in the same one.
- **Your duels** under the join form lists all your duels, with the ones where it's your turn on top.
- **Notifications:** the other player gets a Web Push message when you join, when both clovers are in, when you solved their clover, on a rematch and when you leave. On iPhone this only works in the installed app (iOS 16.4+). See *Push notifications* under Deployment.
- **Identity:** duels belong to the anonymous session of the browser. On iPhone, the installed app and Safari keep **separate** sessions, so app users should enter the code in the app instead of opening the link.
- Unanswered duels are deleted after 7 days, and any duel is deleted after 30 days without activity.

### Out of scope for now (see the roadmap)
- In-game chat (use Discord or a call)
- A writing timer
- Persistent stats or history
- Drag and drop
- Word-card editor

---

## 3. Tech stack & architecture

| Layer | Choice |
|-------|--------|
| Frontend | React 19 + TypeScript, Vite, Tailwind CSS v4 |
| i18n | i18next / react-i18next (`src/i18n/{en,de,fr}.json`) |
| Backend | Supabase: Postgres, Auth (anonymous), Realtime, PostgREST |
| Game logic | Postgres functions (RPCs, `security definer`); **there is no custom server** |
| Hosting | Any static host for the frontend (Vercel or Netlify) plus a Supabase project |

```
 Browser (React)                                Supabase
┌────────────────────┐   supabase.rpc(...)   ┌───────────────────────────────┐
│ Join / Lobby /     │ ────────────────────► │ RPCs (plpgsql, security       │
│ Writing / Guessing │                       │ definer): validate + mutate   │
│ / Results          │   select (RLS)        │                               │
│                    │ ◄──────────────────── │ Tables with RLS: read-only    │
│ useRoom():         │                       │ for clients, solutions only   │
│  realtime changes  │ ◄── postgres_changes ─│ for owner or after reveal     │
│  + presence        │ ◄── presence ─────────│ Realtime                      │
└────────────────────┘                       └───────────────────────────────┘
```

**Why RPCs?** Clients can never write to tables directly. Every state change goes through a function that:
- checks `auth.uid()` and the current phase
- locks the room row, so simultaneous clicks are handled one after another
- makes the change

This keeps the game consistent, and hidden information stays on the server.

### Hidden information
- `cards` are public: they hold only the words, plus a random `tray_order`.
- `solutions` (slot and rotation per card, `slot = null` for the decoy) are protected by RLS. You can only read **your own** solutions, plus those of clovers that have **already been revealed**.
- Checking a guess happens entirely on the server, in `submit_guess`.

---

## 4. Data model

| Table | Purpose | Client access |
|-------|---------|---------------|
| `words(lang, word)` | Word pool, about 450 words per language | none (RPC only) |
| `rooms` | One per lobby (`id` = `'main'` or the share code), with all game state:<br>• `status`: lobby, writing, guessing or finished<br>• `card_lang`, `level`, `allow_shuffle`, `host_id`<br>• `turn_order`, `current_turn`<br>• `attempt`, `revealing`<br>• `guess_state` (jsonb `{cardId: {slot, rotation}}`)<br>• `locked_slots`, `score` | read `'main'` or own room |
| `room_players` | Who is at the table (`name`, `joined_at`, `ready`) | read own room |
| `heartbeats` | `last_seen` per player, used for the host timeout and stale-player cleanup. Kept separate so heartbeats don't trigger realtime refetches. | none |
| `clovers` | One per player per game:<br>• `owner_name`<br>• `clues[4]` in the order top, right, bottom, left<br>• `submitted`, `points`, `revealed`, `shuffled` | read own room |
| `cards` | 5 per clover:<br>• `words[4]` in the order top, right, bottom, left at rotation 0<br>• `tray_order` | read own room |
| `solutions` | Secret `slot` (0 = TL, 1 = TR, 2 = BR, 3 = BL, null = decoy) and `rotation` (0–3 clockwise quarter turns) | read own or revealed (own room) |
| `player_locations` | Rounded `lat`/`lon` per user and when they last joined from there, for the player map | none (RPC only) |

Realtime publishes changes to `rooms`, `room_players` and `clovers`; clients filter them by room. Clients refetch cards and solutions whenever the phase or turn changes.

**Rotation maths:** the word shown on edge `e` of a card rotated `r` times is `words[(e − r) mod 4]`. This is implemented in `src/lib/clover.ts` and unit-tested.

## 5. RPC API

Every game RPC takes an optional `p_room` (default `'main'`). The client sends the room it is looking at.

| Function | Who | What |
|----------|-----|------|
| `create_room(p_name)` | anyone signed in | Open a private lobby, join it as host and return its code. |
| `get_room()` | anyone signed in | The room row for a code (even if you're not in it), or nothing. |
| `join_room(p_name)` | anyone signed in | Take a seat (in lobby or finished only, max 10) or rename yourself. Leaves any other room first. The first player becomes host. Unknown codes fail with `room_not_found`. |
| `leave_room()` | player | Leave the table. Fixes up host and game state. An empty room resets. |
| `kick_player(p_user)` | host | Remove a player. |
| `set_settings(p_card_lang, p_level, p_allow_shuffle?)` | host | In the lobby: store card language, level (1–3) and whether card shuffle is allowed. Clears everyone's ready. |
| `shuffle_clover()` | player | Once per game while writing and before submitting: replace your 5 cards with new ones and clear your clues. |
| `set_ready(p_ready)` | player | In the lobby: mark yourself ready or not. When all 2–10 players are ready, the game is dealt (5 cards × 4 unique words per player, secret slots, rotations and decoy) and moves to **writing**. |
| `heartbeat()` | player | Called every 20 s. Closes the lobby if the host has been silent for 2 minutes, and removes stale players or resets an abandoned game. |
| `submit_clues(p_clues text[4])` | player | Validates single words. Once everyone has submitted, moves to **guessing**. |
| `edit_clues()` | player | Take your submission back while still in writing. |
| `force_guessing()` | host | Start guessing now and drop unsubmitted clovers. |
| `move_card(p_card, p_slot, p_rotation)` | guesser | Place a card (`p_slot` 0–3), return it to the tray (`null`) or rotate it. Locked slots and the author are rejected. |
| `submit_guess()` | guesser | Score the guess: attempt 1 is perfect or goes to attempt 2 with locks; after attempt 2, reveal the solution. |
| `next_clover()` | player | After a reveal, move to the next clover or to **finished**. |
| `back_to_lobby()` | host | Reset to the lobby and clear all ready flags ("Play again"). |
| `set_location(p_lat, p_lon)` | anyone signed in | Store your rough location for the map (rounded to 0.1°). No `p_room`. |
| `player_map()` | anyone, even signed out | Per rounded point: `players_now`, `players_week` (incl. now) and `players_total`. No `p_room`. |

Errors come back as short codes (for example `not_host`, `clue_must_be_one_word`, `author_cannot_guess`), and the UI translates them in `errors.*`.

### State machine

```
 lobby ──all ready───► writing ──all submitted / force──► guessing ──last next_clover──► finished
   ▲                                                      │  attempt 1 ─► (2) ─► revealing ─┐   │
   │                                                      └──────────── next_clover ◄───────┘   │
   └──── back_to_lobby (play again) / everyone leaves / timeout ◄─────────────────────────────────┘
```

---

## 6. Project structure

```
├── index.html                  # PWA meta tags
├── public/                     # icon.svg (source), PNG icons, manifest.webmanifest
├── src/
│   ├── App.tsx                 # routes by room.status, header, toast
│   ├── i18n/                   # en.json, de.json, fr.json, init
│   ├── lib/
│   │   ├── supabase.ts         # client (+ ?p=N test profiles)
│   │   ├── clover.ts           # board geometry, rotation, rating (tested)
│   │   ├── room.ts             # current room (public or ?room=CODE), invite links
│   │   ├── geo.ts              # IP-based location for the player map
│   │   ├── rpc.ts              # RPC wrapper with translated errors
│   │   ├── toast.ts, types.ts
│   ├── hooks/
│   │   ├── useAuth.ts          # anonymous session
│   │   └── useRoom.ts          # data, realtime, presence, optimistic patches
│   └── components/
│       ├── Join, Lobby, WritingPhase, GuessingPhase, Results
│       ├── Clover (board + leaves), CardView, PlayerList, LanguageSwitcher
│       ├── PlayerMap           # footer map dialog (lazy-loaded Leaflet)
│       └── WordleafLoader (+ .css)   # animated loading screen
├── supabase/
│   ├── config.toml             # anonymous sign-ins enabled
│   └── migrations/
│       ├── 0001_schema.sql     # tables, RLS, realtime publication, 'main' room
│       ├── 0002_functions.sql  # game logic RPCs
│       ├── 0003_words.sql      # word pool en/de/fr
│       ├── 0004_levels.sql     # word categories + difficulty levels
│       ├── 0005_ready_and_heartbeat.sql  # ready check + host timeout
│       ├── 0006_shuffle.sql    # card shuffle
│       ├── 0007_stale_players.sql  # remove silent players, reset abandoned games
│       ├── 0008_lobbies_and_map.sql  # private lobbies with codes, membership RLS, player map
│       ├── 0009_map_history.sql      # map keeps past play locations
│       ├── 0010_duels.sql            # asynchronous 1v1 duels + notifications outbox
│       └── 0011_push.sql             # push subscriptions, trigger -> send-push
│   └── functions/send-push/    # Edge Function that sends Web Push (VAPID)
└── scripts/
    ├── smoke-test.mjs          # full-game backend test
    ├── smoke-duel.mjs          # duel backend test (npm run smoke:duel)
    └── make-icons.sh           # renders the PNG icons from public/icon.svg (needs rsvg-convert)
```

---

## 7. Local development

Prerequisites: Node 20+ and Docker (for the local Supabase).

```bash
npm install
npx supabase start          # applies migrations; prints API URL and keys
cp .env.example .env        # put the API URL and the publishable/anon key here
npm run dev                 # http://localhost:5173
```

Locally, the captcha uses Cloudflare's public test keys (site key in `.env.example`, secret in `supabase/config.toml`), which always pass. If you started Supabase before the captcha was added, run `npx supabase stop && npx supabase start` so Auth picks up the setting.

**Testing multiplayer alone:** open `http://localhost:5173/?p=1`, `?p=2` and `?p=3` in separate tabs. Each `p` value uses its own session, so each tab is a different player. A private window also works.

After changing the SQL, run `npx supabase db reset` to re-apply the migrations.

### Tests

```bash
npm test                    # unit tests (board geometry, rotation, rating)
npm run typecheck
SUPABASE_SERVICE_KEY=<secret key from `npx supabase status`> npm run smoke
SUPABASE_SERVICE_KEY=<secret key from `npx supabase status`> npm run smoke:duel
```

The smoke test resets the `main` room and plays through the game with 3 anonymous players. It checks:
- host rules and input validation
- RLS on solutions (no peeking, readable after the reveal)
- the author cannot move cards
- all three scoring paths (6, 4 via attempt 2, 0)
- locked cards cannot be moved
- leaving mid-game and passing on the host role
- realtime delivery
- private lobbies: codes, membership RLS, `room_not_found`, one room per player
- the player map: rounding, live vs past, validation, access without signing in

---

## 8. Deployment (free tier is enough)

1. Create a project at [supabase.com](https://supabase.com).
2. Go to **Authentication → Sign In / Providers** and turn on **Allow anonymous sign-ins**.
3. Push the schema:
   ```bash
   npx supabase link --project-ref <your-ref>
   npx supabase db push
   ```
4. Set up the captcha:
   - In the Cloudflare dashboard, go to **Turnstile → Add widget**, add your site's hostname and pick the **Managed** mode. You get a site key and a secret key.
   - In Supabase, go to **Authentication → Attack Protection**, turn on **CAPTCHA protection**, pick **Turnstile** and paste the **secret** key.
5. Deploy the frontend to Vercel or Netlify:
   - build command `npm run build`
   - output directory `dist`
   - env vars `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (the publishable key) and `VITE_TURNSTILE_SITE_KEY` (the Turnstile **site** key)
6. Share the URL with your friends. 🍀

### Push notifications for duels (optional)

Duels work without this; players just don't get notified.

1. Generate a VAPID key pair: `npx web-push generate-vapid-keys`.
2. Deploy the function and set its secrets:
   ```bash
   npx supabase functions deploy send-push
   npx supabase secrets set VAPID_PUBLIC_KEY=<public> VAPID_PRIVATE_KEY=<private> \
     VAPID_SUBJECT=mailto:you@example.com PUSH_HOOK_SECRET=<long random string>
   ```
3. Tell the database where to post notifications (SQL editor):
   ```sql
   select vault.create_secret('https://<ref>.supabase.co/functions/v1/send-push', 'push_function_url');
   select vault.create_secret('<same PUSH_HOOK_SECRET>', 'push_hook_secret');
   ```
4. Add `VITE_VAPID_PUBLIC_KEY=<public>` to the frontend env vars and redeploy.

Push needs the service worker, so it only works in a production build (`npm run build && npm run preview` locally), not in `npm run dev`. Locally, run `npx supabase functions serve send-push --env-file <file with the secrets>` and use `http://host.docker.internal:54321/functions/v1/send-push` as `push_function_url`.

Do steps 4 and 5 together: with CAPTCHA protection on in Supabase but no site key in the frontend, nobody new can sign in.

---

## 9. Roadmap / ideas

- An optional writing timer and a "hurry up" nudge
- Drag and drop with animations, and a sound when cards lock
- Text chat for guessers, hidden from the author
- Persistent profiles: turn an anonymous user into an email account and keep stats
- An "only one word" mode that blocks words that already appear on the board
- A bigger and themed word list, plus custom word lists per room
