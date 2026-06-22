import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { QueryProvider } from '@/providers/query-provider';
import { getApiUrl, getSiteUrl } from '@/lib/env';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'BlackStore — Achetez vos produits numériques',
  description:
    'Plateforme de vente de produits numériques (Applications, Logiciels) sécurisée et automatisée.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <body className={inter.className}>
        <QueryProvider>
          <div className="flex min-h-screen flex-col">
            <header className="flex h-14 shrink-0 items-center border-b px-4">
              <div className="container mx-auto flex items-center justify-between">
                <h1 className="text-lg font-bold tracking-tight">BlackStore</h1>
                <span className="text-xs text-muted-foreground">
                  API: {getApiUrl()} · Site: {getSiteUrl()}
                </span>
              </div>
            </header>
            <main className="container mx-auto flex-1 py-6">{children}</main>
            <footer className="border-t py-4 text-center text-xs text-muted-foreground">
              &copy; {new Date().getFullYear()} BlackStore — Phase 0 (base frontend)
            </footer>
          </div>
        </QueryProvider>
      </body>
    </html>
  );
}
