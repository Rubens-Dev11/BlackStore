'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import {
  ShoppingCart,
  Zap,
  Star,
  Download,
  Monitor,
  Smartphone,
  Globe,
  ArrowLeft,
  CheckCircle2,
} from 'lucide-react';
import { formatFcfa } from '@/lib/format';
import { useCartStore } from '@/stores/use-cart-store';
import { trackPageView } from '@/lib/api/products';
import type { ProductDetail } from '@/lib/api/products';
import { toast } from 'sonner';
import { ReviewForm } from '@/components/reviews/review-form';
import { ReviewList } from '@/components/reviews/review-list';
import { fetchReviews, ReviewResponse } from '@/lib/api/reviews';

const PLATFORM_ICON = {
  android: <Smartphone className="h-4 w-4" />,
  desktop: <Monitor className="h-4 w-4" />,
  multiplatform: <Globe className="h-4 w-4" />,
};

const PLATFORM_LABEL = {
  android: 'Android APK',
  desktop: 'Desktop',
  multiplatform: 'Multi-plateforme',
};

interface Props {
  product: ProductDetail;
}

export function ProductPageClient({ product }: Props) {
  const router = useRouter();
  const addItem = useCartStore((s) => s.addItem);
  const [addedToCart, setAddedToCart] = useState(false);
  const [reviewsData, setReviewsData] = useState<ReviewResponse | null>(null);
  
  const loadReviews = async () => {
    try {
      const data = await fetchReviews(product.id);
      setReviewsData(data);
    } catch (error) {
      console.error('Failed to load reviews', error);
    }
  };

  // Tracking pageview (silencieux)
  useEffect(() => {
    trackPageView(product.id);
    loadReviews();
  }, [product.id]);

  const hasDiscount =
    product.originalPrice !== null && product.originalPrice > product.price;

  const handleAddToCart = () => {
    addItem({
      productId: product.id,
      name: product.name,
      slug: product.slug,
      price: product.price,
      coverImageUrl: product.coverImageUrl,
    });
    setAddedToCart(true);
    toast.success(`${product.name} ajouté au panier !`);
    setTimeout(() => setAddedToCart(false), 2000);
  };

  const handleBuyNow = () => {
    // Achat direct : vider sélection courante n'est pas nécessaire
    // On ajoute au panier puis on redirige vers /commande directement
    addItem({
      productId: product.id,
      name: product.name,
      slug: product.slug,
      price: product.price,
      coverImageUrl: product.coverImageUrl,
    });
    router.push('/commande');
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      {/* Retour */}
      <Link
        href="/"
        className="mb-6 inline-flex items-center gap-2 text-sm text-zinc-400 transition-colors hover:text-white"
      >
        <ArrowLeft className="h-4 w-4" />
        Retour au catalogue
      </Link>

      {/* Grille principale */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        {/* Colonne gauche — Image */}
        <div>
          <div className="relative w-full overflow-hidden rounded-xl bg-zinc-800 animate-fade-in md:aspect-video h-[400px] md:h-auto">
            {product.coverImageUrl ? (
              <Image
                src={product.coverImageUrl}
                alt={product.name}
                fill
                className="object-cover"
                sizes="(max-width: 1024px) 100vw, 50vw"
                priority
              />
            ) : (
              <div className="flex h-full items-center justify-center text-6xl text-zinc-600">
                📦
              </div>
            )}
          </div>

          {/* Screenshots miniatures */}
          {product.screenshots.length > 0 && (
            <div className="mt-3 flex gap-2 overflow-x-auto pb-1 animate-fade-in" style={{ animationDelay: '0.25s' }}>
              {product.screenshots.map((url, i) => {
                // Handle screenshot URL: if it's already an absolute URL, use it; otherwise skip
                const screenshotUrl = url.startsWith('http') ? url : null;

                if (!screenshotUrl) {
                  return null; // Skip invalid URLs
                }

                return (
                  <div
                    key={i}
                    className="relative h-16 w-28 flex-shrink-0 overflow-hidden rounded-lg border border-zinc-700 bg-zinc-800"
                  >
                    <img
                      src={screenshotUrl}
                      alt={`Screenshot ${i + 1}`}
                      className="object-cover w-full h-full"
                    />
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Colonne droite — Infos + CTA */}
        <div className="flex flex-col gap-4 animate-slide-in-left" style={{ animationDelay: '0.1s' }}>
          {/* Badges */}
          <div className="flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-zinc-700 px-3 py-1 text-xs text-zinc-400">
              {PLATFORM_ICON[product.platform]}
              {PLATFORM_LABEL[product.platform]}
            </span>
            {product.version && (
              <span className="rounded-full border border-zinc-700 px-3 py-1 text-xs text-zinc-400">
                v{product.version}
              </span>
            )}
            {product.fileSizeMb && (
              <span className="rounded-full border border-zinc-700 px-3 py-1 text-xs text-zinc-400">
                {product.fileSizeMb} MB
              </span>
            )}
          </div>

          {/* Titre */}
          <h1 className="text-2xl sm:text-3xl font-bold text-white lg:text-4xl">
            {product.name}
          </h1>

          {/* Description courte */}
          {product.shortDescription && (
            <p className="text-base sm:text-lg text-zinc-400">{product.shortDescription}</p>
          )}

          {/* Stats */}
          <div className="flex gap-4 text-base sm:text-lg text-zinc-500">
            {parseInt(String(product.ratingCount ?? '0')) > 0 && (
              <span className="flex items-center gap-1">
                <Star className="h-4 w-4 fill-orange-400 text-orange-400" />
                <span className="font-medium text-white">
                    {parseFloat(String(product.ratingAvg ?? '0')).toFixed(1)}
                  </span>
                <span>({parseInt(String(product.ratingCount ?? '0'))} avis)</span>
              </span>
            )}
            <span className="flex items-center gap-1">
              <Download className="h-4 w-4" />
              {parseInt(String(product.downloadCount ?? '0')).toLocaleString('fr-FR')} téléchargements
            </span>
          </div>

          {/* Prix */}
          <div className="flex items-baseline gap-3">
            <span className="text-2xl sm:text-3xl font-bold text-orange-400">
              {formatFcfa(product.price)}
            </span>
            {hasDiscount && (
              <>
                <span className="text-base sm:text-lg text-zinc-500 line-through">
                  {formatFcfa(product.originalPrice!)}
                </span>
                <span className="rounded-full bg-green-900/50 px-2 py-0.5 text-xs font-semibold text-green-400">
                  -{Math.round(((product.originalPrice! - product.price) / product.originalPrice!) * 100)}%
                </span>
              </>
            )}
          </div>

          {/* Boutons CTA */}
          <div className="flex flex-col gap-3 sm:flex-row animate-fade-in" style={{ animationDelay: '0.2s' }}>
            {product.price === 0 ? (
              <button
                onClick={handleBuyNow}
                className="flex flex-1 w-full sm:w-auto items-center justify-center gap-2 rounded-lg bg-orange-500 px-6 py-3 font-semibold text-white transition-colors hover:bg-orange-600 active:scale-95"
              >
                <Download className="h-4 w-4" />
                Télécharger maintenant
              </button>
            ) : (
              <button
                onClick={handleBuyNow}
                className="flex flex-1 w-full sm:w-auto items-center justify-center gap-2 rounded-lg bg-orange-500 px-6 py-3 font-semibold text-white transition-colors hover:bg-orange-600 active:scale-95"
              >
                <Zap className="h-4 w-4" />
                Acheter maintenant
              </button>
            )}
            <button
              onClick={handleAddToCart}
              className={`flex flex-1 w-full sm:w-auto items-center justify-center gap-2 rounded-lg border px-6 py-3 font-semibold transition-all ${
                addedToCart
                  ? 'border-green-500 bg-green-900/30 text-green-400'
                  : 'border-zinc-600 text-zinc-300 hover:border-orange-500 hover:text-white'}`}
            >
              {addedToCart ? (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  Ajouté !
                </>
              ) : (
                <>
                  <ShoppingCart className="h-4 w-4" />
                  Ajouter au panier
                </>
              )}
            </button>
          </div>

          {/* Tags */}
          {product.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {product.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full bg-zinc-800 px-2.5 py-1 text-xs text-zinc-400"
                >
                  #{tag}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Description complète */}
      {product.description && (
        <section className="mt-10">
          <h2 className="mb-3 text-xl font-semibold text-white">
            Description
          </h2>
          <div
            className="prose prose-invert max-w-none text-zinc-400"
            dangerouslySetInnerHTML={{ __html: product.description }}
          />
        </section>
      )}

      {/* Configuration minimale */}
      {product.minRequirements && (
        <section className="mt-8 rounded-xl border border-zinc-800 bg-zinc-900 p-5">
          <h2 className="mb-3 text-lg font-semibold text-white">
            Configuration requise
          </h2>
          <p className="whitespace-pre-wrap text-sm text-zinc-400">
            {typeof product.minRequirements === 'object'
              ? JSON.stringify(product.minRequirements, null, 2)
              : product.minRequirements}
          </p>
        </section>
      )}

      {/* Guide d'installation */}
      {product.installGuide && (
        <section className="mt-8">
          <h2 className="mb-3 text-xl font-semibold text-white">
            Guide d&apos;installation
          </h2>
          <div
            className="prose prose-invert max-w-none text-zinc-400"
            dangerouslySetInnerHTML={{ __html: product.installGuide }}
          />
        </section>
      )}

      {/* Section Avis */}
      <section className="mt-12 border-t border-zinc-800 pt-10">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-2">
          {/* Liste des avis */}
          <div>
            <h2 className="mb-6 text-2xl font-bold text-white">Avis des clients</h2>
            {reviewsData ? (
              <ReviewList 
                reviews={reviewsData.reviews} 
                ratingAvg={reviewsData.ratingAvg} 
                ratingCount={reviewsData.ratingCount} 
              />
            ) : (
              <p className="text-zinc-500">Chargement des avis...</p>
            )}
          </div>

          {/* Formulaire */}
          <div>
            <ReviewForm productId={product.id} onSuccess={loadReviews} />
          </div>
        </div>
      </section>
    </div>
  );
}