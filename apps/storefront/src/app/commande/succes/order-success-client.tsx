"use client";

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { formatFcfa } from '@/lib/format';

interface DownloadToken {
  token: string;
  expiresAt: string;
  downloadCount: number;
  maxDownloads: number;
}

interface OrderItem {
  product: {
    name: string;
    slug: string;
  };
  downloadTokens: DownloadToken[];
}

interface Order {
  id: string;
  orderNumber: string;
  status: 'paid' | 'pending' | 'failed' | 'refunded';
  buyerName: string;
  buyerEmail: string;
  totalAmount: number;
  items: OrderItem[];
}

export function OrderSuccessClient() {
  const router = useRouter();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const pendingOrder = sessionStorage.getItem('blackstore_pending_order');
    if (!pendingOrder) {
      router.push('/');
      return;
    }

    let parsedOrder;
    try {
      parsedOrder = JSON.parse(pendingOrder);
      const { orderNumber, buyerEmail } = parsedOrder;
      if (!orderNumber || !buyerEmail) {
        router.push('/');
        return;
      }

      const fetchOrder = async () => {
        try {
          const response = await fetch(
            `${process.env.NEXT_PUBLIC_API_URL}/orders/by-number/${orderNumber}?email=${buyerEmail}`,
            { credentials: 'omit' }
          );

          if (!response.ok) {
            if (response.status === 404 || response.status === 400) {
              setError(true);
            } else {
              router.push('/');
            }
            return;
          }

          const data = await response.json();
          setOrder(data);

          if (data.status === 'paid') {
            sessionStorage.removeItem('blackstore_pending_order');
          } else if (data.status === 'pending') {
            router.push('/commande/en-attente');
          } else if (data.status === 'failed') {
            router.push('/commande/echec');
          }
        } catch (err) {
          router.push('/');
        } finally {
          setLoading(false);
        }
      };

      fetchOrder();
    } catch (err) {
      router.push('/');
    }
  }, [router]);

  if (loading) {
    return (
      <main className="min-h-screen p-8 text-white">
        <div className="container mx-auto text-center py-16">
          <p className="text-xl">Chargement de votre commande...</p>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen p-8 text-white">
        <div className="container mx-auto text-center py-16">
          <p className="text-xl mb-4">Commande introuvable.</p>
          <a href="/" className="text-blue-400 hover:underline">
            Retour à l'accueil
          </a>
        </div>
      </main>
    );
  }

  if (!order || order.status !== 'paid') {
    return null;
  }

  return (
    <main className="min-h-screen p-8 text-white">
      <div className="container mx-auto py-8">
        <h1 className="text-3xl font-bold mb-8">Commande #{order.orderNumber}</h1>
        <div className="bg-gray-800 rounded-lg p-6 mb-6">
          <p className="text-lg mb-2">
            <span className="font-semibold">Acheteur :</span> {order.buyerName}
          </p>
          <p className="text-lg mb-2">
            <span className="font-semibold">Email :</span> {order.buyerEmail}
          </p>
          <p className="text-lg">
            <span className="font-semibold">Montant total :</span> {formatFcfa(order.totalAmount)}
          </p>
        </div>

        <h2 className="text-2xl font-bold mb-6">Vos produits</h2>
        <div className="space-y-6">
          {order.items.map((item, index) => (
            <div key={index} className="bg-gray-800 rounded-lg p-6">
              <h3 className="text-xl font-semibold mb-4">{item.product.name}</h3>
              <div className="space-y-4">
                {item.downloadTokens.map((token, tokenIndex) => (
                  <div key={tokenIndex} className="border border-gray-600 rounded p-4">
                    <a
                      href={`${process.env.NEXT_PUBLIC_API_URL}/downloads/${token.token}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-block bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded mb-2"
                    >
                      Télécharger
                    </a>
                    <p className="text-sm text-gray-300">
                      Expire le : {new Date(token.expiresAt).toLocaleDateString('fr-FR')}
                    </p>
                    <p className="text-sm text-gray-300">
                      {token.downloadCount}/{token.maxDownloads} téléchargements utilisés
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
