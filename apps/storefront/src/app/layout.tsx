import type { Metadata } from 'next';
import { QueryProvider } from '@/providers/query-provider';
import { Header } from '@/components/layout/header';
import './globals.css';
import { Toaster } from 'sonner';

export const metadata: Metadata = {
  title: {
    default: 'BlackStore — Produits Numériques',
    template: '%s | BlackStore',
  },
  description:
    'Téléchargez les meilleurs APK Android, logiciels Desktop et produits numériques au Cameroun. Paiement Mobile Money sécurisé.',
  keywords: [
    'APK',
    'Android',
    'logiciels',
    'produits numériques',
    'Cameroun',
    'BlackStore',
  ],
  openGraph: {
    siteName: 'BlackStore',
    locale: 'fr_CM',
    type: 'website',
  },
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
            <div className="animate-fade-in">
              {children}
            </div>
            <Toaster position="top-right" richColors duration={3000} />
        </QueryProvider>
      </body>
    </html>
  );
}