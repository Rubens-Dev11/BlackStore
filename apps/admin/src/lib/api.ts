import { getApiUrl } from './env';
import { useAuthStore } from '@/stores/use-auth-store';

const BASE_URL = getApiUrl();

async function request<T>(
  path: string,
  options: RequestInit = {},
  accessToken?: string | null
): Promise<T> {
  const token = accessToken ?? useAuthStore.getState().accessToken;

  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string> || {}),
  };

  const isFormData = options.body instanceof FormData;
  if (!isFormData && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Erreur réseau' }));
    throw { status: response.status, message: error.message || 'Erreur serveur' };
  }

  return response.json();
}

export const api = {
  get: <T>(path: string, accessToken?: string | null) =>
    request<T>(path, { method: 'GET' }, accessToken),
  post: <T>(path: string, body: unknown, accessToken?: string | null) =>
    request<T>(path, { method: 'POST', body: JSON.stringify(body) }, accessToken),
  postForm: <T>(path: string, body: FormData, accessToken?: string | null) =>
    request<T>(path, { method: 'POST', body }, accessToken),
  patch: <T>(path: string, body: unknown, accessToken?: string | null) =>
    request<T>(path, { method: 'PATCH', body: JSON.stringify(body) }, accessToken),
  delete: <T>(path: string, accessToken?: string | null) =>
    request<T>(path, { method: 'DELETE' }, accessToken),
  getBlob: async (path: string, accessToken?: string | null): Promise<Blob> => {
    const token = accessToken ?? useAuthStore.getState().accessToken;
    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    const response = await fetch(`${BASE_URL}${path}`, { headers });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Erreur réseau' }));
      throw { status: response.status, message: error.message || 'Erreur serveur' };
    }
    return response.blob();
  },
};
