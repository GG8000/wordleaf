import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { boardFromSolutions, isValidClue, leafWords } from '../lib/clover'
import { rpc } from '../lib/rpc'
import { Clover } from './Clover'
import { PlayerList } from './PlayerList'
import type { GameProps } from './types'

export function WritingPhase({ room, players, clovers, cards, solutions, userId, online }: GameProps) {
  const { t } = useTranslation()
  const mine = clovers.find((c) => c.owner_id === userId)
  const board = useMemo(
    () => boardFromSolutions(cards, solutions.filter((s) => s.owner_id === userId)),
    [cards, solutions, userId],
  )
  const [clues, setClues] = useState<string[]>(['', '', '', ''])
  const [active, setActive] = useState<number | null>(0)
  const [busy, setBusy] = useState(false)
  const inputs = useRef<(HTMLInputElement | null)[]>([])
  const isHost = room.host_id === userId
  const done = clovers.filter((c) => c.submitted).length

  // Restore submitted clues (e.g. after reload or when editing)
  useEffect(() => {
    if (mine?.clues) setClues(mine.clues)
  }, [mine?.clues])

  if (!mine) {
    return <p className="text-center text-stone-600">{t('writing.submitted')}</p>
  }

  const allValid = clues.every(isValidClue)

  async function submit() {
    setBusy(true)
    await rpc('submit_clues', { p_clues: clues.map((c) => c.trim()) }).catch(() => {})
    setBusy(false)
  }

  return (
    <div className="grid gap-6 md:grid-cols-[1fr_16rem]">
      <section className="flex flex-col gap-4">
        <div>
          <h2 className="text-lg font-bold">{t('writing.title')}</h2>
          <p className="text-sm text-stone-600">{t('writing.hint')}</p>
        </div>
        <Clover
          board={board}
          clues={clues}
          activeLeaf={mine.submitted ? null : active}
          onLeafClick={mine.submitted ? undefined : (i) => inputs.current[i]?.focus()}
        />
        {mine.submitted ? (
          <div className="flex flex-col items-center gap-2">
            <p className="font-semibold text-emerald-700">{t('writing.submitted')}</p>
            <button type="button" onClick={() => rpc('edit_clues').catch(() => {})} className="text-sm text-stone-600 underline">
              {t('writing.edit')}
            </button>
          </div>
        ) : (
          <form
            className="mx-auto flex w-full max-w-md flex-col gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              if (allValid) submit()
            }}
          >
            {[0, 1, 2, 3].map((i) => {
              const [a, b] = leafWords(board, i)
              const invalid = clues[i] !== '' && !isValidClue(clues[i])
              return (
                <label key={i} className="flex flex-col gap-0.5 text-xs font-semibold text-stone-500">
                  <span>
                    {(t('writing.leaf', { returnObjects: true }) as string[])[i]}: <span className="uppercase text-stone-800">{a}</span>
                    {' + '}
                    <span className="uppercase text-stone-800">{b}</span>
                  </span>
                  <input
                    ref={(el) => {
                      inputs.current[i] = el
                    }}
                    value={clues[i]}
                    maxLength={30}
                    onFocus={() => setActive(i)}
                    onChange={(e) => setClues((c) => c.map((v, j) => (j === i ? e.target.value : v)))}
                    className={`rounded-xl border px-3 py-2 text-base font-normal text-stone-900 focus:outline-none ${
                      invalid ? 'border-rose-400' : 'border-stone-300 focus:border-emerald-500'
                    }`}
                  />
                </label>
              )
            })}
            <button
              type="submit"
              disabled={!allValid || busy}
              className="mt-2 rounded-xl bg-emerald-600 py-3 font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {t('writing.submit')}
            </button>
          </form>
        )}
      </section>
      <aside className="flex flex-col gap-3">
        <h3 className="font-bold">{t('writing.status', { done, total: clovers.length })}</h3>
        <PlayerList
          players={players}
          hostId={room.host_id}
          userId={userId}
          online={online}
          badge={(p) => {
            const c = clovers.find((c) => c.owner_id === p.user_id)
            return c ? <span>{c.submitted ? '✅' : '✏️'}</span> : null
          }}
        />
        {isHost && (
          <div className="flex flex-col gap-1">
            <button
              type="button"
              onClick={() => rpc('force_guessing').catch(() => {})}
              disabled={done === 0}
              className="rounded-xl border border-emerald-600 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
            >
              {t('writing.force')}
            </button>
            <p className="text-xs text-stone-500">{t('writing.forceHint')}</p>
          </div>
        )}
      </aside>
    </div>
  )
}
