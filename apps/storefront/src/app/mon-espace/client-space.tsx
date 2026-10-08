'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, Download, Loader2, LogOut, Mail, PackageOpen, RotateCw } from 'lucide-react';
import { formatFcfa } from '@/lib/format';
import {
  SessionExpiredError,
  clearSession,
  closeSession,
  downloadFileUrl,
  fetchPurchases,
  loadSession,
  requestLoginLink,
  type ClientPurchases,
  type ClientSession,
  type DisputeStatus,
} from '@/lib/api/client';

const FIELD =
  'w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2.5 text-white placeholder-zinc-500 outline-none transition-colors focus:border-orange-500';
const BUTTON =
  'inline-flex items-center justify-center gap-2 rounded-lg bg-orange-500 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-orange-600 disabled:opacity-60';
const SECONDARY =
  'inline-flex items-center justify-center gap-2 rounded-lg border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-100 transition-colors hover:bg-zinc-800';
const LINK = 'font-medium text-orange-400 hover:underline';

const formatDate = (iso: string) =>
  new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Africa/Douala' }).format(new Date(iso));
const formatDateTime = (iso: string) =>
  new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Douala' }).format(new Date(iso));

const DISPUTE_LABELS: Record<DisputeStatus, string> = {
  open: 'en attente de la réponse du vendeur',
  review: 'en cours d’examen par notre équipe',
  accepted: 'remboursement accordé, l’argent vous est renvoyé sous 10 jours ouvrés',
  refunded: 'remboursé',
  rejected: 'demande refusée (motif envoyé par e-mail)',
};

type Item = ClientPurchases['orders'][number]['items'][number];

/** Ce que le client peut faire pour un produit acheté, selon l'état de son lien. */
function ItemActions({ item, orderNumber }: { item: Item; orderNumber: string }) {
  const contact = `/contact?sujet=order&commande=${orderNumber}`;
  const d = item.download;
  return (
    <div className="mt-2 space-y-2 text-sm">
      {!d && <p className="text-zinc-400">Aucun lien de téléchargement pour ce produit. <Link href={contact} className={LINK}>Écrivez-nous</Link>.</p>}
      {d?.etat === 'valide' && (
        <div className="flex flex-wrap items-center gap-3">
          <a href={downloadFileUrl(d.token)} className={BUTTON}>
            <Download className="h-4 w-4" aria-hidden="true" />
            Télécharger
          </a>
          <span className="text-xs text-zinc-400">
            {d.remaining} téléchargement{d.remaining > 1 ? 's' : ''} restant{d.remaining > 1 ? 's' : ''} sur {d.max}, jusqu&apos;au {formatDateTime(d.expiresAt)}
          </span>
        </div>
      )}
      {(d?.etat === 'expire' || d?.etat === 'quota') && (
        <p className="text-zinc-400">
          {d.etat === 'expire' ? `Lien expiré le ${formatDateTime(d.expiresAt)}.` : `Les ${d.max} téléchargements de ce lien ont été utilisés.`}{' '}
          <Link href={contact} className={LINK}>Demander un nouveau lien</Link>
        </p>
      )}
      {d?.etat === 'verification' && <p className="text-amber-300">Le vendeur vient de mettre à jour le fichier : il est en cours de vérification. Réessayez dans quelques minutes.</p>}
      {(d?.etat === 'indisponible' || d?.etat === 'introuvable') && (
        <p className="text-zinc-400">
          Fichier momentanément indisponible. <Link href={contact} className={LINK}>Écrivez-nous</Link>.
        </p>
      )}
      {d?.etat === 'annule' && !item.dispute && <p className="text-zinc-400">Achat remboursé : le lien de téléchargement est désactivé.</p>}
      {item.dispute && (
        <p className="text-zinc-300">
          Demande de remboursement {item.dispute.reference} : {DISPUTE_LABELS[item.dispute.status]}.
        </p>
      )}
      {item.refundUntil && (
        <p className="text-xs text-zinc-500">
          Un problème avec ce produit ?{' '}
          <Link href={`/remboursements/demande?commande=${orderNumber}`} className={LINK}>
            Demander un remboursement
          </Link>{' '}
          (jusqu&apos;au {formatDateTime(item.refundUntil)}).
        </p>
      )}
    </div>
  );
}

/** Formulaire de connexion : un lien est envoyé à l'adresse des achats. */
function LoginForm({ notice }: { notice: string | null }) {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setError('Indiquez l’adresse e-mail utilisée pour vos achats.');
    setBusy(true);
    try {
      setSent(await requestLoginLink(email.trim()));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Le lien n’a pas pu être envoyé.');
    } finally {
      setBusy(false);
    }
  };

  if (sent) {
    return (
      <div className="rounded-xl border border-green-800 bg-green-950/40 p-6 text-green-200" role="status">
        <Mail className="mb-3 h-6 w-6" aria-hidden="true" />
        <p className="font-semibold">Regardez votre boîte e-mail</p>
        <p className="mt-2 text-sm text-green-300/90">{sent}</p>
        <p className="mt-2 text-sm text-green-300/90">Pensez aux courriers indésirables. Ouvrez le lien sur l’appareil où vous voulez consulter vos achats.</p>
        <button type="button" onClick={() => setSent(null)} className="mt-4 text-sm text-green-200 underline">
          Utiliser une autre adresse
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} noValidate className="max-w-lg space-y-4">
      {notice && <p className="rounded-lg border border-amber-900 bg-amber-950/40 px-3 py-2 text-sm text-amber-200">{notice}</p>}
      <p className="text-zinc-300">
        Pas de mot de passe : indiquez l’adresse e-mail de vos achats, nous vous envoyons un lien qui ouvre votre espace sur cet appareil pendant 30 jours.
      </p>
      <div>
        <label htmlFor="email" className="mb-1 block text-sm font-medium text-zinc-300">Adresse e-mail de vos achats</label>
        <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={150} autoComplete="email" className={FIELD} />
      </div>
      {error && <p className="rounded-lg border border-red-900 bg-red-950/50 px-3 py-2 text-sm text-red-300" role="alert">{error}</p>}
      <button type="submit" disabled={busy} className={BUTTON}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Mail className="h-4 w-4" aria-hidden="true" />}
        {busy ? 'Envoi…' : 'Recevoir mon lien de connexion'}
      </button>
    </form>
  );
}

/** Espace client : achats, liens de téléchargement, demandes de remboursement. */
export function ClientSpace() {
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<ClientSession | null>(null);
  const [data, setData] = useState<ClientPurchases | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async (current: ClientSession) => {
    setLoading(true);
    setError(null);
    try {
      setData(await fetchPurchases(current.token));
    } catch (err) {
      if (err instanceof SessionExpiredError) {
        clearSession();
        setSession(null);
        setNotice(err.message);
      } else {
        setError(err instanceof Error ? err.message : 'Vos achats n’ont pas pu être chargés.');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const current = loadSession();
    setSession(current);
    setReady(true);
    if (current) void load(current);
  }, [load]);

  const logout = async () => {
    if (session) await closeSession(session.token);
    clearSession();
    setSession(null);
    setData(null);
    setNotice('Vous êtes déconnecté de votre espace sur cet appareil.');
  };

  if (!ready) {
    return <Loader2 className="h-6 w-6 animate-spin text-orange-500" aria-label="Chargement" />;
  }
  if (!session) {
    return <LoginForm notice={notice} />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-zinc-800 bg-zinc-900/60 px-4 py-3 text-sm">
        <p className="text-zinc-300">
          <CheckCircle2 className="mr-2 inline h-4 w-4 text-emerald-400" aria-hidden="true" />
          Connecté avec <strong className="text-white">{session.email}</strong>
        </p>
        <button type="button" onClick={logout} className={SECONDARY}>
          <LogOut className="h-4 w-4" aria-hidden="true" />
          Se déconnecter
        </button>
      </div>

      {loading && !data && <Loader2 className="h-6 w-6 animate-spin text-orange-500" aria-label="Chargement" />}
      {error && (
        <div className="space-y-3" role="alert">
          <p className="rounded-lg border border-red-900 bg-red-950/50 px-3 py-2 text-sm text-red-300">{error}</p>
          <button type="button" onClick={() => load(session)} className={SECONDARY}>
            <RotateCw className="h-4 w-4" aria-hidden="true" />
            Réessayer
          </button>
        </div>
      )}

      {data && data.orders.length === 0 && (
        <div className="rounded-xl border border-dashed border-zinc-800 p-8 text-center text-zinc-400">
          <PackageOpen className="mx-auto mb-3 h-8 w-8" aria-hidden="true" />
          Aucun achat n’est lié à cette adresse pour le moment. <Link href="/" className={LINK}>Voir le catalogue</Link>
        </div>
      )}

      {data?.orders.map((order) => (
        <section key={order.orderNumber} className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 sm:p-5" aria-label={`Commande ${order.orderNumber}`}>
          <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-zinc-800 pb-3">
            <h2 className="font-semibold text-white">Commande {order.orderNumber}</h2>
            <p className="text-sm text-zinc-400">
              {formatDate(order.paidAt)} · {order.totalAmount === 0 ? 'gratuit' : formatFcfa(order.totalAmount)}
              {order.status === 'refunded' && <span className="ml-2 rounded-full bg-zinc-800 px-2 py-0.5 text-xs text-zinc-300">remboursée</span>}
            </p>
          </div>
          <ul className="divide-y divide-zinc-800">
            {order.items.map((item) => (
              <li key={item.id} className="py-3">
                <p className="text-white">
                  {item.productSlug ? (
                    <Link href={`/produits/${item.productSlug}`} className="font-medium hover:text-orange-400">
                      {item.productName}
                    </Link>
                  ) : (
                    <span className="font-medium">{item.productName}</span>
                  )}
                  <span className="text-sm text-zinc-500">
                    {' '}
                    · {item.price === 0 ? 'gratuit' : formatFcfa(item.price)}
                    {item.store && <> · vendu par {item.store.name}</>}
                  </span>
                </p>
                <ItemActions item={item} orderNumber={order.orderNumber} />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
