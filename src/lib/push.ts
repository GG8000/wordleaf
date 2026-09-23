import { useSyncExternalStore } from 'react'
import i18n from '../i18n'
import { supabase } from './supabase'

// Web Push for duels: the service worker (public/push-sw.js) shows the messages that the
// send-push Edge Function sends. iOS only allows push in the installed app (iOS 16.4+).

const VAPID_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined

export type PushState = 'unsupported' | 'denied' | 'off' | 'on'

let state: PushState = 'unsupported'
const listeners = new Set<() => void>()

function setState(s: PushState) {
  state = s
  listeners.forEach((l) => l())
}

export function isPushSupported(): boolean {
  return Boolean(VAPID_KEY) && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
}

function keyBytes(base64: string): Uint8Array<ArrayBuffer> {
  const padded = (base64 + '='.repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(padded)
  const bytes = new Uint8Array(new ArrayBuffer(raw.length))
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i)
  return bytes
}

async function save(sub: PushSubscription) {
  const json = sub.toJSON()
  const { error } = await supabase.rpc('save_push_subscription', {
    p_endpoint: sub.endpoint,
    p_p256dh: json.keys?.p256dh,
    p_auth: json.keys?.auth,
    p_lang: i18n.language,
  })
  if (error) throw error
}

/**
 * Check the current state, and if push is on, store the subscription again for the signed-in
 * user (endpoints can change, and the language may have). Call on start and after sign-in.
 */
export async function syncPush(): Promise<void> {
  if (!isPushSupported()) return setState('unsupported')
  if (Notification.permission === 'denied') return setState('denied')
  const reg = await navigator.serviceWorker.getRegistration()
  const sub = await reg?.pushManager.getSubscription()
  if (!sub || Notification.permission !== 'granted') return setState('off')
  setState('on')
  await save(sub).catch(() => {})
}

/** Ask for permission (must run from a click) and subscribe. Returns the new state. */
export async function enablePush(): Promise<PushState> {
  if (!isPushSupported()) {
    setState('unsupported')
    return state
  }
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') {
    setState(permission === 'denied' ? 'denied' : 'off')
    return state
  }
  const reg = await navigator.serviceWorker.ready
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(VAPID_KEY!) }))
  await save(sub)
  setState('on')
  return state
}

export async function disablePush(): Promise<void> {
  const reg = await navigator.serviceWorker.getRegistration()
  const sub = await reg?.pushManager.getSubscription()
  if (sub) {
    await supabase.rpc('delete_push_subscription', { p_endpoint: sub.endpoint })
    await sub.unsubscribe()
  }
  setState('off')
}

export function usePushState(): PushState {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => state,
  )
}

/** A tapped notification in an already open app: switch to its duel instead of reloading */
export function listenForOpenDuel(open: (duelId: string) => void): () => void {
  if (!('serviceWorker' in navigator)) return () => {}
  const onMessage = (e: MessageEvent) => {
    if (e.data?.type !== 'open-duel') return
    const id = new URL(e.data.url, window.location.origin).searchParams.get('duel')
    if (id) open(id)
  }
  navigator.serviceWorker.addEventListener('message', onMessage)
  return () => navigator.serviceWorker.removeEventListener('message', onMessage)
}
