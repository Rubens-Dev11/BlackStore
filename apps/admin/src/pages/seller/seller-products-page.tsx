import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { formatFcfa } from '@/lib/format';
import { notify } from '@/lib/toast';
import { sellerProductState, TONE_CLASSES, type SellerProduct, type SellerStore } from '@/lib/seller-api';
import { useAuthStore } from '@/stores/use-auth-store';
import { apiErrorMessage, BUTTON_CLASS } from '@/components/form-field';

const LINK_BUTTON = 'rounded-md border px-3 py-1.5 text-xs hover:bg-muted disabled:opacity-50';

export function SellerProductsPage() {
  const { accessToken } = useAuthStore();
  const queryClient = useQueryClient();
  const { data: products = [], isLoading, isError } = useQuery({
    queryKey: ['seller-products'],
    queryFn: () => api.get<SellerProduct[]>('/seller/products', accessToken),
    // Une analyse antivirus ou une validation en cours : on rafraîchit la liste toute seule.
    refetchInterval: (query) =>
      query.state.data?.some((p) => p.scanStatus === 'pending') ? 5000 : false,
  });
  const { data: storeData } = useQuery({
    queryKey: ['seller-store'],
    queryFn: () => api.get<{ store: SellerStore | null }>('/seller/store', accessToken),
  });

  const refresh = (updated?: SellerProduct) => {
    if (updated) {
      queryClient.setQueryData<SellerProduct[]>(['seller-products'], (list) =>
        list?.map((p) => (p.id === updated.id ? updated : p)),
      );
    }
    queryClient.invalidateQueries({ queryKey: ['seller-products'] });
  };

  const visibility = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      api.patch<SellerProduct>(`/seller/products/${id}/visibility`, { isActive }, accessToken),
    onSuccess: (updated) => {
      refresh(updated);
      notify.success(updated.isActive ? 'Produit affiché' : 'Produit masqué');
    },
    onError: (err) => notify.error(apiErrorMessage(err)),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.delete<{ deleted: boolean }>(`/seller/products/${id}`, accessToken),
    onSuccess: () => {
      refresh();
      notify.success('Produit supprimé');
    },
    onError: (err) => notify.error(apiErrorMessage(err)),
  });

  if (isLoading) return <p className="text-sm text-muted-foreground">Chargement...</p>;
  if (isError) return <p className="text-sm text-red-600">Impossible de charger vos produits. Rechargez la page.</p>;

  const hasStore = !!storeData?.store;

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Mes produits</h1>
        {hasStore && (
          <Link to="/vendeur/produits/nouveau" className={BUTTON_CLASS}>
            Ajouter un produit
          </Link>
        )}
      </div>

      {!hasStore && storeData && (
        <div className="rounded-lg border border-yellow-300 bg-yellow-50 px-4 py-3 text-sm text-yellow-800 dark:border-yellow-800 dark:bg-yellow-950 dark:text-yellow-200">
          Créez d'abord votre boutique : vos produits y seront présentés.{' '}
          <Link to="/vendeur/boutique" className="font-medium underline">Créer ma boutique</Link>
        </div>
      )}

      {hasStore && products.length === 0 && (
        <div className="rounded-lg border border-dashed bg-background p-8 text-center text-sm text-muted-foreground">
          <p>Vous n'avez pas encore de produit.</p>
          <p className="mt-1">
            Votre premier produit est vérifié par l'équipe BlackStore avant sa mise en ligne ; les suivants sont publiés
            directement.
          </p>
        </div>
      )}

      {products.length > 0 && (
        <ul className="space-y-3">
          {products.map((product) => {
            const state = sellerProductState(product);
            return (
              <li key={product.id} className="flex flex-col gap-4 rounded-lg border bg-background p-4 sm:flex-row sm:items-center">
                <div className="flex h-16 w-24 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-muted">
                  {product.coverUrl ? (
                    <img src={product.coverUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-xs text-muted-foreground">Sans image</span>
                  )}
                </div>
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link to={`/vendeur/produits/${product.id}`} className="font-medium hover:underline">
                      {product.name}
                    </Link>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${TONE_CLASSES[state.tone]}`}>{state.label}</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {product.price === 0 ? 'Gratuit' : formatFcfa(product.price)}
                    {product.categoryName && <> · {product.categoryName}</>}
                    {product.orderCount > 0 && <> · {product.orderCount} commande{product.orderCount > 1 ? 's' : ''}</>}
                  </p>
                  {product.reviewStatus === 'rejected' && product.reviewNote && (
                    <p className="text-sm text-red-700 dark:text-red-400">Motif : {product.reviewNote}</p>
                  )}
                  {product.isPublic && (
                    <a href={product.publicUrl} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline">
                      Voir sur le site
                    </a>
                  )}
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  <Link to={`/vendeur/produits/${product.id}`} className={LINK_BUTTON}>
                    Modifier
                  </Link>
                  {product.reviewStatus === 'approved' && (
                    <button
                      type="button"
                      disabled={visibility.isPending}
                      onClick={() => visibility.mutate({ id: product.id, isActive: !product.isActive })}
                      className={LINK_BUTTON}
                    >
                      {product.isActive ? 'Masquer' : 'Afficher'}
                    </button>
                  )}
                  {product.orderCount === 0 && (
                    <button
                      type="button"
                      disabled={remove.isPending}
                      onClick={() => {
                        if (window.confirm(`Supprimer définitivement « ${product.name} » ?`)) remove.mutate(product.id);
                      }}
                      className={`${LINK_BUTTON} text-red-700 dark:text-red-400`}
                    >
                      Supprimer
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
