'use client';

import { useEffect } from 'react';
import Link from 'next/link';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // On pourrait logguer l'erreur ici vers un service externe (Sentry, etc.)
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[calc(100vh-64px)] flex-col items-center justify-center bg-zinc-950 px-4 text-center">
      <div className="rounded-full bg-red-500/10 p-4 text-red-500">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
          className="h-12 w-12"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
          />
        </svg>
      </div>
      <h1 className="mt-6 text-3xl font-bold tracking-tight text-white">
        Une erreur est survenue
      </h1>
      <p className="mt-4 max-w-md text-zinc-400">
        Nous sommes désolés, une erreur inattendue s'est produite lors du chargement de cette page.
      </p>
      {error.digest && (
        <p className="mt-2 text-xs text-zinc-600">ID Erreur: {error.digest}</p>
      )}
      <div className="mt-10 flex flex-col gap-4 sm:flex-row">
        <button
          onClick={() => reset()}
          className="inline-flex h-12 items-center justify-center rounded-lg bg-orange-500 px-8 text-sm font-medium text-white transition-colors hover:bg-orange-600 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 focus:ring-offset-zinc-950"
        >
          Réessayer
        </button>
        <button
          onClick={() => (window.location.href = '/')}
          className="inline-flex h-12 items-center justify-center rounded-lg border border-zinc-700 bg-transparent px-8 text-sm font-medium text-zinc-100 transition-colors hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-500 focus:ring-offset-2 focus:ring-offset-zinc-950"
        >
          Retour à l'accueil
        </button>
      </div>
    </div>
  );
}
