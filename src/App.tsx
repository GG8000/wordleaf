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
import { isConfigured } from './lib/supabase'
import { useToast } from './lib/toast'

export default function App() {
  const { t } = useTranslation()
  const { userId, ready, ensureSession } = useAuth()
  const roomData = useRoom(userId)
  const toast = useToast()
  const { room, players, loaded, refetch } = roomData
  const me = players.find((p) => p.user_id === userId)

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
        <h1 className="flex items-center gap-2 text-2xl font-extrabold text-emerald-800">
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
              onClick={() => rpc('leave_room').then(refetch, () => {})}
              className="text-sm text-stone-500 hover:text-rose-600"
            >
              {t('common.leave')}
            </button>
          )}
        </div>
      </header>
      <main className="mx-auto max-w-4xl">{content}</main>
      {toast && (
        <div className="fixed inset-x-4 bottom-4 mx-auto max-w-md rounded-xl bg-stone-900 px-4 py-3 text-center text-sm text-white shadow-lg">
          {toast}
        </div>
      )}
    </div>
  )
}
