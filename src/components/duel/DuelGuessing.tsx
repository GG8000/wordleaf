import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { boardFromGuess } from '../../lib/clover'
import { duelRpc } from '../../lib/rpc'
import type { DuelGuess, Placement } from '../../lib/types'
import { CardView } from '../CardView'
import { Clover } from '../Clover'
import type { DuelProps } from './types'

/** Solve the opponent's clover on your own board. Same tap-to-place flow as GuessingPhase. */
export function DuelGuessing({ opponent, cards, patchGuess, myGuess }: DuelProps & { myGuess: DuelGuess }) {
  const { t } = useTranslation()
  const [selected, setSelected] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const guess = myGuess.state
  const locked = myGuess.locked_slots
  const ownerCards = useMemo(() => cards.filter((c) => c.owner_id === myGuess.owner_id), [cards, myGuess.owner_id])
  const board = useMemo(() => boardFromGuess(ownerCards, guess), [ownerCards, guess])
  const tray = ownerCards.filter((c) => guess[c.id] && guess[c.id].slot === null)
  const placed = Object.values(guess).filter((p) => p.slot !== null).length

  useEffect(() => setSelected(null), [myGuess.attempt])

  /** Mirror of move_duel_card so the board reacts instantly */
  function move(cardId: string, slot: number | null, rotation: number) {
    const next: Record<string, Placement> = {}
    for (const [id, p] of Object.entries(guess)) {
      if (id === cardId) next[id] = { slot, rotation }
      else if (slot !== null && p.slot === slot) next[id] = { ...p, slot: null }
      else next[id] = p
    }
    patchGuess({ state: next })
    duelRpc('move_duel_card', { p_card: cardId, p_slot: slot, p_rotation: rotation }).catch(() => {})
  }

  function onSlotClick(slot: number) {
    if (locked.includes(slot)) return
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
    await duelRpc('submit_duel_guess').catch(() => {})
    setBusy(false)
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-bold">{t('duel.guessTitle', { name: opponent?.name ?? '?' })}</h2>
        <span className="rounded-full bg-white px-3 py-1 text-sm font-semibold">{t('guessing.attempt', { n: myGuess.attempt })}</span>
      </div>
      {myGuess.attempt === 2 && <p className="rounded-xl bg-sky-100 p-3 text-center text-sm text-sky-900">{t('duel.attempt2')}</p>}

      <Clover
        board={board}
        clues={opponent?.clues ?? []}
        selectedCard={selected}
        lockedSlots={locked}
        onSlotClick={onSlotClick}
        onRotate={(slot) => board[slot] && rotate(board[slot]!.card.id)}
      />

      <section className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between">
          <h3 className="font-semibold">{t('guessing.tray')}</h3>
          <span className="text-xs text-stone-500">{t('guessing.trayHint')}</span>
        </div>
        <div className="grid grid-cols-3 gap-3 rounded-2xl bg-white/60 p-3 sm:grid-cols-5">
          {tray.map((c) => (
            <CardView
              key={c.id}
              card={c}
              rotation={guess[c.id].rotation}
              selected={selected === c.id}
              onClick={() => setSelected(selected === c.id ? null : c.id)}
              onRotate={() => rotate(c.id)}
            />
          ))}
        </div>
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
            className="rounded-xl bg-leaf-600 px-8 py-3 font-bold text-white hover:bg-leaf-700 disabled:opacity-50"
          >
            {t('guessing.submit')}
          </button>
          {placed !== 4 && <span className="w-full text-center text-xs text-stone-500">{t('duel.needFour')}</span>}
        </div>
      </section>
    </div>
  )
}
