import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex min-h-[calc(100vh-64px)] flex-col items-center justify-center bg-zinc-950 px-4 text-center">
      <h1 className="text-9xl font-bold tracking-tighter text-white">404</h1>
      <h2 className="mt-4 text-3xl font-semibold text-zinc-100">Page introuvable</h2>
      <p className="mt-4 max-w-md text-zinc-400">
        Désolé, la page que vous recherchez n'existe pas ou a été déplacée.
      </p>
      <div className="mt-10 flex flex-col gap-4 sm:flex-row">
        <Link
          href="/"
          className="inline-flex h-12 items-center justify-center rounded-lg bg-orange-500 px-8 text-sm font-medium text-white transition-colors hover:bg-orange-600 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 focus:ring-offset-zinc-950"
        >
          Retour à l'accueil
        </Link>
        <Link
          href="/"
          className="inline-flex h-12 items-center justify-center rounded-lg border border-zinc-700 bg-transparent px-8 text-sm font-medium text-zinc-100 transition-colors hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-500 focus:ring-offset-2 focus:ring-offset-zinc-950"
        >
          Voir les produits
        </Link>
      </div>
    </div>
  );
}
