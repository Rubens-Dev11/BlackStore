import { getApiUrl, getServerApiUrl } from '@/lib/env';

const getBaseUrl = () => {
  // eslint-disable-next-line no-restricted-globals
  if (typeof window !== 'undefined') {
    // client-side
    return getApiUrl();
  }
  // server-side
  return getServerApiUrl();
};

export interface ProductSummary {
  id: string;
  name: string;
  slug: string;
  shortDescription: string | null;
  coverImageUrl: string | null;
  price: number;
  originalPrice: number | null;
  platform: 'android' | 'desktop' | 'multiplatform';
  ratingAvg: number;
  ratingCount: number;
  downloadCount: number;
  isFeatured: boolean;
  categoryId: string | null;
  fileSizeMb: number | null;
}

export interface ProductDetail extends ProductSummary {
  description: string | null;
  screenshots: string[];
  demoVideoUrl: string | null;
  installGuide: string | null;
  tags: string[];
  version: string | null;
  fileSizeMb: number | null;
  minRequirements: any; // Prisma Json type
  viewCount: number;
  seoTitle: string | null;
  seoDescription: string | null;
  /** Boutique du vendeur ; null pour les produits vendus par BlackStore. */
  store: { name: string; slug: string } | null;
}

export async function fetchProducts(params?: {
  categoryId?: string;
  search?: string;
}): Promise<{ data: ProductSummary[]; total: number; page: number; limit: number }> {
  // L'API supporte page/limit/categoryId/featured en query params (voir ProductQueryDto).
  // On demande la limite max (100) pour récupérer tout le catalogue actif en un seul appel.
  // Le filtrage catégorie/recherche reste côté client (le backend ne fait pas de recherche texte).
  const res = await fetch(`${getBaseUrl()}/products?limit=100`, { cache: 'no-store' });
  if (!res.ok) throw new Error('Erreur chargement produits');

  const result: { data: ProductSummary[]; total: number; page: number; limit: number } =
    await res.json();

  // Filtrage client-side par catégorie
  if (params?.categoryId) {
    result.data = result.data.filter((p) => p.categoryId === params.categoryId);
  }

  // Filtrage client-side par recherche (name, shortDescription)
  if (params?.search) {
    const q = params.search.toLowerCase();
    result.data = result.data.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.shortDescription ?? '').toLowerCase().includes(q),
    );
  }

  result.total = result.data.length;
  return result;
}

export async function fetchFeaturedProducts(): Promise<ProductSummary[]> {
  const res = await fetch(`${getBaseUrl()}/products/featured`, { cache: 'no-store' });
  if (!res.ok) throw new Error('Erreur produits vedettes');
  return res.json();
}

export async function fetchProductBySlug(slug: string): Promise<ProductDetail> {
    const res = await fetch(`${getBaseUrl()}/products/${slug}`, { cache: 'no-store' });
    if (!res.ok) throw new Error('Produit introuvable');
    return res.json();
  }

export async function trackPageView(productId: string): Promise<void> {
  try {
    await fetch(`${getBaseUrl()}/analytics/pageview`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId }),
    });
  } catch {
    // silencieux — ne jamais bloquer l'affichage pour un tracking
  }
}

