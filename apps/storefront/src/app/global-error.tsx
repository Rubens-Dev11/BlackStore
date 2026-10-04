'use client';

/**
 * Dernier recours, quand même la mise en page du site n'a pas pu s'afficher.
 * Styles écrits ici : la feuille de style du site peut ne pas être chargée.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="fr">
      <head>
        <title>Erreur | BlackStore</title>
        <meta name="robots" content="noindex" />
      </head>
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '16px',
          background: '#09090b',
          color: '#f4f4f5',
          fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
          textAlign: 'center',
        }}
      >
        <main style={{ maxWidth: 480 }}>
          <p style={{ margin: 0, fontSize: 28, fontWeight: 800 }}>
            Black<span style={{ color: '#f97316' }}>Store</span>
          </p>
          <h1 style={{ margin: '24px 0 0', fontSize: 24 }}>Le site n&apos;a pas pu s&apos;afficher</h1>
          <p style={{ margin: '16px 0 0', color: '#a1a1aa', lineHeight: 1.6 }}>
            BlackStore est peut-être en cours de mise à jour. Réessayez dans un instant ; si le problème continue, écrivez-nous depuis la page Contact.
          </p>
          {error.digest && (
            <p style={{ margin: '12px 0 0', color: '#71717a', fontSize: 13 }}>Code de l&apos;erreur : {error.digest}</p>
          )}
          <div style={{ marginTop: 32, display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => reset()}
              style={{ height: 48, padding: '0 24px', border: 0, borderRadius: 8, background: '#f97316', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
            >
              Réessayer
            </button>
            {/* Lien classique : recharge entièrement le site. */}
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a
              href="/"
              style={{ height: 48, padding: '0 24px', display: 'inline-flex', alignItems: 'center', border: '1px solid #3f3f46', borderRadius: 8, color: '#f4f4f5', fontSize: 14, fontWeight: 600, textDecoration: 'none' }}
            >
              Retour à l&apos;accueil
            </a>
          </div>
        </main>
      </body>
    </html>
  );
}
