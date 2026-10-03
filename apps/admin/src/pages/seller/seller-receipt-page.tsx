import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { formatFcfa } from '@/lib/format';
import { OPERATOR_LABELS, WITHDRAWAL_STATUS_LABELS, type Withdrawal } from '@/lib/seller-api';
import { useAuthStore } from '@/stores/use-auth-store';

type Receipt = Withdrawal & { seller: { firstName: string; lastName: string; email: string; store: { name: string } | null } };

const formatDateTime = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString('fr-FR', { dateStyle: 'long', timeStyle: 'short' }) : '—';

/** Reçu d'un retrait, à imprimer ou enregistrer en PDF depuis le navigateur. */
export function SellerReceiptPage() {
  const { id } = useParams<{ id: string }>();
  const { accessToken } = useAuthStore();
  const { data: receipt, isLoading, isError } = useQuery({
    queryKey: ['seller-withdrawal', id],
    queryFn: () => api.get<Receipt>(`/seller/wallet/withdrawals/${id}`, accessToken),
  });

  if (isLoading) return <p className="text-sm text-muted-foreground">Chargement...</p>;
  if (isError || !receipt) {
    return <p className="text-sm text-red-600">Reçu introuvable. <Link to="/vendeur/gains" className="underline">Retour à mes gains</Link></p>;
  }

  const rows: [string, string][] = [
    ['Bénéficiaire', `${receipt.seller.firstName} ${receipt.seller.lastName}${receipt.seller.store ? ` — boutique ${receipt.seller.store.name}` : ''}`],
    ['Montant', formatFcfa(receipt.amount)],
    ['Envoyé sur', `${OPERATOR_LABELS[receipt.operator]}, ${receipt.phone} (${receipt.accountName})`],
    ['Référence de la transaction', receipt.transferReference ?? '—'],
    ['Demandé le', formatDateTime(receipt.createdAt)],
    ['Payé le', formatDateTime(receipt.processedAt)],
    ['Statut', WITHDRAWAL_STATUS_LABELS[receipt.status].label],
  ];

  return (
    <div className="max-w-2xl space-y-4">
      <div className="flex items-center justify-between print:hidden">
        <Link to="/vendeur/gains" className="text-sm text-muted-foreground hover:text-foreground">← Mes gains</Link>
        <button type="button" onClick={() => window.print()} className="rounded-md border px-4 py-2 text-sm hover:bg-muted">
          Imprimer ou enregistrer en PDF
        </button>
      </div>
      <article className="rounded-lg border bg-background p-6 print:border-0 print:p-0">
        <header className="mb-6 flex items-start justify-between">
          <div>
            <p className="text-xl font-bold">BlackStore</p>
            <p className="text-xs text-muted-foreground">blackstore.pymail.cm</p>
          </div>
          <div className="text-right">
            <p className="font-semibold">Reçu de retrait</p>
            <p className="text-xs text-muted-foreground">N° {receipt.id.slice(0, 8).toUpperCase()}</p>
          </div>
        </header>
        <table className="w-full text-sm">
          <tbody>
            {rows.map(([label, value]) => (
              <tr key={label} className="border-b last:border-0">
                <td className="py-2 pr-4 text-muted-foreground">{label}</td>
                <td className="py-2 font-medium">{value}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-6 text-xs text-muted-foreground">
          Ce montant correspond à vos ventes sur BlackStore, commission déduite. Conservez ce reçu pour votre comptabilité.
        </p>
      </article>
    </div>
  );
}
