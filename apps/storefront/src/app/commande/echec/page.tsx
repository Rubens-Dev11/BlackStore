"use client";

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

interface PendingOrder {
  orderNumber: string;
  buyerEmail: string;
}

export default function OrderFailurePage() {
  const router = useRouter();
  const [pendingOrder, setPendingOrder] = useState<PendingOrder | null>(null);

  useEffect(() => {
    const pendingOrderData = sessionStorage.getItem('blackstore_pending_order');
    if (pendingOrderData) {
      try {
        const parsedOrder = JSON.parse(pendingOrderData);
        setPendingOrder(parsedOrder);
      } catch (err) {
        console.error("Erreur lors de l'analyse des données de la commande en attente :", err);
      }
    }
  }, []);

  return (
    <main className="min-h-screen p-8 text-white">
      <div className="container mx-auto text-center py-16">
        <div className="mb-6">
          <span className="text-red-500 text-6xl">❌</span>
        </div>
        <h1 className="text-3xl font-bold mb-4">Paiement échoué</h1>
        <p className="text-lg mb-6">Votre paiement n'a pas pu être traité. Aucun montant n'a été débité.</p>
        {pendingOrder && (
          <p className="text-lg mb-8">
            <span className="font-semibold">Référence :</span> {pendingOrder.orderNumber}
          </p>
        )}
        <div className="flex justify-center gap-4">
          <button
            onClick={() => router.push('/commande')}
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded"
          >
            Réessayer
          </button>
          <button
            onClick={() => router.push('/')}
            className="bg-gray-600 hover:bg-gray-700 text-white font-semibold py-3 px-6 rounded"
          >
            Retour à l'accueil
          </button>
        </div>
      </div>
    </main>
  );
}