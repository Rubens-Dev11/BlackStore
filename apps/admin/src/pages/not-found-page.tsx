import { Link } from 'react-router-dom';

/** Adresse inconnue, dans l'admin ou dans l'espace vendeur (chacun garde son menu). */
export function NotFoundPage({ space = 'admin' }: { space?: 'admin' | 'vendeur' }) {
  const home = space === 'vendeur'
    ? { to: '/vendeur', label: 'Retour à mon espace vendeur' }
    : { to: '/dashboard', label: 'Retour au tableau de bord' };

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="h-7 w-7" aria-hidden="true">
          <circle cx="12" cy="12" r="10" />
          <path d="m16.24 7.76-2.12 6.36-6.36 2.12 2.12-6.36 6.36-2.12z" />
        </svg>
      </div>
      <p className="mt-5 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Erreur 404</p>
      <h1 className="mt-2 text-2xl font-bold">Page introuvable</h1>
      <p className="mt-3 max-w-md text-muted-foreground">
        Cette adresse ne correspond à aucune page. Le lien est peut-être incomplet, ou la page a été déplacée.
      </p>
      <Link to={home.to} className="mt-6 rounded-md bg-primary px-6 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
        {home.label}
      </Link>
    </div>
  );
}
