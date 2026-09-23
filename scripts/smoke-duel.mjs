// End-to-end smoke test for asynchronous duels against a running Supabase (local by default).
// Plays two duels through the RPCs and checks rules, RLS, scoring and notifications.
//
//   npx supabase start
//   SUPABASE_SERVICE_KEY=<secret key from `npx supabase status`> npm run smoke:duel
//
// Does not touch live rooms.
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'

const env = Object.fromEntries(
  readFileSync(new URL('../.env', import.meta.url), 'utf8')
    .split('\n')
    .filter((l) => l.includes('='))
    .map((l) => l.split('=').map((s) => s.trim())),
)
const API_URL = process.env.VITE_SUPABASE_URL ?? env.VITE_SUPABASE_URL
const ANON = process.env.VITE_SUPABASE_ANON_KEY ?? env.VITE_SUPABASE_ANON_KEY
const SERVICE = process.env.SUPABASE_SERVICE_KEY
if (!SERVICE) throw new Error('Set SUPABASE_SERVICE_KEY')

const opts = { auth: { persistSession: false, autoRefreshToken: false } }
const admin = createClient(API_URL, SERVICE, opts)
let failures = 0
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

function check(cond, msg) {
  console.log(`${cond ? '✔' : '✘'} ${msg}`)
  if (!cond) failures++
}

async function call(client, fn, args = {}) {
  const { data, error } = await client.rpc(fn, args)
  if (error) throw new Error(`${fn}: ${error.message}`)
  return data
}

async function expectError(client, fn, args, code) {
  const { error } = await client.rpc(fn, args)
  check(error?.message === code, `${fn} rejected with ${code} (got ${error?.message ?? 'no error'})`)
}

async function duel(id) {
  const { data } = await admin.from('duels').select('*').eq('id', id).single()
  return data
}

async function notificationsFor(user, id) {
  const { data } = await admin.from('notifications').select('*').eq('user_id', user.id).eq('duel_id', id).order('id')
  return data.map((n) => n.kind)
}

const players = []
for (const name of ['Dora', 'Emil', 'Finn']) {
  const client = createClient(API_URL, ANON, opts)
  const { data, error } = await client.auth.signInAnonymously({ options: { captchaToken: 'XXXX.DUMMY.TOKEN.XXXX' } })
  if (error) throw error
  players.push({ name, client, id: data.user.id })
}
const [D, E, F] = players

// Realtime: E listens to duel_players
let realtimeEvents = 0
const channel = E.client
  .channel('smoke-duel')
  .on('postgres_changes', { event: '*', schema: 'public', table: 'duel_players' }, () => realtimeEvents++)
await new Promise((resolve) => channel.subscribe((s) => s === 'SUBSCRIBED' && resolve()))
await sleep(1500)

// Create and join
await expectError(D.client, 'create_duel', { p_name: ' ' }, 'invalid_name')
const code = await call(D.client, 'create_duel', { p_name: 'Dora', p_card_lang: 'de', p_level: 2 })
check(/^[A-HJKMNP-Z2-9]{4}$/.test(code ?? ''), `create_duel returns a 4-letter code (got ${code})`)
check((await duel(code)).status === 'waiting', 'new duel waits for an opponent')
await expectError(E.client, 'join_duel', { p_duel: 'ZZZZ', p_name: 'Emil' }, 'duel_not_found')
await call(E.client, 'join_duel', { p_duel: ` ${code.toLowerCase()} `, p_name: 'Emil' })
check((await duel(code)).status === 'writing', 'second player joins with a lower-case code -> writing')
await expectError(F.client, 'join_duel', { p_duel: code, p_name: 'Finn' }, 'duel_full')
check((await notificationsFor(D, code)).join() === 'opponent_joined', 'creator is notified that the opponent joined')

// RLS
{
  const { data: outsider } = await F.client.from('duel_cards').select('id').eq('duel_id', code)
  check(outsider.length === 0, 'outsiders cannot see duel cards')
  const { data: cards } = await D.client.from('duel_cards').select('*').eq('duel_id', code)
  check(cards.length === 10, `players see both clovers' 10 cards (got ${cards.length})`)
  const { data: sol } = await D.client.from('duel_solutions').select('*').eq('duel_id', code)
  check(sol.length === 5 && sol.every((s) => s.owner_id === D.id), 'players only see their own solution')
  const { data: notes, error } = await D.client.from('notifications').select('*')
  check(!error && notes.length === 0, 'notifications are not readable by clients')
  const { data: list } = await D.client.rpc('my_duels')
  const mine = list.find((x) => x.id === code)
  check(mine?.opponent_name === 'Emil' && mine.my_turn === true, 'my_duels shows the opponent and that it is my turn')
}

// Writing, at different times
await expectError(D.client, 'submit_duel_clues', { p_duel: code, p_clues: ['zwei Worte', 'b', 'c', 'd'] }, 'clue_must_be_one_word')
await call(D.client, 'submit_duel_clues', { p_duel: code, p_clues: ['Eins', 'Zwei', 'Drei', 'Vier'] })
check((await duel(code)).status === 'writing', 'one submitted -> still writing')
await call(D.client, 'edit_duel_clues', { p_duel: code })
await call(D.client, 'submit_duel_clues', { p_duel: code, p_clues: ['Eins', 'Zwei', 'Drei', 'Vier'] })
await call(E.client, 'shuffle_duel_clover', { p_duel: code })
await expectError(E.client, 'shuffle_duel_clover', { p_duel: code }, 'already_shuffled')
await call(E.client, 'submit_duel_clues', { p_duel: code, p_clues: ['Un', 'Deux', 'Trois', 'Quatre'] })
check((await duel(code)).status === 'guessing', 'both submitted -> guessing')
check((await notificationsFor(D, code)).join() === 'opponent_joined,opponent_submitted', 'first writer is notified that it is their turn to guess')

const real = (sol) => sol.filter((s) => s.slot !== null).sort((a, b) => a.slot - b.slot)
const decoy = (sol) => sol.find((s) => s.slot === null)
const solutionOf = async (id, owner) =>
  (await admin.from('duel_solutions').select('*').eq('duel_id', id).eq('owner_id', owner.id)).data
const guessOf = async (id, guesser) =>
  (await admin.from('duel_guesses').select('*').eq('duel_id', id).eq('guesser_id', guesser.id).single()).data

// Solve the opponent's clover: `plan(solution, attempt)` returns placements
async function solve(id, guesser, owner, plan, expectedPoints) {
  const { data: hidden } = await guesser.client.from('duel_solutions').select('*').eq('duel_id', id).eq('owner_id', owner.id)
  check(hidden.length === 0, `${guesser.name} cannot peek at ${owner.name}'s solution`)
  const sol = await solutionOf(id, owner)
  for (const attempt of [1, 2]) {
    const g = await guessOf(id, guesser)
    if (g.done) break
    for (const [cardId, slot, rotation] of plan(sol, attempt)) {
      if (g.locked_slots.includes(slot)) continue
      await call(guesser.client, 'move_duel_card', { p_duel: id, p_card: cardId, p_slot: slot, p_rotation: rotation })
    }
    await call(guesser.client, 'submit_duel_guess', { p_duel: id })
  }
  const { data: p } = await admin.from('duel_players').select('points').eq('duel_id', id).eq('user_id', owner.id).single()
  check(p.points === expectedPoints, `${owner.name}'s clover scored ${p.points} (expected ${expectedPoints})`)
  const { data: revealed } = await guesser.client.from('duel_solutions').select('*').eq('duel_id', id).eq('owner_id', owner.id)
  check(revealed.length === 5, 'solution is readable once solved')
}

// Guess boards are separate: D moving a card does not touch E's board
{
  const gD = await guessOf(code, D)
  const gE = await guessOf(code, E)
  check(gD.owner_id === E.id && gE.owner_id === D.id, 'each player guesses the other clover')
  const card = Object.keys(gE.state)[0]
  await expectError(D.client, 'move_duel_card', { p_duel: code, p_card: card, p_slot: 0, p_rotation: 0 }, 'unknown_card')
}

// E: 2 right on attempt 1, all right on attempt 2 -> 4, and a locked card can't move
await solve(code, E, D, (sol, attempt) => {
  const [s0, s1, s2, s3] = real(sol)
  if (attempt === 2) return [s0, s1, s2, s3].map((s) => [s.card_id, s.slot, s.rotation])
  return [
    [s0.card_id, 0, s0.rotation],
    [s1.card_id, 1, s1.rotation],
    [decoy(sol).card_id, 2, 0],
    [s3.card_id, 3, (s3.rotation + 1) % 4],
  ]
}, 4)
check((await duel(code)).status === 'guessing', 'one solved -> still guessing')
check((await notificationsFor(D, code)).at(-1) === 'opponent_solved', 'author is notified when their clover is solved')
await expectError(E.client, 'submit_duel_guess', { p_duel: code }, 'wrong_phase')

// D: perfect -> 6, duel finished with 10
await solve(code, D, E, (sol) => real(sol).map((s) => [s.card_id, s.slot, s.rotation]), 6)
check((await duel(code)).status === 'finished', 'both solved -> finished')
{
  const { data: list } = await E.client.rpc('my_duels')
  const mine = list.find((x) => x.id === code)
  check(mine?.score === 10 && mine.my_turn === false, `my_duels shows the shared score (got ${mine?.score})`)
}

// Rematch: both players asking get the same new duel, straight to writing
const re1 = await call(D.client, 'rematch_duel', { p_duel: code })
const re2 = await call(E.client, 'rematch_duel', { p_duel: code })
check(re1 && re1 === re2 && re1 !== code, 'rematch_duel returns the same new duel for both players')
check((await duel(re1)).status === 'writing', 'rematch starts in writing')
check((await notificationsFor(E, re1)).join() === 'rematch', 'opponent is notified of the rematch')

// Locked cards on attempt 2
await call(D.client, 'submit_duel_clues', { p_duel: re1, p_clues: ['A', 'B', 'C', 'D'] })
await call(E.client, 'submit_duel_clues', { p_duel: re1, p_clues: ['A', 'B', 'C', 'D'] })
{
  const [s0, s1, s2, s3] = real(await solutionOf(re1, E))
  await call(D.client, 'move_duel_card', { p_duel: re1, p_card: s0.card_id, p_slot: 0, p_rotation: s0.rotation })
  await call(D.client, 'move_duel_card', { p_duel: re1, p_card: s1.card_id, p_slot: 2, p_rotation: 0 })
  await call(D.client, 'move_duel_card', { p_duel: re1, p_card: s2.card_id, p_slot: 1, p_rotation: 0 })
  await call(D.client, 'move_duel_card', { p_duel: re1, p_card: s3.card_id, p_slot: 3, p_rotation: (s3.rotation + 2) % 4 })
  await call(D.client, 'submit_duel_guess', { p_duel: re1 })
  const g = await guessOf(re1, D)
  check(g.attempt === 2 && g.locked_slots.join() === '0', `attempt 2 keeps only slot 0 locked (got [${g.locked_slots}])`)
  await expectError(D.client, 'move_duel_card', { p_duel: re1, p_card: s0.card_id, p_slot: 1, p_rotation: 0 }, 'card_locked')
}

// Leaving mid-game: the other player sees it as abandoned, the last one out deletes it
await call(D.client, 'leave_duel', { p_duel: re1 })
check((await duel(re1)).status === 'abandoned', 'leaving mid-game marks the duel abandoned')
check((await notificationsFor(E, re1)).at(-1) === 'opponent_left', 'opponent is notified when someone leaves')
await expectError(E.client, 'rematch_duel', { p_duel: re1 }, 'wrong_phase')
await call(E.client, 'leave_duel', { p_duel: re1 })
check((await duel(re1)) === null, 'last player out deletes the duel')

await sleep(1000)
check(realtimeEvents > 0, `realtime delivered ${realtimeEvents} duel_players updates`)

// Push subscriptions
await expectError(D.client, 'save_push_subscription', { p_endpoint: 'http://x', p_p256dh: 'a', p_auth: 'b' }, 'invalid_subscription')
await call(D.client, 'save_push_subscription', { p_endpoint: 'https://push.example/abc', p_p256dh: 'k', p_auth: 'a', p_lang: 'de' })
{
  const { data: subs } = await admin.from('push_subscriptions').select('*').eq('endpoint', 'https://push.example/abc')
  check(subs.length === 1 && subs[0].user_id === D.id && subs[0].lang === 'de', 'push subscription is stored for the caller')
  const { data: peek } = await D.client.from('push_subscriptions').select('*')
  check(peek.length === 0, 'push subscriptions are not readable by clients')
  await call(D.client, 'delete_push_subscription', { p_endpoint: 'https://push.example/abc' })
}

// Cleanup
await E.client.removeChannel(channel)
for (const p of players) {
  for (const d of (await p.client.rpc('my_duels')).data ?? []) await p.client.rpc('leave_duel', { p_duel: d.id })
}

console.log(failures ? `\n${failures} check(s) failed` : '\nAll checks passed')
process.exit(failures ? 1 : 0)
