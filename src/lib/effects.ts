import { useSyncExternalStore } from 'react'

// Full-screen fun effects (confetti rain, shuffle flurry, splash text), same store idea as toast.ts

export interface Drop {
  emoji: string
  left: number // vw
  delay: number // s
  duration: number // s
  size: number // rem
  spin: number // deg
}

export type Effect =
  | { id: number; kind: 'rain'; drops: Drop[] }
  | { id: number; kind: 'shuffle'; text: string }
  | { id: number; kind: 'splash'; text: string }

type NewEffect =
  | { kind: 'rain'; emojis: string[]; count?: number; slow?: boolean }
  | { kind: 'shuffle'; text: string }
  | { kind: 'splash'; text: string }

const DURATION = { rain: 5000, shuffle: 2200, splash: 1400 }

let effects: Effect[] = []
let nextId = 1
const listeners = new Set<() => void>()

function set(next: Effect[]) {
  effects = next
  listeners.forEach((l) => l())
}

function drops(emojis: string[], count: number, slow: boolean): Drop[] {
  return Array.from({ length: count }, () => ({
    emoji: emojis[Math.floor(Math.random() * emojis.length)],
    left: Math.random() * 96,
    delay: Math.random() * (slow ? 1.5 : 0.9),
    duration: (slow ? 3 : 1.8) + Math.random() * 1.4,
    size: 1.2 + Math.random() * 1.4,
    spin: (Math.random() - 0.5) * 720,
  }))
}

export function playEffect(e: NewEffect) {
  const id = nextId++
  const effect: Effect =
    e.kind === 'rain' ? { id, kind: 'rain', drops: drops(e.emojis, e.count ?? 36, e.slow ?? false) } : { id, ...e }
  set([...effects, effect])
  setTimeout(() => set(effects.filter((x) => x.id !== id)), DURATION[e.kind])
}

export function useEffects(): Effect[] {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => effects,
  )
}
