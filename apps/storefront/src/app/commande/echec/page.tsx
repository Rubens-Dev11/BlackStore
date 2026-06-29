import type { Metadata } from 'next';
import { OrderFailureClient } from './order-failure-client';

export const metadata: Metadata = {
  title: 'Paiement échoué',
  description: "Désolé, votre paiement n'a pas pu être traité. Veuillez réessayer.",
  robots: { index: false },
};

export default function OrderFailurePage() {
  return <OrderFailureClient />;
}