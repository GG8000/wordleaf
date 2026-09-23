import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useChat } from '../hooks/useChat'
import { rpc } from '../lib/rpc'
import type { ChatMessage, Room } from '../lib/types'

interface Props {
  room: Room
  userId: string
}

/** Lobby chat, inline. The host turns it on here; the server rejects anything unkind. */
export function Chat({ room, userId }: Props) {
  const { t } = useTranslation()
  const { messages } = useChat(room.id, room.allow_chat)
  const isHost = room.host_id === userId

  if (!room.allow_chat) {
    return isHost ? (
      <div className="flex items-center justify-between gap-3 rounded-2xl bg-white p-4 shadow-sm">
        <span className="text-sm">
          <span className="font-semibold">💬 {t('chat.title')}</span>
          <span className="block text-stone-600">{t('chat.offHost')}</span>
        </span>
        <button
          type="button"
          onClick={() => rpc('set_chat', { p_enabled: true }).catch(() => {})}
          className="shrink-0 rounded-xl bg-leaf-600 px-3 py-2 text-sm font-bold text-white hover:bg-leaf-700"
        >
          {t('chat.enable')}
        </button>
      </div>
    ) : null
  }

  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm">
      <ChatPanel room={room} userId={userId} messages={messages} />
    </div>
  )
}

/** In-game chat: a floating 💬 button with an unread count that opens the chat as a panel. */
export function FloatingChat({ room, userId }: Props) {
  const { t } = useTranslation()
  const { messages, loaded } = useChat(room.id, room.allow_chat)
  const [open, setOpen] = useState(false)
  // Messages up to this id count as read; everything from before the game counts as read too
  const [seenId, setSeenId] = useState<number | null>(null)
  const lastId = messages.at(-1)?.id ?? 0

  useEffect(() => {
    if (loaded && (open || seenId === null)) setSeenId(lastId)
  }, [loaded, open, lastId, seenId])

  if (!room.allow_chat) return null
  const unread = messages.filter((m) => m.id > (seenId ?? lastId) && m.user_id !== userId).length

  return (
    <div className="fixed right-4 bottom-4 z-[1000] flex flex-col items-end gap-2">
      {open && (
        <div className="w-[min(22rem,calc(100vw-2rem))] rounded-2xl bg-white p-4 shadow-xl ring-1 ring-stone-200">
          <ChatPanel room={room} userId={userId} messages={messages} onClose={() => setOpen(false)} />
        </div>
      )}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={t('chat.title')}
        aria-expanded={open}
        className="relative flex h-12 w-12 items-center justify-center rounded-full bg-leaf-600 text-xl text-white shadow-lg hover:bg-leaf-700"
      >
        {open ? '✕' : '💬'}
        {!open && unread > 0 && (
          <span className="absolute -top-1 -right-1 min-w-5 rounded-full bg-rose-600 px-1 text-xs font-bold leading-5">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>
    </div>
  )
}

interface PanelProps extends Props {
  messages: ChatMessage[]
  onClose?: () => void
}

function ChatPanel({ room, userId, messages, onClose }: PanelProps) {
  const { t } = useTranslation()
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const list = useRef<HTMLUListElement>(null)
  const isHost = room.host_id === userId
  // The author of the clover being guessed has to stay silent
  const silent = room.status === 'guessing' && !room.revealing && room.turn_order[room.current_turn] === userId

  useEffect(() => {
    list.current?.scrollTo({ top: list.current.scrollHeight })
  }, [messages])

  async function send(e: React.FormEvent) {
    e.preventDefault()
    if (!text.trim() || busy || silent) return
    setBusy(true)
    try {
      await rpc('send_chat', { p_body: text })
      setText('')
    } catch {
      // Toast already shown; keep the text so it can be rephrased
    }
    setBusy(false)
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-bold">💬 {t('chat.title')}</h2>
        <div className="flex items-center gap-3">
          {isHost && (
            <button
              type="button"
              onClick={() => rpc('set_chat', { p_enabled: false }).catch(() => {})}
              className="text-xs text-stone-500 hover:underline"
            >
              {t('chat.disable')}
            </button>
          )}
          {onClose && (
            <button type="button" onClick={onClose} aria-label={t('chat.close')} className="text-stone-400 hover:text-stone-700">
              ✕
            </button>
          )}
        </div>
      </div>
      <ul ref={list} className="flex max-h-64 min-h-24 flex-col gap-1.5 overflow-y-auto">
        {messages.length === 0 && <li className="m-auto text-sm text-stone-400">{t('chat.empty')}</li>}
        {messages.map((m) => {
          const mine = m.user_id === userId
          return (
            <li key={m.id} className={`group flex items-end gap-1 ${mine ? 'flex-row-reverse' : ''}`}>
              <div
                className={`max-w-[80%] rounded-2xl px-3 py-1.5 text-sm break-words ${
                  mine ? 'bg-leaf-600 text-white' : 'bg-leaf-50 text-stone-800'
                }`}
              >
                {!mine && <span className="block text-xs font-semibold text-leaf-800">{m.name}</span>}
                {m.body}
              </div>
              {(mine || isHost) && (
                <button
                  type="button"
                  onClick={() => rpc('delete_chat', { p_id: m.id }).catch(() => {})}
                  title={t('chat.delete')}
                  aria-label={t('chat.delete')}
                  className="text-xs text-stone-300 hover:text-rose-600"
                >
                  ✕
                </button>
              )}
            </li>
          )
        })}
      </ul>
      <form onSubmit={send} className="flex gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={200}
          disabled={silent}
          placeholder={silent ? t('chat.silent') : t('chat.placeholder')}
          aria-label={t('chat.placeholder')}
          className="min-w-0 flex-1 rounded-xl border border-stone-300 px-3 py-2 text-sm disabled:bg-stone-50"
        />
        <button
          type="submit"
          disabled={busy || silent || !text.trim()}
          className="shrink-0 rounded-xl bg-leaf-600 px-3 py-2 text-sm font-bold text-white hover:bg-leaf-700 disabled:opacity-50"
        >
          {t('chat.send')}
        </button>
      </form>
      <p className="text-xs text-stone-500">{t('chat.niceHint')}</p>
    </div>
  )
}
