import type { InputHTMLAttributes } from 'react';

// Éléments de formulaire partagés par les pages de l'espace vendeur.

export const INPUT_CLASS =
  'w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary';
export const BUTTON_CLASS =
  'rounded-md bg-primary px-6 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50';

export function FormField({ label, id, ...input }: { label: string; id: string } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-medium">{label}</label>
      <input id={id} {...input} className={INPUT_CLASS} />
    </div>
  );
}

/** Message affichable d'une erreur d'API (les erreurs de validation arrivent sous forme de liste). */
export const apiErrorMessage = (err: any): string =>
  (Array.isArray(err?.message) ? err.message[0] : err?.message) || 'Erreur serveur. Réessayez.';
