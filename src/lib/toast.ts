import { useSyncExternalStore } from 'react'

// Tiny global store for a single error/info message
let message: string | null = null
let timer: ReturnType<typeof setTimeout> | undefined
const listeners = new Set<() => void>()

function emit() {
  listeners.forEach((l) => l())
}

export function showToast(text: string) {
  message = text
  clearTimeout(timer)
  timer = setTimeout(() => {
    message = null
    emit()
  }, 4000)
  emit()
}

export function useToast(): string | null {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => message,
  )
}
