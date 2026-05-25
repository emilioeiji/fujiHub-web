const DEFAULT_API_BASE_URL = 'http://127.0.0.1:8000';

export function getApiBaseUrl() {
  const value = import.meta.env.VITE_API_URL;
  if (!value || !String(value).trim()) return DEFAULT_API_BASE_URL;
  return String(value).trim().replace(/\/+$/, '');
}

export function apiUrl(path) {
  const normalizedPath = String(path || '').startsWith('/') ? path : `/${path || ''}`;
  return `${getApiBaseUrl()}${normalizedPath}`;
}

