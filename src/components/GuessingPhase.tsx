import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { boardFromGuess, boardFromSolutions, POINTS_PERFECT } from '../lib/clover'
import { rpc } from '../lib/rpc'
import type { Placement } from '../lib/types'
import { CardView } from './CardView'
import { Clover } from './Clover'
import type { GameProps } from './types'

export function GuessingPhase({ room, clovers, cards, solutions, userId, patchRoom }: GameProps) {
  const { t } = useTranslation()
  const [selected, setSelected] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const ownerId = room.turn_order[room.current_turn]
  const clover = clovers.find((c) => c.owner_id === ownerId)
  const isAuthor = ownerId === userId
  const canAct = !isAuthor && !room.revealing
  const guess = room.guess_state
  const ownerCards = useMemo(() => cards.filter((c) => c.owner_id === ownerId), [cards, ownerId])
  const board = useMemo(() => boardFromGuess(ownerCards, guess), [ownerCards, guess])
  const tray = ownerCards.filter((c) => guess[c.id] && guess[c.id].slot === null)
  const placed = Object.values(guess).filter((p) => p.slot !== null).length
  const ownerSolutions = solutions.filter((s) => s.owner_id === ownerId)
  const solutionBoard = useMemo(() => boardFromSolutions(ownerCards, ownerSolutions), [ownerCards, ownerSolutions])
  const isLast = room.current_turn + 1 >= room.turn_order.length

  // Drop the selection when the turn or attempt changes, or the card got locked
  useEffect(() => setSelected(null), [room.current_turn, room.attempt, room.revealing])

  /** Mirror of the move_card RPC so the board reacts instantly */
  function move(cardId: string, slot: number | null, rotation: number) {
    const next: Record<string, Placement> = {}
    for (const [id, p] of Object.entries(guess)) {
      if (id === cardId) next[id] = { slot, rotation }
      else if (slot !== null && p.slot === slot) next[id] = { ...p, slot: null }
      else next[id] = p
    }
    patchRoom({ guess_state: next })
    rpc('move_card', { p_card: cardId, p_slot: slot, p_rotation: rotation }).catch(() => {})
  }

  function onSlotClick(slot: number) {
    if (!canAct || room.locked_slots.includes(slot)) return
    const occupant = board[slot]?.card.id
    if (selected && selected !== occupant) {
      move(selected, slot, guess[selected].rotation)
      setSelected(null)
    } else {
      setSelected(occupant && occupant !== selected ? occupant : null)
    }
  }

  function rotate(cardId: string) {
    const p = guess[cardId]
    move(cardId, p.slot, (p.rotation + 1) % 4)
  }

  async function submit() {
    setBusy(true)
    await rpc('submit_guess').catch(() => {})
    setBusy(false)
  }

  const status = room.revealing
    ? [0, 1, 2, 3].map((s) => (room.locked_slots.includes(s) ? ('correct' as const) : ('wrong' as const)))
    : undefined

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-bold">
          {t('guessing.title', { n: room.current_turn + 1, total: room.turn_order.length, name: clover?.owner_name ?? '?' })}
        </h2>
        {!room.revealing && (
          <span className="rounded-full bg-white px-3 py-1 text-sm font-semibold">{t('guessing.attempt', { n: room.attempt })}</span>
        )}
      </div>

      {isAuthor && !room.revealing && (
        <p className="rounded-xl bg-amber-100 p-3 text-center font-semibold text-amber-900">🤫 {t('guessing.yourClover')}</p>
      )}
      {room.attempt === 2 && !room.revealing && (
        <p className="rounded-xl bg-sky-100 p-3 text-center text-sm text-sky-900">{t('guessing.attempt2')}</p>
      )}

      {room.revealing && (
        <div className="rounded-2xl bg-white p-4 text-center shadow-sm">
          <p className="text-2xl font-bold text-emerald-700">{t('guessing.revealTitle', { count: clover?.points ?? 0 })}</p>
          {clover?.points === POINTS_PERFECT && <p className="text-stone-600">{t('guessing.perfect')} 🍀</p>}
          <button
            type="button"
            onClick={() => rpc('next_clover').catch(() => {})}
            className="mt-3 rounded-xl bg-emerald-600 px-6 py-2 font-bold text-white hover:bg-emerald-700"
          >
            {isLast ? t('guessing.finish') : t('guessing.next')}
          </button>
        </div>
      )}

      <div className={`grid gap-6 ${room.revealing || isAuthor ? 'md:grid-cols-2' : ''}`}>
        <section className="flex flex-col gap-2">
          {(room.revealing || isAuthor) && <h3 className="text-center font-semibold">{t('guessing.yourGuess')}</h3>}
          <Clover
            board={board}
            clues={clover?.clues ?? []}
            selectedCard={selected}
            lockedSlots={room.locked_slots}
            slotStatus={status}
            onSlotClick={canAct ? onSlotClick : undefined}
            onRotate={canAct ? (slot) => board[slot] && rotate(board[slot]!.card.id) : undefined}
          />
        </section>
        {(room.revealing || isAuthor) && (
          <section className="flex flex-col gap-2">
            <h3 className="text-center font-semibold">{room.revealing ? t('guessing.solution') : t('guessing.yourSolution')}</h3>
            <Clover board={solutionBoard} clues={clover?.clues ?? []} />
          </section>
        )}
      </div>

      {!room.revealing && (
        <section className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between">
            <h3 className="font-semibold">{t('guessing.tray')}</h3>
            {canAct && <span className="text-xs text-stone-500">{t('guessing.trayHint')}</span>}
          </div>
          <div className="grid grid-cols-3 gap-3 rounded-2xl bg-white/60 p-3 sm:grid-cols-5">
            {tray.map((c) => (
              <CardView
                key={c.id}
                card={c}
                rotation={guess[c.id].rotation}
                selected={selected === c.id}
                onClick={canAct ? () => setSelected(selected === c.id ? null : c.id) : undefined}
                onRotate={canAct ? () => rotate(c.id) : undefined}
              />
            ))}
          </div>
          {canAct && (
            <div className="flex flex-wrap items-center justify-center gap-3">
              {selected && guess[selected]?.slot !== null && (
                <button
                  type="button"
                  onClick={() => {
                    move(selected, null, guess[selected].rotation)
                    setSelected(null)
                  }}
                  className="rounded-xl border border-stone-400 px-4 py-2 text-sm font-semibold hover:bg-white"
                >
                  {t('guessing.return')}
                </button>
              )}
              <button
                type="button"
                onClick={submit}
                disabled={placed !== 4 || busy}
                className="rounded-xl bg-emerald-600 px-8 py-3 font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                {t('guessing.submit')}
              </button>
              {placed !== 4 && <span className="w-full text-center text-xs text-stone-500">{t('guessing.needFour')}</span>}
            </div>
          )}
        </section>
      )}
    </div>
  )
}
