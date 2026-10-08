'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { KeyRound, Loader2 } from 'lucide-react';
import { openSession, saveSession } from '@/lib/api/client';

/**
 * Ouverture de la session par un bouton, pas automatiquement : les messageries qui ouvrent les liens
 * pour les analyser n'utilisent donc pas le lien (il ne sert qu'une fois).
 */
export function OpenSession({ jeton }: { jeton: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(jeton ? null : 'Ce lien de connexion est incomplet : ouvrez le lien tel qu’il figure dans l’e-mail.');

  const open = async () => {
    setBusy(true);
    setError(null);
    try {
      saveSession(await openSession(jeton));
      router.replace('/mon-espace');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ce lien de connexion ne fonctionne pas.');
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-md text-center">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-orange-500/10 text-orange-400 ring-1 ring-orange-500/25">
        <KeyRound className="h-8 w-8" aria-hidden="true" />
      </div>
      <h1 className="mt-6 text-2xl font-bold text-white">Ouvrir votre espace client</h1>
      <p className="mt-3 text-zinc-400">Vous retrouverez vos achats sur cet appareil pendant 30 jours.</p>
      {error ? (
        <div className="mt-6 space-y-4" role="alert">
          <p className="rounded-lg border border-red-900 bg-red-950/50 px-3 py-2 text-sm text-red-300">{error}</p>
          <Link href="/mon-espace" className="inline-flex rounded-lg bg-orange-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-orange-600">
            Recevoir un nouveau lien
          </Link>
        </div>
      ) : (
        <button
          type="button"
          onClick={open}
          disabled={busy}
          className="mt-8 inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-orange-500 px-6 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-60"
        >
          {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
          {busy ? 'Ouverture…' : 'Ouvrir mon espace'}
        </button>
      )}
    </div>
  );
}
