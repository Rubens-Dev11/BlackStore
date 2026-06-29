import { NavLink, Outlet, Navigate } from 'react-router-dom';
import { getApiUrl } from '@/lib/env';
import { useAuthStore } from '@/stores/use-auth-store';

const navItems = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/produits', label: 'Produits' },
  { to: '/categories', label: 'Catégories' },
  { to: '/commandes', label: 'Commandes' },
  { to: '/avis', label: 'Avis' },
  { to: '/analytics', label: 'Analytics' },
];

export function AdminLayout() {
  const { accessToken, clearAuth, _hasHydrated } = useAuthStore();

  if (!_hasHydrated) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-muted-foreground">Chargement...</p>
      </div>
    );
  }

  if (!accessToken) return <Navigate to="/login" replace />;

  return (
    <div className="flex min-h-screen bg-muted/30">
      <aside className="flex w-56 shrink-0 flex-col border-r bg-background p-4">
        <p className="mb-6 text-lg font-bold">BlackStore Admin</p>
        <nav className="flex flex-col gap-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
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
        <p className="mt-auto pt-6 text-xs text-muted-foreground">API: {getApiUrl()}</p>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center justify-between border-b bg-background px-6">
          <p className="text-sm text-muted-foreground">BlackStore Admin Dashboard</p>
          <button
            onClick={() => {
              clearAuth();
              window.location.href = '/login';
            }}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
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
