import type { Metadata } from 'next';
import { CartPageClient } from './cart-page-client';

export const metadata: Metadata = {
  title: 'Mon Panier',
  description: 'Vérifiez et validez vos produits numériques avant de passer commande.',
};

export default function CartPage() {
  return <CartPageClient />;
}