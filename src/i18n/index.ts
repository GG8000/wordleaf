import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import en from './en.json'
import de from './de.json'
import fr from './fr.json'

const KEY = 'kleever-lang'
const supported = ['en', 'de', 'fr']

function initialLang(): string {
  try {
    const saved = localStorage.getItem(KEY)
    if (saved && supported.includes(saved)) return saved
  } catch {
    // storage unavailable
  }
  const nav = navigator.language.slice(0, 2)
  return supported.includes(nav) ? nav : 'en'
}

i18n.use(initReactI18next).init({
  resources: { en: { translation: en }, de: { translation: de }, fr: { translation: fr } },
  lng: initialLang(),
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
})

i18n.on('languageChanged', (lng) => {
  document.documentElement.lang = lng
  try {
    localStorage.setItem(KEY, lng)
  } catch {
    // storage unavailable
  }
})

export default i18n
