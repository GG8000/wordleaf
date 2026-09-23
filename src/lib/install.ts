import { useSyncExternalStore } from 'react'

// Chrome/Edge/Samsung fire `beforeinstallprompt` when the site can be installed.
// We keep it so the "Install app" button can open the native dialog; Safari has
// no such event, so iOS players get step-by-step instructions instead.
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export type Platform = 'ios' | 'android' | 'other'

let deferred: BeforeInstallPromptEvent | null = null
let installed =
  matchMedia('(display-mode: standalone)').matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true
const listeners = new Set<() => void>()

function emit() {
  listeners.forEach((l) => l())
}

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault()
  deferred = e as BeforeInstallPromptEvent
  emit()
})

window.addEventListener('appinstalled', () => {
  deferred = null
  installed = true
  emit()
})

export function detectPlatform(): Platform {
  const ua = navigator.userAgent
  // iPadOS reports itself as a Mac, but Macs have no touch screen
  if (/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return 'ios'
  if (/Android/.test(ua)) return 'android'
  return 'other'
}

/** Open the browser's own install dialog. Returns false if there is none to show. */
export async function promptInstall(): Promise<boolean> {
  if (!deferred) return false
  const e = deferred
  deferred = null // each event can only be prompted once
  emit()
  await e.prompt()
  return true
}

function subscribe(l: () => void) {
  listeners.add(l)
  return () => listeners.delete(l)
}

/** `installed`: running from the home screen. `canPrompt`: a native install dialog is available. */
export function useInstall(): { installed: boolean; canPrompt: boolean } {
  const isInstalled = useSyncExternalStore(subscribe, () => installed)
  const canPrompt = useSyncExternalStore(subscribe, () => deferred !== null)
  return { installed: isInstalled, canPrompt }
}
