import type { Metadata } from 'next';
import { OrderPendingClient } from './order-pending-client';

export const metadata: Metadata = {
  title: 'Paiement en attente...',
  description: 'Nous attendons la confirmation de votre paiement Mobile Money.',
  robots: { index: false },
};

export default function OrderPendingPage() {
  return <OrderPendingClient />;
}