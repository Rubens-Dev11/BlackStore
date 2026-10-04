'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, RotateCw, WifiOff } from 'lucide-react';
import { ErrorPanel } from '@/components/errors/error-panel';

/** Page affichée quand une page n'a pas pu se charger (API indisponible, coupure réseau…). */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();
  const [retrying, startRetry] = useTransition();
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    console.error(error);
  }, [error]);

  useEffect(() => {
    const update = () => setOffline(!navigator.onLine);
    update();
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);

  // Recharge les données du serveur puis réaffiche la page.
  const retry = () =>
    startRetry(() => {
      router.refresh();
      reset();
    });

  const retryAction = { label: retrying ? 'Nouvel essai…' : 'Réessayer', onClick: retry, icon: RotateCw };

  if (offline) {
    return (
      <ErrorPanel icon={WifiOff} tone="warning" title="Pas de connexion internet" primary={retryAction} helpHref={null}>
        <p>Votre téléphone ou votre ordinateur semble hors ligne. Vérifiez vos données mobiles ou votre Wi-Fi, puis réessayez.</p>
      </ErrorPanel>
    );
  }

  return (
    <ErrorPanel
      icon={AlertTriangle}
      tone="danger"
      eyebrow="Erreur"
      title="Cette page n'a pas pu s'afficher"
      primary={retryAction}
      secondary={{ label: "Retour à l'accueil", href: '/' }}
      details={error.digest ? [{ label: "Code de l'erreur", value: error.digest }] : undefined}
    >
      <p>BlackStore est peut-être en cours de mise à jour, ou momentanément surchargé. Réessayez dans un instant.</p>
      {error.digest && <p className="text-sm">Si le problème continue, écrivez-nous en indiquant le code ci-dessous.</p>}
    </ErrorPanel>
  );
}
