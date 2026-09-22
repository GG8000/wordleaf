import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const isConfigured = Boolean(url && key)

// `?p=2` gives the tab its own session so one browser can act as several players
const profile = new URLSearchParams(window.location.search).get('p')

export const supabase = createClient(url ?? 'http://localhost', key ?? 'missing', {
  auth: { storageKey: profile ? `kleever-auth-p${profile}` : 'kleever-auth' },
})

export const ROOM_ID = 'main'
