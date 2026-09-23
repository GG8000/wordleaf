import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { detectPlatform, useInstall } from '../../lib/install'
import { enablePush, usePushState } from '../../lib/push'
import { showToast } from '../../lib/toast'

interface Props {
  onShowInstall: () => void
  /** Show the quiet "notifications are on" line too */
  showOn?: boolean
}

/** Offer push notifications for duels, or explain why they aren't available */
export function PushPrompt({ onShowInstall, showOn }: Props) {
  const { t } = useTranslation()
  const state = usePushState()
  const { installed } = useInstall()
  const [busy, setBusy] = useState(false)

  async function enable() {
    setBusy(true)
    try {
      const s = await enablePush()
      if (s === 'denied') showToast(t('push.denied'))
    } catch (e) {
      showToast(t('errors.generic', { msg: (e as Error).message }))
    } finally {
      setBusy(false)
    }
  }

  if (state === 'on') {
    return showOn ? <p className="text-center text-xs text-stone-500">🔔 {t('push.on')}</p> : null
  }
  if (state === 'denied') {
    return <p className="rounded-xl bg-stone-100 p-3 text-center text-xs text-stone-600">🔕 {t('push.blocked')}</p>
  }
  if (state === 'unsupported') {
    // iPhones only get web push in the installed app
    if (detectPlatform() !== 'ios' || installed) return null
    return (
      <p className="rounded-xl bg-sky-50 p-3 text-center text-xs text-sky-900">
        {t('push.iosInstall')}{' '}
        <button type="button" onClick={onShowInstall} className="font-semibold underline">
          {t('install.open')}
        </button>
      </p>
    )
  }
  return (
    <button
      type="button"
      onClick={enable}
      disabled={busy}
      className="rounded-xl border border-leaf-600 px-4 py-2 text-sm font-semibold text-leaf-700 hover:bg-leaf-50 disabled:opacity-50"
    >
      🔔 {t('push.enable')}
    </button>
  )
}
