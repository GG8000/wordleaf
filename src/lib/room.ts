import { useSyncExternalStore } from 'react'

export const PUBLIC_ROOM = 'main'

// The room this tab is looking at: the public table, or a private lobby from `?room=K7QF`
let roomId = normalizeRoom(new URLSearchParams(window.location.search).get('room') ?? PUBLIC_ROOM)
const listeners = new Set<() => void>()

/** Codes are typed by people: accept lower case and stray spaces */
export function normalizeRoom(id: string): string {
  const s = id.trim()
  return !s || s.toLowerCase() === PUBLIC_ROOM ? PUBLIC_ROOM : s.toUpperCase()
}

export function getRoomId(): string {
  return roomId
}

/** Switch rooms and keep the URL shareable (other params like `?p=` stay) */
export function setRoomId(id: string) {
  roomId = normalizeRoom(id)
  const url = new URL(window.location.href)
  if (roomId === PUBLIC_ROOM) url.searchParams.delete('room')
  else url.searchParams.set('room', roomId)
  history.replaceState(null, '', url)
  listeners.forEach((l) => l())
}

export function useRoomId(): string {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => roomId,
  )
}

export function inviteLink(id: string): string {
  const url = new URL(window.location.origin + window.location.pathname)
  url.searchParams.set('room', id)
  return url.toString()
}
