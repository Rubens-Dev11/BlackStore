import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { notify } from '@/lib/toast';
import { TONE_CLASSES, type SellerStatus } from '@/lib/seller-api';
import { useAuthStore } from '@/stores/use-auth-store';
import { apiErrorMessage } from '@/components/form-field';

type ReportStatus = 'open' | 'resolved' | 'dismissed';
type ReportReason = 'piracy' | 'malware' | 'scam' | 'illegal' | 'broken' | 'other';

interface Report {
  id: string;
  reason: ReportReason;
  details: string | null;
  reporterEmail: string | null;
  status: ReportStatus;
  resolutionNote: string | null;
  resolvedAt: string | null;
  createdAt: string;
  openReportsOnProduct: number;
  product: {
    id: string;
    name: string;
    slug: string;
    publicUrl: string;
    coverUrl: string | null;
    onSale: boolean;
    store: { name: string; slug: string } | null;
    seller: { id: string; firstName: string; lastName: string; email: string; status: SellerStatus } | null;
  };
}

const REASONS: Record<ReportReason, { label: string; tone: keyof typeof TONE_CLASSES }> = {
  piracy: { label: 'Copie piratée / droits', tone: 'red' },
  malware: { label: 'Fichier dangereux', tone: 'red' },
  scam: { label: 'Arnaque ou tromperie', tone: 'red' },
  illegal: { label: 'Contenu illégal ou choquant', tone: 'red' },
  broken: { label: 'Fichier défectueux', tone: 'yellow' },
  other: { label: 'Autre', tone: 'gray' },
};

const TABS: { value: ReportStatus; label: string }[] = [
  { value: 'open', label: 'À traiter' },
  { value: 'resolved', label: 'Produits retirés' },
  { value: 'dismissed', label: 'Classés sans suite' },
];

const BUTTON = 'rounded-md border px-3 py-1.5 text-sm hover:bg-muted disabled:opacity-50';

const formatDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

export function ReportsPage() {
  const { accessToken } = useAuthStore();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<ReportStatus>('open');
  // Signalement en cours de décision et action choisie (la note est saisie avant de confirmer).
  const [deciding, setDeciding] = useState<{ id: string; action: 'dismiss' | 'remove-product' } | null>(null);
  const [note, setNote] = useState('');

  const { data: reports = [], isLoading, isError } = useQuery({
    queryKey: ['admin-reports', tab],
    queryFn: () => api.get<Report[]>(`/admin/reports?status=${tab}`, accessToken),
  });

  const handle = useMutation({
    mutationFn: ({ id, action, note }: { id: string; action: 'dismiss' | 'remove-product'; note?: string }) =>
      api.patch<Report>(`/admin/reports/${id}`, { action, note }, accessToken),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ['admin-reports'] });
      queryClient.invalidateQueries({ queryKey: ['admin-product-review'] });
      setDeciding(null);
      setNote('');
      notify.success(
        updated.status === 'resolved'
          ? `« ${updated.product.name} » retiré du site${updated.product.seller ? ' ; le vendeur a reçu le motif par e-mail' : ''}.`
          : 'Signalement classé sans suite.',
      );
    },
    onError: (err) => notify.error(apiErrorMessage(err)),
  });

  const start = (id: string, action: 'dismiss' | 'remove-product') => {
    setDeciding({ id, action });
    setNote('');
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">Signalements</h1>
        <p className="text-sm text-muted-foreground">
          Produits signalés par les visiteurs depuis leur fiche. Retirer un produit de vendeur le refuse : le vendeur reçoit
          votre motif et doit le corriger puis le soumettre à nouveau.
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
      {isError && <p className="text-sm text-red-600">Impossible de charger les signalements. Rechargez la page.</p>}
      {!isLoading && !isError && reports.length === 0 && (
        <p className="rounded-lg border border-dashed bg-background p-8 text-center text-sm text-muted-foreground">
          {tab === 'open' ? 'Aucun signalement à traiter.' : 'Aucun signalement dans cette liste.'}
        </p>
      )}

      <ul className="space-y-4">
        {reports.map((r) => {
          const reason = REASONS[r.reason];
          const isDeciding = deciding?.id === r.id;
          return (
            <li key={r.id} className="space-y-3 rounded-lg border bg-background p-4">
              <div className="flex flex-col gap-4 sm:flex-row">
                <div className="flex h-20 w-32 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-muted">
                  {r.product.coverUrl ? <img src={r.product.coverUrl} alt="" className="h-full w-full object-cover" /> : <span className="text-xs text-muted-foreground">Sans image</span>}
                </div>
                <div className="min-w-0 flex-1 space-y-1 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <a href={r.product.publicUrl} target="_blank" rel="noreferrer" className="text-base font-semibold hover:underline">
                      {r.product.name}
                    </a>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${TONE_CLASSES[reason.tone]}`}>{reason.label}</span>
                    {r.status === 'open' && r.openReportsOnProduct > 1 && (
                      <span className="rounded-full bg-orange-500 px-2 py-0.5 text-xs font-semibold text-white">
                        {r.openReportsOnProduct} signalements sur ce produit
                      </span>
                    )}
                  </div>
                  <p className="text-muted-foreground">
                    {r.product.store ? (
                      <>
                        Boutique <strong className="text-foreground">{r.product.store.name}</strong> — {r.product.seller?.firstName}{' '}
                        {r.product.seller?.lastName}, {r.product.seller?.email}
                      </>
                    ) : (
                      'Produit BlackStore'
                    )}
                    {!r.product.onSale && <> · <span className="text-red-600">déjà retiré du site</span></>}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Signalé le {formatDate(r.createdAt)} par{' '}
                    {r.reporterEmail ? (
                      <a href={`mailto:${r.reporterEmail}`} className="underline">{r.reporterEmail}</a>
                    ) : (
                      'un visiteur anonyme'
                    )}
                  </p>
                </div>
              </div>

              {r.details && <p className="whitespace-pre-line rounded-md bg-muted/50 px-3 py-2 text-sm">{r.details}</p>}
              {r.status !== 'open' && (
                <p className="text-sm text-muted-foreground">
                  {formatDate(r.resolvedAt)} : {r.resolutionNote}
                </p>
              )}

              {r.status === 'open' && !isDeciding && (
                <div className="flex flex-wrap gap-2">
                  <a href={r.product.publicUrl} target="_blank" rel="noreferrer" className={BUTTON}>
                    Voir la fiche
                  </a>
                  <button type="button" onClick={() => start(r.id, 'remove-product')} className={`${BUTTON} text-red-700 dark:text-red-400`}>
                    Retirer le produit du site
                  </button>
                  <button type="button" onClick={() => start(r.id, 'dismiss')} className={BUTTON}>
                    Classer sans suite
                  </button>
                </div>
              )}

              {isDeciding && (
                <div className="space-y-2 rounded-md border p-3">
                  <label htmlFor={`note-${r.id}`} className="block text-sm font-medium">
                    {deciding.action === 'remove-product'
                      ? r.product.seller
                        ? 'Motif du retrait (envoyé au vendeur)'
                        : 'Motif du retrait'
                      : 'Note (facultatif)'}
                  </label>
                  <textarea
                    id={`note-${r.id}`}
                    rows={3}
                    maxLength={500}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder={
                      deciding.action === 'remove-product'
                        ? 'Ex. : copie d’une application payante, vous ne pouvez pas la revendre.'
                        : 'Ex. : vérifié, le fichier fonctionne.'
                    }
                    className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={handle.isPending || (deciding.action === 'remove-product' && note.trim().length < 5)}
                      onClick={() => handle.mutate({ id: r.id, action: deciding.action, note: note.trim() || undefined })}
                      className={
                        deciding.action === 'remove-product'
                          ? 'rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50'
                          : 'rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50'
                      }
                    >
                      {deciding.action === 'remove-product' ? 'Confirmer le retrait' : 'Classer sans suite'}
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
