import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { ChatMessage } from '../lib/types'

/** Chat messages of a room, oldest first. Empty while the chat is turned off. */
export function useChat(roomId: string, enabled: boolean) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    setMessages([])
    setLoaded(false)
    if (!enabled) return
    let active = true

    const refetch = async () => {
      const { data } = await supabase
        .from('chat_messages')
        .select('id,user_id,name,body,created_at')
        .eq('room_id', roomId)
        .order('id')
      if (!active || !data) return
      setMessages(data as ChatMessage[])
      setLoaded(true)
    }

    const channel = supabase
      .channel(`chat:${roomId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `room_id=eq.${roomId}` },
        (payload) => {
          const msg = payload.new as ChatMessage
          setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg].slice(-100)))
        },
      )
      // DELETE events cannot be filtered and only carry the id
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'chat_messages' }, (payload) => {
        const id = (payload.old as { id?: number }).id
        setMessages((prev) => prev.filter((m) => m.id !== id))
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') refetch()
      })

    window.addEventListener('focus', refetch)
    return () => {
      active = false
      window.removeEventListener('focus', refetch)
      supabase.removeChannel(channel)
    }
  }, [roomId, enabled])

  return { messages, loaded }
}
