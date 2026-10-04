import { NavLink, Outlet, Navigate } from 'react-router-dom';
import { PageErrorBoundary } from '@/components/page-error-boundary';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { getApiUrl } from '@/lib/env';
import { useAuthStore } from '@/stores/use-auth-store';

const navItems = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/produits', label: 'Produits' },
  { to: '/categories', label: 'Catégories' },
  { to: '/commandes', label: 'Commandes' },
  { to: '/avis', label: 'Avis' },
  { to: '/analytics', label: 'Analytics' },
  { to: '/vendeurs', label: 'Vendeurs' },
  { to: '/produits-a-valider', label: 'Produits à valider' },
  { to: '/signalements', label: 'Signalements' },
  { to: '/messages', label: 'Messages' },
  { to: '/identites', label: 'Identités' },
  { to: '/retraits', label: 'Retraits' },
  { to: '/reglages', label: 'Réglages' },
  { to: '/sauvegardes', label: 'Sauvegardes' },
  { to: '/compte', label: 'Mon compte' },
];

export function AdminLayout() {
  const { accessToken, role, clearAuth, _hasHydrated } = useAuthStore();
  // Nombre de produits de vendeurs en attente, affiché dans le menu.
  const { data: pendingProducts } = useQuery({
    queryKey: ['admin-product-review', 'pending'],
    queryFn: () => api.get<unknown[]>('/admin/products/review?status=pending', accessToken),
    enabled: _hasHydrated && !!accessToken && role !== 'seller',
    refetchInterval: 60_000,
  });
  const { data: openReports } = useQuery({
    queryKey: ['admin-reports', 'open'],
    queryFn: () => api.get<unknown[]>('/admin/reports?status=open', accessToken),
    enabled: _hasHydrated && !!accessToken && role !== 'seller',
    refetchInterval: 60_000,
  });
  const { data: pendingIdentities } = useQuery({
    queryKey: ['admin-identity-checks', 'pending'],
    queryFn: () => api.get<unknown[]>('/admin/identity-checks?status=pending', accessToken),
    enabled: _hasHydrated && !!accessToken && role !== 'seller',
    refetchInterval: 60_000,
  });
  const { data: pendingWithdrawals } = useQuery({
    queryKey: ['admin-withdrawals', 'pending'],
    queryFn: () => api.get<unknown[]>('/admin/wallet/withdrawals?status=pending', accessToken),
    enabled: _hasHydrated && !!accessToken && role !== 'seller',
    refetchInterval: 60_000,
  });
  const { data: openMessages } = useQuery({
    queryKey: ['admin-messages', 'open'],
    queryFn: () => api.get<unknown[]>('/admin/messages?status=open', accessToken),
    enabled: _hasHydrated && !!accessToken && role !== 'seller',
    refetchInterval: 60_000,
  });
  // Sauvegarde de la base trop ancienne ou en échec : pastille d'alerte.
  const { data: backupHealth } = useQuery({
    queryKey: ['admin-backups-health'],
    queryFn: () => api.get<{ healthy: boolean }>('/admin/backups/health', accessToken),
    enabled: _hasHydrated && !!accessToken && role !== 'seller',
    refetchInterval: 5 * 60_000,
  });
  // Pastille du menu : ce qui attend une décision.
  const badges: Record<string, number> = {
    '/produits-a-valider': pendingProducts?.length ?? 0,
    '/signalements': openReports?.length ?? 0,
    '/messages': openMessages?.length ?? 0,
    '/sauvegardes': backupHealth && !backupHealth.healthy ? 1 : 0,
    '/identites': pendingIdentities?.length ?? 0,
    '/retraits': pendingWithdrawals?.length ?? 0,
  };

  if (!_hasHydrated) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-muted-foreground">Chargement...</p>
      </div>
    );
  }

  if (!accessToken) return <Navigate to="/login" replace />;
  if (role === 'seller') return <Navigate to="/vendeur" replace />;

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
              {(badges[item.to] ?? 0) > 0 && (
                <span className="ml-2 rounded-full bg-orange-500 px-1.5 py-0.5 text-xs font-semibold text-white">{badges[item.to]}</span>
              )}
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
            <PageErrorBoundary>
              <Outlet />
            </PageErrorBoundary>
          </div>
        </main>
      </div>
    </div>
  );
}
