import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { supabase } from '../lib/supabase'
import type { MapPoint } from '../lib/types'

const REFRESH_MS = 30_000

// Most recent activity at a spot. Colors are a CVD-checked trio (validated against the map
// background); the darker stroke keeps the lighter fills visible on the pale tiles.
type Recency = 'now' | 'week' | 'earlier'
const RECENCY: Recency[] = ['now', 'week', 'earlier']
const COLORS: Record<Recency, { fill: string; stroke: string }> = {
  now: { fill: '#1baf7a', stroke: '#0b6b49' },
  week: { fill: '#eb6834', stroke: '#9c3a12' },
  earlier: { fill: '#2a78d6', stroke: '#16467f' },
}

function recency(p: MapPoint): Recency {
  return p.players_now > 0 ? 'now' : p.players_week > 0 ? 'week' : 'earlier'
}

/** Players per category, each player counted once (in their most recent one) */
function totals(points: MapPoint[]): Record<Recency, number> {
  const t = { now: 0, week: 0, earlier: 0 }
  for (const p of points) {
    t.now += p.players_now
    t.week += p.players_week - p.players_now
    t.earlier += p.players_total - p.players_week
  }
  return t
}

interface Props {
  onClose: () => void
}

/** Anonymous dots where people are playing right now. Loaded lazily (Leaflet is big). */
export default function PlayerMap({ onClose }: Props) {
  const { t } = useTranslation()
  const container = useRef<HTMLDivElement>(null)
  const map = useRef<L.Map | null>(null)
  const layer = useRef<L.LayerGroup | null>(null)
  const fitted = useRef(false)
  const [points, setPoints] = useState<MapPoint[] | null>(null)
  const [hidden, setHidden] = useState<Set<Recency>>(new Set())

  useEffect(() => {
    const m = L.map(container.current!, { worldCopyJump: true, minZoom: 1, maxZoom: 9 }).setView([30, 10], 2)
    map.current = m
    // OpenStreetMap's own tiles need no API key (usage policy: attribution + light traffic)
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(m)
    layer.current = L.layerGroup().addTo(m)
    return () => {
      m.remove()
      map.current = null
      layer.current = null
    }
  }, [])

  useEffect(() => {
    let alive = true
    const load = async () => {
      const { data } = await supabase.rpc('player_map')
      if (alive) setPoints((data as MapPoint[] | null) ?? [])
    }
    load()
    const id = setInterval(load, REFRESH_MS)
    return () => {
      alive = false
      clearInterval(id)
    }
  }, [])

  useEffect(() => {
    const group = layer.current
    if (!group || !points) return
    group.clearLayers()
    // Oldest first, so the live dots end up on top
    const sorted = [...points].sort((a, b) => RECENCY.indexOf(recency(b)) - RECENCY.indexOf(recency(a)))
    for (const p of sorted) {
      const kind = recency(p)
      if (hidden.has(kind)) continue
      const lines = [
        p.players_now && t('map.tipNow', { count: p.players_now }),
        p.players_week && t('map.tipWeek', { count: p.players_week }),
        t('map.tipTotal', { count: p.players_total }),
      ].filter(Boolean)
      L.circleMarker([p.lat, p.lon], {
        radius: 5 + Math.sqrt(p.players_total) * 3,
        color: COLORS[kind].stroke,
        weight: 2,
        fillColor: COLORS[kind].fill,
        fillOpacity: 0.85,
        className: kind === 'now' ? 'map-live' : undefined,
      })
        .bindTooltip(lines.join('<br>'))
        .addTo(group)
    }
    // Show every spot the first time data arrives; after that, leave the view to the player
    if (!fitted.current && points.length) {
      fitted.current = true
      map.current?.fitBounds(L.latLngBounds(points.map((p) => [p.lat, p.lon])), { padding: [30, 30], maxZoom: 5 })
    }
  }, [points, hidden, t])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const counts = points && totals(points)
  const toggle = (kind: Recency) =>
    setHidden((prev) => {
      const next = new Set(prev)
      if (!next.delete(kind)) next.add(kind)
      return next
    })

  return (
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-stone-900/50 p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="player-map-title"
        className="flex w-full max-w-3xl flex-col gap-3 rounded-3xl bg-white p-4 shadow-xl"
      >
        <div className="flex items-center justify-between gap-3">
          <h2 id="player-map-title" className="text-lg font-bold text-leaf-800">
            🌍 {t('map.title')}
          </h2>
          <button
            type="button"
            onClick={onClose}
            autoFocus
            className="rounded-full px-3 py-1 text-sm text-stone-500 hover:bg-stone-100 hover:text-stone-800"
          >
            {t('map.close')}
          </button>
        </div>
        <div ref={container} className="h-[60vh] max-h-[480px] min-h-[260px] w-full overflow-hidden rounded-2xl bg-stone-100" />
        <ul className="flex flex-wrap justify-center gap-2" aria-label={t('map.legend')}>
          {RECENCY.map((kind) => (
            <li key={kind}>
              <button
                type="button"
                onClick={() => toggle(kind)}
                aria-pressed={!hidden.has(kind)}
                className={`flex items-center gap-2 rounded-full border border-stone-200 px-3 py-1 text-sm text-stone-700 hover:bg-stone-50 ${
                  hidden.has(kind) ? 'opacity-40' : ''
                }`}
              >
                <span
                  className="size-3 rounded-full border-2"
                  style={{ background: COLORS[kind].fill, borderColor: COLORS[kind].stroke }}
                  aria-hidden="true"
                />
                {t(`map.legend_${kind}`)}
                <span className="font-semibold text-stone-900">{counts ? counts[kind] : '…'}</span>
              </button>
            </li>
          ))}
        </ul>
        <p className="text-center text-xs text-stone-400">{t('map.note')}</p>
      </div>
    </div>
  )
}
