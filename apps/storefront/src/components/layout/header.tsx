'use client';
import Link from 'next/link';
import { ShoppingCart, Menu, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useCartStore } from '@/stores/use-cart-store';

export function Header() {
  const [mounted, setMounted] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const itemCount = useCartStore((state) => state.getItemCount());

  useEffect(() => setMounted(true), []);

  return (
    <header className="sticky top-0 z-50 border-b border-zinc-800 bg-zinc-950/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
        <Link href="/" className="text-2xl font-bold tracking-tight text-white md:text-3xl">
          Black<span className="text-orange-500">Store</span>
        </Link>

        {/* Mobile menu button */}
        <button
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          className="md:hidden p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800/50"
          aria-label="Open menu"
        >
          {isMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
        </button>

        {/* Desktop navigation */}
        <nav className="hidden md:flex items-center gap-6">
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

      {/* Mobile menu dropdown */}
      {isMenuOpen && (
        <div className="md:hidden fixed inset-0 z-40 flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-xs space-y-4">
            <Link href="/" className="block px-4 py-3 text-left text-base font-medium text-white hover:text-orange-500">
              Accueil
            </Link>
            <Link
              href="/panier"
              className="block px-4 py-3 text-left text-base font-medium text-white hover:text-orange-500 relative"
            >
              <span className="mr-2">
                <ShoppingCart className="h-4 w-4" />
              </span>
              Panier
              {itemCount > 0 && (
                <span className="ml-2 inline-flex h-4 w-4 items-center justify-center rounded-full bg-orange-500 text-xs font-bold text-white">
                  {itemCount > 9 ? '9+' : itemCount}
                </span>
              )}
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}