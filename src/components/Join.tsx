import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { rpc } from '../lib/rpc'
import { showToast } from '../lib/toast'
import type { Status } from '../lib/types'
import { Turnstile, TURNSTILE_SITE_KEY } from './Turnstile'

const NAME_KEY = 'wordleaf-name'

interface Props {
  ensureSession: (captchaToken?: string) => Promise<unknown>
  /** Signed in already: no captcha needed */
  hasSession: boolean
  onJoined: () => void
  status?: Status
}

function savedName(): string {
  try {
    return localStorage.getItem(NAME_KEY) ?? ''
  } catch {
    return ''
  }
}

export function Join({ ensureSession, hasSession, onJoined, status }: Props) {
  const { t, i18n } = useTranslation()
  const [name, setName] = useState(savedName)
  const [busy, setBusy] = useState(false)
  const inProgress = status === 'writing' || status === 'guessing'

  // Captcha only guards the anonymous sign-in, so returning players never see it
  const needsCaptcha = Boolean(TURNSTILE_SITE_KEY) && !hasSession
  const [captchaToken, setCaptchaToken] = useState<string | null>(null)
  const [captchaRound, setCaptchaRound] = useState(0) // bump to get a fresh single-use token
  const [captchaBroken, setCaptchaBroken] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    try {
      try {
        await ensureSession(captchaToken ?? undefined)
      } catch (err) {
        showToast(t(needsCaptcha ? 'login.captchaFailed' : 'errors.generic', { msg: (err as Error).message }))
        setCaptchaRound((n) => n + 1)
        return
      }
      await rpc('join_room', { p_name: name.trim() })
      try {
        localStorage.setItem(NAME_KEY, name.trim())
      } catch {
        // storage unavailable
      }
      onJoined()
    } catch {
      // toast already shown
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="mx-auto mt-10 flex max-w-sm flex-col gap-4 rounded-3xl bg-white p-6 shadow-lg">
      <div className="text-center text-6xl">🍀</div>
      <p className="text-center text-stone-600">{t('app.tagline')}</p>
      <label className="flex flex-col gap-1 text-sm font-semibold text-stone-700">
        {t('login.nickname')}
        <input
          className="rounded-xl border border-stone-300 px-3 py-2 text-base font-normal focus:border-leaf-500 focus:outline-none"
          value={name}
          maxLength={20}
          placeholder={t('login.placeholder')}
          onChange={(e) => setName(e.target.value)}
          autoFocus
        />
      </label>
      {needsCaptcha &&
        (captchaBroken ? (
          <p className="rounded-xl bg-rose-100 p-3 text-sm text-rose-900">{t('login.captchaBlocked')}</p>
        ) : (
          <Turnstile
            key={`${i18n.language}-${captchaRound}`}
            siteKey={TURNSTILE_SITE_KEY!}
            lang={i18n.language}
            onToken={setCaptchaToken}
            onLoadError={() => setCaptchaBroken(true)}
          />
        ))}
      {inProgress && <p className="rounded-xl bg-amber-100 p-3 text-sm text-amber-900">{t('login.inProgress')}</p>}
      <button
        type="submit"
        disabled={busy || !name.trim() || (needsCaptcha && !captchaToken)}
        className="rounded-xl bg-leaf-600 py-3 font-bold text-white hover:bg-leaf-700 disabled:opacity-50"
      >
        {busy ? t('login.joining') : inProgress ? t('login.retry') : t('login.join')}
      </button>
    </form>
  )
}
