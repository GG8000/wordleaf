// End-to-end smoke test against a running Supabase (local by default).
// Plays a full 3-player game through the RPCs and checks rules, RLS and realtime.
//
//   npx supabase start
//   SUPABASE_SERVICE_KEY=<secret key from `npx supabase status`> npm run smoke
//
// WARNING: resets the 'main' room.
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
  const { error } = await client.rpc(fn, args)
  if (error) throw new Error(`${fn}: ${error.message}`)
}

async function expectError(client, fn, args, code) {
  const { error } = await client.rpc(fn, args)
  check(error?.message === code, `${fn} rejected with ${code} (got ${error?.message ?? 'no error'})`)
}

async function room() {
  const { data } = await admin.from('rooms').select('*').eq('id', 'main').single()
  return data
}

async function solutionOf(owner) {
  const { data } = await admin.from('solutions').select('*').eq('owner_id', owner)
  return data
}

// Reset room
await admin.from('room_players').delete().eq('room_id', 'main')
await admin.from('clovers').delete().eq('room_id', 'main')
await admin.from('rooms').update({ status: 'lobby', host_id: null, score: 0 }).eq('id', 'main')

// Three anonymous players
const names = ['Ana', 'Ben', 'Cleo']
const players = []
for (const name of names) {
  const client = createClient(API_URL, ANON, opts)
  const { data, error } = await client.auth.signInAnonymously()
  if (error) throw error
  players.push({ name, client, id: data.user.id })
}
const [A, B, C] = players
const byId = Object.fromEntries(players.map((p) => [p.id, p]))

// Realtime: C listens to room updates
let realtimeEvents = 0
const channel = C.client
  .channel('smoke')
  .on('postgres_changes', { event: '*', schema: 'public', table: 'rooms' }, () => realtimeEvents++)
await new Promise((resolve) => channel.subscribe((s) => s === 'SUBSCRIBED' && resolve()))
await sleep(1500) // postgres_changes needs a moment after SUBSCRIBED

// Lobby
for (const p of players) await call(p.client, 'join_room', { p_name: p.name })
check((await room()).host_id === A.id, 'first player becomes host')
await expectError(B.client, 'start_game', { p_card_lang: 'de' }, 'not_host')
await expectError(A.client, 'join_room', { p_name: '   ' }, 'invalid_name')

// Writing
await call(A.client, 'start_game', { p_card_lang: 'de' })
check((await room()).status === 'writing', 'game starts in writing phase')
const { data: cardsB } = await B.client.from('cards').select('*')
check(cardsB.length === 15, `everyone sees 15 cards (got ${cardsB.length})`)
const { data: solB } = await B.client.from('solutions').select('*')
check(solB.length === 5 && solB.every((s) => s.owner_id === B.id), 'players only see their own solutions')
check(solB.filter((s) => s.slot === null).length === 1, 'exactly one decoy per clover')

await expectError(A.client, 'submit_clues', { p_clues: ['two words', 'b', 'c', 'd'] }, 'clue_must_be_one_word')
for (const p of players) await call(p.client, 'submit_clues', { p_clues: ['Eins', 'Zwei', 'Drei', 'Vier'] })
let r = await room()
check(r.status === 'guessing' && r.turn_order.length === 3, 'all submitted -> guessing with 3 clovers')

// Play one clover: `plan(solution, attempt)` returns placements for the 4 slots
async function playTurn(plan, expectedPoints) {
  r = await room()
  const owner = byId[r.turn_order[r.current_turn]]
  const guesser = players.find((p) => p.id !== owner.id)
  const sol = await solutionOf(owner.id)

  const { data: hidden } = await guesser.client.from('solutions').select('*').eq('owner_id', owner.id)
  check(hidden.length === 0, `${guesser.name} cannot peek at ${owner.name}'s solution`)
  const anyCard = Object.keys(r.guess_state)[0]
  await expectError(owner.client, 'move_card', { p_card: anyCard, p_slot: 0, p_rotation: 0 }, 'author_cannot_guess')

  for (const attempt of [1, 2]) {
    r = await room()
    if (r.revealing) break
    for (const [cardId, slot, rotation] of plan(sol, attempt)) {
      if (r.locked_slots.includes(slot)) continue
      await call(guesser.client, 'move_card', { p_card: cardId, p_slot: slot, p_rotation: rotation })
    }
    await call(guesser.client, 'submit_guess')
  }

  r = await room()
  const { data: clover } = await admin.from('clovers').select('*').eq('owner_id', owner.id).single()
  check(r.revealing && clover.points === expectedPoints, `${owner.name}'s clover scored ${clover.points} (expected ${expectedPoints})`)
  const { data: revealed } = await guesser.client.from('solutions').select('*').eq('owner_id', owner.id)
  check(revealed.length === 5, 'solution is readable after the reveal')
  await call(guesser.client, 'next_clover')
}

const real = (sol) => sol.filter((s) => s.slot !== null).sort((a, b) => a.slot - b.slot)
const decoy = (sol) => sol.find((s) => s.slot === null)

// Clover 1: perfect on the first attempt -> 6
await playTurn((sol) => real(sol).map((s) => [s.card_id, s.slot, s.rotation]), 6)

// Clover 2: 2 right on the first attempt (decoy + wrong rotation), all right on the second -> 4
await playTurn((sol, attempt) => {
  const [s0, s1, s2, s3] = real(sol)
  if (attempt === 2) return [s0, s1, s2, s3].map((s) => [s.card_id, s.slot, s.rotation])
  return [
    [s0.card_id, 0, s0.rotation],
    [s1.card_id, 1, s1.rotation],
    [decoy(sol).card_id, 2, 0],
    [s3.card_id, 3, (s3.rotation + 1) % 4],
  ]
}, 4)

// Clover 3: every rotation wrong twice -> 0, then the game is finished
await playTurn((sol) => real(sol).map((s) => [s.card_id, s.slot, (s.rotation + 1) % 4]), 0)
r = await room()
check(r.status === 'finished' && r.score === 10, `game finished with team score ${r.score} (expected 10)`)

// Locked cards cannot be moved (fresh game, force a partial first attempt)
await call(A.client, 'start_game', { p_card_lang: 'fr' })
for (const p of players) await call(p.client, 'submit_clues', { p_clues: ['Un', 'Deux', 'Trois', 'Quatre'] })
r = await room()
{
  const owner = byId[r.turn_order[0]]
  const guesser = players.find((p) => p.id !== owner.id)
  const [s0, s1, s2, s3] = real(await solutionOf(owner.id))
  await call(guesser.client, 'move_card', { p_card: s0.card_id, p_slot: 0, p_rotation: s0.rotation })
  await call(guesser.client, 'move_card', { p_card: s1.card_id, p_slot: 2, p_rotation: 0 })
  await call(guesser.client, 'move_card', { p_card: s2.card_id, p_slot: 1, p_rotation: 0 })
  await call(guesser.client, 'move_card', { p_card: s3.card_id, p_slot: 3, p_rotation: (s3.rotation + 2) % 4 })
  await call(guesser.client, 'submit_guess')
}
r = await room()
check(r.attempt === 2 && r.locked_slots.join() === '0', `attempt 2 keeps only slot 0 locked (got [${r.locked_slots}])`)
{
  const lockedCard = Object.entries(r.guess_state).find(([, p]) => p.slot === 0)[0]
  const guesser = players.find((p) => p.id !== r.turn_order[0])
  await expectError(guesser.client, 'move_card', { p_card: lockedCard, p_slot: 1, p_rotation: 0 }, 'card_locked')
}

// Leaving: current author leaves -> their clover is dropped, turn moves on
{
  const owner = byId[r.turn_order[0]]
  await call(owner.client, 'leave_room')
  const after = await room()
  check(after.turn_order.length === 2 && !after.turn_order.includes(owner.id), 'author leaving drops their clover')
  check(after.status === 'guessing' && after.attempt === 1, 'next clover starts fresh')
  if (owner === A) check(after.host_id !== A.id, 'host role passes on when the host leaves')
}

await sleep(1000)
check(realtimeEvents > 0, `realtime delivered ${realtimeEvents} room updates`)

// Cleanup
await C.client.removeChannel(channel)
for (const p of players) await p.client.rpc('leave_room')
r = await room()
check(r.status === 'lobby' && r.host_id === null, 'empty room resets to lobby')

console.log(failures ? `\n${failures} check(s) failed` : '\nAll checks passed')
process.exit(failures ? 1 : 0)
