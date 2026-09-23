import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { POINTS_PERFECT, ratingTier } from '../lib/clover'
import { playEffect } from '../lib/effects'
import { rpc } from '../lib/rpc'
import type { GameProps } from './types'

/** Counts from 0 up to `target` over about a second */
function useCountUp(target: number): number {
  const [value, setValue] = useState(0)
  useEffect(() => {
    if (target <= 0) return setValue(0)
    let n = 0
    const id = setInterval(() => {
      n += 1
      setValue(n)
      if (n >= target) clearInterval(id)
    }, Math.max(20, 1000 / target))
    return () => clearInterval(id)
  }, [target])
  return value
}

export function Results({ room, clovers, players, userId }: GameProps) {
  const { t } = useTranslation()
  const isHost = room.host_id === userId
  const ordered = room.turn_order.map((id) => clovers.find((c) => c.owner_id === id)).filter((c) => c !== undefined)
  const max = ordered.length * POINTS_PERFECT
  const tier = ratingTier(room.score, max)
  const host = players.find((p) => p.user_id === room.host_id)
  const shown = useCountUp(room.score)

  // Party for a great score, a sad little leaf shower for a bad one
  const celebrated = useRef(false)
  useEffect(() => {
    if (celebrated.current) return
    celebrated.current = true
    if (tier >= 3) playEffect({ kind: 'rain', emojis: ['🍀', '🎉', '🏆', '✨'], count: 48 })
    else if (tier === 0) playEffect({ kind: 'rain', emojis: ['🍂', '🍁'], count: 16, slow: true })
  }, [tier])

  return (
    <div className="mx-auto flex max-w-md flex-col gap-4 text-center">
      <h2 className="text-2xl font-bold">{t('results.title')}</h2>
      <div className="rounded-3xl bg-white p-6 shadow">
        <div className="text-5xl">
          {Array.from({ length: Math.max(tier, 1) }, (_, i) => (
            <span key={i} className="anim-deal inline-block" style={{ animationDelay: `${300 + i * 200}ms` }}>
              🍀
            </span>
          ))}
        </div>
        <p className="mt-2 text-xl font-bold text-leaf-700">{t('results.score', { score: shown, max })}</p>
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
        // Everyone confirms again with the ready check in the lobby
        <button
          type="button"
          onClick={() => rpc('back_to_lobby').catch(() => {})}
          className="mx-auto rounded-xl bg-leaf-600 px-5 py-3 font-bold text-white hover:bg-leaf-700"
        >
          {t('results.newGame')}
        </button>
      ) : (
        <p className="text-stone-600">{t('lobby.waitingHost', { name: host?.name ?? '…' })}</p>
      )}
    </div>
  )
}
