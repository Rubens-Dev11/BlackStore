import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { formatFcfa } from '@/lib/format';
import { notify } from '@/lib/toast';
import {
  PLATFORM_LABELS,
  TONE_CLASSES,
  type FileScanStatus,
  type ProductPlatform,
  type ProductReviewStatus,
  type SellerStatus,
} from '@/lib/seller-api';
import { useAuthStore } from '@/stores/use-auth-store';
import { apiErrorMessage } from '@/components/form-field';

interface ReviewProduct {
  id: string;
  name: string;
  slug: string;
  shortDescription: string | null;
  description: string | null;
  price: number;
  originalPrice: number | null;
  categoryName: string | null;
  platform: ProductPlatform;
  version: string | null;
  tags: string[];
  coverUrl: string | null;
  screenshotUrls: string[];
  file: { name: string; sizeMb: number | null; sha256: string | null } | null;
  scanStatus: FileScanStatus | null;
  scanResult: string | null;
  scannedAt: string | null;
  reviewStatus: ProductReviewStatus;
  reviewNote: string | null;
  submittedAt: string | null;
  reviewedAt: string | null;
  isActive: boolean;
  store: { name: string; slug: string };
  seller: { id: string; firstName: string; lastName: string; email: string; status: SellerStatus };
}

const TABS: { value: ProductReviewStatus; label: string }[] = [
  { value: 'pending', label: 'En attente' },
  { value: 'approved', label: 'Validés' },
  { value: 'rejected', label: 'Refusés' },
];

const SCAN_LABELS: Record<FileScanStatus, { label: string; tone: keyof typeof TONE_CLASSES }> = {
  pending: { label: 'Analyse antivirus en cours', tone: 'blue' },
  clean: { label: 'Antivirus : sain', tone: 'green' },
  infected: { label: 'Antivirus : menace détectée', tone: 'red' },
  failed: { label: 'Antivirus : analyse impossible', tone: 'yellow' },
};

const BUTTON = 'rounded-md border px-3 py-1.5 text-sm hover:bg-muted disabled:opacity-50';

const formatDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

export function ProductReviewPage() {
  const { accessToken } = useAuthStore();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<ProductReviewStatus>('pending');
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [note, setNote] = useState('');

  const { data: products = [], isLoading, isError } = useQuery({
    queryKey: ['admin-product-review', tab],
    queryFn: () => api.get<ReviewProduct[]>(`/admin/products/review?status=${tab}`, accessToken),
    refetchInterval: (query) => (query.state.data?.some((p) => p.scanStatus === 'pending') ? 5000 : false),
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['admin-product-review'] });

  const review = useMutation({
    mutationFn: ({ id, decision, note }: { id: string; decision: 'approve' | 'reject'; note?: string }) =>
      api.patch<ReviewProduct>(`/admin/products/${id}/review`, { decision, note }, accessToken),
    onSuccess: (updated) => {
      refresh();
      setRejecting(null);
      setNote('');
      notify.success(
        updated.reviewStatus === 'approved'
          ? `« ${updated.name} » validé. Le vendeur est prévenu par e-mail.`
          : `« ${updated.name} » refusé. Le vendeur a reçu le motif par e-mail.`,
      );
    },
    onError: (err) => notify.error(apiErrorMessage(err)),
  });

  const rescan = useMutation({
    mutationFn: (id: string) => api.post<ReviewProduct>(`/admin/products/${id}/rescan`, {}, accessToken),
    onSuccess: () => {
      refresh();
      notify.success('Analyse antivirus relancée');
    },
    onError: (err) => notify.error(apiErrorMessage(err)),
  });

  const download = async (product: ReviewProduct) => {
    try {
      const { url } = await api.get<{ url: string }>(`/admin/products/${product.id}/file-url`, accessToken);
      window.location.assign(url);
    } catch (err) {
      notify.error(apiErrorMessage(err));
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">Produits des vendeurs</h1>
        <p className="text-sm text-muted-foreground">
          Le premier produit de chaque vendeur attend ici votre validation ; les suivants sont publiés directement et
          restent consultables dans « Validés ».
        </p>
      </div>

      <div className="flex gap-2">
        {TABS.map((t) => (
          <button
            key={t.value}
            onClick={() => setTab(t.value)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${
              tab === t.value ? 'bg-primary text-primary-foreground' : 'border hover:bg-muted'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Chargement...</p>}
      {isError && <p className="text-sm text-red-600">Impossible de charger les produits. Rechargez la page.</p>}
      {!isLoading && !isError && products.length === 0 && (
        <p className="rounded-lg border border-dashed bg-background p-8 text-center text-sm text-muted-foreground">
          Aucun produit dans cette liste.
        </p>
      )}

      <ul className="space-y-4">
        {products.map((p) => {
          const scan = p.scanStatus ? SCAN_LABELS[p.scanStatus] : null;
          return (
            <li key={p.id} className="space-y-4 rounded-lg border bg-background p-4">
              <div className="flex flex-col gap-4 sm:flex-row">
                <div className="flex h-28 w-48 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-muted">
                  {p.coverUrl ? <img src={p.coverUrl} alt="" className="h-full w-full object-cover" /> : <span className="text-xs text-muted-foreground">Sans couverture</span>}
                </div>
                <div className="min-w-0 flex-1 space-y-1 text-sm">
                  <p className="text-base font-semibold">{p.name}</p>
                  <p>
                    {p.price === 0 ? 'Gratuit' : formatFcfa(p.price)}
                    {p.originalPrice !== null && <span className="ml-2 text-muted-foreground line-through">{formatFcfa(p.originalPrice)}</span>}
                    {' · '}{p.categoryName ?? 'Sans catégorie'} · {PLATFORM_LABELS[p.platform]}
                    {p.version && <> · v{p.version}</>}
                  </p>
                  <p className="text-muted-foreground">
                    Boutique <strong className="text-foreground">{p.store.name}</strong> (/boutique/{p.store.slug}) — {p.seller.firstName}{' '}
                    {p.seller.lastName}, {p.seller.email}
                  </p>
                  {p.seller.status !== 'approved' && (
                    <p className="text-yellow-700 dark:text-yellow-300">
                      Compte vendeur {p.seller.status === 'pending' ? 'en attente' : 'suspendu'} : le produit ne sera visible
                      qu'avec un compte validé (page « Vendeurs »).
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Soumis le {formatDate(p.submittedAt)}
                    {p.reviewedAt && <> · décision le {formatDate(p.reviewedAt)}</>}
                  </p>
                  {p.reviewStatus === 'rejected' && p.reviewNote && <p className="text-red-700 dark:text-red-400">Motif du refus : {p.reviewNote}</p>}
                </div>
              </div>

              {p.shortDescription && <p className="text-sm font-medium">{p.shortDescription}</p>}
              {p.description && (
                <details className="text-sm">
                  <summary className="cursor-pointer text-muted-foreground">Description</summary>
                  <p className="mt-2 whitespace-pre-line">{p.description}</p>
                </details>
              )}
              {p.tags.length > 0 && <p className="text-xs text-muted-foreground">Mots-clés : {p.tags.join(', ')}</p>}
              {p.screenshotUrls.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {p.screenshotUrls.map((url, i) => (
                    <a key={url} href={url} target="_blank" rel="noreferrer">
                      <img src={url} alt={`Capture ${i + 1}`} className="h-16 w-28 rounded-md border object-cover" />
                    </a>
                  ))}
                </div>
              )}

              <div className="flex flex-wrap items-center gap-2 border-t pt-3 text-sm">
                {p.file ? (
                  <span className="break-all">
                    Fichier : <strong>{p.file.name}</strong>
                    {p.file.sizeMb !== null && <> ({p.file.sizeMb.toLocaleString('fr-FR')} Mo)</>}
                  </span>
                ) : (
                  <span className="text-muted-foreground">Aucun fichier</span>
                )}
                {scan && (
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${TONE_CLASSES[scan.tone]}`} title={p.scanResult ?? undefined}>
                    {scan.label}
                    {p.scanStatus === 'infected' && p.scanResult ? ` (${p.scanResult})` : ''}
                  </span>
                )}
              </div>

              <div className="flex flex-wrap gap-2">
                {p.file && p.scanStatus === 'clean' && (
                  <button type="button" onClick={() => download(p)} className={BUTTON}>
                    Télécharger le fichier
                  </button>
                )}
                {p.file && (p.scanStatus === 'failed' || p.scanStatus === 'pending') && (
                  <button type="button" disabled={rescan.isPending} onClick={() => rescan.mutate(p.id)} className={BUTTON}>
                    Relancer l'analyse
                  </button>
                )}
                {(p.reviewStatus === 'pending' || p.reviewStatus === 'rejected') && (
                  <button
                    type="button"
                    disabled={review.isPending || p.scanStatus !== 'clean'}
                    title={p.scanStatus !== 'clean' ? "Le fichier doit d'abord passer l'antivirus" : undefined}
                    onClick={() => review.mutate({ id: p.id, decision: 'approve' })}
                    className={`${BUTTON} text-green-700 dark:text-green-400`}
                  >
                    Valider
                  </button>
                )}
                {(p.reviewStatus === 'pending' || p.reviewStatus === 'approved') && rejecting !== p.id && (
                  <button
                    type="button"
                    onClick={() => {
                      setRejecting(p.id);
                      setNote('');
                    }}
                    className={`${BUTTON} text-red-700 dark:text-red-400`}
                  >
                    {p.reviewStatus === 'approved' ? 'Retirer du site' : 'Refuser'}
                  </button>
                )}
              </div>

              {rejecting === p.id && (
                <div className="space-y-2 rounded-md border p-3">
                  <label htmlFor={`note-${p.id}`} className="block text-sm font-medium">
                    Motif (envoyé au vendeur)
                  </label>
                  <textarea
                    id={`note-${p.id}`}
                    rows={3}
                    maxLength={500}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Ex. : la couverture est floue ; le fichier ne correspond pas à la description…"
                    className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={review.isPending || note.trim().length < 5}
                      onClick={() => review.mutate({ id: p.id, decision: 'reject', note: note.trim() })}
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
