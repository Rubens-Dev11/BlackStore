import { Link, useParams } from 'react-router-dom';
import { SellerStatsView } from '@/components/seller-stats-view';
import { MonthlyReportView } from '@/components/monthly-report-view';

/** Statistiques d'un vendeur vues par l'admin (les mêmes que dans son espace). */
export function SellerStatsAdminPage() {
  const { id = '' } = useParams<{ id: string }>();
  return (
    <div className="space-y-2">
      <Link to="/analytics" className="text-sm text-muted-foreground hover:text-foreground">← Ventes par vendeur</Link>
      <SellerStatsView
        statsPath={`/admin/stats/sellers/${id}`}
        reportPath={`/admin/stats/sellers/${id}/report`}
        reportHref={(month) => `/vendeurs/${id}/releve/${month}`}
        title={(stats) =>
          stats ? `${stats.store?.name ?? 'Sans boutique'} — ${stats.seller.firstName} ${stats.seller.lastName}` : 'Statistiques du vendeur'
        }
        intro="Les mêmes chiffres que dans l'espace du vendeur."
      />
    </div>
  );
}

/** Relevé mensuel d'un vendeur, pour l'admin. */
export function SellerReportAdminPage() {
  const { id = '', month = '' } = useParams<{ id: string; month: string }>();
  return (
    <MonthlyReportView
      apiPath={`/admin/stats/sellers/${id}/report`}
      month={month}
      backHref={`/vendeurs/${id}/statistiques`}
      backLabel="Statistiques du vendeur"
    />
  );
}
