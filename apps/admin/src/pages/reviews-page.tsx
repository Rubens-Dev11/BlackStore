import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/use-auth-store';
import { api } from '@/lib/api';
import { isApiError } from '@/lib/format';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

interface Review {
  id: string;
  productId: string;
  buyerEmail: string;
  rating: number;
  comment: string | null;
  isApproved: boolean;
  createdAt: string;
  product: { name: string; slug: string };
}

// ─────────────────────────────────────────────
// Composant
// ─────────────────────────────────────────────

function StarRating({ rating }: { rating: number }) {
  return (
    <span className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <span key={n} className={n <= rating ? 'text-orange-400' : 'text-gray-300'}>
          ★
        </span>
      ))}
    </span>
  );
}

interface ReviewsResponse {
  data: Review[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export function ReviewsPage() {
  const { accessToken } = useAuthStore();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['reviews'],
    queryFn: () => api.get<ReviewsResponse>('/reviews?limit=100', accessToken),
    enabled: !!accessToken,
  });

  const reviews = data?.data ?? [];

  const approveMutation = useMutation({
    mutationFn: (id: string) =>
      api.patch<Review>(`/reviews/${id}/approve`, {}, accessToken),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reviews'] });
    },
    onError: (err) => {
      alert(isApiError(err) ? err.message : 'Erreur lors de l\'approbation');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete<void>(`/reviews/${id}`, accessToken),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reviews'] });
    },
    onError: (err) => {
      alert(isApiError(err) ? err.message : 'Erreur lors de la suppression');
    },
  });

  const pending = reviews.filter((r) => !r.isApproved);
  const approved = reviews.filter((r) => r.isApproved);

  function confirmDelete(review: Review) {
    if (confirm(`Supprimer l'avis de ${review.buyerEmail} ? Cette action est irréversible.`)) {
      deleteMutation.mutate(review.id);
    }
  }

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Modération des avis</h1>
        <span className="rounded-full bg-orange-100 px-3 py-1 text-sm font-medium text-orange-700 dark:bg-orange-900 dark:text-orange-200">
          {pending.length} en attente
        </span>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Chargement...</p>
      ) : reviews.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <p className="text-muted-foreground">Aucun avis pour le moment.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Avis en attente */}
          {pending.length > 0 && (
            <section>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-orange-600">
                En attente d'approbation ({pending.length})
              </h2>
              <div className="space-y-3">
                {pending.map((review) => (
                  <ReviewCard
                    key={review.id}
                    review={review}
                    onApprove={() => approveMutation.mutate(review.id)}
                    onDelete={() => confirmDelete(review)}
                    isPendingApprove={approveMutation.isPending}
                    isPendingDelete={deleteMutation.isPending}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Avis approuvés */}
          {approved.length > 0 && (
            <section>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-green-600">
                Approuvés ({approved.length})
              </h2>
              <div className="space-y-3">
                {approved.map((review) => (
                  <ReviewCard
                    key={review.id}
                    review={review}
                    onDelete={() => confirmDelete(review)}
                    isPendingApprove={false}
                    isPendingDelete={deleteMutation.isPending}
                  />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// Carte avis
// ─────────────────────────────────────────────

interface ReviewCardProps {
  review: Review;
  onApprove?: () => void;
  onDelete: () => void;
  isPendingApprove: boolean;
  isPendingDelete: boolean;
}

function ReviewCard({ review, onApprove, onDelete, isPendingApprove, isPendingDelete }: ReviewCardProps) {
  return (
    <div
      className={`rounded-lg border p-4 ${
        review.isApproved
          ? 'bg-card'
          : 'border-orange-200 bg-orange-50 dark:border-orange-800 dark:bg-orange-950/30'
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-center gap-3">
            <StarRating rating={review.rating} />
            <span className="text-xs text-muted-foreground">{review.buyerEmail}</span>
            <span className="text-xs text-muted-foreground">
              {new Date(review.createdAt).toLocaleDateString('fr-FR')}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            Produit : <span className="font-medium">{review.product.name}</span>
          </p>
          {review.comment && (
            <p className="mt-2 text-sm text-foreground">{review.comment}</p>
          )}
        </div>
        <div className="flex shrink-0 gap-2">
          {!review.isApproved && onApprove && (
            <button
              onClick={onApprove}
              disabled={isPendingApprove}
              className="rounded px-3 py-1 text-xs font-medium text-green-700 hover:bg-green-100 disabled:opacity-50 dark:text-green-400 dark:hover:bg-green-950"
            >
              ✓ Approuver
            </button>
          )}
          <button
            onClick={onDelete}
            disabled={isPendingDelete}
            className="rounded px-3 py-1 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50 dark:text-red-400 dark:hover:bg-red-950"
          >
            Supprimer
          </button>
        </div>
      </div>
    </div>
  );
}
