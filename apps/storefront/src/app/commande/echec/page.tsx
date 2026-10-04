import type { Metadata } from 'next';
import { OrderFailureClient } from './order-failure-client';

export const metadata: Metadata = {
  title: 'Paiement non abouti',
  description: "Le paiement de votre commande n'a pas abouti.",
  robots: { index: false },
};

export default function OrderFailurePage() {
  return <OrderFailureClient />;
}