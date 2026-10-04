import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { fetchProductBySlug } from '@/lib/api/products';
import { ProductPageClient } from './product-page-client';

interface Props {
  params: { slug: string };
}

export const dynamicParams = true;
export const revalidate = 0;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  try {
    const product = await fetchProductBySlug(params.slug);
    if (!product) {
      return {
        title: 'Produit introuvable',
        description: "Ce produit n'existe pas ou a été supprimé.",
      };
    }
    const title = product.seoTitle || product.name;
    const description =
      product.seoDescription ||
      product.shortDescription ||
      `Téléchargez ${product.name} sur BlackStore.`;

    return {
      title,
      description,
      openGraph: {
        title,
        description,
        images: product.coverImageUrl ? [{ url: product.coverImageUrl }] : [],
        type: 'website',
      },
      twitter: {
        card: 'summary_large_image',
        title,
        description,
        images: product.coverImageUrl ? [product.coverImageUrl] : [],
      },
    };
  } catch {
    // API injoignable : la page affichera l'erreur avec « Réessayer ».
    return { title: 'Page momentanément indisponible' };
  }
}

export default async function ProductPage({ params }: Props) {
  // Produit absent : page « introuvable » ; API en panne : page d'erreur (avec « Réessayer »).
  const product = await fetchProductBySlug(params.slug);
  if (!product) {
    notFound();
  }
  return <ProductPageClient product={product} />;
}
