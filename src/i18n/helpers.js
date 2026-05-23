export function getCurrentLanguage(i18n) {
  return i18n.resolvedLanguage || i18n.language || 'pt-BR';
}

export function getLocalizedField(record, baseName, i18n, fallback = '-') {
  if (!record) return fallback;

  const language = getCurrentLanguage(i18n);
  const preferredSuffix = language.startsWith('ja') ? 'jp' : 'pt';
  const fallbackSuffix = preferredSuffix === 'jp' ? 'pt' : 'jp';

  return (
    record[`${baseName}_${preferredSuffix}`] ||
    record[`${baseName}_${fallbackSuffix}`] ||
    record[baseName] ||
    fallback
  );
}

export function getLocalizedName(record, i18n, fallback = '-') {
  return getLocalizedField(record, 'name', i18n, fallback);
}

export function getLocalizedLabel(record, i18n, fallback = '-') {
  return getLocalizedField(record, 'label', i18n, fallback);
}
