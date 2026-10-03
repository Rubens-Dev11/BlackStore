import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { formatFcfa } from '@/lib/format';
import { notify } from '@/lib/toast';
import {
  OPERATOR_LABELS,
  TONE_CLASSES,
  WITHDRAWAL_STATUS_LABELS,
  type MobileMoneyOperator,
  type WalletEntry,
  type WalletSummary,
  type Withdrawal,
} from '@/lib/seller-api';
import { useAuthStore } from '@/stores/use-auth-store';
import { apiErrorMessage, BUTTON_CLASS, INPUT_CLASS } from '@/components/form-field';

const formatDate = (iso: string) => new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });

function Card({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border bg-background p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-bold">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

/** Libellé d'un mouvement du portefeuille. */
function describe(entry: WalletEntry): string {
  switch (entry.type) {
    case 'sale':
      return `Vente : ${entry.productName ?? 'produit'}${entry.orderNumber ? ` (${entry.orderNumber})` : ''}`;
    case 'refund':
      return `Remboursement : ${entry.productName ?? 'produit'}${entry.orderNumber ? ` (${entry.orderNumber})` : ''}`;
    case 'withdrawal':
      return `Retrait vers ${entry.withdrawal ? OPERATOR_LABELS[entry.withdrawal.operator] : 'Mobile Money'}`;
    case 'withdrawal_reversal':
      return entry.withdrawal?.status === 'cancelled' ? 'Retrait annulé : montant restitué' : 'Retrait refusé : montant restitué';
  }
}

export function SellerWalletPage() {
  const queryClient = useQueryClient();
  const { accessToken } = useAuthStore();
  const [page, setPage] = useState(1);
  const { data: wallet, isLoading, isError } = useQuery({
    queryKey: ['seller-wallet'],
    queryFn: () => api.get<WalletSummary>('/seller/wallet', accessToken),
  });
  const { data: history } = useQuery({
    queryKey: ['seller-wallet-entries', page],
    queryFn: () => api.get<{ page: number; totalPages: number; entries: WalletEntry[] }>(`/seller/wallet/entries?page=${page}`, accessToken),
  });
  const { data: withdrawals = [] } = useQuery({
    queryKey: ['seller-withdrawals'],
    queryFn: () => api.get<Withdrawal[]>('/seller/wallet/withdrawals', accessToken),
  });

  const [form, setForm] = useState({ amount: '', operator: 'orange' as MobileMoneyOperator, phone: '', accountName: '' });
  const [sending, setSending] = useState(false);

  // Formulaire prérempli : tout le solde retirable (multiple de 5), numéro du compte, nom vérifié.
  useEffect(() => {
    if (!wallet) return;
    setForm((prev) => ({
      ...prev,
      amount: prev.amount || String(Math.floor(wallet.balance.withdrawable / 5) * 5 || ''),
      phone: prev.phone || wallet.defaultPhone || '',
      accountName: prev.accountName || wallet.identity.fullName || '',
    }));
  }, [wallet]);

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['seller-wallet'] });
    queryClient.invalidateQueries({ queryKey: ['seller-wallet-entries'] });
    queryClient.invalidateQueries({ queryKey: ['seller-withdrawals'] });
  };

  const requestWithdrawal = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = Number(form.amount.replace(/\s/g, ''));
    if (!Number.isInteger(amount) || amount <= 0) return notify.error('Indiquez un montant en FCFA');
    if (amount % 5 !== 0) return notify.error('Le montant doit être un multiple de 5 FCFA');
    setSending(true);
    try {
      await api.post<Withdrawal>('/seller/wallet/withdrawals', { ...form, amount }, accessToken);
      notify.success('Demande de retrait envoyée : l’équipe BlackStore vous paie sous 72 heures');
      setForm((prev) => ({ ...prev, amount: '' }));
      refresh();
    } catch (err) {
      notify.error(apiErrorMessage(err));
    } finally {
      setSending(false);
    }
  };

  const cancel = async (id: string) => {
    if (!window.confirm('Annuler cette demande de retrait ? Le montant reviendra dans votre solde.')) return;
    try {
      await api.post<Withdrawal>(`/seller/wallet/withdrawals/${id}/cancel`, {}, accessToken);
      notify.success('Retrait annulé : le montant est revenu dans votre solde');
      // Le montant se remplit à nouveau avec tout le solde retirable.
      setForm((prev) => ({ ...prev, amount: '' }));
      refresh();
    } catch (err) {
      notify.error(apiErrorMessage(err));
    }
  };

  if (isLoading) return <p className="text-sm text-muted-foreground">Chargement...</p>;
  if (isError || !wallet) return <p className="text-sm text-red-600">Impossible de charger vos gains. Rechargez la page.</p>;

  const { balance, stats, settings } = wallet;

  return (
    <div className="max-w-4xl space-y-6">
      <h1 className="text-2xl font-bold">Mes gains</h1>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card label="Retirable maintenant" value={formatFcfa(balance.withdrawable)} />
        <Card
          label="En attente"
          value={formatFcfa(balance.pending)}
          hint={
            wallet.nextRelease
              ? `Délai de sécurité de ${settings.holdDays} jours ; prochain déblocage le ${formatDate(wallet.nextRelease.date)}`
              : `Chaque vente devient retirable ${settings.holdDays} jours après le paiement.`
          }
        />
        <Card label="Déjà retiré" value={formatFcfa(stats.withdrawn)} />
      </div>
      <p className="text-sm text-muted-foreground">
        {stats.salesCount} vente{stats.salesCount > 1 ? 's' : ''} pour {formatFcfa(stats.grossSales)} ; commissions BlackStore :{' '}
        {formatFcfa(stats.commissions)} ; vos gains : <strong className="text-foreground">{formatFcfa(stats.netEarnings)}</strong>. Commission
        actuelle : {settings.commissionRate} % par vente.
      </p>

      <section className="space-y-4 rounded-lg border bg-background p-4">
        <h2 className="text-sm font-semibold">Retirer mes gains</h2>
        {wallet.pendingWithdrawal ? (
          <div className={`flex flex-wrap items-center justify-between gap-3 rounded-md border px-4 py-3 text-sm ${TONE_CLASSES.yellow}`}>
            <span>
              Retrait de <strong>{formatFcfa(wallet.pendingWithdrawal.amount)}</strong> vers {OPERATOR_LABELS[wallet.pendingWithdrawal.operator]}{' '}
              ({wallet.pendingWithdrawal.phone}), demandé le {formatDate(wallet.pendingWithdrawal.createdAt)} : en cours de paiement, sous 72 heures.
            </span>
            <button type="button" onClick={() => cancel(wallet.pendingWithdrawal!.id)} className="rounded-md border border-current px-3 py-1 text-xs">
              Annuler
            </button>
          </div>
        ) : wallet.identity.status !== 'approved' ? (
          <p className="text-sm">
            {wallet.blocker}{' '}
            <Link to="/vendeur/identite" className="font-medium text-primary hover:underline">Vérifier mon identité</Link>
          </p>
        ) : !wallet.canWithdraw ? (
          <p className="text-sm text-muted-foreground">{wallet.blocker} Vous avez {formatFcfa(balance.withdrawable)} retirables.</p>
        ) : (
          <form onSubmit={requestWithdrawal} className="space-y-4" noValidate>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="amount" className="mb-1 block text-sm font-medium">Montant (FCFA)</label>
                <input id="amount" inputMode="numeric" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className={INPUT_CLASS} />
                <p className="mt-1 text-xs text-muted-foreground">
                  De {formatFcfa(settings.minWithdrawal)} à {formatFcfa(balance.withdrawable)}, multiple de 5.
                </p>
              </div>
              <div>
                <label htmlFor="operator" className="mb-1 block text-sm font-medium">Opérateur</label>
                <select id="operator" value={form.operator} onChange={(e) => setForm({ ...form, operator: e.target.value as MobileMoneyOperator })} className={INPUT_CLASS}>
                  <option value="orange">Orange Money</option>
                  <option value="mtn">MTN Mobile Money</option>
                </select>
              </div>
              <div>
                <label htmlFor="phone" className="mb-1 block text-sm font-medium">Numéro Mobile Money</label>
                <input id="phone" type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className={INPUT_CLASS} />
              </div>
              <div>
                <label htmlFor="accountName" className="mb-1 block text-sm font-medium">Nom du titulaire du compte</label>
                <input id="accountName" value={form.accountName} onChange={(e) => setForm({ ...form, accountName: e.target.value })} className={INPUT_CLASS} />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Le compte Mobile Money doit être à votre nom, celui de votre pièce d'identité. L'équipe BlackStore envoie l'argent sous 72 heures.
            </p>
            <button type="submit" disabled={sending} className={BUTTON_CLASS}>
              {sending ? 'Envoi...' : 'Demander le retrait'}
            </button>
          </form>
        )}
      </section>

      {withdrawals.length > 0 && (
        <section className="space-y-3 rounded-lg border bg-background p-4">
          <h2 className="text-sm font-semibold">Mes retraits</h2>
          <ul className="divide-y text-sm">
            {withdrawals.map((w) => {
              const status = WITHDRAWAL_STATUS_LABELS[w.status];
              return (
                <li key={w.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <span>
                    {formatDate(w.createdAt)} — <strong>{formatFcfa(w.amount)}</strong> vers {OPERATOR_LABELS[w.operator]} ({w.phone})
                    {w.status === 'rejected' && w.adminNote && <span className="block text-xs text-red-700 dark:text-red-400">Motif : {w.adminNote}</span>}
                  </span>
                  <span className="flex items-center gap-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${TONE_CLASSES[status.tone]}`}>{status.label}</span>
                    {w.status === 'paid' && (
                      <Link to={`/vendeur/gains/recus/${w.id}`} className="text-xs text-primary hover:underline">
                        Reçu
                      </Link>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section className="space-y-3 rounded-lg border bg-background p-4">
        <h2 className="text-sm font-semibold">Historique des mouvements</h2>
        {!history || history.entries.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucun mouvement pour l'instant : vos ventes payées apparaîtront ici.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="py-2 pr-3">Date</th>
                  <th className="py-2 pr-3">Mouvement</th>
                  <th className="py-2 pr-3 text-right">Montant</th>
                  <th className="py-2">Disponibilité</th>
                </tr>
              </thead>
              <tbody>
                {history.entries.map((entry) => (
                  <tr key={entry.id} className="border-b last:border-0">
                    <td className="whitespace-nowrap py-2 pr-3">{formatDate(entry.createdAt)}</td>
                    <td className="py-2 pr-3">
                      {describe(entry)}
                      {entry.type === 'sale' && entry.grossAmount !== null && (
                        <span className="block text-xs text-muted-foreground">
                          Prix {formatFcfa(entry.grossAmount)} − commission {entry.commissionRate} % ({formatFcfa(entry.commission ?? 0)})
                        </span>
                      )}
                    </td>
                    <td className={`whitespace-nowrap py-2 pr-3 text-right font-medium ${entry.amount < 0 ? 'text-red-700 dark:text-red-400' : 'text-green-700 dark:text-green-400'}`}>
                      {entry.amount > 0 ? '+' : ''}
                      {formatFcfa(entry.amount)}
                    </td>
                    <td className="whitespace-nowrap py-2 text-xs text-muted-foreground">
                      {entry.available ? 'Disponible' : `Le ${formatDate(entry.availableAt)}`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {history && history.totalPages > 1 && (
          <div className="flex items-center gap-2 text-sm">
            <button type="button" disabled={page <= 1} onClick={() => setPage(page - 1)} className="rounded-md border px-3 py-1 disabled:opacity-50">
              Précédent
            </button>
            <span className="text-muted-foreground">Page {history.page} sur {history.totalPages}</span>
            <button type="button" disabled={page >= history.totalPages} onClick={() => setPage(page + 1)} className="rounded-md border px-3 py-1 disabled:opacity-50">
              Suivant
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
