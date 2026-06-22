import { NavLink, Outlet } from 'react-router-dom';
import { getApiUrl } from '@/lib/env';

const navItems = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/produits', label: 'Produits' },
  { to: '/categories', label: 'Catégories' },
  { to: '/commandes', label: 'Commandes' },
  { to: '/avis', label: 'Avis' },
  { to: '/analytics', label: 'Analytics' },
];

export function AdminLayout() {
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
        <header className="flex h-14 items-center border-b bg-background px-6">
          <p className="text-sm text-muted-foreground">Phase 0 — base frontend admin</p>
        </header>
        <main className="flex-1 p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
