import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { formatFcfa } from '@/lib/format';
import { OPERATOR_LABELS, WITHDRAWAL_STATUS_LABELS } from '@/lib/seller-api';
import { downloadText, formatDay, monthLabel, reportCsv, type MonthlyReport } from '@/lib/stats';
import { useAuthStore } from '@/stores/use-auth-store';

const money = (value: number | null) => (value === null ? '—' : formatFcfa(value));

/** Relevé mensuel d'un vendeur, à imprimer ou enregistrer en PDF depuis le navigateur. */
export function MonthlyReportView({ apiPath, month, backHref, backLabel }: { apiPath: string; month: string; backHref: string; backLabel: string }) {
  const { accessToken } = useAuthStore();
  const { data: report, isLoading, isError, error } = useQuery({
    queryKey: ['monthly-report', apiPath, month],
    queryFn: () => api.get<MonthlyReport>(`${apiPath}?month=${month}`, accessToken),
    retry: false,
  });

  if (isLoading) return <p className="text-sm text-muted-foreground">Chargement...</p>;
  if (isError || !report) {
    const message = (error as { message?: string } | null)?.message;
    return (
      <p className="text-sm text-red-600">
        {message || 'Relevé introuvable.'} <Link to={backHref} className="underline">{backLabel}</Link>
      </p>
    );
  }

  const summary: [string, string, boolean?][] = [
    ['Solde au début du mois', formatFcfa(report.balance.opening)],
    [`Ventes (${report.totals.sales})`, `${formatFcfa(report.totals.paid)} payés par les clients`],
    ...(report.totals.discounts > 0 ? [['dont réductions des codes promo', formatFcfa(report.totals.discounts)] as [string, string]] : []),
    ['Commission BlackStore', `− ${formatFcfa(report.totals.commission)}`],
    ['Vos gains sur les ventes', formatFcfa(report.totals.net), true],
    ...(report.totals.refunds > 0 ? [[`Remboursements (${report.totals.refunds})`, `− ${formatFcfa(report.totals.refundedNet)}`] as [string, string]] : []),
    ['Retraits payés', `− ${formatFcfa(report.totals.withdrawn)}`],
    ['Solde à la fin du mois', formatFcfa(report.balance.closing), true],
  ];
  const th = 'px-2 py-1.5 text-left font-medium';
  const td = 'px-2 py-1.5';

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
        <Link to={backHref} className="text-sm text-muted-foreground hover:text-foreground">← {backLabel}</Link>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => downloadText(reportCsv(report), `releve-blackstore-${report.store?.slug ?? 'vendeur'}-${report.month}.csv`)}
            className="rounded-md border px-4 py-2 text-sm hover:bg-muted"
          >
            Télécharger pour Excel (CSV)
          </button>
          <button type="button" onClick={() => window.print()} className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
            Imprimer ou enregistrer en PDF
          </button>
        </div>
      </div>

      <article className="space-y-6 rounded-lg border bg-background p-6 text-sm print:border-0 print:p-0">
        <header className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xl font-bold">BlackStore</p>
            <p className="text-xs text-muted-foreground">blackstore.pymail.cm</p>
          </div>
          <div className="text-right">
            <p className="font-semibold">Relevé de compte vendeur</p>
            <p className="capitalize">{monthLabel(report.month)}</p>
          </div>
        </header>

        <p>
          <span className="font-medium">{report.seller.firstName} {report.seller.lastName}</span>
          {report.store && <> — boutique {report.store.name}</>}
          <br />
          <span className="text-muted-foreground">{report.seller.email}</span>
        </p>

        <table className="w-full max-w-md">
          <tbody>
            {summary.map(([label, value, strong]) => (
              <tr key={label} className="border-b last:border-0">
                <td className={`py-1.5 pr-4 ${strong ? 'font-semibold' : 'text-muted-foreground'}`}>{label}</td>
                <td className={`py-1.5 text-right ${strong ? 'font-semibold' : ''}`}>{value}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <section className="space-y-2">
          <h2 className="font-semibold">Ventes</h2>
          {report.sales.length === 0 ? (
            <p className="text-muted-foreground">Aucune vente ce mois-ci.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-xs">
                <thead className="border-b text-muted-foreground">
                  <tr>
                    <th className={th}>Date</th>
                    <th className={th}>Commande</th>
                    <th className={th}>Produit</th>
                    <th className={`${th} text-right`}>Payé</th>
                    <th className={`${th} text-right`}>Réduction</th>
                    <th className={`${th} text-right`}>Commission</th>
                    <th className={`${th} text-right`}>Votre gain</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {report.sales.map((sale, i) => (
                    <tr key={`${sale.orderNumber}-${i}`}>
                      <td className={td}>{formatDay(sale.date)}</td>
                      <td className={`${td} font-mono`}>{sale.orderNumber}</td>
                      <td className={td}>{sale.productName}</td>
                      <td className={`${td} text-right`}>{formatFcfa(sale.paid)}</td>
                      <td className={`${td} text-right`}>{sale.discount > 0 ? formatFcfa(sale.discount) : '—'}</td>
                      <td className={`${td} text-right`}>{money(sale.commission)}</td>
                      <td className={`${td} text-right`}>{money(sale.net)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {report.refunds.length > 0 && (
          <section className="space-y-2">
            <h2 className="font-semibold">Remboursements</h2>
            <table className="w-full text-xs">
              <thead className="border-b text-muted-foreground">
                <tr>
                  <th className={th}>Date</th>
                  <th className={th}>Commande</th>
                  <th className={th}>Produit</th>
                  <th className={`${th} text-right`}>Rendu au client</th>
                  <th className={`${th} text-right`}>Retiré de vos gains</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {report.refunds.map((refund, i) => (
                  <tr key={i}>
                    <td className={td}>{formatDay(refund.date)}</td>
                    <td className={`${td} font-mono`}>{refund.orderNumber ?? '—'}</td>
                    <td className={td}>{refund.productName ?? '—'}</td>
                    <td className={`${td} text-right`}>{formatFcfa(refund.paid)}</td>
                    <td className={`${td} text-right`}>{formatFcfa(refund.net)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        <section className="space-y-2">
          <h2 className="font-semibold">Retraits demandés</h2>
          {report.withdrawals.length === 0 ? (
            <p className="text-muted-foreground">Aucun retrait demandé ce mois-ci.</p>
          ) : (
            <table className="w-full text-xs">
              <thead className="border-b text-muted-foreground">
                <tr>
                  <th className={th}>Date</th>
                  <th className={`${th} text-right`}>Montant</th>
                  <th className={th}>Statut</th>
                  <th className={th}>Envoi</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {report.withdrawals.map((w) => (
                  <tr key={w.id}>
                    <td className={td}>{formatDay(w.date)}</td>
                    <td className={`${td} text-right`}>{formatFcfa(w.amount)}</td>
                    <td className={td}>{WITHDRAWAL_STATUS_LABELS[w.status].label}</td>
                    <td className={td}>
                      {OPERATOR_LABELS[w.operator]}
                      {w.reference && <span className="font-mono"> · {w.reference}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <p className="text-xs text-muted-foreground">
          Les montants sont en francs CFA. La commission est calculée sur le prix payé par le client, réduction déduite. Le solde comprend
          les sommes encore en attente (délai de sécurité) ou bloquées par un litige. Conservez ce relevé pour votre comptabilité.
        </p>
      </article>
    </div>
  );
}
