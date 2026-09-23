import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { boardFromSolutions, isValidClue, leafWords } from '../../lib/clover'
import { playEffect } from '../../lib/effects'
import { duelRpc } from '../../lib/rpc'
import { Clover } from '../Clover'
import type { DuelProps } from './types'

/** Write your own clover. Like WritingPhase, minus the other players and the host controls. */
export function DuelWriting({ duel, me, opponent, cards, solutions, userId, pushPrompt }: DuelProps) {
  const { t } = useTranslation()
  const board = useMemo(
    () => boardFromSolutions(cards, solutions.filter((s) => s.owner_id === userId)),
    [cards, solutions, userId],
  )
  const [clues, setClues] = useState<string[]>(['', '', '', ''])
  const [active, setActive] = useState<number | null>(0)
  const [busy, setBusy] = useState(false)
  const inputs = useRef<(HTMLInputElement | null)[]>([])

  // Restore the server's clues after reload or editing, keyed by content so refetches keep what you type
  const serverClues = me.clues?.join('\n') ?? ''
  useEffect(() => {
    setClues(serverClues ? serverClues.split('\n') : ['', '', '', ''])
  }, [serverClues])

  const greeted = useRef(false)
  useEffect(() => {
    if (greeted.current || me.submitted) return
    greeted.current = true
    playEffect({ kind: 'splash', text: t('effects.go') })
  }, [me.submitted, t])

  const allValid = clues.every(isValidClue)
  const canShuffle = duel.allow_shuffle && !me.shuffled && !me.submitted

  async function shuffle() {
    setBusy(true)
    await duelRpc('shuffle_duel_clover').then(
      () => {
        setClues(['', '', '', ''])
        playEffect({ kind: 'shuffle', text: t('effects.selfShuffled') })
      },
      () => {},
    )
    setBusy(false)
  }

  async function submit() {
    setBusy(true)
    await duelRpc('submit_duel_clues', { p_clues: clues.map((c) => c.trim()) }).catch(() => {})
    setBusy(false)
  }

  return (
    <section className="mx-auto flex w-full max-w-md flex-col gap-4">
      <div>
        <h2 className="text-lg font-bold">{t('writing.title')}</h2>
        <p className="text-sm text-stone-600">{t('writing.hint')}</p>
      </div>
      <Clover
        board={board}
        clues={clues}
        activeLeaf={me.submitted ? null : active}
        onLeafClick={me.submitted ? undefined : (i) => inputs.current[i]?.focus()}
        deal
      />
      {duel.allow_shuffle && !me.submitted && (
        <div className="flex flex-col items-center gap-1">
          <button
            type="button"
            onClick={shuffle}
            disabled={!canShuffle || busy}
            className="rounded-xl border border-leaf-600 px-4 py-2 text-sm font-semibold text-leaf-700 hover:bg-leaf-50 disabled:opacity-50"
          >
            {me.shuffled ? t('writing.shuffleUsed') : t('writing.shuffle')}
          </button>
          {canShuffle && <p className="text-center text-xs text-stone-500">{t('duel.shuffleHint')}</p>}
        </div>
      )}
      {me.submitted ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl bg-white p-4 text-center shadow-sm">
          <p className="font-semibold text-leaf-700">{t('duel.submitted', { name: opponent?.name ?? '…' })}</p>
          {pushPrompt}
          <button type="button" onClick={() => duelRpc('edit_duel_clues').catch(() => {})} className="text-sm text-stone-600 underline">
            {t('writing.edit')}
          </button>
        </div>
      ) : (
        <form
          className="flex w-full flex-col gap-2"
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
                    invalid ? 'border-rose-400' : 'border-stone-300 focus:border-leaf-500'
                  }`}
                />
              </label>
            )
          })}
          <button
            type="submit"
            disabled={!allValid || busy}
            className="mt-2 rounded-xl bg-leaf-600 py-3 font-bold text-white hover:bg-leaf-700 disabled:opacity-50"
          >
            {t('writing.submit')}
          </button>
          {opponent?.submitted && <p className="text-center text-xs text-stone-500">{t('duel.opponentWaiting', { name: opponent.name })}</p>}
        </form>
      )}
    </section>
  )
}
