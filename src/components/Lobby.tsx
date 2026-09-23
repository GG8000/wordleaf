import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { inviteLink, PUBLIC_ROOM } from '../lib/room'
import { rpc } from '../lib/rpc'
import { showToast } from '../lib/toast'
import type { Lang, Level } from '../lib/types'
import { Chat } from './Chat'
import { PlayerList } from './PlayerList'
import type { GameProps } from './types'

export function Lobby({ room, players, userId, online }: GameProps) {
  const { t } = useTranslation()
  const [busy, setBusy] = useState(false)
  const isHost = room.host_id === userId
  const host = players.find((p) => p.user_id === room.host_id)
  const me = players.find((p) => p.user_id === userId)
  const readyCount = players.filter((p) => p.ready).length
  const enoughPlayers = players.length >= 2 && players.length <= 10
  const levels = t('lobby.levels', { returnObjects: true }) as { name: string; desc: string }[]

  // Settings live on the room so everyone sees them; changing them resets all ready flags
  const saveSettings = (lang: Lang, level: Level, shuffle = room.allow_shuffle) =>
    rpc('set_settings', { p_card_lang: lang, p_level: level, p_allow_shuffle: shuffle }).catch(() => {})

  async function toggleReady() {
    setBusy(true)
    await rpc('set_ready', { p_ready: !me?.ready }).catch(() => {})
    setBusy(false)
  }

  async function share() {
    const url = inviteLink(room.id)
    try {
      await navigator.clipboard.writeText(url)
      showToast(t('lobby.linkCopied'))
    } catch {
      // No clipboard access (e.g. insecure context): fall back to the share sheet
      await navigator.share?.({ title: t('app.title'), url }).catch(() => {})
    }
  }

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <section className="flex flex-col gap-3">
        {room.id !== PUBLIC_ROOM && (
          <div className="flex items-center justify-between gap-3 rounded-2xl bg-leaf-100 p-4">
            <div>
              <p className="text-xs font-semibold uppercase text-leaf-800">{t('lobby.code')}</p>
              <p className="font-mono text-3xl font-extrabold tracking-[0.3em] text-leaf-900">{room.id}</p>
              <p className="text-xs text-leaf-800">{t('lobby.shareHint')}</p>
            </div>
            <button
              type="button"
              onClick={share}
              className="shrink-0 rounded-xl bg-leaf-600 px-3 py-2 text-sm font-bold text-white hover:bg-leaf-700"
            >
              {t('lobby.copyLink')}
            </button>
          </div>
        )}
        <h2 className="text-lg font-bold">{t('lobby.players', { count: players.length })}</h2>
        <PlayerList
          players={players}
          hostId={room.host_id}
          userId={userId}
          online={online}
          badge={(p) => (
            <span key={String(p.ready)} className="anim-pop" title={p.ready ? t('lobby.ready') : undefined}>
              {p.ready ? '✅' : '⏳'}
            </span>
          )}
          onKick={isHost ? (p) => rpc('kick_player', { p_user: p.user_id }).catch(() => {}) : undefined}
        />
        <div className="flex flex-col gap-2 rounded-2xl bg-white p-4 shadow-sm">
          <button
            type="button"
            onClick={toggleReady}
            disabled={busy || !me}
            className={`rounded-xl py-3 font-bold disabled:opacity-50 ${
              me?.ready
                ? 'border border-leaf-600 text-leaf-700 hover:bg-leaf-50'
                : 'bg-leaf-600 text-white hover:bg-leaf-700'
            }`}
          >
            {me?.ready ? t('lobby.unready') : t('lobby.ready')}
          </button>
          <p className="text-center text-sm font-semibold">
            {t('lobby.readyCount', { ready: readyCount, total: players.length })}
          </p>
          <p className="text-center text-sm text-stone-500">
            {enoughPlayers ? t('lobby.readyHint') : t('lobby.needPlayers')}
          </p>
        </div>
        <Chat room={room} userId={userId} />
        {!isHost && <p className="text-sm text-stone-500">{t('lobby.waitingHost', { name: host?.name ?? '…' })}</p>}
        <p className="text-xs text-stone-400">{t('lobby.hostTimeout')}</p>
      </section>
      <section className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 rounded-2xl bg-white p-4 shadow-sm">
          <label className="flex items-center justify-between gap-2 text-sm font-semibold">
            {t('lobby.cardLang')}
            <select
              value={room.card_lang}
              disabled={!isHost}
              onChange={(e) => saveSettings(e.target.value as Lang, room.level)}
              className="rounded-lg border border-stone-300 px-2 py-1 disabled:bg-stone-50"
            >
              {(['de', 'en', 'fr'] as const).map((l) => (
                <option key={l} value={l}>
                  {t(`langs.${l}`)}
                </option>
              ))}
            </select>
          </label>
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-sm font-semibold">{t('lobby.level')}</legend>
            {levels.map((l, i) => {
              const value = (i + 1) as Level
              const checked = room.level === value
              return (
                <label
                  key={value}
                  className={`flex gap-2 rounded-xl border p-2 text-sm ${
                    checked ? 'border-leaf-500 bg-leaf-50' : 'border-stone-200'
                  } ${isHost ? 'cursor-pointer hover:border-leaf-400' : ''}`}
                >
                  <input
                    type="radio"
                    name="level"
                    checked={checked}
                    disabled={!isHost}
                    onChange={() => saveSettings(room.card_lang, value)}
                    className="mt-0.5 accent-leaf-600"
                  />
                  <span>
                    <span className="font-semibold">
                      {'🍀'.repeat(value)} {l.name}
                    </span>
                    <span className="block text-stone-600">{l.desc}</span>
                  </span>
                </label>
              )
            })}
          </fieldset>
          <label className={`flex items-start gap-3 text-sm ${isHost ? 'cursor-pointer' : ''}`}>
            <input
              type="checkbox"
              checked={room.allow_shuffle}
              disabled={!isHost}
              onChange={(e) => saveSettings(room.card_lang, room.level, e.target.checked)}
              className="mt-0.5 h-4 w-4 accent-leaf-600"
            />
            <span>
              <span className="font-semibold">🔀 {t('lobby.shuffle')}</span>
              <span className="block text-stone-600">{t('lobby.shuffleDesc')}</span>
            </span>
          </label>
          {isHost && <p className="text-xs text-stone-500">{t('lobby.settingsHint')}</p>}
        </div>
        <div className="rounded-2xl bg-white/70 p-4 shadow-sm">
          <h2 className="mb-2 text-lg font-bold">{t('lobby.rulesTitle')}</h2>
          <ol className="list-decimal space-y-2 pl-5 text-sm text-stone-700">
            {(t('lobby.rules', { returnObjects: true }) as string[]).map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ol>
        </div>
      </section>
    </div>
  )
}
