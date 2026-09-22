import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { rpc } from '../lib/rpc'
import type { Status } from '../lib/types'

const NAME_KEY = 'kleever-name'

interface Props {
  ensureSession: () => Promise<unknown>
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

export function Join({ ensureSession, onJoined, status }: Props) {
  const { t } = useTranslation()
  const [name, setName] = useState(savedName)
  const [busy, setBusy] = useState(false)
  const inProgress = status === 'writing' || status === 'guessing'

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    try {
      await ensureSession()
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
          className="rounded-xl border border-stone-300 px-3 py-2 text-base font-normal focus:border-emerald-500 focus:outline-none"
          value={name}
          maxLength={20}
          placeholder={t('login.placeholder')}
          onChange={(e) => setName(e.target.value)}
          autoFocus
        />
      </label>
      {inProgress && <p className="rounded-xl bg-amber-100 p-3 text-sm text-amber-900">{t('login.inProgress')}</p>}
      <button
        type="submit"
        disabled={busy || !name.trim()}
        className="rounded-xl bg-emerald-600 py-3 font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
      >
        {busy ? t('login.joining') : inProgress ? t('login.retry') : t('login.join')}
      </button>
    </form>
  )
}
