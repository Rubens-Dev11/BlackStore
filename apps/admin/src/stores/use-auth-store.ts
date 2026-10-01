import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/** Type de compte connecté ; absent pour une session admin ouverte avant l'arrivée des vendeurs. */
export type AuthRole = 'admin' | 'seller';

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  role: AuthRole | null;
  _hasHydrated: boolean;
  setTokens: (accessToken: string, refreshToken: string, role?: AuthRole) => void;
  clearAuth: () => void;
  setHasHydrated: (state: boolean) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      refreshToken: null,
      role: null,
      _hasHydrated: false,
      // Sans rôle précisé (renouvellement de session), le rôle en cours est conservé.
      setTokens: (accessToken, refreshToken, role) =>
        set((state) => ({ accessToken, refreshToken, role: role ?? state.role ?? 'admin' })),
      clearAuth: () => set({ accessToken: null, refreshToken: null, role: null }),
      setHasHydrated: (state: boolean) => set({ _hasHydrated: state }),
    }),
    {
      name: 'blackstore-admin-auth',
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    }
  )
);

/** Page de connexion correspondant au compte en cours. */
export const loginPathFor = (role: AuthRole | null) =>
  role === 'seller' ? '/vendeur/connexion' : '/login';
