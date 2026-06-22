import { useQuery } from '@tanstack/react-query';
import { isApiError, type CategoryWithCount } from '@blackstore/shared';
import { api } from '@/lib/api';

export function DashboardPage() {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['categories'],
    queryFn: () => api.get<CategoryWithCount[]>('/categories'),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Tableau de bord</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Test de connexion API (GET /categories — endpoint public).
        </p>
      </div>

      {isLoading && (
        <p className="text-sm text-muted-foreground" role="status">
          Chargement des catégories depuis l&apos;API…
        </p>
      )}

      {isError && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm">
          <p className="font-medium text-destructive">Erreur API</p>
          <p className="mt-1 text-muted-foreground">
            {isApiError(error) ? error.message : 'Impossible de joindre l&apos;API'}
          </p>
        </div>
      )}

      {data && (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Connexion API OK — {data.length} catégorie(s) active(s)
          </p>
          <ul className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {data.map((category) => (
              <li key={category.id} className="rounded-lg border bg-background p-4">
                <p className="font-medium">{category.name}</p>
                <p className="text-xs text-muted-foreground">{category.slug}</p>
                <p className="mt-2 text-sm">
                  {category._count.products} produit(s) actif(s)
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
