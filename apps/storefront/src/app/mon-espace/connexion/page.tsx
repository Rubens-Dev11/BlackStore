import type { Metadata } from 'next';
import { OpenSession } from './open-session';

export const metadata: Metadata = {
  title: 'Connexion à votre espace',
  robots: { index: false, follow: false },
  // L'adresse contient le lien de connexion : elle ne doit pas partir vers d'autres sites.
  referrer: 'no-referrer',
};

interface Props {
  searchParams: { jeton?: string };
}

export default function OpenSessionPage({ searchParams }: Props) {
  const jeton = /^[A-Za-z0-9_-]{20,100}$/.test(searchParams.jeton ?? '') ? searchParams.jeton! : '';
  return (
    <main className="flex min-h-[60vh] items-center justify-center px-4 py-16">
      <OpenSession jeton={jeton} />
    </main>
  );
}
