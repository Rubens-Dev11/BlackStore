import type { Metadata } from 'next';
import { Inter } from 'next/font/google';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'BlackStore — Achetez vos produits numériques',
  description: 'Plateforme de vente de produits numériques (Applications, Logiciels) sécurisée et automatisée.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <body className={inter.className}>
        {/* Placeholder for Providers (TanStack Query, etc) and UI Frame (Header/Footer) */}
        <div className="flex flex-col min-h-screen">
          <header className="h-16 border-b flex items-center px-4 shrink-0 bg-background">
            <h1 className="text-xl font-bold tracking-tight">BlackStore</h1>
          </header>
          <main className="flex-1 container py-6 mx-auto">
            {children}
          </main>
          <footer className="border-t py-6 text-center text-sm text-muted-foreground">
            &copy; {new Date().getFullYear()} BlackStore. Tous droits réservés.
          </footer>
        </div>
      </body>
    </html>
  );
}
