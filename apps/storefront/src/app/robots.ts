import { MetadataRoute } from 'next';
import { getSiteUrl } from '@/lib/env';

export default function robots(): MetadataRoute.Robots {
  const baseUrl = getSiteUrl();

  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/panier/', '/commande/', '/admin/'],
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
