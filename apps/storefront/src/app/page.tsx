'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, Loader2 } from 'lucide-react';
import { ProductCard } from '@/components/products/product-card';
import { fetchProducts } from '@/lib/api/products';
import { fetchCategories } from '@/lib/api/categories';

export default function HomePage() {
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Debounce recherche 400ms
  const handleSearchChange = (value: string) => {
    setSearch(value);
    clearTimeout((handleSearchChange as any)._t);
    (handleSearchChange as any)._t = setTimeout(() => setDebouncedSearch(value), 400);
  };

  const { data: categoriesData } = useQuery({
    queryKey: ['categories'],
    queryFn: fetchCategories,
    staleTime: 5 * 60 * 1000,
  });

  const { data: productsData, isLoading } = useQuery({
    queryKey: ['products', selectedCategoryId, debouncedSearch],
    queryFn: () =>
      fetchProducts({
        categoryId: selectedCategoryId ?? undefined,
        search: debouncedSearch || undefined,
      }),
    staleTime: 60 * 1000,
  });

  const categories = categoriesData ?? [];
  const products = productsData?.data ?? [];

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      {/* Hero */}
      <section className="mb-10 text-center">
        <h1 className="mb-3 text-4xl font-bold tracking-tight text-white">
          Applications & Logiciels
          <span className="text-orange-500"> Premium</span>
        </h1>
        <p className="text-zinc-400">
          APK Android, logiciels Desktop, outils numériques — paiement Mobile Money
        </p>
      </section>

      {/* Barre de recherche */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
        <input
          type="text"
          value={search}
          onChange={(e) => handleSearchChange(e.target.value)}
          placeholder="Rechercher un produit..."
          className="w-full rounded-lg border border-zinc-700 bg-zinc-800 py-2.5 pl-10 pr-4 text-sm text-white placeholder-zinc-500 outline-none transition-colors focus:border-orange-500"
        />
      </div>

      {/* Filtres catégories */}
      {categories.length > 0 && (
        <div className="mb-8 flex flex-wrap gap-2">
          <button
            onClick={() => setSelectedCategoryId(null)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
              selectedCategoryId === null
                ? 'bg-orange-500 text-white'
                : 'border border-zinc-700 text-zinc-400 hover:border-orange-500 hover:text-white'}`}
          >
            Tous
          </button>
          {categories
            .filter((c) => c.isActive)
            .sort((a, b) => a.sortOrder - b.sortOrder)
            .map((cat) => (
              <button
                key={cat.id}
                onClick={() =>
                  setSelectedCategoryId(
                    selectedCategoryId === cat.id ? null : cat.id,
                  )
                }
                className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                  selectedCategoryId === cat.id
                    ? 'bg-orange-500 text-white'
                    : 'border border-zinc-700 text-zinc-400 hover:border-orange-500 hover:text-white'}`}
              >
                {cat.name}
              </button>
            ))}
        </div>
      )}

      {/* Grille produits */}
      {isLoading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
        </div>
      ) : products.length === 0 ? (
        <div className="py-24 text-center text-zinc-500">
          <p className="text-lg">Aucun produit trouvé</p>
          {(selectedCategoryId || debouncedSearch) && (
            <button
              onClick={() => {
                setSelectedCategoryId(null);
                setSearch('');
                setDebouncedSearch('');
              }}
              className="mt-3 text-sm text-orange-400 hover:underline"
            >
              Effacer les filtres
            </button>
          )}
        </div>
      ) : (
        <>
          <p className="mb-4 text-sm text-zinc-500">
            {productsData?.total ?? products.length} produit
            {(productsData?.total ?? products.length) > 1 ? 's' : ''}
          </p>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
