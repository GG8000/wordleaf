import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { rpc } from '../lib/rpc'
import type { Lang } from '../lib/types'
import { PlayerList } from './PlayerList'
import type { GameProps } from './types'

export function Lobby({ room, players, userId, online }: GameProps) {
  const { t } = useTranslation()
  const [lang, setLang] = useState<Lang>(room.card_lang)
  const [busy, setBusy] = useState(false)
  const isHost = room.host_id === userId
  const host = players.find((p) => p.user_id === room.host_id)
  const canStart = players.length >= 2 && players.length <= 10

  async function start() {
    setBusy(true)
    await rpc('start_game', { p_card_lang: lang }).catch(() => {})
    setBusy(false)
  }

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
            <button
              type="button"
              onClick={start}
              disabled={!canStart || busy}
              className="rounded-xl bg-emerald-600 py-3 font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {t('lobby.start')}
            </button>
            {!canStart && <p className="text-sm text-stone-500">{t('lobby.needPlayers')}</p>}
          </div>
        ) : (
          <p className="text-stone-600">{t('lobby.waitingHost', { name: host?.name ?? '…' })}</p>
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
