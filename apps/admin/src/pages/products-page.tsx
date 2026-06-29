import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/use-auth-store';
import { api } from '@/lib/api';
import { formatFcfa } from '@/lib/format';
import { notify } from '@/lib/toast';

interface ProductsResponse {
  data: Product[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface Product {
  id: string;
  name: string;
  slug: string;
  shortDescription: string | null;
  price: number;
  originalPrice: number | null;
  platform: 'android' | 'desktop' | 'multiplatform';
  isActive: boolean;
  isFeatured: boolean;
  coverImageUrl: string | null;
  fileSizeMb: number | null;
  downloadCount: number;
  ratingAvg: number;
  categoryId: string | null;
  createdAt: string;
}



export function ProductsPage() {
  const { accessToken } = useAuthStore();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['products'],
    queryFn: () => api.get<ProductsResponse>('/products/admin/all', accessToken),
    enabled: !!accessToken,
  });

  // Handle errors in v5
  useEffect(() => {
    if (isError) {
      notify.error('Erreur lors du chargement des produits.');
    }
  }, [isError]);

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      api.patch<Product>(`/products/${id}`, { isActive }, accessToken),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      notify.success('Statut mis à jour');
    },
    onError: (_err: unknown) => {
      notify.success('Statut mis à jour');
    },
  });

  if (isLoading) {
    return <div className="p-6">Chargement des produits...</div>;
  }

  if (isError) {
    return (
      <div className="p-6 flex flex-col items-center gap-4">
        <button
          onClick={() => refetch()}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Réessayer
        </button>
      </div>
    );
  }

  const products = data?.data || [];

  if (!data || products.length === 0) {
    return <div className="p-6">Aucun produit trouvé.</div>;
  }

  const getPlatformBadge = (platform: Product['platform']) => {
    switch (platform) {
      case 'android':
        return <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded">Android</span>;
      case 'desktop':
        return <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">Desktop</span>;
      case 'multiplatform':
        return <span className="px-2 py-1 bg-purple-100 text-purple-800 text-xs rounded">Multiplateforme</span>;
      default:
        return null;
    }
  };

  const getStatusBadge = (isActive: boolean) => {
    return isActive ? (
      <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded">Actif</span>
    ) : (
      <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded">Inactif</span>
    );
  };

  return (
    <div className="p-6 animate-fade-in">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Produits</h1>
        <button
          onClick={() => navigate('/produits/nouveau')}
          className="px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90 text-sm font-medium"
        >
          + Nouveau produit
        </button>
      </div>

      <p className="mb-4 text-sm text-gray-600">
        {products.length} produit(s) au total
      </p>

      <div className="overflow-x-auto">
        <table className="min-w-full bg-white border border-gray-200 rounded">
          <thead>
            <tr className="bg-gray-50">
              <th className="py-2 px-4 text-left">Image</th>
              <th className="py-2 px-4 text-left">Nom</th>
              <th className="py-2 px-4 text-left">Plateforme</th>
              <th className="py-2 px-4 text-left">Prix</th>
              <th className="py-2 px-4 text-left">Statut</th>
              <th className="py-2 px-4 text-left">Actif</th>
              <th className="py-2 px-4 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {products.map((product: Product) => (
              <tr key={product.id} className="border-t">
                <td className="py-2 px-4">
                  {product.coverImageUrl ? (
                    <img
                      src={product.coverImageUrl}
                      alt={product.name}
                      className="w-10 h-10 rounded object-cover"
                    />
                  ) : (
                    <div className="w-10 h-10 bg-gray-200 rounded"></div>
                  )}
                </td>
                <td className="py-2 px-4">
                  <div className="font-medium">{product.name}</div>
                  {product.shortDescription && (
                    <div className="text-xs text-gray-500">{product.shortDescription}</div>
                  )}
                </td>
                <td className="py-2 px-4">{getPlatformBadge(product.platform)}</td>
                <td className="py-2 px-4">{formatFcfa(product.price)}</td>
                <td className="py-2 px-4">{getStatusBadge(product.isActive)}</td>
                <td className="py-2 px-4">
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={product.isActive}
                      onChange={() => toggleMutation.mutate({ id: product.id, isActive: !product.isActive })}
                      disabled={toggleMutation.isPending}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-checked:bg-orange-500 peer-disabled:opacity-50 after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full"></div>
                  </label>
                </td>
                <td className="py-2 px-4">
                  <button
                    onClick={() => navigate(`/produits/${product.id}/modifier`)}
                    className="px-3 py-1 bg-blue-100 text-blue-700 rounded text-sm hover:bg-blue-200"
                  >
                    Modifier
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
