import { useCallback, useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setReady(true)
    })
    const { data } = supabase.auth.onAuthStateChange((_event, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])

  /** Anonymous sign-in on first join; reuses the stored session afterwards */
  const ensureSession = useCallback(async () => {
    const { data } = await supabase.auth.getSession()
    if (data.session) return data.session
    const res = await supabase.auth.signInAnonymously()
    if (res.error) throw res.error
    return res.data.session
  }, [])

  return { userId: session?.user.id ?? null, ready, ensureSession }
}
