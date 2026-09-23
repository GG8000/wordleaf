// Sends a duel notification to every push subscription of one user.
// Called by the notifications trigger in supabase/migrations/0011_push.sql, which authenticates
// with the shared PUSH_HOOK_SECRET instead of a user JWT (see [functions.send-push] in config.toml).
//
// Secrets: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (mailto: or https: URL), PUSH_HOOK_SECRET.
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided by the runtime.
import { createClient } from 'npm:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'

type Kind = 'opponent_joined' | 'opponent_submitted' | 'opponent_solved' | 'rematch' | 'opponent_left'
type Lang = 'en' | 'de' | 'fr'

interface Payload {
  user_id: string
  kind: Kind
  duel_id: string
  actor_name: string
  points: number | null
}

const TEXT: Record<Lang, Record<Kind, (name: string, points: number) => string>> = {
  en: {
    opponent_joined: (n) => `${n} accepted your duel. Write your clover!`,
    opponent_submitted: (n) => `${n} has written their clover. Your turn to guess!`,
    opponent_solved: (n, p) => `${n} solved your clover: ${p} points.`,
    rematch: (n) => `${n} wants a rematch. Write your clover!`,
    opponent_left: (n) => `${n} left the duel.`,
  },
  de: {
    opponent_joined: (n) => `${n} hat dein Duell angenommen. Schreib dein Kleeblatt!`,
    opponent_submitted: (n) => `${n} hat das Kleeblatt geschrieben. Du bist dran mit Raten!`,
    opponent_solved: (n, p) => `${n} hat dein Kleeblatt gelöst: ${p} Punkte.`,
    rematch: (n) => `${n} will eine Revanche. Schreib dein Kleeblatt!`,
    opponent_left: (n) => `${n} hat das Duell verlassen.`,
  },
  fr: {
    opponent_joined: (n) => `${n} a accepté ton duel. Écris ton trèfle !`,
    opponent_submitted: (n) => `${n} a écrit son trèfle. À toi de deviner !`,
    opponent_solved: (n, p) => `${n} a résolu ton trèfle : ${p} points.`,
    rematch: (n) => `${n} veut une revanche. Écris ton trèfle !`,
    opponent_left: (n) => `${n} a quitté le duel.`,
  },
}

webpush.setVapidDetails(
  Deno.env.get('VAPID_SUBJECT') ?? 'mailto:admin@example.com',
  Deno.env.get('VAPID_PUBLIC_KEY')!,
  Deno.env.get('VAPID_PRIVATE_KEY')!,
)

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false },
})

Deno.serve(async (req) => {
  if (req.headers.get('x-push-secret') !== Deno.env.get('PUSH_HOOK_SECRET')) {
    return new Response('forbidden', { status: 403 })
  }
  const n = (await req.json()) as Payload

  const { data: subs, error } = await admin
    .from('push_subscriptions')
    .select('endpoint,p256dh,auth,lang')
    .eq('user_id', n.user_id)
  if (error) return new Response(error.message, { status: 500 })

  let sent = 0
  await Promise.all(
    (subs ?? []).map(async (s) => {
      const lang = (s.lang in TEXT ? s.lang : 'en') as Lang
      const body = JSON.stringify({
        title: 'Wordleaf 🍀',
        body: TEXT[lang][n.kind](n.actor_name, n.points ?? 0),
        url: `/?duel=${encodeURIComponent(n.duel_id)}`,
        tag: `duel-${n.duel_id}`,
      })
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, body, {
          TTL: 60 * 60 * 24 * 7,
        })
        sent++
      } catch (e) {
        // Gone or unknown: the browser dropped this subscription
        const status = (e as { statusCode?: number }).statusCode
        if (status === 404 || status === 410) {
          await admin.from('push_subscriptions').delete().eq('endpoint', s.endpoint)
        } else {
          console.error('push failed', status, e)
        }
      }
    }),
  )
  return Response.json({ sent })
})
