export function forbiddenMessage() {
  return 'Você não tem permissão para executar esta ação.';
}

export function readonlyMessage() {
  return 'Modo somente leitura.';
}

export function requestAccessMessage() {
  return 'Solicite acesso ao responsável do sistema.';
}

export function noOperationalModuleMessage() {
  return 'Nenhum módulo operacional disponível para seu perfil.';
}

export async function readJsonSafe(res) {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export function formatApiError(data, fallback) {
  if (!data) return fallback;
  if (typeof data.detail === 'string') return data.detail;
  const firstError = Object.entries(data)[0];
  if (!firstError) return fallback;
  const [field, messages] = firstError;
  const message = Array.isArray(messages) ? messages[0] : messages;
  return `${field}: ${message}`;
}
