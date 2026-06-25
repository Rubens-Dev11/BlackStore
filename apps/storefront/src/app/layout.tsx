import type { Metadata } from 'next';
import { QueryProvider } from '@/providers/query-provider';
import { Header } from '@/components/layout/header';
import './globals.css';

export const metadata: Metadata = {
  title: 'BlackStore — Produits Numériques',
  description:
    'Achetez des applications Android, logiciels Desktop et outils numériques. Paiement Mobile Money sécurisé.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr">
      <body className="font-sans bg-zinc-950 text-zinc-100 antialiased">
        <QueryProvider>
            <Header />
          {children}
        </QueryProvider>
      </body>
    </html>
  );
}

