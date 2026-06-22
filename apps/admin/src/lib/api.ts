import { create } from 'zustand';
import { createApiClient, type ApiClient } from '@blackstore/shared';
import { getApiUrl } from './env';

interface AuthState {
  accessToken: string | null;
  setAccessToken: (token: string | null) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  setAccessToken: (token) => set({ accessToken: token }),
  clearAuth: () => set({ accessToken: null }),
}));

export const api: ApiClient = createApiClient({
  baseUrl: getApiUrl(),
  credentials: 'include',
  getAccessToken: () => useAuthStore.getState().accessToken,
  onUnauthorized: () => useAuthStore.getState().clearAuth(),
});
