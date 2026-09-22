import { useTranslation } from 'react-i18next'

const LANGS = ['en', 'de', 'fr'] as const

export function LanguageSwitcher() {
  const { i18n } = useTranslation()
  return (
    <div className="flex gap-1 rounded-full bg-white/70 p-1 text-xs font-semibold">
      {LANGS.map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => i18n.changeLanguage(l)}
          className={`rounded-full px-2 py-1 uppercase ${
            i18n.resolvedLanguage === l ? 'bg-emerald-600 text-white' : 'text-stone-600 hover:bg-emerald-100'
          }`}
        >
          {l}
        </button>
      ))}
    </div>
  )
}
