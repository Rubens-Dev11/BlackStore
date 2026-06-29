import type { Metadata } from 'next';
import { HomePageClient } from './home-page-client';

export const metadata: Metadata = {
  title: 'Catalogue — Produits Numériques',
  description:
    'Découvrez notre catalogue de produits numériques : APK Android, logiciels Desktop, et plus encore.',
  openGraph: {
    title: 'BlackStore — Catalogue',
    description: 'Les meilleurs produits numériques pour le marché africain.',
    type: 'website',
  },
};

export default function HomePage() {
  return <HomePageClient />;
}