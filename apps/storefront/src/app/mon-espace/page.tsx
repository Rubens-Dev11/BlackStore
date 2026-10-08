import type { Metadata } from 'next';
import { ClientSpace } from './client-space';

export const metadata: Metadata = {
  title: 'Mes achats',
  description: 'Retrouvez vos achats, vos liens de téléchargement et vos demandes de remboursement.',
  robots: { index: false },
};

export default function ClientSpacePage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-3xl font-bold text-white">Mes achats</h1>
      <p className="mb-8 mt-2 text-sm text-zinc-500">Tous les produits achetés avec votre adresse e-mail, leurs liens de téléchargement et vos demandes de remboursement.</p>
      <ClientSpace />
    </main>
  );
}
