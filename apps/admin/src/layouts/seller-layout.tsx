import { useEffect, useRef } from 'react';
import { NavLink, Outlet, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { getApiUrl } from '@/lib/env';
import { useAuthStore } from '@/stores/use-auth-store';
import { useSellerPageTitle } from './seller-auth-card';

const navItems = [
  { to: '/vendeur', label: 'Tableau de bord', end: true },
  { to: '/vendeur/boutique', label: 'Ma boutique', end: false },
  { to: '/vendeur/produits', label: 'Mes produits', end: false },
  { to: '/vendeur/gains', label: 'Mes gains', end: false },
  { to: '/vendeur/identite', label: "Vérification d'identité", end: false },
  { to: '/vendeur/compte', label: 'Mon compte', end: false },
];

export function SellerLayout() {
  const navigate = useNavigate();
  const { accessToken, role, clearAuth, _hasHydrated } = useAuthStore();
  useSellerPageTitle('Espace vendeur');
  const { pathname } = useLocation();
  const mobileNav = useRef<HTMLElement>(null);

  // Sur téléphone, la rubrique ouverte reste visible dans la barre de menu.
  useEffect(() => {
    mobileNav.current?.querySelector('[aria-current="page"]')?.scrollIntoView({ block: 'nearest', inline: 'center' });
  }, [pathname, _hasHydrated]);

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

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    [
      'rounded-md px-3 py-2 text-sm font-medium',
      isActive ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
    ].join(' ');

  return (
    <div className="flex min-h-screen bg-muted/30">
      <aside className="hidden w-56 shrink-0 flex-col border-r bg-background p-4 md:flex print:hidden">
        <p className="mb-6 text-lg font-bold">BlackStore Vendeur</p>
        <nav className="flex flex-col gap-1">
          {navItems.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end} className={linkClass}>
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center justify-between border-b bg-background px-4 md:px-6 print:hidden">
          <p className="text-sm text-muted-foreground">
            <span className="font-bold text-foreground md:hidden">BlackStore Vendeur</span>
            <span className="hidden md:inline">Espace vendeur</span>
          </p>
          <button onClick={logout} className="text-sm text-muted-foreground hover:text-foreground">
            Déconnexion
          </button>
        </header>
        {/* Sur téléphone, le menu devient une barre qui défile horizontalement. */}
        <nav ref={mobileNav} className="flex gap-1 overflow-x-auto border-b bg-background px-4 py-2 md:hidden print:hidden">
          {navItems.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end} className={(state) => `${linkClass(state)} shrink-0 whitespace-nowrap`}>
              {item.label}
            </NavLink>
          ))}
        </nav>
        <main className="flex-1 p-4 md:p-6">
          <div className="animate-fade-in">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
