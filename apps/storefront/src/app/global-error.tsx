'use client';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="fr">
      <body className="font-sans bg-zinc-950 text-zinc-100 antialiased flex min-h-screen flex-col items-center justify-center p-4 text-center">
        <h2 className="text-2xl font-bold mb-4">Une erreur critique est survenue</h2>
        <button
          onClick={() => reset()}
          className="rounded-lg bg-orange-500 px-6 py-2 text-sm font-medium text-white hover:bg-orange-600 transition-colors"
        >
          Réessayer
        </button>
      </body>
    </html>
  );
}
