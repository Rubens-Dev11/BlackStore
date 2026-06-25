"use client";

import { useRouter } from 'next/navigation';
import { useEffect, useState, useRef } from 'react';

interface PendingOrder {
  orderNumber: string;
  buyerEmail: string;
}

interface OrderStatusResponse {
  status: 'paid' | 'pending' | 'failed' | 'refunded';
}

export default function OrderPendingPage() {
  const router = useRouter();
  const [pendingOrder, setPendingOrder] = useState<PendingOrder | null>(null);
  const [timedOut, setTimedOut] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const pendingOrderData = sessionStorage.getItem('blackstore_pending_order');
    if (!pendingOrderData) {
      router.push('/');
      return;
    }

    try {
      const parsedOrder = JSON.parse(pendingOrderData);
      const { orderNumber, buyerEmail } = parsedOrder;
      if (!orderNumber || !buyerEmail) {
        router.push('/');
        return;
      }

      setPendingOrder(parsedOrder);
      setLoading(false);

      const startPolling = async () => {
        try {
          const response = await fetch(
            `${process.env.NEXT_PUBLIC_API_URL}/orders/by-number/${orderNumber}?email=${buyerEmail}`,
            { credentials: 'omit' }
          );

          if (!response.ok) {
            throw new Error('Erreur lors de la récupération du statut de la commande');
          }

          const data: OrderStatusResponse = await response.json();

          if (data.status === 'paid') {
            sessionStorage.removeItem('blackstore_pending_order');
            router.push('/commande/succes');
          } else if (data.status === 'failed') {
            router.push('/commande/echec');
          }
        } catch (err) {
          console.error("Erreur lors de la vérification du statut de la commande :", err);
        }
      };

      intervalRef.current = setInterval(startPolling, 5000);
      timeoutRef.current = setTimeout(() => {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
        }
        setTimedOut(true);
      }, 600000);

      return () => {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
        }
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }
      };
    } catch (err) {
      router.push('/');
    }
  }, [router]);

  if (loading) {
    return (
      <main className="min-h-screen p-8 text-white">
        <div className="container mx-auto text-center py-16">
          <p className="text-xl">Vérification de votre paiement...</p>
        </div>
      </main>
    );
  }

  if (timedOut) {
    return (
      <main className="min-h-screen p-8 text-white">
        <div className="container mx-auto text-center py-16">
          <div className="mb-6">
            <span className="text-yellow-500 text-6xl">⚠️</span>
          </div>
          <h1 className="text-3xl font-bold mb-4">Délai d'attente dépassé</h1>
          <p className="text-lg mb-6">
            Nous n'avons pas reçu de confirmation dans les délais. Si vous avez été débité, contactez le support.
          </p>
          <button
            onClick={() => router.push('/')}
            className="bg-gray-600 hover:bg-gray-700 text-white font-semibold py-3 px-6 rounded"
          >
            Retour à l'accueil
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen p-8 text-white">
      <div className="container mx-auto text-center py-16">
        <div className="mb-6">
          <div className="flex justify-center gap-1">
            <div className="w-3 h-3 bg-white rounded-full animate-pulse"></div>
            <div className="w-3 h-3 bg-white rounded-full animate-pulse delay-100"></div>
            <div className="w-3 h-3 bg-white rounded-full animate-pulse delay-200"></div>
          </div>
        </div>
        <h1 className="text-3xl font-bold mb-4">En attente de confirmation</h1>
        <p className="text-lg mb-6">
          Nous attendons la confirmation de votre paiement. Cette page se met à jour automatiquement.
        </p>
        {pendingOrder && (
          <p className="text-lg mb-2">
            <span className="font-semibold">Référence :</span> {pendingOrder.orderNumber}
          </p>
        )}
        <p className="text-sm text-gray-400">Vérification toutes les 5 secondes...</p>
      </div>
    </main>
  );
}