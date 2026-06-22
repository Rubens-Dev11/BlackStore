'use client';

import { useQuery } from '@tanstack/react-query';
import { formatFcfa, isApiError, type ProductsListResponse } from '@blackstore/shared';
import { api } from '@/lib/api';

export function ProductsCatalog() {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['products', { page: 1, limit: 12 }],
    queryFn: () => api.get<ProductsListResponse>('/products', { page: 1, limit: 12 }),
  });

  if (isLoading) {
    return (
      <p className="text-sm text-muted-foreground" role="status">
        Chargement des produits depuis l&apos;API…
      </p>
    );
  }

  if (isError) {
    const message = isApiError(error)
      ? error.message
      : 'Impossible de joindre l&apos;API BlackStore';

    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm">
        <p className="font-medium text-destructive">Erreur API</p>
        <p className="mt-1 text-muted-foreground">{message}</p>
        <p className="mt-2 text-xs text-muted-foreground">
          Vérifiez que l&apos;API tourne sur {api.getBaseUrl()}
        </p>
      </div>
    );
  }

  if (!data || data.data.length === 0) {
    return (
      <div className="rounded-lg border p-6 text-sm text-muted-foreground">
        <p className="font-medium text-foreground">Connexion API OK</p>
        <p className="mt-1">Aucun produit actif pour le moment ({data?.total ?? 0} total).</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Connexion API OK — {data.total} produit(s) actif(s)
      </p>
      <ul className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {data.data.map((product) => (
          <li key={product.id} className="rounded-lg border p-4">
            <p className="font-medium">{product.name}</p>
            {product.category && (
              <p className="text-xs text-muted-foreground">{product.category.name}</p>
            )}
            <p className="mt-2 text-sm font-semibold">{formatFcfa(product.price)}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
