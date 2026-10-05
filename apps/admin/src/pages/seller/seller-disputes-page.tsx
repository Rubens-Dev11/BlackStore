import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { formatFcfa } from '@/lib/format';
import { notify } from '@/lib/toast';
import { DISPUTE_STATUS_LABELS, TONE_CLASSES, type SellerDispute } from '@/lib/seller-api';
import { useAuthStore } from '@/stores/use-auth-store';
import { apiErrorMessage, BUTTON_CLASS, INPUT_CLASS } from '@/components/form-field';
import { useSellerPageTitle } from '@/layouts/seller-auth-card';

const formatDate = (iso: string) =>
  new Date(iso).toLocaleString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });

/** Litiges sur les produits du vendeur : demande de l'acheteur, réponse (une fois), décision de BlackStore. */
export function SellerDisputesPage() {
  useSellerPageTitle('Litiges');
  const { accessToken } = useAuthStore();
  const queryClient = useQueryClient();
  const [answering, setAnswering] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [acceptRefund, setAcceptRefund] = useState(false);

  const { data: disputes = [], isLoading, isError } = useQuery({
    queryKey: ['seller-disputes'],
    queryFn: () => api.get<SellerDispute[]>('/seller/disputes', accessToken),
  });

  const respond = useMutation({
    mutationFn: (id: string) => api.post<SellerDispute>(`/seller/disputes/${id}/respond`, { message: message.trim(), acceptRefund }, accessToken),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ['seller-disputes'] });
      setAnswering(null);
      setMessage('');
      setAcceptRefund(false);
      notify.success(
        updated.sellerAcceptsRefund
          ? 'Réponse envoyée : BlackStore va rembourser l’acheteur.'
          : 'Réponse envoyée : BlackStore va examiner le litige et vous tiendra informé par e-mail.',
      );
    },
    onError: (err) => notify.error(apiErrorMessage(err)),
  });

  const open = (id: string) => {
    setAnswering(id);
    setMessage('');
    setAcceptRefund(false);
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Litiges</h1>
        <p className="text-sm text-muted-foreground">
          Quand un acheteur demande le remboursement d'un de vos produits, vous avez 5 jours pour répondre : expliquer la situation, corriger votre
          produit (le nouveau fichier est analysé puis livré) ou accepter le remboursement. BlackStore décide ensuite. Pendant le litige, le montant
          de la vente reste bloqué dans votre solde.
        </p>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Chargement...</p>}
      {isError && <p className="text-sm text-red-600">Impossible de charger vos litiges. Rechargez la page.</p>}
      {!isLoading && !isError && disputes.length === 0 && (
        <p className="rounded-lg border border-dashed bg-background p-8 text-center text-sm text-muted-foreground">
          Aucun litige : aucun acheteur n'a demandé de remboursement pour vos produits.
        </p>
      )}

      <ul className="space-y-4">
        {disputes.map((d) => {
          const status = DISPUTE_STATUS_LABELS[d.status];
          return (
            <li key={d.id} className="space-y-3 rounded-lg border bg-background p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1 text-sm">
                  <p className="font-semibold">
                    {d.productName} <span className="font-normal text-muted-foreground">· commande {d.orderNumber}</span>
                  </p>
                  <p className="text-muted-foreground">
                    Litige {d.reference}, ouvert le {formatDate(d.createdAt)} par {d.buyerName}
                  </p>
                  <p>
                    Vente de {formatFcfa(d.amount)}
                    {d.sellerAmount !== null && <> ; votre part : {formatFcfa(d.sellerAmount)}</>}
                  </p>
                </div>
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${TONE_CLASSES[status.tone]}`}>{status.label}</span>
              </div>

              <div className="rounded-md bg-muted/50 p-3 text-sm">
                <p className="font-medium">{d.reasonLabel}</p>
                <p className="mt-1 whitespace-pre-line text-muted-foreground">{d.description}</p>
              </div>

              {d.status === 'open' && d.sellerDeadline && (
                <p className={`text-sm ${d.late ? 'font-medium text-red-600' : ''}`}>
                  {d.late
                    ? `Délai dépassé (${formatDate(d.sellerDeadline)}) : vous pouvez encore répondre tant que BlackStore n'a pas décidé.`
                    : `Répondez avant le ${formatDate(d.sellerDeadline)}.`}
                </p>
              )}

              {d.sellerResponse && (
                <div className="text-sm">
                  <p className="font-medium">
                    Votre réponse{d.sellerRespondedAt && <> du {formatDate(d.sellerRespondedAt)}</>} :{' '}
                    {d.sellerAcceptsRefund ? 'vous acceptez le remboursement.' : 'vous contestez la demande.'}
                  </p>
                  <p className="mt-1 whitespace-pre-line text-muted-foreground">{d.sellerResponse}</p>
                </div>
              )}

              {d.decidedAt && (
                <div className="text-sm">
                  <p className="font-medium">
                    Décision du {formatDate(d.decidedAt)} :{' '}
                    {d.status === 'rejected' ? 'la vente vous reste acquise.' : 'l’acheteur est remboursé, la vente est retirée de votre solde.'}
                  </p>
                  {d.decisionNote && <p className="mt-1 whitespace-pre-line text-muted-foreground">{d.decisionNote}</p>}
                </div>
              )}

              {d.canRespond && answering !== d.id && (
                <button type="button" onClick={() => open(d.id)} className={BUTTON_CLASS}>
                  Répondre
                </button>
              )}

              {answering === d.id && (
                <div className="space-y-3 rounded-md border p-3">
                  <label htmlFor={`message-${d.id}`} className="block text-sm font-medium">
                    Votre réponse (transmise à BlackStore, pas à l'acheteur)
                  </label>
                  <textarea
                    id={`message-${d.id}`}
                    rows={4}
                    maxLength={3000}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    className={INPUT_CLASS}
                    placeholder="Ex. : le fichier a été corrigé et remis en ligne ce matin ; l'application fonctionne sur Android 8 et plus."
                  />
                  <label className="flex items-start gap-2 text-sm">
                    <input type="checkbox" checked={acceptRefund} onChange={(e) => setAcceptRefund(e.target.checked)} className="mt-0.5" />
                    <span>J'accepte que l'acheteur soit remboursé (la vente sera retirée de mon solde).</span>
                  </label>
                  <p className="text-xs text-muted-foreground">Vous ne pouvez répondre qu'une fois : relisez avant d'envoyer.</p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={respond.isPending || message.trim().length < 10}
                      onClick={() => respond.mutate(d.id)}
                      className={BUTTON_CLASS}
                    >
                      {respond.isPending ? 'Envoi…' : 'Envoyer ma réponse'}
                    </button>
                    <button type="button" onClick={() => setAnswering(null)} className="rounded-md border px-4 py-2 text-sm hover:bg-muted">
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
