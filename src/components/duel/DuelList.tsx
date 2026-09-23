import { useTranslation } from 'react-i18next'
import { POINTS_PERFECT } from '../../lib/clover'
import { setDuelId } from '../../lib/duel'
import type { DuelSummary } from '../../lib/types'
import { PushPrompt } from './PushPrompt'

interface Props {
  duels: DuelSummary[]
  onShowInstall: () => void
}

/** "My duels" under the join form: your turn first, then the most recent */
export function DuelList({ duels, onShowInstall }: Props) {
  const { t } = useTranslation()
  if (duels.length === 0) return null
  const sorted = [...duels].sort((a, b) => Number(b.my_turn) - Number(a.my_turn) || b.updated_at.localeCompare(a.updated_at))

  function statusText(d: DuelSummary): string {
    if (d.my_turn) return d.status === 'writing' ? t('duel.list.yourWrite') : t('duel.list.yourGuess')
    switch (d.status) {
      case 'waiting':
        return t('duel.list.waiting', { code: d.id })
      case 'finished':
        return t('results.score', { score: d.score, max: 2 * POINTS_PERFECT })
      case 'abandoned':
        return t('duel.list.abandoned')
      default:
        return t('duel.list.theirTurn', { name: d.opponent_name ?? '…' })
    }
  }

  return (
    <section className="mx-auto mt-6 flex max-w-sm flex-col gap-3">
      <h2 className="text-center font-bold text-leaf-800">{t('duel.list.title')}</h2>
      <ul className="flex flex-col gap-2">
        {sorted.map((d) => (
          <li key={d.id}>
            <button
              type="button"
              onClick={() => setDuelId(d.id)}
              className={`flex w-full items-center justify-between gap-3 rounded-2xl px-4 py-3 text-left shadow-sm transition-colors ${
                d.my_turn ? 'bg-leaf-600 text-white hover:bg-leaf-700' : 'bg-white hover:bg-leaf-50'
              } ${d.status === 'finished' || d.status === 'abandoned' ? 'opacity-75' : ''}`}
            >
              <span className="flex min-w-0 flex-col">
                <span className="truncate font-semibold">{d.opponent_name ? t('duel.vs', { name: d.opponent_name }) : t('duel.waitingTitle')}</span>
                <span className={`text-xs ${d.my_turn ? 'text-leaf-100' : 'text-stone-500'}`}>{statusText(d)}</span>
              </span>
              <span aria-hidden="true">{d.my_turn ? '👉' : d.status === 'finished' ? '🏁' : '⏳'}</span>
            </button>
          </li>
        ))}
      </ul>
      <div className="flex justify-center">
        <PushPrompt onShowInstall={onShowInstall} showOn />
      </div>
    </section>
  )
}
