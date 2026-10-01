import { getApiUrl } from './env';
import { loginPathFor, useAuthStore } from '@/stores/use-auth-store';

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
      const { refreshToken, role } = useAuthStore.getState();
      const loginPath = loginPathFor(role);
      if (!refreshToken) {
        // No refresh token, logout
        useAuthStore.getState().clearAuth();
        window.location.href = loginPath;
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
        const refreshPath = role === 'seller' ? '/seller/auth/refresh' : '/auth/refresh';
        const refreshResponse = await fetch(`${BASE_URL}${refreshPath}`, {
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
        // Session expirée ou fermée (mot de passe changé, compte suspendu) : retour à la connexion.
        if (err instanceof Error && err.message === 'Refresh failed') {
          useAuthStore.getState().clearAuth();
          window.location.href = loginPath;
        }
        throw err;
      } finally {
        isRefreshing = false;
      }
    }
    throw err;
  }
}

// Upload avec suivi de progression réel (XMLHttpRequest, car fetch() ne
// permet pas d'observer la progression de l'UPLOAD, seulement de la
// réception). Version simplifiée par rapport à fetchWithRefresh : en cas de
// 401 pendant un upload, on ne tente pas de rafraîchir le token et de
// rejouer automatiquement — on demande de recharger la page. Ça évite de
// dupliquer la logique de file d'attente de refresh sur un chemin critique
// (upload de fichiers volumineux) pour un cas rare (token expiré pile
// pendant un upload).
function postFormWithProgress<T>(
  path: string,
  body: FormData,
  accessToken: string | null | undefined,
  onProgress: (percent: number) => void,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${BASE_URL}${path}`);
    if (accessToken) {
      xhr.setRequestHeader('Authorization', `Bearer ${accessToken}`);
    }

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(JSON.parse(xhr.responseText));
        } catch {
          reject({ status: xhr.status, message: 'Réponse invalide du serveur' });
        }
        return;
      }

      let message = xhr.status === 401
        ? 'Session expirée, merci de recharger la page et réessayer.'
        : 'Erreur serveur';
      try {
        const parsed = JSON.parse(xhr.responseText);
        message = parsed.message || message;
      } catch {
        // réponse non-JSON, on garde le message par défaut
      }
      reject({ status: xhr.status, message });
    };

    xhr.onerror = () => {
      reject({ status: 0, message: "Erreur réseau pendant l'upload" });
    };

    xhr.send(body);
  });
}

export const api = {
  postFormWithProgress,
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
  put: <T>(path: string, body: unknown, accessToken?: string | null) =>
    fetchWithRefresh(`${BASE_URL}${path}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: accessToken ? `Bearer ${accessToken}` : '' },
      body: JSON.stringify(body),
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

