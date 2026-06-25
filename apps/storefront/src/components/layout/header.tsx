'use client';
import Link from 'next/link';
import { ShoppingCart } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useCartStore } from '@/stores/use-cart-store';

export function Header() {
  const [mounted, setMounted] = useState(false);
  const itemCount = useCartStore((state) => state.getItemCount());

  useEffect(() => setMounted(true), []);

  return (
    <header className="sticky top-0 z-50 border-b border-zinc-800 bg-zinc-950/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
        <Link href="/" className="text-xl font-bold tracking-tight text-white">
          Black<span className="text-orange-500">Store</span>
        </Link>
        <nav className="flex items-center gap-6">
          <Link href="/" className="text-sm text-zinc-400 transition-colors hover:text-white">
            Accueil
          </Link>
          <Link
            href="/panier"
            className="relative text-zinc-400 transition-colors hover:text-white"
            aria-label="Panier"
          >
            <ShoppingCart className="h-5 w-5" />
            {mounted && itemCount > 0 && (
              <span className="absolute -right-2 -top-2 flex h-4 w-4 items-center justify-center rounded-full bg-orange-500 text-[10px] font-bold text-white">
                {itemCount > 9 ? '9+' : itemCount}
              </span>
            )}
          </Link>
        </nav>
      </div>
    </header>
  );
}