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

export function CardView({ card, rotation, selected, locked, status, onClick, onRotate }: Props) {
  const ring =
    status === 'correct'
      ? 'ring-4 ring-leaf-500'
      : status === 'wrong'
        ? 'ring-4 ring-rose-500'
        : selected
          ? 'ring-4 ring-amber-400'
          : 'ring-1 ring-stone-300'

  return (
    <div
      className={`@container relative aspect-square w-full rounded-xl bg-amber-50 shadow-sm ${ring} ${
        onClick ? 'cursor-pointer active:scale-95 transition-transform' : ''
      }`}
      onClick={onClick}
    >
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
