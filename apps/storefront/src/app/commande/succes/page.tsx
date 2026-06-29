import type { Metadata } from 'next';
import { OrderSuccessClient } from './order-success-client';

export const metadata: Metadata = {
  title: 'Commande confirmée ✓',
  description: 'Votre commande a été confirmée. Téléchargez vos produits numériques dès maintenant.',
  robots: { index: false },
};

export default function OrderSuccessPage() {
  return <OrderSuccessClient />;
}