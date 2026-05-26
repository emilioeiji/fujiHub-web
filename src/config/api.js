const DEV_API_BASE_URL = 'http://127.0.0.1:8000';

export function getApiBaseUrl() {
  const value = import.meta.env.VITE_API_URL;
  if (!value || !String(value).trim()) {
    if (import.meta.env.DEV) return DEV_API_BASE_URL;
    throw new Error(
      'VITE_API_URL is required for production builds. Example: VITE_API_URL=https://api.emilioeiji.com.br'
    );
  }
  return String(value).trim().replace(/\/+$/, '');
}

if (import.meta.env.DEV) {
  console.info(`FujiHub API URL: ${getApiBaseUrl()}`);
}

export function apiUrl(path) {
  const normalizedPath = String(path || '').startsWith('/') ? path : `/${path || ''}`;
  return `${getApiBaseUrl()}${normalizedPath}`;
}
