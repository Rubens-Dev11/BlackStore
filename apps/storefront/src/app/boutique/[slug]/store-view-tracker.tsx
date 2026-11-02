'use client';
import { useEffect } from 'react';
import { trackPageView } from '@/lib/api/products';

/** Compte la visite de la page boutique dans les statistiques du vendeur (rien n'est affiché). */
export function StoreViewTracker({ slug }: { slug: string }) {
  useEffect(() => {
    trackPageView({ storeSlug: slug });
  }, [slug]);
  return null;
}
