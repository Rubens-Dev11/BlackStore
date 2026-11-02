import { SellerStatsView } from '@/components/seller-stats-view';
import { useSellerPageTitle } from '@/layouts/seller-auth-card';

/** Statistiques de la boutique du vendeur connecté. */
export function SellerStatsPage() {
  useSellerPageTitle('Statistiques');
  return (
    <SellerStatsView
      statsPath="/seller/stats"
      reportPath="/seller/stats/report"
      reportHref={(month) => `/vendeur/statistiques/releve/${month}`}
      title={() => 'Statistiques'}
      intro="Visites de votre boutique et de vos produits, ventes et gains, sur la période choisie (heure du Cameroun)."
    />
  );
}
