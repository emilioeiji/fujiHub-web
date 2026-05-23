import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import jaJP from './locales/ja-JP.json';
import ptBR from './locales/pt-BR.json';

export const supportedLanguages = [
  { code: 'pt-BR', label: 'Português', shortLabel: 'PT' },
  { code: 'ja-JP', label: '日本語', shortLabel: 'JA' },
];

export function isSupportedLanguage(language) {
  return supportedLanguages.some((supportedLanguage) => supportedLanguage.code === language);
}

export function changeAppLanguage(language) {
  if (!isSupportedLanguage(language)) return Promise.resolve();
  return i18n.changeLanguage(language);
}

const storedLanguage = localStorage.getItem('fujihub.language');
const initialLanguage = isSupportedLanguage(storedLanguage) ? storedLanguage : 'pt-BR';

i18n.use(initReactI18next).init({
  resources: {
    'pt-BR': { translation: ptBR },
    'ja-JP': { translation: jaJP },
  },
  lng: initialLanguage,
  fallbackLng: 'pt-BR',
  interpolation: {
    escapeValue: false,
  },
});

i18n.on('languageChanged', (language) => {
  localStorage.setItem('fujihub.language', language);
  document.documentElement.lang = language;
});

document.documentElement.lang = initialLanguage;

export default i18n;
