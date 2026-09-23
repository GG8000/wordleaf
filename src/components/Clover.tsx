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
  /** Deal the cards in one after another (new game or shuffle) */
  deal?: boolean
}

// Clues can be up to 30 characters, so shrink long ones instead of cutting them off
function leafSize(text: string): string {
  if (text.length <= 10) return 'text-sm'
  if (text.length <= 18) return 'text-xs'
  return 'text-[10px]'
}

function Leaf({ text, vertical, active, onClick }: { text?: string | null; vertical?: boolean; active?: boolean; onClick?: () => void }) {
  return (
    <div
      onClick={onClick}
      title={text || undefined}
      className={`flex items-center justify-center rounded-full px-2 py-1.5 text-center font-bold uppercase text-white shadow-sm ${
        active ? 'bg-leaf-700 ring-4 ring-amber-300' : 'bg-leaf-600'
      } ${vertical ? 'min-h-24 min-w-9 [writing-mode:vertical-rl]' : 'min-w-24 min-h-9'} ${onClick ? 'cursor-pointer' : ''}`}
    >
      <span className={`break-all leading-tight ${leafSize(text ?? '')} ${text ? '' : 'opacity-40'}`}>{text || '…'}</span>
    </div>
  )
}

/** 2×2 card board with a clue leaf on each side */
export function Clover({ board, clues, selectedCard, lockedSlots = [], slotStatus, activeLeaf, onSlotClick, onRotate, onLeafClick, deal }: Props) {
  const slot = (i: number): ReactNode => {
    const s = board[i]
    const locked = lockedSlots.includes(i)
    if (!s) {
      return (
        <div
          key={i}
          onClick={onSlotClick ? () => onSlotClick(i) : undefined}
          className={`aspect-square w-full rounded-xl border-2 border-dashed border-leaf-300 bg-leaf-50/60 ${
            onSlotClick ? 'cursor-pointer hover:bg-leaf-100' : ''
          }`}
        />
      )
    }
    return (
      <CardView
        key={s.card.id} // new card in a slot -> fresh mount -> entry animation
        card={s.card}
        anim={deal ? 'anim-deal' : 'anim-plop'}
        animDelay={deal ? [0, 1, 3, 2].indexOf(i) * 130 : undefined}
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
      <div className="grid grid-cols-2 gap-2 rounded-2xl bg-leaf-200/70 p-2">
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
