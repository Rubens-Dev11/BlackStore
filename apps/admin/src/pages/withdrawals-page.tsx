import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { formatFcfa } from '@/lib/format';
import { notify } from '@/lib/toast';
import { OPERATOR_LABELS, TONE_CLASSES, WITHDRAWAL_STATUS_LABELS, type SellerStatus, type Withdrawal, type WithdrawalStatus } from '@/lib/seller-api';
import { useAuthStore } from '@/stores/use-auth-store';
import { apiErrorMessage } from '@/components/form-field';

interface AdminWithdrawal extends Withdrawal {
  seller: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    status: SellerStatus;
    store: { name: string; slug: string } | null;
    /** Nom de la pièce d'identité vérifiée. */
    verifiedName: string | null;
  };
  sellerBalance: { available: number; pending: number; total: number };
}

interface WalletSummary {
  grossSales: number;
  commissions: number;
  sellerBalances: number;
  pendingWithdrawals: { count: number; amount: number };
  paidOut: number;
}

const TABS: { value: WithdrawalStatus; label: string }[] = [
  { value: 'pending', label: 'À payer' },
  { value: 'paid', label: 'Payés' },
  { value: 'rejected', label: 'Refusés' },
  { value: 'cancelled', label: 'Annulés' },
];

const BUTTON = 'rounded-md border px-3 py-1.5 text-sm hover:bg-muted disabled:opacity-50';
const FIELD = 'w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary';

const formatDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
const hoursSince = (iso: string) => Math.floor((Date.now() - new Date(iso).getTime()) / 3_600_000);
const sameName = (a: string, b: string) => {
  const words = (s: string) => s.normalize('NFD').replace(/[^\p{L}\s]/gu, '').toLowerCase().split(/\s+/).filter(Boolean).sort().join(' ');
  return words(a) === words(b);
};

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border bg-background p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-bold">{value}</p>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function WithdrawalsPage() {
  const { accessToken } = useAuthStore();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<WithdrawalStatus>('pending');
  const [deciding, setDeciding] = useState<{ id: string; action: 'paid' | 'reject' } | null>(null);
  const [text, setText] = useState('');

  const { data: summary } = useQuery({
    queryKey: ['admin-wallet-summary'],
    queryFn: () => api.get<WalletSummary>('/admin/wallet/summary', accessToken),
  });
  const { data: withdrawals = [], isLoading, isError } = useQuery({
    queryKey: ['admin-withdrawals', tab],
    queryFn: () => api.get<AdminWithdrawal[]>(`/admin/wallet/withdrawals?status=${tab}`, accessToken),
  });

  const handle = useMutation({
    mutationFn: ({ id, action, value }: { id: string; action: 'paid' | 'reject'; value: string }) =>
      api.patch<Withdrawal>(`/admin/wallet/withdrawals/${id}`, action === 'paid' ? { action, reference: value } : { action, note: value }, accessToken),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ['admin-withdrawals'] });
      queryClient.invalidateQueries({ queryKey: ['admin-wallet-summary'] });
      setDeciding(null);
      setText('');
      notify.success(
        updated.status === 'paid'
          ? `Retrait de ${formatFcfa(updated.amount)} marqué comme payé : le vendeur a reçu son reçu par e-mail.`
          : `Retrait refusé : ${formatFcfa(updated.amount)} sont revenus dans le solde du vendeur.`,
      );
    },
    onError: (err) => notify.error(apiErrorMessage(err)),
  });

  const copy = (value: string) => {
    void navigator.clipboard?.writeText(value);
    notify.success('Copié');
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">Retraits des vendeurs</h1>
        <p className="text-sm text-muted-foreground">
          Envoyez l'argent depuis votre compte Orange Money ou MTN MoMo vers le numéro indiqué, puis marquez le retrait comme payé avec la
          référence de la transaction. À traiter sous 72 heures.
        </p>
      </div>

      {summary && (
        <div className="grid gap-3 sm:grid-cols-4">
          <Stat label="Ventes des vendeurs" value={formatFcfa(summary.grossSales)} />
          <Stat label="Commissions BlackStore" value={formatFcfa(summary.commissions)} />
          <Stat label="Soldes des vendeurs" value={formatFcfa(summary.sellerBalances)} hint="argent dû, hors retraits en cours" />
          <Stat
            label="Retraits à payer"
            value={formatFcfa(summary.pendingWithdrawals.amount)}
            hint={`${summary.pendingWithdrawals.count} demande${summary.pendingWithdrawals.count > 1 ? 's' : ''} ; déjà versé : ${formatFcfa(summary.paidOut)}`}
          />
        </div>
      )}

      <div className="flex gap-2">
        {TABS.map((t) => (
          <button
            key={t.value}
            onClick={() => setTab(t.value)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${tab === t.value ? 'bg-primary text-primary-foreground' : 'border hover:bg-muted'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Chargement...</p>}
      {isError && <p className="text-sm text-red-600">Impossible de charger les retraits. Rechargez la page.</p>}
      {!isLoading && !isError && withdrawals.length === 0 && (
        <p className="rounded-lg border border-dashed bg-background p-8 text-center text-sm text-muted-foreground">
          {tab === 'pending' ? 'Aucun retrait à payer.' : 'Aucun retrait dans cette liste.'}
        </p>
      )}

      <ul className="space-y-4">
        {withdrawals.map((w) => {
          const status = WITHDRAWAL_STATUS_LABELS[w.status];
          const isDeciding = deciding?.id === w.id;
          const nameOk = w.seller.verifiedName ? sameName(w.accountName, w.seller.verifiedName) : false;
          const waited = hoursSince(w.createdAt);
          return (
            <li key={w.id} className="space-y-3 rounded-lg border bg-background p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1 text-sm">
                  <p className="text-2xl font-bold">{formatFcfa(w.amount)}</p>
                  <p>
                    vers <strong>{OPERATOR_LABELS[w.operator]}</strong> au{' '}
                    <button type="button" onClick={() => copy(w.phone)} className="font-mono underline decoration-dotted" title="Copier le numéro">
                      {w.phone}
                    </button>{' '}
                    — titulaire : <strong>{w.accountName}</strong>
                  </p>
                  <p className="text-muted-foreground">
                    {w.seller.firstName} {w.seller.lastName} ({w.seller.email}){w.seller.store && <> · boutique {w.seller.store.name}</>}
                  </p>
                  <p>
                    Identité vérifiée : {w.seller.verifiedName ?? 'aucune'}
                    {w.seller.verifiedName && !nameOk && (
                      <span className="ml-2 rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
                        titulaire différent
                      </span>
                    )}
                  </p>
                </div>
                <div className="space-y-1 text-right text-xs text-muted-foreground">
                  <span className={`inline-block rounded-full px-2 py-0.5 font-medium ${TONE_CLASSES[status.tone]}`}>{status.label}</span>
                  <p>Demandé le {formatDate(w.createdAt)}</p>
                  {w.status === 'pending' && <p className={waited >= 48 ? 'font-medium text-red-600' : ''}>il y a {waited} h</p>}
                  {w.processedAt && <p>Traité le {formatDate(w.processedAt)}</p>}
                  <p>Solde du vendeur : {formatFcfa(w.sellerBalance.available)} (+ {formatFcfa(w.sellerBalance.pending)} en attente)</p>
                </div>
              </div>

              {w.transferReference && <p className="text-sm">Référence de l'envoi : <strong>{w.transferReference}</strong></p>}
              {w.adminNote && <p className="text-sm text-red-700 dark:text-red-400">Motif du refus : {w.adminNote}</p>}

              {w.status === 'pending' && !isDeciding && (
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => { setDeciding({ id: w.id, action: 'paid' }); setText(''); }} className={`${BUTTON} text-green-700 dark:text-green-400`}>
                    J'ai envoyé l'argent
                  </button>
                  <button type="button" onClick={() => { setDeciding({ id: w.id, action: 'reject' }); setText(''); }} className={`${BUTTON} text-red-700 dark:text-red-400`}>
                    Refuser
                  </button>
                </div>
              )}

              {isDeciding && (
                <div className="space-y-2 rounded-md border p-3">
                  <label htmlFor={`text-${w.id}`} className="block text-sm font-medium">
                    {deciding.action === 'paid'
                      ? `Référence de la transaction ${OPERATOR_LABELS[w.operator]} (dans le SMS de confirmation)`
                      : 'Motif du refus (envoyé au vendeur ; le montant revient dans son solde)'}
                  </label>
                  {deciding.action === 'paid' ? (
                    <input id={`text-${w.id}`} value={text} onChange={(e) => setText(e.target.value)} maxLength={100} className={FIELD} placeholder="Ex. : MP231002.1234.A56789" />
                  ) : (
                    <textarea id={`text-${w.id}`} rows={2} maxLength={500} value={text} onChange={(e) => setText(e.target.value)} className={FIELD} placeholder="Ex. : le compte Mobile Money n’est pas au nom du vendeur." />
                  )}
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={handle.isPending || text.trim().length < (deciding.action === 'paid' ? 3 : 5)}
                      onClick={() => handle.mutate({ id: w.id, action: deciding.action, value: text.trim() })}
                      className={
                        deciding.action === 'paid'
                          ? 'rounded-md bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50'
                          : 'rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50'
                      }
                    >
                      {deciding.action === 'paid' ? 'Confirmer le paiement' : 'Confirmer le refus'}
                    </button>
                    <button type="button" onClick={() => setDeciding(null)} className={BUTTON}>
                      Annuler
                    </button>
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
