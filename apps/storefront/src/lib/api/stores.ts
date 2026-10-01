import { getServerApiUrl } from '@/lib/env';
import type { ProductSummary } from '@/lib/api/products';

export interface StorePublic {
  name: string;
  slug: string;
  description: string | null;
  logoUrl: string | null;
  facebookUrl: string | null;
  instagramUrl: string | null;
  tiktokUrl: string | null;
  whatsapp: string | null;
  createdAt: string;
  products: ProductSummary[];
}

/** Boutique publique (appelée côté serveur) ; null si elle n'existe pas ou n'est pas visible. */
export async function fetchStoreBySlug(slug: string): Promise<StorePublic | null> {
  const res = await fetch(`${getServerApiUrl()}/stores/${encodeURIComponent(slug)}`, { cache: 'no-store' });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error('Erreur chargement boutique');
  return res.json();
}
