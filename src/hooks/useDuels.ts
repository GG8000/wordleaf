import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { DuelSummary } from '../lib/types'

/** The signed-in player's duels for the overview, kept fresh by realtime */
export function useDuels(userId: string | null) {
  const [duels, setDuels] = useState<DuelSummary[]>([])
  const [loaded, setLoaded] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const refetch = useCallback(async () => {
    const { data } = await supabase.rpc('my_duels')
    setDuels((data as DuelSummary[]) ?? [])
    setLoaded(true)
  }, [])

  useEffect(() => {
    setDuels([])
    setLoaded(false)
    if (!userId) return
    refetch()

    // RLS limits these to your own duels, so no filter is needed. Every step that changes
    // whose turn it is also touches the duel row.
    const schedule = () => {
      clearTimeout(timer.current)
      timer.current = setTimeout(refetch, 150)
    }
    const channel = supabase
      .channel(`my-duels:${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'duels' }, schedule)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'duel_players' }, schedule)
      .subscribe()

    const onVisible = () => document.visibilityState === 'visible' && refetch()
    window.addEventListener('focus', refetch)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.removeEventListener('focus', refetch)
      document.removeEventListener('visibilitychange', onVisible)
      clearTimeout(timer.current)
      supabase.removeChannel(channel)
    }
  }, [userId, refetch])

  return { duels, loaded, refetch }
}
