import type { CSSProperties } from 'react'
import { useEffects } from '../lib/effects'

// Mini cards that burst out of the middle of the screen when someone shuffles
const FLURRY = Array.from({ length: 8 }, (_, i) => {
  const angle = (i / 8) * Math.PI * 2 + 0.3
  return { dx: Math.cos(angle) * 38, dy: Math.sin(angle) * 30, rot: (i % 2 ? 1 : -1) * (200 + i * 40) }
})

/** Renders every running effect on top of the page; never blocks clicks */
export function EffectsLayer() {
  const effects = useEffects()
  if (effects.length === 0) return null

  return (
    <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden" aria-live="polite">
      {effects.map((e) => {
        if (e.kind === 'rain') {
          return e.drops.map((d, i) => (
            <span
              key={`${e.id}-${i}`}
              className="fx-motion fx-fall absolute -top-12"
              style={
                {
                  left: `${d.left}vw`,
                  fontSize: `${d.size}rem`,
                  animationDelay: `${d.delay}s`,
                  animationDuration: `${d.duration}s`,
                  '--spin': `${d.spin}deg`,
                } as CSSProperties
              }
            >
              {d.emoji}
            </span>
          ))
        }
        if (e.kind === 'shuffle') {
          return (
            <div key={e.id} className="absolute inset-0 flex items-center justify-center">
              {FLURRY.map((f, i) => (
                <span
                  key={i}
                  className="fx-motion fx-fly absolute h-16 w-16 rounded-lg bg-amber-50 shadow-lg ring-2 ring-leaf-500"
                  style={
                    {
                      animationDelay: `${i * 40}ms`,
                      '--dx': `${f.dx}vw`,
                      '--dy': `${f.dy}vh`,
                      '--rot': `${f.rot}deg`,
                    } as CSSProperties
                  }
                />
              ))}
              <p className="fx-banner relative rounded-2xl bg-white px-5 py-3 text-lg font-bold text-leaf-800 shadow-xl">
                {e.text}
              </p>
            </div>
          )
        }
        return (
          <div key={e.id} className="absolute inset-0 flex items-center justify-center">
            <p className="fx-splash px-4 text-center text-5xl font-extrabold text-leaf-700 drop-shadow-[0_3px_0_white] sm:text-6xl">
              {e.text}
            </p>
          </div>
        )
      })}
    </div>
  )
}
