import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useRegisterSW } from 'virtual:pwa-register/react'

const CHECK_MS = 60 * 60 * 1000

/** Picks up new deployments: silently when nobody is at a table, otherwise with a banner */
export function UpdateBanner({ inGame }: { inGame: boolean }) {
  const { t } = useTranslation()
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, reg) {
      if (!reg) return
      // Installed apps can stay open for days, so look for a new version now and then
      // and every time the app comes back to the foreground
      const check = () => {
        if (navigator.onLine && document.visibilityState === 'visible') void reg.update()
      }
      setInterval(check, CHECK_MS)
      document.addEventListener('visibilitychange', check)
    },
  })

  // Reloading mid-game would interrupt the round, so only switch over on its own outside a room
  useEffect(() => {
    if (needRefresh && !inGame) void updateServiceWorker(true)
  }, [needRefresh, inGame, updateServiceWorker])

  if (!needRefresh || !inGame) return null
  return (
    <div className="fixed inset-x-4 top-4 z-[1100] mx-auto flex max-w-md items-center justify-between gap-3 rounded-xl bg-leaf-800 px-4 py-3 text-sm text-white shadow-lg">
      <span>{t('update.available')}</span>
      <button
        type="button"
        onClick={() => void updateServiceWorker(true)}
        className="shrink-0 rounded-lg bg-white px-3 py-1 font-bold text-leaf-800 hover:bg-leaf-50"
      >
        {t('update.reload')}
      </button>
    </div>
  )
}
