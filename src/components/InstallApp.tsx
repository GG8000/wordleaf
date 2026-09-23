import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { detectPlatform, promptInstall, useInstall, type Platform } from '../lib/install'

const TABS = ['ios', 'android'] as const

export function InstallApp({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation()
  const { installed, canPrompt } = useInstall()
  const detected = detectPlatform()
  const [tab, setTab] = useState<Exclude<Platform, 'other'>>(detected === 'ios' ? 'ios' : 'android')

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  // The native dialog took over, or the app just got installed
  useEffect(() => {
    if (installed) onClose()
  }, [installed, onClose])

  const steps = t(`install.steps.${tab}`, { returnObjects: true }) as string[]

  return (
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-stone-900/50 p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="install-title"
        className="flex max-h-full w-full max-w-md flex-col gap-4 overflow-y-auto rounded-3xl bg-white p-5 shadow-xl"
      >
        <div className="flex items-center justify-between gap-3">
          <h2 id="install-title" className="text-lg font-bold text-leaf-800">
            📲 {t('install.title')}
          </h2>
          <button
            type="button"
            onClick={onClose}
            autoFocus
            className="rounded-full px-3 py-1 text-sm text-stone-500 hover:bg-stone-100 hover:text-stone-800"
          >
            {t('map.close')}
          </button>
        </div>
        <p className="text-sm text-stone-600">{t('install.intro')}</p>
        {canPrompt && (
          <button
            type="button"
            onClick={() => void promptInstall()}
            className="rounded-xl bg-leaf-600 py-3 font-bold text-white hover:bg-leaf-700"
          >
            {t('install.now')}
          </button>
        )}
        <div className="flex gap-1 self-center rounded-full bg-stone-100 p-1 text-sm font-semibold" role="tablist">
          {TABS.map((p) => (
            <button
              key={p}
              type="button"
              role="tab"
              aria-selected={tab === p}
              onClick={() => setTab(p)}
              className={`rounded-full px-4 py-1 ${tab === p ? 'bg-leaf-600 text-white' : 'text-stone-600 hover:bg-leaf-100'}`}
            >
              {t(`install.tab.${p}`)}
            </button>
          ))}
        </div>
        <ol className="flex flex-col gap-2" role="tabpanel">
          {steps.map((step, i) => (
            <li key={i} className="flex gap-3 text-sm text-stone-700">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-leaf-100 text-xs font-bold text-leaf-800">
                {i + 1}
              </span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
        <p className="text-center text-xs text-stone-400">{t(`install.note.${tab}`)}</p>
      </div>
    </div>
  )
}
