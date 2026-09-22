import { useTranslation } from 'react-i18next'
import { POINTS_PERFECT, ratingTier } from '../lib/clover'
import { rpc } from '../lib/rpc'
import type { GameProps } from './types'

export function Results({ room, clovers, players, userId }: GameProps) {
  const { t } = useTranslation()
  const isHost = room.host_id === userId
  const ordered = room.turn_order.map((id) => clovers.find((c) => c.owner_id === id)).filter((c) => c !== undefined)
  const max = ordered.length * POINTS_PERFECT
  const tier = ratingTier(room.score, max)
  const host = players.find((p) => p.user_id === room.host_id)

  return (
    <div className="mx-auto flex max-w-md flex-col gap-4 text-center">
      <h2 className="text-2xl font-bold">{t('results.title')}</h2>
      <div className="rounded-3xl bg-white p-6 shadow">
        <div className="text-5xl">{'🍀'.repeat(Math.max(tier, 1))}</div>
        <p className="mt-2 text-xl font-bold text-emerald-700">{t('results.score', { score: room.score, max })}</p>
        <p className="text-stone-600">{(t('results.tiers', { returnObjects: true }) as string[])[tier]}</p>
      </div>
      <ul className="flex flex-col gap-1 text-left">
        {ordered.map((c) => (
          <li key={c.owner_id} className="flex justify-between rounded-xl bg-white px-4 py-2 shadow-sm">
            <span>
              {c.owner_name}
              {!players.some((p) => p.user_id === c.owner_id) && <span className="text-stone-400"> ({t('results.left')})</span>}
            </span>
            <span className="font-semibold">{t('common.points', { count: c.points ?? 0 })}</span>
          </li>
        ))}
      </ul>
      {isHost ? (
        <div className="flex justify-center gap-3">
          <button
            type="button"
            onClick={() => rpc('start_game', { p_card_lang: room.card_lang }).catch(() => {})}
            className="rounded-xl bg-emerald-600 px-5 py-3 font-bold text-white hover:bg-emerald-700"
          >
            {t('results.newGame')}
          </button>
          <button
            type="button"
            onClick={() => rpc('back_to_lobby').catch(() => {})}
            className="rounded-xl border border-emerald-600 px-5 py-3 font-semibold text-emerald-700 hover:bg-emerald-50"
          >
            {t('results.backToLobby')}
          </button>
        </div>
      ) : (
        <p className="text-stone-600">{t('lobby.waitingHost', { name: host?.name ?? '…' })}</p>
      )}
    </div>
  )
}
