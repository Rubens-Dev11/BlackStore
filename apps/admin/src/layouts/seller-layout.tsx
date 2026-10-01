import { NavLink, Outlet, Navigate, useNavigate } from 'react-router-dom';
import { getApiUrl } from '@/lib/env';
import { useAuthStore } from '@/stores/use-auth-store';
import { useSellerPageTitle } from './seller-auth-card';

const navItems = [
  { to: '/vendeur', label: 'Tableau de bord', end: true },
  { to: '/vendeur/compte', label: 'Mon compte', end: false },
];

export function SellerLayout() {
  const navigate = useNavigate();
  const { accessToken, role, clearAuth, _hasHydrated } = useAuthStore();
  useSellerPageTitle('Espace vendeur');

  if (!_hasHydrated) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-muted-foreground">Chargement...</p>
      </div>
    );
  }

  if (!accessToken || role !== 'seller') return <Navigate to="/vendeur/connexion" replace />;

  const logout = async () => {
    // Efface aussi le cookie de session côté API ; la déconnexion locale suffit s'il est injoignable.
    await fetch(`${getApiUrl()}/seller/auth/logout`, { method: 'POST', credentials: 'include' }).catch(() => undefined);
    clearAuth();
    navigate('/vendeur/connexion', { replace: true });
  };

  return (
    <div className="flex min-h-screen bg-muted/30">
      <aside className="flex w-56 shrink-0 flex-col border-r bg-background p-4">
        <p className="mb-6 text-lg font-bold">BlackStore Vendeur</p>
        <nav className="flex flex-col gap-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                [
                  'rounded-md px-3 py-2 text-sm font-medium',
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                ].join(' ')
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center justify-between border-b bg-background px-6">
          <p className="text-sm text-muted-foreground">Espace vendeur</p>
          <button onClick={logout} className="text-sm text-muted-foreground hover:text-foreground">
            Déconnexion
          </button>
        </header>
        <main className="flex-1 p-6">
          <div className="animate-fade-in">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
