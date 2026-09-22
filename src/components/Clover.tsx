import type { ReactNode } from 'react'
import type { Board } from '../lib/clover'
import { CardView } from './CardView'

interface Props {
  board: Board
  clues: (string | null | undefined)[]
  selectedCard?: string | null
  lockedSlots?: number[]
  slotStatus?: ('correct' | 'wrong' | null)[]
  activeLeaf?: number | null
  onSlotClick?: (slot: number) => void
  onRotate?: (slot: number) => void
  onLeafClick?: (leaf: number) => void
}

function Leaf({ text, vertical, active, onClick }: { text?: string | null; vertical?: boolean; active?: boolean; onClick?: () => void }) {
  return (
    <div
      onClick={onClick}
      className={`flex items-center justify-center rounded-full px-2 py-1.5 text-center font-bold uppercase text-white shadow-sm ${
        active ? 'bg-emerald-700 ring-4 ring-amber-300' : 'bg-emerald-600'
      } ${vertical ? 'min-h-24 w-9 [writing-mode:vertical-rl]' : 'min-w-24 h-9'} ${onClick ? 'cursor-pointer' : ''}`}
    >
      <span className={`truncate text-sm ${vertical ? 'max-h-40' : 'max-w-48'} ${text ? '' : 'opacity-40'}`}>{text || '…'}</span>
    </div>
  )
}

/** 2×2 card board with a clue leaf on each side */
export function Clover({ board, clues, selectedCard, lockedSlots = [], slotStatus, activeLeaf, onSlotClick, onRotate, onLeafClick }: Props) {
  const slot = (i: number): ReactNode => {
    const s = board[i]
    const locked = lockedSlots.includes(i)
    if (!s) {
      return (
        <div
          key={i}
          onClick={onSlotClick ? () => onSlotClick(i) : undefined}
          className={`aspect-square w-full rounded-xl border-2 border-dashed border-emerald-300 bg-emerald-50/60 ${
            onSlotClick ? 'cursor-pointer hover:bg-emerald-100' : ''
          }`}
        />
      )
    }
    return (
      <CardView
        key={i}
        card={s.card}
        rotation={s.rotation}
        selected={selectedCard === s.card.id}
        locked={locked && !slotStatus}
        status={slotStatus?.[i]}
        onClick={onSlotClick ? () => onSlotClick(i) : undefined}
        onRotate={onRotate && !locked ? () => onRotate(i) : undefined}
      />
    )
  }
  const leaf = (i: number) => onLeafClick && (() => onLeafClick(i))

  return (
    <div className="mx-auto grid w-full max-w-md grid-cols-[auto_1fr_auto] grid-rows-[auto_1fr_auto] items-center gap-2">
      <div />
      <div className="flex justify-center"><Leaf text={clues[0]} active={activeLeaf === 0} onClick={leaf(0)} /></div>
      <div />
      <div className="flex justify-center"><Leaf text={clues[3]} vertical active={activeLeaf === 3} onClick={leaf(3)} /></div>
      <div className="grid grid-cols-2 gap-2 rounded-2xl bg-emerald-200/70 p-2">
        {slot(0)}
        {slot(1)}
        {slot(3)}
        {slot(2)}
      </div>
      <div className="flex justify-center"><Leaf text={clues[1]} vertical active={activeLeaf === 1} onClick={leaf(1)} /></div>
      <div />
      <div className="flex justify-center"><Leaf text={clues[2]} active={activeLeaf === 2} onClick={leaf(2)} /></div>
      <div />
    </div>
  )
}
