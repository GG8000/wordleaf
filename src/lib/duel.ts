import { useSyncExternalStore } from 'react'

// The duel this tab is looking at (`?duel=K7QF`), or null for the normal room view
let duelId = normalize(new URLSearchParams(window.location.search).get('duel'))
const listeners = new Set<() => void>()

function normalize(id: string | null): string | null {
  const s = id?.trim().toUpperCase()
  return s ? s : null
}

export function getDuelId(): string | null {
  return duelId
}

/** Open a duel (or go back to the overview with null) and keep the URL shareable */
export function setDuelId(id: string | null) {
  duelId = normalize(id)
  const url = new URL(window.location.href)
  if (duelId) url.searchParams.set('duel', duelId)
  else url.searchParams.delete('duel')
  history.replaceState(null, '', url)
  listeners.forEach((l) => l())
}

export function useDuelId(): string | null {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => duelId,
  )
}

export function duelLink(id: string): string {
  const url = new URL(window.location.origin + window.location.pathname)
  url.searchParams.set('duel', id)
  return url.toString()
}
