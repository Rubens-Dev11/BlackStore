import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Bar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { api } from '@/lib/api';
import { formatFcfa } from '@/lib/format';
import { notify } from '@/lib/toast';
import { apiErrorMessage } from '@/components/form-field';
import {
  bucketLabel,
  downloadText,
  monthLabel,
  PERIOD_OPTIONS,
  recentMonths,
  reportCsv,
  trend,
  type MonthlyReport,
  type PeriodKey,
  type SellerStats,
} from '@/lib/stats';
import { useAuthStore } from '@/stores/use-auth-store';

const TREND_CLASS = { up: 'text-green-600', down: 'text-red-600', flat: 'text-muted-foreground' };
const number = (value: number) => value.toLocaleString('fr-FR');

function Kpi({ label, value, detail, change }: { label: string; value: string; detail?: ReactNode; change?: ReturnType<typeof trend> }) {
  return (
    <div className="rounded-lg border bg-background p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
      {change && (
        <p className={`text-xs font-medium ${TREND_CLASS[change.tone]}`}>
          {change.text === 'nouveau' ? 'nouveau : rien sur la période précédente' : `${change.text} par rapport à la période précédente`}
        </p>
      )}
      {detail && <p className="mt-1 text-xs text-muted-foreground">{detail}</p>}
    </div>
  );
}

interface Props {
  /** API des statistiques (« /seller/stats » ou « /admin/stats/sellers/:id »). */
  statsPath: string;
  /** API du relevé mensuel (sans le mois). */
  reportPath: string;
  /** Page imprimable du relevé d'un mois. */
  reportHref: (month: string) => string;
  title: (stats: SellerStats | undefined) => ReactNode;
  intro?: ReactNode;
}

/** Tableau de bord chiffré d'un vendeur : vues, ventes, gains, produits, provenance, relevés mensuels. */
export function SellerStatsView({ statsPath, reportPath, reportHref, title, intro }: Props) {
  const { accessToken } = useAuthStore();
  const [period, setPeriod] = useState<PeriodKey>('30j');
  const months = recentMonths();
  const [month, setMonth] = useState(months[0]);
  const [downloading, setDownloading] = useState(false);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['seller-stats', statsPath, period],
    queryFn: () => api.get<SellerStats>(`${statsPath}?period=${period}`, accessToken),
  });

  const downloadCsv = async () => {
    setDownloading(true);
    try {
      const report = await api.get<MonthlyReport>(`${reportPath}?month=${month}`, accessToken);
      downloadText(reportCsv(report), `releve-blackstore-${report.store?.slug ?? 'vendeur'}-${month}.csv`);
    } catch (err) {
      notify.error(apiErrorMessage(err));
    } finally {
      setDownloading(false);
    }
  };

  const totals = data?.totals;
  const granularity = data?.period.granularity ?? 'day';
  const chart = (data?.series ?? []).map((point) => ({ ...point, label: bucketLabel(point.bucket, granularity) }));

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{title(data)}</h1>
          {intro && <div className="text-sm text-muted-foreground">{intro}</div>}
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

      {isLoading && <p className="text-sm text-muted-foreground">Chargement...</p>}
      {isError && <p className="text-sm text-red-600">Impossible de charger les statistiques. Rechargez la page.</p>}
      {data && !data.hasStore && (
        <p className="rounded-lg border border-dashed bg-background p-6 text-center text-sm text-muted-foreground">
          Pas encore de boutique : les statistiques apparaîtront dès que la boutique et ses produits seront en ligne.
        </p>
      )}

      {data?.hasStore && totals && data.previous && (
        <>
          <section className="grid grid-cols-2 gap-3 lg:grid-cols-3">
            <Kpi
              label="Visites"
              value={number(totals.views)}
              change={trend(totals.views, data.previous.views)}
              detail={`${number(totals.visitors)} visiteur${totals.visitors > 1 ? 's' : ''} · ${number(totals.storeViews)} sur la page boutique`}
            />
            <Kpi
              label="Ventes"
              value={number(totals.sales)}
              change={trend(totals.sales, data.previous.sales)}
              detail={totals.freeItems > 0 ? `+ ${number(totals.freeItems)} téléchargement${totals.freeItems > 1 ? 's' : ''} gratuit${totals.freeItems > 1 ? 's' : ''}` : undefined}
            />
            <Kpi
              label="Chiffre d'affaires"
              value={formatFcfa(totals.revenue)}
              change={trend(totals.revenue, data.previous.revenue)}
              detail={totals.discounts > 0 ? `après ${formatFcfa(totals.discounts)} de réductions (codes promo)` : 'prix payés par les clients'}
            />
            <Kpi label="Gains du vendeur" value={formatFcfa(totals.net)} detail={`commission BlackStore : ${formatFcfa(totals.commission)}`} />
            <Kpi
              label="Taux de conversion"
              value={`${totals.conversionRate.toLocaleString('fr-FR')} %`}
              detail="produits obtenus pour 100 vues des fiches produits"
            />
            <Kpi
              label="Remboursements"
              value={number(totals.refunds)}
              detail={totals.refunds > 0 ? `${formatFcfa(totals.refundedAmount)} rendus aux clients` : 'aucun sur la période'}
            />
          </section>

          <section className="rounded-lg border bg-background p-4">
            <h2 className="mb-3 text-sm font-semibold">
              Chiffre d'affaires et visites {granularity === 'month' ? 'par mois' : 'par jour'}
            </h2>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chart} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} interval="preserveStartEnd" minTickGap={12} />
                  <YAxis yAxisId="fcfa" tick={{ fontSize: 11 }} width={60} tickFormatter={(v: number) => v.toLocaleString('fr-FR')} />
                  <YAxis yAxisId="views" orientation="right" tick={{ fontSize: 11 }} width={35} allowDecimals={false} />
                  <Tooltip
                    formatter={(value: number, name: string) => (name === "Chiffre d'affaires" ? formatFcfa(value) : number(value))}
                    labelFormatter={(label: string) => label}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar yAxisId="fcfa" dataKey="revenue" name="Chiffre d'affaires" fill="#f97316" radius={[3, 3, 0, 0]} />
                  <Line yAxisId="views" dataKey="views" name="Visites" stroke="#2563eb" strokeWidth={2} dot={false} type="monotone" />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </section>

          <section className="rounded-lg border bg-background">
            <h2 className="border-b p-4 text-sm font-semibold">Produits</h2>
            {data.products && data.products.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-sm">
                  <thead className="bg-muted/50 text-xs text-muted-foreground">
                    <tr>
                      <th className="px-4 py-2 text-left font-medium">Produit</th>
                      <th className="px-4 py-2 text-right font-medium">Prix</th>
                      <th className="px-4 py-2 text-right font-medium">Vues</th>
                      <th className="px-4 py-2 text-right font-medium">Ventes</th>
                      <th className="px-4 py-2 text-right font-medium">Chiffre d'affaires</th>
                      <th className="px-4 py-2 text-right font-medium">Conversion</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {data.products.map((product) => (
                      <tr key={product.id}>
                        <td className="px-4 py-2">
                          <span className="font-medium">{product.name}</span>
                          {!product.isActive && <span className="ml-2 text-xs text-muted-foreground">(hors ligne)</span>}
                        </td>
                        <td className="px-4 py-2 text-right">{product.price === 0 ? 'Gratuit' : formatFcfa(product.price)}</td>
                        <td className="px-4 py-2 text-right">{number(product.views)}</td>
                        <td className="px-4 py-2 text-right">
                          {number(product.sales)}
                          {product.freeItems > 0 && <span className="text-xs text-muted-foreground"> + {number(product.freeItems)} gratuit{product.freeItems > 1 ? 's' : ''}</span>}
                        </td>
                        <td className="px-4 py-2 text-right">{formatFcfa(product.revenue)}</td>
                        <td className="px-4 py-2 text-right">{product.views > 0 ? `${product.conversionRate.toLocaleString('fr-FR')} %` : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="p-4 text-sm text-muted-foreground">Aucun produit dans la boutique pour l'instant.</p>
            )}
          </section>

          <section className="rounded-lg border bg-background p-4">
            <h2 className="mb-1 text-sm font-semibold">D'où viennent les visiteurs</h2>
            <p className="mb-3 text-xs text-muted-foreground">
              Pour suivre une publication, partagez votre lien avec <code className="rounded bg-muted px-1">?utm_source=facebook</code> (ou
              whatsapp, tiktok…) à la fin.
            </p>
            {data.sources && data.sources.length > 0 ? (
              <ul className="space-y-2">
                {data.sources.map((source) => (
                  <li key={source.label} className="text-sm">
                    <div className="flex justify-between gap-3">
                      <span>{source.label}</span>
                      <span className="text-muted-foreground">
                        {number(source.views)} visite{source.views > 1 ? 's' : ''} · {source.share.toLocaleString('fr-FR')} %
                      </span>
                    </div>
                    <div className="mt-1 h-2 rounded-full bg-muted">
                      <div className="h-2 rounded-full bg-orange-500" style={{ width: `${Math.max(source.share, 2)}%` }} />
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">Aucune visite sur la période.</p>
            )}
          </section>
        </>
      )}

      {data?.hasStore && (
        <section className="space-y-3 rounded-lg border bg-background p-4">
          <div>
            <h2 className="text-sm font-semibold">Relevé mensuel</h2>
            <p className="text-xs text-muted-foreground">
              Ventes, commissions, remboursements et retraits d'un mois, avec le solde au début et à la fin : à imprimer, enregistrer en PDF
              ou ouvrir dans Excel.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select aria-label="Mois du relevé" value={month} onChange={(e) => setMonth(e.target.value)} className="rounded-md border bg-background px-3 py-2 text-sm">
              {months.map((m) => (
                <option key={m} value={m}>
                  {monthLabel(m)}
                </option>
              ))}
            </select>
            <Link to={reportHref(month)} className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
              Voir et imprimer
            </Link>
            <button type="button" onClick={downloadCsv} disabled={downloading} className="rounded-md border px-4 py-2 text-sm hover:bg-muted disabled:opacity-50">
              {downloading ? 'Préparation...' : 'Télécharger pour Excel (CSV)'}
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
