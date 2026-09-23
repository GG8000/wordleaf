import { useRef } from 'react'
import type { Card } from '../lib/types'
import { wordOnEdge } from '../lib/clover'

interface Props {
  card: Card
  rotation: number
  selected?: boolean
  locked?: boolean
  status?: 'correct' | 'wrong' | null
  onClick?: () => void
  onRotate?: () => void
  /** Entry animation class (e.g. anim-deal) and its delay in ms */
  anim?: string
  animDelay?: number
}

// Shrink long words so they fit on an edge (sizes are relative to the card width)
function wordSize(word: string): string {
  const fit = Math.floor(78 / Math.max(word.length * 0.62, 1))
  return `min(11cqw, ${fit}cqw)`
}

const edgeClass = [
  'top-[4%] left-1/2 -translate-x-1/2',
  'right-[4%] top-1/2 -translate-y-1/2 [writing-mode:vertical-rl]',
  'bottom-[4%] left-1/2 -translate-x-1/2',
  'left-[4%] top-1/2 -translate-y-1/2 [writing-mode:vertical-rl] rotate-180',
]

export function CardView({ card, rotation, selected, locked, status, onClick, onRotate, anim = 'anim-plop', animDelay }: Props) {
  // Only spin the words for rotations after mount, not when the card first appears
  const firstRotation = useRef(rotation)
  const turned = rotation !== firstRotation.current
  const ring =
    status === 'correct'
      ? 'ring-4 ring-leaf-500'
      : status === 'wrong'
        ? 'ring-4 ring-rose-500'
        : selected
          ? 'ring-4 ring-amber-400'
          : 'ring-1 ring-stone-300'

  const reveal = status === 'correct' ? 'anim-cheer' : status === 'wrong' ? 'anim-shake' : anim

  return (
    <div
      className={`@container relative aspect-square w-full rounded-xl bg-amber-50 shadow-sm ${ring} ${reveal} ${
        onClick ? 'cursor-pointer active:scale-95 transition-transform' : ''
      }`}
      style={animDelay ? { animationDelay: `${animDelay}ms` } : undefined}
      onClick={onClick}
    >
      <div key={rotation} className={`absolute inset-0 ${turned ? 'anim-twist' : ''}`}>
        {[0, 1, 2, 3].map((edge) => {
          const word = wordOnEdge(card.words, rotation, edge)
          return (
            <span
              key={edge}
              className={`absolute font-semibold uppercase leading-none tracking-tight text-stone-800 whitespace-nowrap ${edgeClass[edge]}`}
              style={{ fontSize: wordSize(word) }}
            >
              {word}
            </span>
          )
        })}
      </div>
      <div className="absolute inset-0 flex items-center justify-center">
        {locked ? (
          <span className="text-[14cqw]" aria-label="locked">🔒</span>
        ) : onRotate ? (
          <button
            type="button"
            className="flex h-[34cqw] w-[34cqw] items-center justify-center rounded-full bg-white/80 text-[20cqw] text-stone-600 shadow hover:bg-white"
            onClick={(e) => {
              e.stopPropagation()
              onRotate()
            }}
            aria-label="rotate"
          >
            ↻
          </button>
        ) : null}
      </div>
    </div>
  )
}
