import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { formatFcfa } from '@/lib/format';
import { notify } from '@/lib/toast';
import { DISPUTE_STATUS_LABELS, TONE_CLASSES, type MobileMoneyOperator, type SellerDispute } from '@/lib/seller-api';
import { useAuthStore } from '@/stores/use-auth-store';
import { apiErrorMessage } from '@/components/form-field';

interface AdminDispute extends SellerDispute {
  buyer: { name: string; email: string; phone: string | null };
  refund: {
    operator: MobileMoneyOperator;
    operatorLabel: string;
    phone: string;
    accountName: string;
    reference: string | null;
    refundedAt: string | null;
  };
  orderStatus: string;
  product: { name: string; slug: string };
  store: { name: string; slug: string } | null;
  seller: { name: string; email: string } | null;
}

type Filter = 'todo' | 'waiting' | 'closed';
type Action = 'accept' | 'reject' | 'refunded';

const TABS: { value: Filter; label: string }[] = [
  { value: 'todo', label: 'À traiter' },
  { value: 'waiting', label: 'En attente du vendeur' },
  { value: 'closed', label: 'Clos' },
];

const BUTTON = 'rounded-md border px-3 py-1.5 text-sm hover:bg-muted disabled:opacity-50';
const FIELD = 'w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary';

const formatDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

const ACTION_TEXT: Record<Action, { label: string; placeholder: string; confirm: string; min: number; className: string }> = {
  accept: {
    label: 'Message joint à la décision (facultatif, envoyé au client et au vendeur)',
    placeholder: 'Ex. : le vendeur reconnaît que le fichier était abîmé.',
    confirm: 'Confirmer le remboursement',
    min: 0,
    className: 'bg-red-600 hover:bg-red-700',
  },
  reject: {
    label: 'Motif du refus (envoyé au client et au vendeur)',
    placeholder: 'Ex. : le vendeur a corrigé le fichier ; la nouvelle version fonctionne sur votre appareil.',
    confirm: 'Confirmer le refus',
    min: 5,
    className: 'bg-gray-700 hover:bg-gray-800',
  },
  refunded: {
    label: 'Référence de l’envoi Mobile Money (dans le SMS de confirmation)',
    placeholder: 'Ex. : MP231002.1234.A56789',
    confirm: 'Confirmer l’envoi',
    min: 3,
    className: 'bg-green-600 hover:bg-green-700',
  },
};

/** Litiges : demandes de remboursement des acheteurs, réponse des vendeurs, décision et envoi de l'argent. */
export function DisputesPage() {
  const { accessToken } = useAuthStore();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<Filter>('todo');
  const [deciding, setDeciding] = useState<{ id: string; action: Action } | null>(null);
  const [text, setText] = useState('');

  const { data: disputes = [], isLoading, isError } = useQuery({
    queryKey: ['admin-disputes', filter],
    queryFn: () => api.get<AdminDispute[]>(`/admin/disputes?filter=${filter}`, accessToken),
  });

  const handle = useMutation({
    mutationFn: ({ id, action, value }: { id: string; action: Action; value: string }) =>
      api.patch<AdminDispute>(`/admin/disputes/${id}`, action === 'refunded' ? { action, reference: value } : { action, note: value || null }, accessToken),
    onSuccess: (updated, { action }) => {
      queryClient.invalidateQueries({ queryKey: ['admin-disputes'] });
      setDeciding(null);
      setText('');
      notify.success(
        action === 'accept'
          ? `Remboursement accordé : envoyez ${formatFcfa(updated.amount)} par ${updated.refund.operatorLabel}, puis notez la référence.`
          : action === 'reject'
            ? 'Demande refusée : le client et le vendeur ont été prévenus par e-mail.'
            : 'Remboursement noté comme envoyé : le client a reçu la référence par e-mail.',
      );
    },
    onError: (err) => notify.error(apiErrorMessage(err)),
  });

  const copy = (value: string) => {
    void navigator.clipboard?.writeText(value);
    notify.success('Copié');
  };

  const start = (id: string, action: Action) => {
    setDeciding({ id, action });
    setText('');
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">Litiges</h1>
        <p className="text-sm text-muted-foreground">
          Demandes de remboursement des acheteurs. Le vendeur a 5 jours pour répondre ; décidez ensuite selon la politique de remboursement (réponse
          promise sous 5 jours ouvrés). Un remboursement accordé coupe les liens et retire la vente du solde du vendeur : envoyez alors l'argent par
          Mobile Money (sous 10 jours ouvrés) et notez la référence.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.value}
            onClick={() => setFilter(t.value)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${filter === t.value ? 'bg-primary text-primary-foreground' : 'border hover:bg-muted'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Chargement...</p>}
      {isError && <p className="text-sm text-red-600">Impossible de charger les litiges. Rechargez la page.</p>}
      {!isLoading && !isError && disputes.length === 0 && (
        <p className="rounded-lg border border-dashed bg-background p-8 text-center text-sm text-muted-foreground">
          {filter === 'todo' ? 'Aucun litige à traiter.' : 'Aucun litige dans cette liste.'}
        </p>
      )}

      <ul className="space-y-4">
        {disputes.map((d) => {
          const status = DISPUTE_STATUS_LABELS[d.status];
          const isDeciding = deciding?.id === d.id;
          const action = deciding?.action;
          const pending = d.status === 'open' || d.status === 'review';
          return (
            <li key={d.id} className="space-y-3 rounded-lg border bg-background p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1 text-sm">
                  <p className="text-lg font-bold">
                    {formatFcfa(d.amount)} <span className="text-sm font-normal text-muted-foreground">· {d.reference}</span>
                  </p>
                  <p>
                    <strong>{d.product.name}</strong> · {d.store ? <>boutique {d.store.name}</> : 'produit BlackStore'} · commande {d.orderNumber} (payée le{' '}
                    {formatDate(d.paidAt)})
                  </p>
                  <p className="text-muted-foreground">
                    Acheteur : {d.buyer.name} ({d.buyer.email}){d.buyer.phone && <> · {d.buyer.phone}</>}
                  </p>
                  {d.seller && (
                    <p className="text-muted-foreground">
                      Vendeur : {d.seller.name} ({d.seller.email})
                      {d.sellerAmount !== null && (
                        <>
                          {' '}
                          · {pending ? 'sa part bloquée' : d.status === 'rejected' ? 'sa part' : 'sa part, retirée de son solde'} : {formatFcfa(d.sellerAmount)}
                        </>
                      )}
                    </p>
                  )}
                </div>
                <div className="space-y-1 text-right text-xs text-muted-foreground">
                  <span className={`inline-block rounded-full px-2 py-0.5 font-medium ${TONE_CLASSES[status.tone]}`}>{status.label}</span>
                  <p>Ouvert le {formatDate(d.createdAt)}</p>
                  {d.decidedAt && <p>Décidé le {formatDate(d.decidedAt)}</p>}
                  {d.refund.refundedAt && <p>Remboursé le {formatDate(d.refund.refundedAt)}</p>}
                </div>
              </div>

              <div className="rounded-md bg-muted/50 p-3 text-sm">
                <p className="font-medium">{d.reasonLabel}</p>
                <p className="mt-1 whitespace-pre-line text-muted-foreground">{d.description}</p>
              </div>

              {d.seller && (
                <div className="text-sm">
                  {d.sellerResponse ? (
                    <>
                      <p className="font-medium">
                        Réponse du vendeur ({formatDate(d.sellerRespondedAt)}) :{' '}
                        <span className={d.sellerAcceptsRefund ? 'text-red-700 dark:text-red-400' : 'text-green-700 dark:text-green-400'}>
                          {d.sellerAcceptsRefund ? 'il accepte le remboursement' : 'il conteste la demande'}
                        </span>
                      </p>
                      <p className="mt-1 whitespace-pre-line text-muted-foreground">{d.sellerResponse}</p>
                    </>
                  ) : pending ? (
                    <p className={d.late ? 'font-medium text-red-600' : 'text-muted-foreground'}>
                      {d.late
                        ? `Pas de réponse du vendeur : délai dépassé depuis le ${formatDate(d.sellerDeadline)}. Vous pouvez décider.`
                        : `Le vendeur a jusqu'au ${formatDate(d.sellerDeadline)} pour répondre (vous pouvez décider avant si le cas est évident).`}
                    </p>
                  ) : (
                    <p className="text-muted-foreground">Le vendeur n'a pas répondu avant la décision.</p>
                  )}
                </div>
              )}

              <p className="text-sm">
                Remboursement vers <strong>{d.refund.operatorLabel}</strong> au{' '}
                <button type="button" onClick={() => copy(d.refund.phone)} className="font-mono underline decoration-dotted" title="Copier le numéro">
                  {d.refund.phone}
                </button>{' '}
                — titulaire : <strong>{d.refund.accountName}</strong>
              </p>
              {d.decisionNote && <p className="text-sm">Message envoyé au client : {d.decisionNote}</p>}
              {d.refund.reference && (
                <p className="text-sm">
                  Référence de l'envoi : <strong>{d.refund.reference}</strong>
                </p>
              )}

              {!isDeciding && (pending || d.status === 'accepted') && (
                <div className="flex flex-wrap gap-2">
                  {pending && (
                    <>
                      <button type="button" onClick={() => start(d.id, 'accept')} className={`${BUTTON} text-red-700 dark:text-red-400`}>
                        Rembourser l'acheteur
                      </button>
                      <button type="button" onClick={() => start(d.id, 'reject')} className={BUTTON}>
                        Refuser la demande
                      </button>
                    </>
                  )}
                  {d.status === 'accepted' && (
                    <button type="button" onClick={() => start(d.id, 'refunded')} className={`${BUTTON} text-green-700 dark:text-green-400`}>
                      J'ai envoyé l'argent
                    </button>
                  )}
                </div>
              )}

              {isDeciding && action && (
                <div className="space-y-2 rounded-md border p-3">
                  {action === 'accept' && (
                    <p className="text-sm text-red-700 dark:text-red-400">
                      Les liens de téléchargement de ce produit seront coupés et la vente retirée du solde du vendeur. Il vous restera à envoyer{' '}
                      {formatFcfa(d.amount)} au {d.refund.phone} ({d.refund.operatorLabel}).
                    </p>
                  )}
                  <label htmlFor={`text-${d.id}`} className="block text-sm font-medium">
                    {ACTION_TEXT[action].label}
                  </label>
                  {action === 'refunded' ? (
                    <input id={`text-${d.id}`} value={text} onChange={(e) => setText(e.target.value)} maxLength={100} className={FIELD} placeholder={ACTION_TEXT[action].placeholder} />
                  ) : (
                    <textarea id={`text-${d.id}`} rows={3} maxLength={1000} value={text} onChange={(e) => setText(e.target.value)} className={FIELD} placeholder={ACTION_TEXT[action].placeholder} />
                  )}
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={handle.isPending || text.trim().length < ACTION_TEXT[action].min}
                      onClick={() => handle.mutate({ id: d.id, action, value: text.trim() })}
                      className={`rounded-md px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50 ${ACTION_TEXT[action].className}`}
                    >
                      {ACTION_TEXT[action].confirm}
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
