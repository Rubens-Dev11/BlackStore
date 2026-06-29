import type { Metadata } from 'next';
import { CheckoutPageClient } from './checkout-page-client';

export const metadata: Metadata = {
  title: 'Finaliser ma commande',
  description: 'Complétez votre achat en toute sécurité. Livraison instantanée par email.',
};

export default function CheckoutPage() {
  return <CheckoutPageClient />;
}
