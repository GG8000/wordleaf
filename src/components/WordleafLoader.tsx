import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import './WordleafLoader.css'

/** Length of one run of the animation */
export const LOADER_LOOP_MS = 8000

interface Props {
  /** Fixed text instead of the rotating loading messages */
  message?: string
}

// All sizes are in cqw (percent of the scene width), so the scene scales as one piece
const chipClass =
  'whitespace-nowrap rounded-[1.8cqw] bg-white px-[2.2cqw] py-[1.1cqw] text-[3.4cqw] font-bold text-stone-800 shadow-md ring-1 ring-stone-200'
const clueClass = 'block whitespace-nowrap text-[3.8cqw] font-extrabold uppercase tracking-wide text-white'
const leafClass = 'absolute flex items-center justify-center rounded-full bg-leaf-600 shadow-sm'

/** Places a child with its center at x/y percent of the parent */
function At({ x, y, children, className = '', style }: { x: number; y: number; children: ReactNode; className?: string; style?: CSSProperties }) {
  return (
    <div className={`absolute -translate-x-1/2 -translate-y-1/2 ${className}`} style={{ left: `${x}%`, top: `${y}%`, ...style }}>
      {children}
    </div>
  )
}

/** A word card on the board that stays upright while the board turns */
function Chip({ x, y, anim, children }: { x: number; y: number; anim: string; children: ReactNode }) {
  return (
    <At x={x} y={y}>
      <div className="wl-upright">
        <div className={`${anim} ${chipClass}`}>{children}</div>
      </div>
    </At>
  )
}

function Pencil() {
  const ink = '#292524'
  return (
    <svg viewBox="0 0 40 60" className="h-full w-full overflow-visible">
      <rect x="12" y="2" width="16" height="10" rx="4" fill="oklch(0.8 0.11 10)" />
      <rect x="12" y="10" width="16" height="5" fill="#d6d3d1" />
      <rect x="12" y="14" width="16" height="31" fill="#fbbf24" />
      <rect x="12" y="14" width="3" height="31" fill="#f59e0b" />
      <rect x="25" y="14" width="3" height="31" fill="#f59e0b" />
      <path d="M12 45 L28 45 L20 57 Z" fill="#fde2b8" />
      <path d="M17.3 53 L22.7 53 L20 57 Z" fill="#44403c" />
      <circle cx="17" cy="24" r="1.6" fill={ink} />
      <circle cx="23" cy="24" r="1.6" fill={ink} />
      <circle cx="15.8" cy="28" r="1.4" fill="#fb7185" opacity="0.5" />
      <circle cx="24.2" cy="28" r="1.4" fill="#fb7185" opacity="0.5" />
      <g fill="none" stroke={ink} strokeWidth="1.3" strokeLinecap="round">
        <path className="wl-face-happy" d="M17 28 Q20 31.5 23 28" />
        <g className="wl-face-worried">
          <path d="M15 21.6 L18.4 20.3 M25 21.6 L21.6 20.3" />
          <path d="M16.5 29.8 Q18 28.3 19.5 29.8 Q21 31.3 22.5 29.8" />
        </g>
      </g>
    </svg>
  )
}

function Drop({ className }: { className: string }) {
  return (
    <svg viewBox="0 0 10 14" className={`h-[2.8cqw] w-[2cqw] ${className}`}>
      <path d="M5 0 C5 0 0 7 0 9.5 A5 4.5 0 0 0 10 9.5 C10 7 5 0 5 0 Z" fill="#7dd3fc" />
    </svg>
  )
}

/**
 * Looping loading screen: a pencil links words on a Wordleaf clover, the board turns
 * and the next pair gets awkward. Pure CSS animation (see WordleafLoader.css).
 */
export function WordleafLoader({ message }: Props) {
  const { t } = useTranslation()
  const messages = t('loader.messages', { returnObjects: true }) as string[]
  const [n, setN] = useState(0)

  useEffect(() => {
    if (message) return
    const id = setInterval(() => setN((i) => i + 1), 2000)
    return () => clearInterval(id)
  }, [message])

  return (
    <div className="mx-auto w-full max-w-[360px]">
      <div
        className="wl-scene relative aspect-square w-full overflow-hidden"
        style={{ '--wl-loop': `${LOADER_LOOP_MS}ms` } as CSSProperties}
        aria-hidden="true"
      >
        {/* Board: 4 leaves around a plate, 3 word cards. Turns as one piece. */}
        <div className="wl-board absolute left-[16%] top-[26%] h-[60%] w-[60%]">
          <div className="absolute inset-[18%] flex items-center justify-center rounded-[4cqw] bg-leaf-200/80">
            <svg viewBox="0 0 24 24" className="h-[30%] w-[30%] text-leaf-300" fill="currentColor">
              <circle cx="12" cy="7" r="4.5" />
              <circle cx="17" cy="12" r="4.5" />
              <circle cx="12" cy="17" r="4.5" />
              <circle cx="7" cy="12" r="4.5" />
            </svg>
          </div>
          <div className={`${leafClass} wl-leaf-hit inset-x-[18%] top-[1%] h-[14%]`}>
            <span className={`wl-clue-1 ${clueClass}`}>{t('loader.words.clue1')}</span>
          </div>
          {/* Written sideways: it reads normally once the board has turned */}
          <div className={`${leafClass} wl-leaf-panic inset-y-[18%] right-[1%] w-[14%]`}>
            <div className="rotate-90">
              <div className="wl-jitter">
                <span className={`wl-clue-2 ${clueClass}`}>{t('loader.words.clue2')}</span>
              </div>
            </div>
          </div>
          <div className={`${leafClass} inset-x-[18%] bottom-[1%] h-[14%]`} />
          <div className={`${leafClass} inset-y-[18%] left-[1%] w-[14%]`} />
          <Chip x={32} y={32} anim="wl-card-a">{t('loader.words.a')}</Chip>
          <Chip x={68} y={32} anim="wl-card-b">{t('loader.words.b')}</Chip>
          <Chip x={68} y={68} anim="wl-card-c">{t('loader.words.c')}</Chip>
        </div>

        {[[26, 26], [47, 21], [67, 27]].map(([x, y]) => (
          <At key={x} x={x} y={y}>
            <span className="wl-spark block text-[5cqw] leading-none text-amber-400">✦</span>
          </At>
        ))}

        <div className="wl-mascot absolute left-[66.5%] top-[4.25%] h-[25.5cqw] w-[17cqw]">
          <Pencil />
        </div>
        <At x={87} y={13}><Drop className="wl-sweat-1" /></At>
        <At x={90} y={18}><Drop className="wl-sweat-2" /></At>
        <At x={91} y={6}>
          <span className="wl-ask flex h-[8cqw] w-[8cqw] origin-bottom-left items-center justify-center rounded-full bg-white text-[5cqw] font-extrabold text-amber-500 shadow-md">
            ?
          </span>
        </At>

        {[38, 58, 76].map((y, i) => (
          <div
            key={y}
            className="wl-wind absolute left-0 h-[0.9cqw] w-[30cqw] rounded-full bg-leaf-300"
            style={{ top: `${y}%`, animationDelay: `${i * 0.1}s` }}
          />
        ))}
      </div>

      <p role="status" className="mt-2 h-6 text-center text-sm font-semibold text-leaf-800">
        <span className="sr-only">{message ?? t('loader.label')}</span>
        <span key={message ?? n} aria-hidden="true" className={`inline-block ${message ? 'wl-msg-static' : 'wl-msg'}`}>
          {message ?? messages[n % messages.length]}
        </span>
      </p>
    </div>
  )
}
