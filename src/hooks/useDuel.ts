import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Card, Duel, DuelGuess, DuelPlayer, Solution } from '../lib/types'

export interface DuelData {
  /** null when the duel doesn't exist or you're not in it (RLS) */
  duel: Duel | null
  players: DuelPlayer[]
  cards: Card[]
  solutions: Solution[]
  guesses: DuelGuess[]
  loaded: boolean
}

const empty: DuelData = { duel: null, players: [], cards: [], solutions: [], guesses: [], loaded: false }

/** One duel: both clovers, both boards and whatever solutions you may see. No presence or heartbeat. */
export function useDuel(userId: string | null, duelId: string | null) {
  const [data, setData] = useState<DuelData>(empty)
  const guessesRef = useRef<DuelGuess[]>([])
  guessesRef.current = data.guesses
  const seq = useRef(0)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const refetch = useCallback(async () => {
    if (!duelId) return
    const id = ++seq.current
    const [d, p, c, s, g] = await Promise.all([
      supabase.from('duels').select('id,card_lang,level,allow_shuffle,status,created_by,rematch_id,updated_at').eq('id', duelId).maybeSingle(),
      supabase.from('duel_players').select('user_id,name,joined_at,clues,submitted,shuffled,points').eq('duel_id', duelId).order('joined_at'),
      supabase.from('duel_cards').select('id,owner_id,words,tray_order').eq('duel_id', duelId).order('tray_order'),
      supabase.from('duel_solutions').select('card_id,owner_id,slot,rotation').eq('duel_id', duelId),
      supabase.from('duel_guesses').select('guesser_id,owner_id,state,attempt,locked_slots,done,updated_at').eq('duel_id', duelId),
    ])
    if (id !== seq.current) return // a newer refetch is in flight
    setData({
      duel: (d.data as Duel) ?? null,
      players: (p.data as DuelPlayer[]) ?? [],
      cards: (c.data as Card[]) ?? [],
      solutions: (s.data as Solution[]) ?? [],
      guesses: (g.data as DuelGuess[]) ?? [],
      loaded: true,
    })
  }, [duelId])

  const scheduleRefetch = useCallback(() => {
    clearTimeout(timer.current)
    timer.current = setTimeout(refetch, 80)
  }, [refetch])

  /** Optimistic local change to your own board; realtime brings the real state */
  const patchGuess = useCallback(
    (patch: Partial<DuelGuess>) => {
      setData((prev) => ({
        ...prev,
        guesses: prev.guesses.map((g) => (g.guesser_id === userId ? { ...g, ...patch } : g)),
      }))
    },
    [userId],
  )

  useEffect(() => {
    setData(empty)
    if (!userId || !duelId) return
    refetch()

    const filter = `duel_id=eq.${duelId}`
    const channel = supabase
      .channel(`duel:${duelId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'duels', filter: `id=eq.${duelId}` }, scheduleRefetch)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'duel_players', filter }, scheduleRefetch)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'duel_guesses', filter }, scheduleRefetch)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'duel_guesses', filter }, (payload) => {
        const next = payload.new as DuelGuess
        const prev = guessesRef.current.find((g) => g.guesser_id === next.guesser_id)
        setData((d) => ({ ...d, guesses: d.guesses.map((g) => (g.guesser_id === next.guesser_id ? { ...g, ...next } : g)) }))
        // A new attempt or a finished board changes points and the solutions you may see
        if (!prev || prev.attempt !== next.attempt || prev.done !== next.done) scheduleRefetch()
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') refetch()
      })

    // Async play: the app often comes back from the background, so catch up then
    const onVisible = () => document.visibilityState === 'visible' && refetch()
    window.addEventListener('focus', refetch)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.removeEventListener('focus', refetch)
      document.removeEventListener('visibilitychange', onVisible)
      clearTimeout(timer.current)
      supabase.removeChannel(channel)
    }
  }, [userId, duelId, refetch, scheduleRefetch])

  return { ...data, refetch, patchGuess }
}
