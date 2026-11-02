import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { formatFcfa } from '@/lib/format';
import { PERIOD_OPTIONS, type PeriodKey, type SellersRanking } from '@/lib/stats';
import { useAuthStore } from '@/stores/use-auth-store';

/** Classement des boutiques sur la période (et les produits de BlackStore), avec lien vers le détail. */
export function SellersRankingSection() {
  const { accessToken } = useAuthStore();
  const [period, setPeriod] = useState<PeriodKey>('30j');
  const { data, isLoading, isError } = useQuery({
    queryKey: ['admin-sellers-ranking', period],
    queryFn: () => api.get<SellersRanking>(`/admin/stats/sellers?period=${period}`, accessToken),
    enabled: !!accessToken,
  });

  return (
    <section className="rounded-lg border bg-background">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b p-4">
        <div>
          <h2 className="font-semibold">Ventes par vendeur</h2>
          {data && (
            <p className="text-xs text-muted-foreground">
              {data.totals.sellersWithSales} vendeur{data.totals.sellersWithSales > 1 ? 's' : ''} avec des ventes ·{' '}
              {formatFcfa(data.totals.sellersRevenue)} de ventes des vendeurs · {formatFcfa(data.totals.commission)} de commission
            </p>
          )}
        </div>
        <div className="flex rounded-md border p-0.5" role="group" aria-label="Période">
          {PERIOD_OPTIONS.map((option) => (
            <button
              key={option.key}
              type="button"
              onClick={() => setPeriod(option.key)}
              aria-pressed={period === option.key}
              className={`rounded px-3 py-1.5 text-sm ${period === option.key ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
      {isLoading && <p className="p-4 text-sm text-muted-foreground">Chargement...</p>}
      {isError && <p className="p-4 text-sm text-red-600">Impossible de charger le classement.</p>}
      {data && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-muted/50 text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-2 text-left font-medium">Boutique</th>
                <th className="px-4 py-2 text-right font-medium">Produits</th>
                <th className="px-4 py-2 text-right font-medium">Visites</th>
                <th className="px-4 py-2 text-right font-medium">Ventes</th>
                <th className="px-4 py-2 text-right font-medium">Chiffre d'affaires</th>
                <th className="px-4 py-2 text-right font-medium">Commission</th>
                <th className="px-4 py-2 text-right font-medium">Remb.</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {data.sellers.map((row) => (
                <tr key={row.sellerId ?? 'blackstore'} className={row.sellerId ? '' : 'bg-orange-50/40 dark:bg-orange-950/20'}>
                  <td className="px-4 py-2">
                    {row.sellerId ? (
                      <Link to={`/vendeurs/${row.sellerId}/statistiques`} className="font-medium text-primary hover:underline">
                        {row.storeName}
                      </Link>
                    ) : (
                      <span className="font-medium">BlackStore (vos produits)</span>
                    )}
                    {row.sellerName && (
                      <span className="block text-xs text-muted-foreground">
                        {row.sellerName}
                        {row.sellerStatus === 'suspended' && ' · suspendu'}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-right">{row.products}</td>
                  <td className="px-4 py-2 text-right">{row.views.toLocaleString('fr-FR')}</td>
                  <td className="px-4 py-2 text-right">{row.sales.toLocaleString('fr-FR')}</td>
                  <td className="px-4 py-2 text-right">{formatFcfa(row.revenue)}</td>
                  <td className="px-4 py-2 text-right">{row.sellerId ? formatFcfa(row.commission) : '—'}</td>
                  <td className="px-4 py-2 text-right">{row.refunds}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
