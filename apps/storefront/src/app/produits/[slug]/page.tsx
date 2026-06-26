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
    return {
      title: product.seoTitle ?? `${product.name} — BlackStore`,
      description:
        product.seoDescription ?? product.shortDescription ?? undefined,
      openGraph: {
        title: product.seoTitle ?? product.name,
        description: product.seoDescription ?? product.shortDescription ?? '',
        images: product.coverImageUrl ? [product.coverImageUrl] : [],
      },
    };
  } catch {
    return { title: 'Produit — BlackStore' };
  }
}

export default async function ProductPage({ params }: Props) {
  let product;
  try {
    product = await fetchProductBySlug(params.slug);
  } catch {
    notFound();
  }
  return <ProductPageClient product={product} />;
}
