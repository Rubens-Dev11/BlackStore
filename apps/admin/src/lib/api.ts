import { getApiUrl } from './env';
import { useAuthStore } from '@/stores/use-auth-store';

const BASE_URL = getApiUrl();

let isRefreshing = false;
let refreshQueue: Array<(token: string) => void> = [];

async function fetchWithRefresh(input: RequestInfo, init?: RequestInit): Promise<Response> {
  let token = useAuthStore.getState().accessToken;

  const performFetch = async (token: string | null): Promise<Response> => {
    const headers: Record<string, string> = {
      ...(init?.headers as Record<string, string> || {}),
    };

    // Determine if body is FormData to avoid overwriting Content-Type
    const isFormData = (init?.body as FormData) instanceof FormData;
    if (!isFormData && !headers['Content-Type']) {
      headers['Content-Type'] = 'application/json';
    }

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    // Les appelants (api.get/post/...) passent déjà l'URL complète (BASE_URL + path).
    // Ne PAS re-préfixer BASE_URL ici, sinon l'URL est doublée et fetch échoue.
    const response = await fetch(typeof input === 'string' ? input : input.url, {
      ...init,
      headers,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Network error' }));
      throw { status: response.status, message: error.message || 'Server error' };
    }

    return response;
  };

  try {
    return await performFetch(token);
  } catch (err: any) {
    if (err.status === 401 && token) {
      const { refreshToken } = useAuthStore.getState();
      if (!refreshToken) {
        // No refresh token, logout
        useAuthStore.getState().clearAuth();
        window.location.href = '/login';
        throw err;
      }

      if (isRefreshing) {
        // Wait for ongoing refresh
        return new Promise<Response>((resolve, reject) => {
          refreshQueue.push((newToken: string) => {
            // Retry original request with new token
            fetchWithRefresh(input, { ...init, headers: { ...(init?.headers || {}), Authorization: `Bearer ${newToken}` } })
              .then(resolve)
              .catch(reject);
          });
        });
      }

      isRefreshing = true;
      try {
        const refreshResponse = await fetch(`${BASE_URL}/auth/refresh`, {
          method: 'POST',
          credentials: 'include',
        });

        if (!refreshResponse.ok) {
          throw new Error('Refresh failed');
        }

        const data = await refreshResponse.json();
        const newAccessToken = data.accessToken;
        const newRefreshToken = data.refreshToken ?? refreshToken;

        // Update store with new tokens
        useAuthStore.getState().setTokens(newAccessToken, newRefreshToken);

        // Retry original request with new token
        const result = await fetchWithRefresh(input, {
          ...init,
          headers: { ...(init?.headers || {}), Authorization: `Bearer ${newAccessToken}` },
        });

        // Flush queue
        refreshQueue.forEach((cb) => cb(newAccessToken));
        refreshQueue = [];

        return result;
      } catch (err) {
        refreshQueue = [];
        throw err;
      } finally {
        isRefreshing = false;
      }
    }
    throw err;
  }
}

export const api = {
  get: <T>(path: string, accessToken?: string | null) =>
    fetchWithRefresh(`${BASE_URL}${path}`, { method: 'GET', headers: { Authorization: accessToken ? `Bearer ${accessToken}` : '' } })
      .then((res) => res.json()) as Promise<T>,
  post: <T>(path: string, body: unknown, accessToken?: string | null) =>
    fetchWithRefresh(`${BASE_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: accessToken ? `Bearer ${accessToken}` : '' },
      body: JSON.stringify(body),
    })
      .then((res) => res.json()) as Promise<T>,
  postForm: <T>(path: string, body: FormData, accessToken?: string | null) =>
    fetchWithRefresh(`${BASE_URL}${path}`, {
      method: 'POST',
      body,
      headers: { Authorization: accessToken ? `Bearer ${accessToken}` : '' },
    })
      .then((res) => res.json()) as Promise<T>,
  patch: <T>(path: string, body: unknown, accessToken?: string | null) =>
    fetchWithRefresh(`${BASE_URL}${path}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: accessToken ? `Bearer ${accessToken}` : '' },
      body: JSON.stringify(body),
    })
      .then((res) => res.json()) as Promise<T>,
  delete: <T>(path: string, accessToken?: string | null) =>
    fetchWithRefresh(`${BASE_URL}${path}`, { method: 'DELETE', headers: { Authorization: accessToken ? `Bearer ${accessToken}` : '' } })
      .then((res) => res.json()) as Promise<T>,
  getBlob: async (path: string, accessToken?: string | null): Promise<Blob> => {
    const res = await fetchWithRefresh(`${BASE_URL}${path}`, {
      method: 'GET',
      headers: { Authorization: accessToken ? `Bearer ${accessToken}` : '' },
    });
    return res.blob();
  },
};