import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '@/lib/api';
import type { SellerProfile, SellerStatus } from '@/lib/seller-api';
import { useAuthStore } from '@/stores/use-auth-store';

const STATUS_BANNERS: Record<SellerStatus, { className: string; text: string }> = {
  pending: {
    className: 'border-yellow-300 bg-yellow-50 text-yellow-800 dark:border-yellow-800 dark:bg-yellow-950 dark:text-yellow-200',
    text: "Votre compte est en attente de validation par l'équipe BlackStore. Vous recevrez un e-mail dès qu'il sera validé.",
  },
  approved: {
    className: 'border-green-300 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-950 dark:text-green-200',
    text: 'Votre compte vendeur est validé.',
  },
  suspended: {
    className: 'border-red-300 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200',
    text: 'Votre compte vendeur est suspendu.',
  },
};

const COMING_STEPS = ['Suivre vos ventes et retirer vos gains par Mobile Money'];

export function SellerDashboardPage() {
  const { accessToken } = useAuthStore();
  const { data: me, isLoading, isError } = useQuery({
    queryKey: ['seller-me'],
    queryFn: () => api.get<SellerProfile>('/seller/me', accessToken),
  });

  if (isLoading) return <p className="text-sm text-muted-foreground">Chargement...</p>;
  if (isError || !me) return <p className="text-sm text-red-600">Impossible de charger votre compte. Rechargez la page.</p>;

  const banner = STATUS_BANNERS[me.status];

  return (
    <div className="max-w-3xl space-y-6">
      <h1 className="text-2xl font-bold">Bonjour {me.firstName}</h1>
      <div className={`rounded-lg border px-4 py-3 text-sm ${banner.className}`}>{banner.text}</div>
      <section className="rounded-lg border bg-background p-4">
        <h2 className="mb-3 text-sm font-semibold">Prochaines étapes</h2>
        <ol className="list-decimal space-y-2 pl-5 text-sm">
          <li>
            {me.store ? (
              <>
                Boutique créée : <strong>{me.store.name}</strong>{' '}
                <Link to="/vendeur/boutique" className="text-primary hover:underline">(modifier)</Link>
              </>
            ) : (
              <Link to="/vendeur/boutique" className="font-medium text-primary hover:underline">
                Créer votre boutique : nom, logo, description
              </Link>
            )}
          </li>
          <li>
            {me.store ? (
              <Link to="/vendeur/produits" className="font-medium text-primary hover:underline">
                Ajouter vos produits numériques
              </Link>
            ) : (
              <>Ajouter vos produits numériques <span className="text-muted-foreground">(après la création de la boutique)</span></>
            )}
          </li>
          {COMING_STEPS.map((step) => (
            <li key={step}>
              {step} <span className="text-muted-foreground">(bientôt disponible)</span>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
