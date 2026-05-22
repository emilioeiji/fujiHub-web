import { useTranslation } from 'react-i18next';
import { supportedLanguages } from '../i18n';

export default function LanguageSelector({ compact = false }) {
  const { i18n, t } = useTranslation();

  return (
    <label className={`language-selector ${compact ? 'compact' : ''}`}>
      <span>{t('app.language')}</span>
      <select value={i18n.language} onChange={(event) => i18n.changeLanguage(event.target.value)}>
        {supportedLanguages.map((language) => (
          <option key={language.code} value={language.code}>
            {compact ? language.shortLabel : language.label}
          </option>
        ))}
      </select>
    </label>
  );
}
