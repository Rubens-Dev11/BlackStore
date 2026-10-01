import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Facebook, Instagram, MessageCircle, Store } from 'lucide-react';
import { ProductCard } from '@/components/products/product-card';
import { fetchStoreBySlug } from '@/lib/api/stores';

interface Props {
  params: { slug: string };
}

export const dynamicParams = true;
export const revalidate = 0;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const store = await fetchStoreBySlug(params.slug).catch(() => null);
  if (!store) {
    return { title: 'Boutique introuvable' };
  }
  const description = store.description?.slice(0, 160) || `Les produits numériques de ${store.name} sur BlackStore.`;
  return {
    // Le modèle du layout ajoute « | BlackStore ».
    title: `${store.name} — Boutique`,
    description,
    openGraph: {
      title: store.name,
      description,
      images: store.logoUrl ? [{ url: store.logoUrl }] : [],
      type: 'website',
    },
  };
}

const LINK_CLASS =
  'inline-flex items-center gap-2 rounded-lg border border-zinc-700 px-3 py-1.5 text-sm text-zinc-300 transition-colors hover:border-orange-500 hover:text-white';

export default async function StorePage({ params }: Props) {
  const store = await fetchStoreBySlug(params.slug);
  if (!store) {
    notFound();
  }

  // Lien WhatsApp : wa.me attend le numéro international sans « + ».
  const whatsappUrl = store.whatsapp ? `https://wa.me/${store.whatsapp.replace(/\D/g, '')}` : null;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <Link href="/" className="mb-6 inline-flex items-center gap-2 text-sm text-zinc-400 transition-colors hover:text-white">
        <ArrowLeft className="h-4 w-4" />
        Tout le catalogue
      </Link>

      <header className="mb-10 flex flex-col gap-6 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 sm:flex-row sm:items-center">
        <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-zinc-700 bg-zinc-800">
          {store.logoUrl ? (
            // Image servie par le stockage via une adresse signée : pas d'optimisation Next nécessaire.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={store.logoUrl} alt={`Logo de ${store.name}`} className="h-full w-full object-cover" />
          ) : (
            <Store className="h-10 w-10 text-zinc-500" aria-hidden="true" />
          )}
        </div>
        <div className="min-w-0 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-orange-400">Boutique</p>
          <h1 className="text-2xl font-bold text-white sm:text-3xl">{store.name}</h1>
          {store.description && <p className="max-w-3xl whitespace-pre-line text-zinc-400">{store.description}</p>}
          {(store.facebookUrl || store.instagramUrl || store.tiktokUrl || whatsappUrl) && (
            <div className="flex flex-wrap gap-2 pt-1">
              {store.facebookUrl && (
                <a href={store.facebookUrl} target="_blank" rel="noopener noreferrer nofollow" className={LINK_CLASS}>
                  <Facebook className="h-4 w-4" /> Facebook
                </a>
              )}
              {store.instagramUrl && (
                <a href={store.instagramUrl} target="_blank" rel="noopener noreferrer nofollow" className={LINK_CLASS}>
                  <Instagram className="h-4 w-4" /> Instagram
                </a>
              )}
              {store.tiktokUrl && (
                <a href={store.tiktokUrl} target="_blank" rel="noopener noreferrer nofollow" className={LINK_CLASS}>
                  TikTok
                </a>
              )}
              {whatsappUrl && (
                <a href={whatsappUrl} target="_blank" rel="noopener noreferrer nofollow" className={LINK_CLASS}>
                  <MessageCircle className="h-4 w-4" /> WhatsApp
                </a>
              )}
            </div>
          )}
        </div>
      </header>

      <h2 className="mb-4 text-xl font-semibold text-white">
        Produits {store.products.length > 0 && <span className="text-zinc-500">({store.products.length})</span>}
      </h2>
      {store.products.length > 0 ? (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {store.products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-zinc-700 p-12 text-center text-zinc-400">
          Cette boutique n'a pas encore de produit en vente.
        </div>
      )}
    </div>
  );
}
