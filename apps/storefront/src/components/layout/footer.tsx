import Link from 'next/link';
import { LEGAL_LINKS } from '@/components/legal/legal-page';

/** Bas de page : liens vers les conditions, la confidentialité et le contact. */
export function Footer() {
  return (
    <footer className="mt-16 border-t border-zinc-800 bg-zinc-950">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-8 text-sm text-zinc-500 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="font-semibold text-white">
            Black<span className="text-orange-500">Store</span>
          </p>
          <p className="mt-1 text-xs">Produits numériques vérifiés · Paiement Mobile Money</p>
        </div>
        <nav aria-label="Informations" className="flex flex-wrap gap-x-5 gap-y-2">
          {LEGAL_LINKS.map((link) => (
            <Link key={link.href} href={link.href} className="transition-colors hover:text-white">
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
      <p className="pb-6 text-center text-xs text-zinc-600">© {new Date().getFullYear()} BlackStore</p>
    </footer>
  );
}
