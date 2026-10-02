import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { notify } from '@/lib/toast';
import type { IdentityCheckStatus, IdentityDocumentType, SellerStatus } from '@/lib/seller-api';
import { useAuthStore } from '@/stores/use-auth-store';
import { apiErrorMessage } from '@/components/form-field';

interface IdentityCheck {
  id: string;
  documentType: IdentityDocumentType;
  fullName: string;
  status: IdentityCheckStatus;
  reviewNote: string | null;
  reviewedAt: string | null;
  submittedAt: string;
  /** Liens valables 10 minutes ; vides après un refus (photos effacées). */
  images: { documentFrontUrl: string | null; documentBackUrl: string | null; selfieUrl: string | null };
  seller: { id: string; firstName: string; lastName: string; email: string; phone: string; status: SellerStatus; createdAt: string };
}

const TABS: { value: IdentityCheckStatus; label: string }[] = [
  { value: 'pending', label: 'À vérifier' },
  { value: 'approved', label: 'Vérifiées' },
  { value: 'rejected', label: 'Refusées' },
];

// Motifs fréquents, à compléter si besoin.
const QUICK_REASONS = [
  'Photo floue ou illisible',
  'La pièce est expirée',
  'Le nom ne correspond pas au compte vendeur',
  'Le selfie ne montre pas la pièce et le visage',
];

const BUTTON = 'rounded-md border px-3 py-1.5 text-sm hover:bg-muted disabled:opacity-50';

const formatDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

/** Les noms se comparent sans accents, majuscules ni ordre des mots. */
const sameName = (a: string, b: string) => {
  const words = (s: string) => s.normalize('NFD').replace(/[^\p{L}\s]/gu, '').toLowerCase().split(/\s+/).filter(Boolean).sort().join(' ');
  return words(a) === words(b);
};

function Photo({ url, label }: { url: string | null; label: string }) {
  if (!url) return null;
  return (
    <a href={url} target="_blank" rel="noreferrer" className="block space-y-1">
      <img src={url} alt={label} className="h-40 w-full rounded-md border object-contain bg-muted" />
      <p className="text-center text-xs text-muted-foreground">{label} (cliquer pour agrandir)</p>
    </a>
  );
}

export function IdentityChecksPage() {
  const { accessToken } = useAuthStore();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<IdentityCheckStatus>('pending');
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [note, setNote] = useState('');

  const { data: checks = [], isLoading, isError } = useQuery({
    queryKey: ['admin-identity-checks', tab],
    queryFn: () => api.get<IdentityCheck[]>(`/admin/identity-checks?status=${tab}`, accessToken),
    // Les liens vers les photos expirent au bout de 10 minutes : on les renouvelle avant.
    refetchInterval: 8 * 60_000,
  });

  const review = useMutation({
    mutationFn: ({ id, decision, note }: { id: string; decision: 'approve' | 'reject'; note?: string }) =>
      api.patch<IdentityCheck>(`/admin/identity-checks/${id}`, { decision, note }, accessToken),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ['admin-identity-checks'] });
      queryClient.invalidateQueries({ queryKey: ['admin-sellers'] });
      setRejecting(null);
      setNote('');
      notify.success(
        updated.status === 'approved'
          ? `Identité de ${updated.seller.firstName} ${updated.seller.lastName} vérifiée. Un e-mail l'a prévenu.`
          : `Vérification refusée : les photos sont effacées et le vendeur a reçu le motif.`,
      );
    },
    onError: (err) => notify.error(apiErrorMessage(err)),
  });

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">Vérification d'identité des vendeurs</h1>
        <p className="text-sm text-muted-foreground">
          Obligatoire avant le premier retrait. Vérifiez que la pièce est lisible et valide, que le nom correspond au compte et que
          le selfie montre la même personne avec la pièce. À traiter sous 24 heures.
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
      {isError && <p className="text-sm text-red-600">Impossible de charger les vérifications. Rechargez la page.</p>}
      {!isLoading && !isError && checks.length === 0 && (
        <p className="rounded-lg border border-dashed bg-background p-8 text-center text-sm text-muted-foreground">
          {tab === 'pending' ? 'Aucune vérification à traiter.' : 'Aucune vérification dans cette liste.'}
        </p>
      )}

      <ul className="space-y-4">
        {checks.map((c) => {
          const accountName = `${c.seller.firstName} ${c.seller.lastName}`;
          const nameMatches = sameName(c.fullName, accountName);
          return (
            <li key={c.id} className="space-y-4 rounded-lg border bg-background p-4">
              <div className="flex flex-wrap items-start justify-between gap-2 text-sm">
                <div className="space-y-1">
                  <p className="text-base font-semibold">{accountName}</p>
                  <p className="text-muted-foreground">
                    {c.seller.email} · {c.seller.phone} · compte {c.seller.status === 'approved' ? 'validé' : c.seller.status === 'pending' ? 'en attente' : 'suspendu'}
                  </p>
                  <p>
                    {c.documentType === 'cni' ? 'CNI' : 'Passeport'} au nom de <strong>{c.fullName}</strong>
                    {!nameMatches && (
                      <span className="ml-2 rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
                        différent du nom du compte
                      </span>
                    )}
                  </p>
                </div>
                <p className="text-xs text-muted-foreground">
                  Envoyée le {formatDate(c.submittedAt)}
                  {c.reviewedAt && <><br />Traitée le {formatDate(c.reviewedAt)}</>}
                </p>
              </div>

              {c.status === 'rejected' ? (
                <p className="text-sm text-red-700 dark:text-red-400">Motif du refus : {c.reviewNote} (photos effacées)</p>
              ) : (
                <div className="grid gap-3 sm:grid-cols-3">
                  <Photo url={c.images.documentFrontUrl} label={c.documentType === 'cni' ? 'Recto' : 'Page d’identité'} />
                  <Photo url={c.images.documentBackUrl} label="Verso" />
                  <Photo url={c.images.selfieUrl} label="Selfie avec la pièce" />
                </div>
              )}

              {c.status === 'pending' && rejecting !== c.id && (
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={review.isPending}
                    onClick={() => review.mutate({ id: c.id, decision: 'approve' })}
                    className={`${BUTTON} text-green-700 dark:text-green-400`}
                  >
                    Valider l'identité
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setRejecting(c.id);
                      setNote('');
                    }}
                    className={`${BUTTON} text-red-700 dark:text-red-400`}
                  >
                    Refuser
                  </button>
                </div>
              )}

              {rejecting === c.id && (
                <div className="space-y-2 rounded-md border p-3">
                  <p className="text-sm font-medium">Motif (envoyé au vendeur ; ses photos seront effacées)</p>
                  <div className="flex flex-wrap gap-2">
                    {QUICK_REASONS.map((reason) => (
                      <button key={reason} type="button" onClick={() => setNote(reason)} className="rounded-full border px-2 py-0.5 text-xs hover:bg-muted">
                        {reason}
                      </button>
                    ))}
                  </div>
                  <textarea
                    rows={2}
                    maxLength={500}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={review.isPending || note.trim().length < 5}
                      onClick={() => review.mutate({ id: c.id, decision: 'reject', note: note.trim() })}
                      className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
                    >
                      Confirmer le refus
                    </button>
                    <button type="button" onClick={() => setRejecting(null)} className={BUTTON}>
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
