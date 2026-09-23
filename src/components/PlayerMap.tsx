import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { supabase } from '../lib/supabase'
import type { MapPoint } from '../lib/types'

const REFRESH_MS = 30_000

interface Props {
  onClose: () => void
}

/** Anonymous dots where people are playing right now. Loaded lazily (Leaflet is big). */
export default function PlayerMap({ onClose }: Props) {
  const { t } = useTranslation()
  const container = useRef<HTMLDivElement>(null)
  const layer = useRef<L.LayerGroup | null>(null)
  const [points, setPoints] = useState<MapPoint[] | null>(null)

  useEffect(() => {
    const map = L.map(container.current!, { worldCopyJump: true, minZoom: 1, maxZoom: 9 }).setView([30, 10], 2)
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: 'abcd',
    }).addTo(map)
    layer.current = L.layerGroup().addTo(map)
    return () => {
      map.remove()
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
    for (const p of points) {
      L.circleMarker([p.lat, p.lon], {
        radius: 6 + Math.sqrt(p.players) * 4,
        color: '#2f6b35',
        weight: 2,
        fillColor: '#5fb85a',
        fillOpacity: 0.7,
      })
        .bindTooltip(t('map.players', { count: p.players }))
        .addTo(group)
    }
  }, [points, t])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const total = points?.reduce((n, p) => n + p.players, 0)

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
        <p className="text-center text-sm text-stone-600">
          {total === undefined ? '…' : t('map.count', { count: total })}
          <span className="block text-xs text-stone-400">{t('map.note')}</span>
        </p>
      </div>
    </div>
  )
}
