import { useCallback, useEffect, useRef, useState } from 'react'
import { ROOM_ID, supabase } from '../lib/supabase'
import type { Card, Clover, Player, Room, Solution } from '../lib/types'

export interface RoomData {
  room: Room | null
  players: Player[]
  clovers: Clover[]
  cards: Card[]
  solutions: Solution[]
  loaded: boolean
}

const empty: RoomData = { room: null, players: [], clovers: [], cards: [], solutions: [], loaded: false }

// Keep whichever room snapshot is newer (realtime and refetch can race)
function newer(a: Room | null, b: Room | null): Room | null {
  if (!a) return b
  if (!b) return a
  return time(b.updated_at) >= time(a.updated_at) ? b : a
}

// Realtime and PostgREST format timestamps slightly differently
function time(ts: string): number {
  return Date.parse(ts.replace(' ', 'T').replace(/([+-]\d\d)$/, '$1:00'))
}

export function useRoom(userId: string | null) {
  const [data, setData] = useState<RoomData>(empty)
  const [online, setOnline] = useState<Set<string>>(new Set())
  const roomRef = useRef<Room | null>(null)
  const seq = useRef(0)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const refetch = useCallback(async () => {
    const id = ++seq.current
    const [r, p, c, k, s] = await Promise.all([
      supabase.from('rooms').select('*').eq('id', ROOM_ID).single(),
      supabase.from('room_players').select('user_id,name,joined_at,ready').eq('room_id', ROOM_ID).order('joined_at'),
      supabase.from('clovers').select('owner_id,owner_name,clues,submitted,points,revealed').eq('room_id', ROOM_ID),
      supabase.from('cards').select('id,owner_id,words,tray_order').eq('room_id', ROOM_ID).order('tray_order'),
      supabase.from('solutions').select('card_id,owner_id,slot,rotation').eq('room_id', ROOM_ID),
    ])
    if (id !== seq.current) return // a newer refetch is in flight
    setData((prev) => {
      const room = newer(prev.room, (r.data as Room) ?? null)
      roomRef.current = room
      return {
        room,
        players: (p.data as Player[]) ?? [],
        clovers: (c.data as Clover[]) ?? [],
        cards: (k.data as Card[]) ?? [],
        solutions: (s.data as Solution[]) ?? [],
        loaded: true,
      }
    })
  }, [])

  const scheduleRefetch = useCallback(() => {
    clearTimeout(timer.current)
    timer.current = setTimeout(refetch, 80)
  }, [refetch])

  /** Optimistic local change to the room row; realtime brings the real state */
  const patchRoom = useCallback((patch: Partial<Room>) => {
    setData((prev) => {
      if (!prev.room) return prev
      const room = { ...prev.room, ...patch }
      roomRef.current = room
      return { ...prev, room }
    })
  }, [])

  useEffect(() => {
    if (!userId) {
      setData(empty)
      return
    }
    refetch()

    const channel = supabase.channel(`room:${ROOM_ID}`, { config: { presence: { key: userId } } })
    channel
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rooms', filter: `id=eq.${ROOM_ID}` }, (payload) => {
        const next = payload.new as Room
        const prev = roomRef.current
        // Phase or turn changes affect cards/solutions/clovers too
        if (
          !prev ||
          prev.status !== next.status ||
          prev.current_turn !== next.current_turn ||
          prev.revealing !== next.revealing ||
          prev.turn_order.join() !== next.turn_order.join()
        ) {
          scheduleRefetch()
        }
        roomRef.current = newer(prev, next)
        setData((d) => ({ ...d, room: newer(d.room, next) }))
      })
      // DELETE events cannot be filtered, so listen to the whole table (one room anyway)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'room_players' }, scheduleRefetch)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'clovers' }, scheduleRefetch)
      .on('presence', { event: 'sync' }, () => setOnline(new Set(Object.keys(channel.presenceState()))))
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          channel.track({ online_at: new Date().toISOString() })
          refetch()
        }
      })

    const onFocus = () => refetch()
    window.addEventListener('focus', onFocus)
    return () => {
      window.removeEventListener('focus', onFocus)
      clearTimeout(timer.current)
      supabase.removeChannel(channel)
    }
  }, [userId, refetch, scheduleRefetch])

  return { ...data, online, refetch, patchRoom }
}
