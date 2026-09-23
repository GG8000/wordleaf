import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { GuessingPhase } from './components/GuessingPhase'
import { Join } from './components/Join'
import { LanguageSwitcher } from './components/LanguageSwitcher'
import { Lobby } from './components/Lobby'
import { Results } from './components/Results'
import { WritingPhase } from './components/WritingPhase'
import { useAuth } from './hooks/useAuth'
import { useRoom } from './hooks/useRoom'
import { rpc } from './lib/rpc'
import { isConfigured, ROOM_ID, supabase } from './lib/supabase'
import { useToast } from './lib/toast'

export default function App() {
  const { t } = useTranslation()
  const { userId, ready, ensureSession } = useAuth()
  const roomData = useRoom(userId)
  const toast = useToast()
  const { room, players, loaded, refetch } = roomData
  const me = players.find((p) => p.user_id === userId)
  const inRoom = Boolean(me)

  // Heartbeat: the server closes the lobby when the host misses 2 minutes of these
  useEffect(() => {
    if (!inRoom) return
    const beat = () => void supabase.rpc('heartbeat', { p_room: ROOM_ID })
    beat()
    const id = setInterval(beat, 20_000)
    document.addEventListener('visibilitychange', beat)
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', beat)
    }
  }, [inRoom])

  // Tell players why they are suddenly back at the join screen
  const [closed, setClosed] = useState(false)
  const wasIn = useRef(false)
  const leaving = useRef(false)
  useEffect(() => {
    if (inRoom) setClosed(false)
    else if (wasIn.current && !leaving.current && room && !room.host_id && players.length === 0) setClosed(true)
    wasIn.current = inRoom
    if (!inRoom) leaving.current = false
  }, [inRoom, room, players.length])

  let content
  if (!isConfigured) {
    content = <p className="mx-auto mt-10 max-w-md rounded-xl bg-rose-100 p-4 text-rose-900">{t('config.missing')}</p>
  } else if (!ready || (userId && !loaded)) {
    content = <div className="mt-20 animate-pulse text-center text-5xl">🍀</div>
  } else if (!userId || !me || !room) {
    content = <Join ensureSession={ensureSession} onJoined={refetch} status={room?.status} />
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
          🍀 <span>{t('app.title')}</span>
        </h1>
        <div className="flex items-center gap-3">
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
                rpc('leave_room').then(refetch, () => (leaving.current = false))
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
      <footer className="mx-auto mt-12 max-w-xl text-center text-xs text-stone-500">{t('app.credit')}</footer>
      {toast && (
        <div className="fixed inset-x-4 bottom-4 mx-auto max-w-md rounded-xl bg-stone-900 px-4 py-3 text-center text-sm text-white shadow-lg">
          {toast}
        </div>
      )}
    </div>
  )
}
