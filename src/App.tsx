import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { GuessingPhase } from './components/GuessingPhase'
import { Join } from './components/Join'
import { LanguageSwitcher } from './components/LanguageSwitcher'
import { Lobby } from './components/Lobby'
import { Results } from './components/Results'
import { EffectsLayer } from './components/Effects'
import { InstallApp } from './components/InstallApp'
import { UpdateBanner } from './components/UpdateBanner'
import { LOADER_LOOP_MS, WordleafLoader } from './components/WordleafLoader'
import { WritingPhase } from './components/WritingPhase'
import { useAuth } from './hooks/useAuth'
import { useRoom } from './hooks/useRoom'
import { useInstall } from './lib/install'
import { PUBLIC_ROOM, setRoomId, useRoomId } from './lib/room'
import { rpc } from './lib/rpc'
import { isConfigured, supabase } from './lib/supabase'
import { useToast } from './lib/toast'

// Leaflet is only downloaded once someone opens the map
const PlayerMap = lazy(() => import('./components/PlayerMap'))

export default function App() {
  const { t } = useTranslation()
  const { userId, ready, ensureSession } = useAuth()
  const roomId = useRoomId()
  const roomData = useRoom(userId, roomId)
  const toast = useToast()
  const { room, players, loaded, refetch } = roomData
  const me = players.find((p) => p.user_id === userId)
  const inRoom = Boolean(me)

  // Heartbeat: the server closes the lobby when the host misses 2 minutes of these
  useEffect(() => {
    if (!inRoom) return
    const beat = () => void supabase.rpc('heartbeat', { p_room: roomId })
    beat()
    const id = setInterval(beat, 20_000)
    document.addEventListener('visibilitychange', beat)
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', beat)
    }
  }, [inRoom, roomId])

  const [mapOpen, setMapOpen] = useState(false)
  const [installOpen, setInstallOpen] = useState(false)
  const { installed } = useInstall()

  // Tell players why they are suddenly back at the join screen
  const [spins, setSpins] = useState(0)
  const [closed, setClosed] = useState(false)
  const wasIn = useRef(false)
  const leaving = useRef(false)
  useEffect(() => {
    if (inRoom) setClosed(false)
    else if (wasIn.current && !leaving.current && room && !room.host_id && players.length === 0) setClosed(true)
    wasIn.current = inRoom
    if (!inRoom) leaving.current = false
  }, [inRoom, room, players.length])

  // Play the loading animation once in full on startup, even if the data is there sooner
  const [introDone, setIntroDone] = useState(() => matchMedia('(prefers-reduced-motion: reduce)').matches)
  useEffect(() => {
    const id = setTimeout(() => setIntroDone(true), LOADER_LOOP_MS)
    return () => clearTimeout(id)
  }, [])

  let content
  if (!isConfigured) {
    content = <p className="mx-auto mt-10 max-w-md rounded-xl bg-rose-100 p-4 text-rose-900">{t('config.missing')}</p>
  } else if (!introDone || !ready || (userId && !loaded)) {
    content = <div className="mt-10"><WordleafLoader /></div>
  } else if (!userId || !me || !room) {
    content = <Join ensureSession={ensureSession} hasSession={Boolean(userId)} onJoined={refetch} status={room?.status} />
  } else {
    const props = { ...roomData, room, userId }
    content = {
      lobby: <Lobby {...props} />,
      writing: <WritingPhase {...props} />,
      guessing: <GuessingPhase {...props} />,
      finished: <Results {...props} />,
    }[room.status]
  }

  return (
    <div className="min-h-screen px-4 pb-16">
      <header className="mx-auto flex max-w-4xl items-center justify-between gap-3 py-4">
        <h1 className="flex items-center gap-2 text-2xl font-extrabold text-leaf-800">
          <button
            type="button"
            key={spins}
            onClick={() => setSpins((n) => n + 1)}
            className={spins ? 'anim-spin' : ''}
            aria-hidden="true"
            tabIndex={-1}
          >
            🍀
          </button>
          <span>{t('app.title')}</span>
        </h1>
        <div className="flex items-center gap-3">
          {me && roomId !== PUBLIC_ROOM && (
            <span className="rounded-full bg-leaf-100 px-3 py-1 font-mono text-sm font-bold tracking-widest text-leaf-800" title={t('lobby.code')}>
              {roomId}
            </span>
          )}
          {room && room.status !== 'lobby' && me && (
            <span className="hidden rounded-full bg-white px-3 py-1 text-sm font-semibold sm:inline">
              {t('common.points', { count: room.score })}
            </span>
          )}
          <LanguageSwitcher />
          {me && (
            <button
              type="button"
              onClick={() => {
                leaving.current = true
                rpc('leave_room').then(
                  () => (roomId === PUBLIC_ROOM ? refetch() : setRoomId(PUBLIC_ROOM)),
                  () => (leaving.current = false),
                )
              }}
              className="text-sm text-stone-500 hover:text-rose-600"
            >
              {t('common.leave')}
            </button>
          )}
        </div>
      </header>
      <main className="mx-auto max-w-4xl">
        {closed && (
          <p className="mx-auto mb-4 max-w-md rounded-xl bg-amber-100 p-4 text-center text-sm text-amber-900">{t('lobby.closed')}</p>
        )}
        {content}
      </main>
      <footer className="mx-auto mt-12 flex max-w-xl flex-col items-center gap-3 text-center text-xs text-stone-500">
        <div className="flex flex-wrap justify-center gap-2">
          <button
            type="button"
            onClick={() => setMapOpen(true)}
            className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-leaf-800 shadow-sm hover:bg-leaf-50"
          >
            🌍 {t('map.open')}
          </button>
          {!installed && (
            <button
              type="button"
              onClick={() => setInstallOpen(true)}
              className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-leaf-800 shadow-sm hover:bg-leaf-50"
            >
              📲 {t('install.open')}
            </button>
          )}
        </div>
        <p>{t('app.credit')}</p>
      </footer>
      {mapOpen && (
        <Suspense fallback={null}>
          <PlayerMap onClose={() => setMapOpen(false)} />
        </Suspense>
      )}
      {installOpen && <InstallApp onClose={() => setInstallOpen(false)} />}
      <EffectsLayer />
      <UpdateBanner inGame={inRoom} />
      {toast && (
        <div className="fixed inset-x-4 bottom-4 mx-auto max-w-md rounded-xl bg-stone-900 px-4 py-3 text-center text-sm text-white shadow-lg">
          {toast}
        </div>
      )}
    </div>
  )
}
