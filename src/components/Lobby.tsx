import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { rpc } from '../lib/rpc'
import type { Lang, Level } from '../lib/types'
import { PlayerList } from './PlayerList'
import type { GameProps } from './types'

export function Lobby({ room, players, userId, online }: GameProps) {
  const { t } = useTranslation()
  const [lang, setLang] = useState<Lang>(room.card_lang)
  const [level, setLevel] = useState<Level>(room.level)
  const [busy, setBusy] = useState(false)
  const isHost = room.host_id === userId
  const host = players.find((p) => p.user_id === room.host_id)
  const canStart = players.length >= 2 && players.length <= 10
  const levels = t('lobby.levels', { returnObjects: true }) as { name: string; desc: string }[]
  // Guests see the level of the last game; the host's pick is only saved on start
  const shownLevel = isHost ? level : room.level

  async function start() {
    setBusy(true)
    await rpc('start_game', { p_card_lang: lang, p_level: level }).catch(() => {})
    setBusy(false)
  }

  const levelPicker = (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1 text-sm font-semibold">{t('lobby.level')}</legend>
      {levels.map((l, i) => {
        const value = (i + 1) as Level
        const checked = shownLevel === value
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
              onChange={() => setLevel(value)}
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
  )

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-bold">{t('lobby.players', { count: players.length })}</h2>
        <PlayerList
          players={players}
          hostId={room.host_id}
          userId={userId}
          online={online}
          onKick={isHost ? (p) => rpc('kick_player', { p_user: p.user_id }).catch(() => {}) : undefined}
        />
        {isHost ? (
          <div className="flex flex-col gap-3 rounded-2xl bg-white p-4 shadow-sm">
            <label className="flex items-center justify-between gap-2 text-sm font-semibold">
              {t('lobby.cardLang')}
              <select
                value={lang}
                onChange={(e) => setLang(e.target.value as Lang)}
                className="rounded-lg border border-stone-300 px-2 py-1"
              >
                {(['de', 'en', 'fr'] as const).map((l) => (
                  <option key={l} value={l}>
                    {t(`langs.${l}`)}
                  </option>
                ))}
              </select>
            </label>
            {levelPicker}
            <button
              type="button"
              onClick={start}
              disabled={!canStart || busy}
              className="rounded-xl bg-leaf-600 py-3 font-bold text-white hover:bg-leaf-700 disabled:opacity-50"
            >
              {t('lobby.start')}
            </button>
            {!canStart && <p className="text-sm text-stone-500">{t('lobby.needPlayers')}</p>}
          </div>
        ) : (
          <>
            <p className="text-stone-600">{t('lobby.waitingHost', { name: host?.name ?? '…' })}</p>
            <div className="rounded-2xl bg-white p-4 shadow-sm">{levelPicker}</div>
          </>
        )}
      </section>
      <section className="rounded-2xl bg-white/70 p-4 shadow-sm">
        <h2 className="mb-2 text-lg font-bold">{t('lobby.rulesTitle')}</h2>
        <ol className="list-decimal space-y-2 pl-5 text-sm text-stone-700">
          {(t('lobby.rules', { returnObjects: true }) as string[]).map((r, i) => (
            <li key={i}>{r}</li>
          ))}
        </ol>
      </section>
    </div>
  )
}
