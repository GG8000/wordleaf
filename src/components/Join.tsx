import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { shareLocation } from '../lib/geo'
import { setDuelId } from '../lib/duel'
import { normalizeRoom, PUBLIC_ROOM, setRoomId, useRoomId } from '../lib/room'
import { createDuel, createRoom, duelRpc, rpc } from '../lib/rpc'
import { supabase } from '../lib/supabase'
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
  /** Opened from a duel link: join that duel instead of a room */
  duelId?: string | null
}

function savedName(): string {
  try {
    return localStorage.getItem(NAME_KEY) ?? ''
  } catch {
    return ''
  }
}

export function Join({ ensureSession, hasSession, onJoined, status, duelId }: Props) {
  const { t, i18n } = useTranslation()
  const [name, setName] = useState(savedName)
  const [busy, setBusy] = useState(false)
  const [code, setCode] = useState('')
  const roomId = useRoomId()
  const isPublic = roomId === PUBLIC_ROOM && !duelId
  const inProgress = !duelId && (status === 'writing' || status === 'guessing')

  // Captcha only guards the anonymous sign-in, so returning players never see it
  const needsCaptcha = Boolean(TURNSTILE_SITE_KEY) && !hasSession
  const [captchaToken, setCaptchaToken] = useState<string | null>(null)
  const [captchaRound, setCaptchaRound] = useState(0) // bump to get a fresh single-use token
  const [captchaBroken, setCaptchaBroken] = useState(false)

  /** Sign in if needed, then join the public table, a lobby or duel by code, or start a private lobby or duel */
  async function enter(target: 'current' | 'code' | 'create' | 'duel') {
    setBusy(true)
    try {
      try {
        await ensureSession(captchaToken ?? undefined)
      } catch (err) {
        showToast(t(needsCaptcha ? 'login.captchaFailed' : 'errors.generic', { msg: (err as Error).message }))
        setCaptchaRound((n) => n + 1)
        return
      }
      if (target === 'create') {
        setRoomId(await createRoom(name.trim()))
      } else if (target === 'duel') {
        setDuelId(await createDuel(name.trim(), i18n.language))
      } else if (target === 'current' && duelId) {
        await duelRpc('join_duel', { p_name: name.trim() })
      } else if (target === 'code' && (await isDuelCode(code))) {
        const id = normalizeRoom(code)
        await duelRpc('join_duel', { p_duel: id, p_name: name.trim() })
        setDuelId(id)
      } else {
        const room = target === 'code' ? normalizeRoom(code) : roomId
        await rpc('join_room', { p_name: name.trim(), p_room: room })
        setRoomId(room)
      }
      try {
        localStorage.setItem(NAME_KEY, name.trim())
      } catch {
        // storage unavailable
      }
      void shareLocation()
      onJoined()
    } catch {
      // toast already shown
    } finally {
      setBusy(false)
    }
  }

  function submit(e: FormEvent) {
    e.preventDefault()
    enter('current')
  }

  const canSubmit = !busy && Boolean(name.trim()) && !(needsCaptcha && !captchaToken)

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
        disabled={!canSubmit}
        className="rounded-xl bg-leaf-600 py-3 font-bold text-white hover:bg-leaf-700 disabled:opacity-50"
      >
        {busy
          ? t('login.joining')
          : inProgress
            ? t('login.retry')
            : duelId
              ? t('duel.accept', { code: duelId })
              : isPublic
                ? t('login.joinPublic')
                : t('login.joinLobby', { code: roomId })}
      </button>
      {isPublic ? (
        <>
          <div className="flex items-center gap-3 text-xs text-stone-400">
            <span className="h-px flex-1 bg-stone-200" />
            {t('login.or')}
            <span className="h-px flex-1 bg-stone-200" />
          </div>
          <button
            type="button"
            onClick={() => enter('create')}
            disabled={!canSubmit}
            className="rounded-xl border border-leaf-600 py-2.5 font-bold text-leaf-700 hover:bg-leaf-50 disabled:opacity-50"
          >
            {t('login.createLobby')}
          </button>
          <button
            type="button"
            onClick={() => enter('duel')}
            disabled={!canSubmit}
            className="rounded-xl border border-leaf-600 py-2.5 font-bold text-leaf-700 hover:bg-leaf-50 disabled:opacity-50"
          >
            {t('duel.create')}
          </button>
          <p className="-mt-2 text-center text-xs text-stone-500">{t('duel.createHint')}</p>
          <div className="flex flex-col gap-1">
            <span className="text-sm font-semibold text-stone-700">{t('login.haveCode')}</span>
            <div className="flex gap-2">
              <input
                className="min-w-0 flex-1 rounded-xl border border-stone-300 px-3 py-2 font-mono text-base uppercase tracking-widest focus:border-leaf-500 focus:outline-none"
                value={code}
                maxLength={8}
                placeholder={t('login.codePlaceholder')}
                aria-label={t('login.haveCode')}
                autoCapitalize="characters"
                autoComplete="off"
                onChange={(e) => setCode(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    if (canSubmit && code.trim()) enter('code')
                  }
                }}
              />
              <button
                type="button"
                onClick={() => enter('code')}
                disabled={!canSubmit || !code.trim()}
                className="rounded-xl bg-stone-800 px-4 font-bold text-white hover:bg-stone-900 disabled:opacity-50"
              >
                {t('login.joinCode')}
              </button>
            </div>
          </div>
        </>
      ) : (
        <button
          type="button"
          onClick={() => (duelId ? setDuelId(null) : setRoomId(PUBLIC_ROOM))}
          className="text-sm text-stone-500 underline hover:text-leaf-700"
        >
          {duelId ? t('duel.back') : t('login.backToPublic')}
        </button>
      )}
    </form>
  )
}

/** Room and duel codes share one namespace: a code that isn't a room is treated as a duel */
async function isDuelCode(code: string): Promise<boolean> {
  const id = normalizeRoom(code)
  if (id === PUBLIC_ROOM) return false
  const { data } = await supabase.rpc('get_room', { p_room: id })
  return !(data as unknown[] | null)?.length
}
