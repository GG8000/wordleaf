// Push handlers, loaded into the generated service worker via workbox.importScripts (vite.config.ts).
// Messages come from supabase/functions/send-push: { title, body, url, tag }.

self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    data = { body: event.data ? event.data.text() : '' }
  }
  // Always show something: browsers (Safari especially) revoke push for silent messages
  event.waitUntil(
    self.registration.showNotification(data.title || 'Wordleaf 🍀', {
      body: data.body || '',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: data.tag,
      renotify: Boolean(data.tag),
      data: { url: data.url || '/' },
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = new URL(event.notification.data?.url || '/', self.location.origin).href
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      for (const client of windows) {
        if (new URL(client.url).origin !== self.location.origin) continue
        await client.focus()
        // The open app switches to the duel itself (see listenForOpenDuel in src/lib/push.ts)
        client.postMessage({ type: 'open-duel', url })
        return
      }
      await self.clients.openWindow(url)
    })(),
  )
})
