import { useEffect, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode } from 'react';

/** Titre de l'onglet du navigateur pour les pages vendeur. */
export function useSellerPageTitle(title: string) {
  useEffect(() => {
    const previous = document.title;
    document.title = `${title} — BlackStore Vendeurs`;
    return () => {
      document.title = previous;
    };
  }, [title]);
}

/** Carte centrée des pages publiques vendeur (inscription, connexion, liens reçus par e-mail). */
export function SellerAuthCard({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  useSellerPageTitle(title);
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950 px-4 py-10">
      <div className="w-full max-w-md p-8 bg-gray-800 rounded-lg">
        <p className="text-center text-sm font-semibold uppercase tracking-wide text-orange-500">BlackStore Vendeurs</p>
        <h1 className="mt-2 text-2xl font-bold text-white text-center">{title}</h1>
        {subtitle && <p className="mt-2 text-center text-sm text-gray-400">{subtitle}</p>}
        <div className="mt-6">{children}</div>
        {footer && <div className="mt-6 space-y-2 text-center text-sm text-gray-400">{footer}</div>}
      </div>
    </div>
  );
}

export function AuthField({ label, id, ...input }: { label: string; id: string } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-gray-300 mb-1">
        {label}
      </label>
      <input
        id={id}
        {...input}
        className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
      />
    </div>
  );
}

export function AuthButton({ loading, children, ...rest }: { loading?: boolean; children: ReactNode } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      disabled={loading}
      {...rest}
      className="w-full py-2 px-4 bg-orange-600 hover:bg-orange-700 text-white font-semibold rounded-md transition duration-200 disabled:opacity-70"
    >
      {children}
    </button>
  );
}

/** Encadré d'information (succès en vert, erreur en rouge). */
export function AuthNotice({ tone, children }: { tone: 'success' | 'error' | 'info'; children: ReactNode }) {
  const tones = {
    success: 'border-green-700 bg-green-950 text-green-200',
    error: 'border-red-700 bg-red-950 text-red-200',
    info: 'border-gray-600 bg-gray-900 text-gray-300',
  };
  return <div className={`rounded-md border px-4 py-3 text-sm ${tones[tone]}`}>{children}</div>;
}
