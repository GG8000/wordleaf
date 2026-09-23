import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { boardFromGuess, boardFromSolutions } from '../../lib/clover'
import type { Card, DuelGuess, DuelPlayer, Solution } from '../../lib/types'
import { Clover } from '../Clover'

interface Props {
  title: string
  owner: DuelPlayer
  guess: DuelGuess | undefined
  cards: Card[]
  solutions: Solution[]
}

/** One clover after it was solved (the guess with green/red cards next to the solution), or while being solved */
export function SolvedClover({ title, owner, guess, cards, solutions }: Props) {
  const { t } = useTranslation()
  const ownerCards = useMemo(() => cards.filter((c) => c.owner_id === owner.user_id), [cards, owner.user_id])
  const guessBoard = useMemo(() => boardFromGuess(ownerCards, guess?.state ?? {}), [ownerCards, guess])
  const solutionBoard = useMemo(
    () => boardFromSolutions(ownerCards, solutions.filter((s) => s.owner_id === owner.user_id)),
    [ownerCards, solutions, owner.user_id],
  )
  const done = Boolean(guess?.done)
  const status = done ? [0, 1, 2, 3].map((s) => (guess!.locked_slots.includes(s) ? ('correct' as const) : ('wrong' as const))) : undefined

  return (
    <section className="flex flex-col gap-3 rounded-3xl bg-white/70 p-4 shadow-sm">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-bold">{title}</h3>
        {owner.points != null ? (
          <span className="rounded-full bg-leaf-100 px-3 py-1 text-sm font-bold text-leaf-800">{t('common.points', { count: owner.points })}</span>
        ) : (
          guess && <span className="text-sm text-stone-500">{t('guessing.attempt', { n: guess.attempt })}</span>
        )}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <p className="text-center text-sm font-semibold text-stone-600">{t('duel.theGuess')}</p>
          <Clover board={guessBoard} clues={owner.clues ?? []} lockedSlots={guess?.locked_slots} slotStatus={status} />
        </div>
        {solutionBoard.some(Boolean) && (
          <div className="flex flex-col gap-1">
            <p className="text-center text-sm font-semibold text-stone-600">{t('guessing.solution')}</p>
            <Clover board={solutionBoard} clues={owner.clues ?? []} />
          </div>
        )}
      </div>
    </section>
  )
}
