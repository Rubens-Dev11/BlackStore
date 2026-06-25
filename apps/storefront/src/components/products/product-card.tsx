'use client';
import Link from 'next/link';
import Image from 'next/image';
import { Star, Download } from 'lucide-react';
import { formatFcfa } from '@/lib/format';
import type { ProductSummary } from '@/lib/api/products';

const PLATFORM_LABEL: Record<ProductSummary['platform'], string> = {
  android: '📱 Android',
  desktop: '💻 Desktop',
  multiplatform: '🌐 Multi',
};

interface ProductCardProps {
  product: ProductSummary;
}

export function ProductCard({ product }: ProductCardProps) {
  const hasDiscount =
    product.originalPrice !== null && product.originalPrice > product.price;

  return (
    <Link
      href={`/produits/${product.slug}`}
      className="group flex flex-col overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900 transition-all duration-200 hover:-translate-y-1 hover:border-orange-500/50 hover:shadow-lg hover:shadow-orange-500/10"
    >
      {/* Image */}
      <div className="relative aspect-video w-full overflow-hidden bg-zinc-800">
        {product.coverImageUrl ? (
          <Image
            src={product.coverImageUrl}
            alt={product.name}
            fill
            className="object-cover transition-transform duration-300 group-hover:scale-105"
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-4xl text-zinc-600">
            📦
          </div>
        )}
        {/* Badge plateforme */}
        <span className="absolute left-2 top-2 rounded-full bg-zinc-900/90 px-2 py-0.5 text-xs text-zinc-300">
          {PLATFORM_LABEL[product.platform]}
        </span>
        {/* Badge featured */}
        {product.isFeatured && (
          <span className="absolute right-2 top-2 rounded-full bg-orange-500 px-2 py-0.5 text-xs font-semibold text-white">
            ⭐ Vedette
          </span>
        )}
      </div>
      {/* Contenu */}
      <div className="flex flex-1 flex-col gap-2 p-4">
        <h3 className="line-clamp-2 text-sm font-semibold text-white group-hover:text-orange-400">
          {product.name}
        </h3>
        {product.shortDescription && (
          <p className="line-clamp-2 text-xs text-zinc-400">
            {product.shortDescription}
          </p>
        )}
        {/* Stats */}
        <div className="mt-auto flex items-center gap-3 pt-2 text-xs text-zinc-500">
          {(product.ratingCount ?? 0) > 0 && (
            <span className="flex items-center gap-1">
              <Star className="h-3 w-3 fill-orange-400 text-orange-400" />
              {(product.ratingAvg ?? 0).toFixed(1)} ({product.ratingCount})
            </span>
          )}
          <span className="flex items-center gap-1">
            <Download className="h-3 w-3" />
            {(product.downloadCount ?? 0).toLocaleString('fr-FR')}
          </span>
        </div>
        {/* Prix */}
        <div className="flex items-baseline gap-2 pt-1">
          <span className="text-lg font-bold text-orange-400">
            {formatFcfa(product.price)}
          </span>
          {hasDiscount && (
            <span className="text-xs text-zinc-500 line-through">
              {formatFcfa(product.originalPrice!)}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}