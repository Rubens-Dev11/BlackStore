'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Trash2, Plus, Minus, ShoppingBag, ArrowRight } from 'lucide-react';
import { formatFcfa } from '@/lib/format';
import { useCartStore } from '@/stores/use-cart-store';

export default function CartPage() {
  const [mounted, setMounted] = useState(false);
  const { items, addItem, removeItem, clearCart, getTotalAmount, getItemCount } =
    useCartStore();

  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center text-zinc-500">
        Chargement du panier…
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-24 text-center">
        <ShoppingBag className="mx-auto mb-4 h-16 w-16 text-zinc-700" />
        <h1 className="mb-2 text-2xl font-bold text-white">
          Votre panier est vide
        </h1>
        <p className="mb-6 text-zinc-400">
          Parcourez notre catalogue pour trouver vos produits numériques.
        </p>
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-lg bg-orange-500 px-6 py-3 font-semibold text-white hover:bg-orange-600"
        >
          Découvrir les produits
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">
          Panier{' '}
          <span className="text-zinc-500 text-lg font-normal">
            ({getItemCount()} article{getItemCount() > 1 ? 's' : ''})
          </span>
        </h1>
        <button
          onClick={clearCart}
          className="flex items-center gap-1 text-sm text-zinc-500 transition-colors hover:text-red-400"
        >
          <Trash2 className="h-4 w-4" />
          Vider le panier
        </button>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Liste articles */}
        <div className="space-y-3 lg:col-span-2">
          {items.map((item) => (
            <div
              key={item.productId}
              className="flex gap-4 rounded-xl border border-zinc-800 bg-zinc-900 p-4"
            >
              {/* Image */}
              <div className="relative h-20 w-28 flex-shrink-0 overflow-hidden rounded-lg bg-zinc-800">
                {item.coverImageUrl ? (
                  <Image
                    src={item.coverImageUrl}
                    alt={item.name}
                    fill
                    className="object-cover"
                    sizes="112px"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-2xl text-zinc-600">
                    📦
                  </div>
                )}
              </div>

              {/* Infos */}
              <div className="flex flex-1 flex-col justify-between">
                <div>
                  <Link
                    href={`/produits/${item.slug}`}
                    className="font-semibold text-white hover:text-orange-400 transition-colors line-clamp-1"
                  >
                    {item.name}
                  </Link>
                  <p className="mt-1 text-sm text-orange-400 font-medium">
                    {formatFcfa(item.price)}
                  </p>
                </div>

                {/* Contrôle quantité */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        if (item.quantity <= 1) {
                          removeItem(item.productId);
                        } else {
                          // Décrémente : on utilise une approche directe via set
                          useCartStore.setState((s) => ({
                            items: s.items.map((i) =>
                              i.productId === item.productId
                                ? { ...i, quantity: i.quantity - 1 }
                                : i,
                            ),
                          }));
                        }
                      }}
                      className="flex h-7 w-7 items-center justify-center rounded-full border border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-white transition-colors"
                    >
                      <Minus className="h-3 w-3" />
                    </button>
                    <span className="w-6 text-center text-sm font-medium text-white">
                      {item.quantity}
                    </span>
                    <button
                      onClick={() => addItem({ ...item })}
                      className="flex h-7 w-7 items-center justify-center rounded-full border border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-white transition-colors"
                    >
                      <Plus className="h-3 w-3" />
                    </button>
                  </div>
                  <button
                    onClick={() => removeItem(item.productId)}
                    className="text-zinc-600 hover:text-red-400 transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Récapitulatif */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5 h-fit">
          <h2 className="mb-4 text-lg font-semibold text-white">Récapitulatif</h2>
          <div className="space-y-2 text-sm">
            {items.map((item) => (
              <div key={item.productId} className="flex justify-between text-zinc-400">
                <span className="line-clamp-1 flex-1 pr-2">
                  {item.name} × {item.quantity}
                </span>
                <span className="flex-shrink-0">
                  {formatFcfa(item.price * item.quantity)}
                </span>
              </div>
            ))}
          </div>

          <div className="my-4 border-t border-zinc-700" />

          <div className="mb-5 flex justify-between font-bold text-white">
            <span>Total</span>
            <span className="text-orange-400">{formatFcfa(getTotalAmount())}</span>
          </div>

          <Link
            href="/commande"
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-orange-500 py-3 font-semibold text-white hover:bg-orange-600 transition-colors"
          >
            Commander
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}