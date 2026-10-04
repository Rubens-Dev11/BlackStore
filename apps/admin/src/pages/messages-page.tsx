import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { formatFcfa } from '@/lib/format';
import { notify } from '@/lib/toast';
import { useAuthStore } from '@/stores/use-auth-store';
import { apiErrorMessage } from '@/components/form-field';

type SupportStatus = 'open' | 'answered' | 'closed';
type SupportTopic = 'order' | 'refund' | 'seller' | 'personal_data' | 'other';

interface SupportRequest {
  id: string;
  topic: SupportTopic;
  topicLabel: string;
  name: string;
  email: string;
  orderNumber: string | null;
  message: string;
  status: SupportStatus;
  reply: string | null;
  repliedAt: string | null;
  createdAt: string;
  /** Commande citée, retrouvée par son numéro. */
  order: { id: string; status: string; totalAmount: number; createdAt: string; sameEmail: boolean } | null;
}

const TABS: { value: SupportStatus; label: string }[] = [
  { value: 'open', label: 'À traiter' },
  { value: 'answered', label: 'Répondus' },
  { value: 'closed', label: 'Classés' },
];

const TOPIC_TONES: Record<SupportTopic, string> = {
  refund: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  order: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  personal_data: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  seller: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  other: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200',
};

const ORDER_STATUS: Record<string, string> = {
  pending: 'en attente de paiement',
  paid: 'payée',
  failed: 'paiement échoué',
  refunded: 'remboursée',
};

const BUTTON = 'rounded-md border px-3 py-1.5 text-sm hover:bg-muted disabled:opacity-50';
const formatDate = (iso: string) =>
  new Date(iso).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

/** Messages du formulaire de contact du site : réponse par e-mail depuis l'admin. */
export function MessagesPage() {
  const { accessToken } = useAuthStore();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<SupportStatus>('open');
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [text, setText] = useState('');

  const { data: requests = [], isLoading, isError } = useQuery({
    queryKey: ['admin-messages', tab],
    queryFn: () => api.get<SupportRequest[]>(`/admin/messages?status=${tab}`, accessToken),
  });

  const handle = useMutation({
    mutationFn: ({ id, action, reply }: { id: string; action: 'reply' | 'close' | 'reopen'; reply?: string }) =>
      api.patch<SupportRequest>(`/admin/messages/${id}`, { action, reply }, accessToken),
    onSuccess: (_updated, { action }) => {
      queryClient.invalidateQueries({ queryKey: ['admin-messages'] });
      setReplyingTo(null);
      setText('');
      notify.success(
        action === 'reply' ? 'Réponse envoyée par e-mail' : action === 'close' ? 'Message classé' : 'Message rouvert',
      );
    },
    onError: (err) => notify.error(apiErrorMessage(err)),
  });

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">Messages</h1>
        <p className="text-sm text-muted-foreground">
          Demandes envoyées depuis la page Contact du site (commandes, remboursements, données personnelles…). Votre réponse part par
          e-mail ; promis aux clients : une réponse sous 2 jours ouvrés, 5 pour un remboursement.
        </p>
      </div>

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
      {isError && <p className="text-sm text-red-600">Impossible de charger les messages. Rechargez la page.</p>}
      {!isLoading && !isError && requests.length === 0 && (
        <p className="rounded-lg border border-dashed bg-background p-8 text-center text-sm text-muted-foreground">
          {tab === 'open' ? 'Aucun message à traiter.' : 'Aucun message dans cette liste.'}
        </p>
      )}

      <ul className="space-y-4">
        {requests.map((r) => (
          <li key={r.id} className="space-y-3 rounded-lg border bg-background p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="space-y-1 text-sm">
                <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${TOPIC_TONES[r.topic]}`}>{r.topicLabel}</span>
                <p>
                  <strong>{r.name}</strong> — <a href={`mailto:${r.email}`} className="underline">{r.email}</a>
                </p>
                {r.orderNumber && (
                  <p className="text-muted-foreground">
                    Commande {r.orderNumber} :{' '}
                    {r.order ? (
                      <>
                        {ORDER_STATUS[r.order.status] ?? r.order.status}, {formatFcfa(r.order.totalAmount)}, du {formatDate(r.order.createdAt)}
                        {!r.order.sameEmail && (
                          <span className="ml-2 rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
                            e-mail différent de la commande
                          </span>
                        )}
                      </>
                    ) : (
                      <span className="text-red-600">introuvable</span>
                    )}
                  </p>
                )}
              </div>
              <p className="text-xs text-muted-foreground">Reçu le {formatDate(r.createdAt)}</p>
            </div>

            <p className="whitespace-pre-line rounded-md bg-muted/50 p-3 text-sm">{r.message}</p>

            {r.reply && (
              <div className="rounded-md border-l-4 border-primary bg-muted/30 p-3 text-sm">
                <p className="mb-1 text-xs text-muted-foreground">Réponse envoyée{r.repliedAt ? ` le ${formatDate(r.repliedAt)}` : ''} :</p>
                <p className="whitespace-pre-line">{r.reply}</p>
              </div>
            )}

            {replyingTo === r.id ? (
              <div className="space-y-2">
                <label htmlFor={`reply-${r.id}`} className="block text-sm font-medium">
                  Votre réponse (envoyée à {r.email}, avec son message en rappel)
                </label>
                <textarea
                  id={`reply-${r.id}`}
                  rows={5}
                  maxLength={5000}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
                  placeholder="Bonjour, …"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={handle.isPending || text.trim().length < 5}
                    onClick={() => handle.mutate({ id: r.id, action: 'reply', reply: text.trim() })}
                    className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                  >
                    {handle.isPending ? 'Envoi...' : 'Envoyer la réponse'}
                  </button>
                  <button type="button" onClick={() => setReplyingTo(null)} className={BUTTON}>
                    Annuler
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => { setReplyingTo(r.id); setText(''); }} className={BUTTON}>
                  {r.reply ? 'Répondre à nouveau' : 'Répondre'}
                </button>
                {r.status !== 'closed' ? (
                  <button type="button" disabled={handle.isPending} onClick={() => handle.mutate({ id: r.id, action: 'close' })} className={BUTTON}>
                    Classer
                  </button>
                ) : (
                  <button type="button" disabled={handle.isPending} onClick={() => handle.mutate({ id: r.id, action: 'reopen' })} className={BUTTON}>
                    Rouvrir
                  </button>
                )}
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
