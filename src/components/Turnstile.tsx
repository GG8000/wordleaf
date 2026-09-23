import { useEffect, useRef, useState } from 'react'

/** Unset = no captcha (e.g. local development without a key) */
export const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined

const SCRIPT_URL = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'

interface TurnstileApi {
  render(el: HTMLElement, options: Record<string, unknown>): string
  remove(widgetId: string): void
}

declare global {
  interface Window {
    turnstile?: TurnstileApi
  }
}

// Loaded once, on first use; a failed load can be retried
let loading: Promise<TurnstileApi> | undefined
function loadTurnstile(): Promise<TurnstileApi> {
  loading ??= new Promise<TurnstileApi>((resolve, reject) => {
    const script = document.createElement('script')
    script.src = SCRIPT_URL
    script.async = true
    script.onload = () => (window.turnstile ? resolve(window.turnstile) : reject(new Error('turnstile_missing')))
    script.onerror = () => reject(new Error('turnstile_load_failed'))
    document.head.appendChild(script)
  }).catch((e: unknown) => {
    loading = undefined
    throw e
  })
  return loading
}

interface Props {
  siteKey: string
  lang: string
  /** Fresh token, or null when it expired or the check failed */
  onToken: (token: string | null) => void
  /** The script could not be loaded (content blocker, offline) */
  onLoadError: () => void
}

/** Cloudflare Turnstile widget. Tokens are single-use: remount it (change its key) for a new one. */
export function Turnstile({ siteKey, lang, onToken, onLoadError }: Props) {
  const box = useRef<HTMLDivElement>(null)
  const callbacks = useRef({ onToken, onLoadError })
  callbacks.current = { onToken, onLoadError }
  const [rendered, setRendered] = useState(false)

  useEffect(() => {
    let widgetId: string | undefined
    let cancelled = false
    loadTurnstile().then(
      (api) => {
        if (cancelled || !box.current) return
        widgetId = api.render(box.current, {
          sitekey: siteKey,
          language: lang,
          theme: 'light',
          size: 'flexible',
          callback: (token: string) => callbacks.current.onToken(token),
          'expired-callback': () => callbacks.current.onToken(null),
          'timeout-callback': () => callbacks.current.onToken(null),
          'error-callback': () => callbacks.current.onToken(null),
        })
        setRendered(true)
      },
      () => !cancelled && callbacks.current.onLoadError(),
    )
    return () => {
      cancelled = true
      if (widgetId) window.turnstile?.remove(widgetId)
      callbacks.current.onToken(null)
    }
  }, [siteKey, lang])

  // Reserve the widget's height so the form doesn't jump when it appears
  return <div ref={box} className={rendered ? '' : 'min-h-[65px]'} />
}
