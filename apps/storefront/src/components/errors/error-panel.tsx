import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

/**
 * Présentation commune des pages d'erreur et d'information : un pictogramme,
 * un titre qui dit ce qui se passe, une explication simple et l'action à faire.
 */

type Tone = 'info' | 'warning' | 'danger' | 'success';

const TONES: Record<Tone, string> = {
  info: 'bg-orange-500/10 text-orange-400 ring-orange-500/25',
  warning: 'bg-amber-500/10 text-amber-400 ring-amber-500/25',
  danger: 'bg-red-500/10 text-red-400 ring-red-500/25',
  success: 'bg-emerald-500/10 text-emerald-400 ring-emerald-500/25',
};

export interface ErrorAction {
  label: string;
  /** Page du site (lien Next). */
  href?: string;
  /** Adresse hors du site, par exemple le téléchargement servi par l'API. */
  externalHref?: string;
  onClick?: () => void;
  icon?: LucideIcon;
}

interface Props {
  icon: LucideIcon;
  tone?: Tone;
  /** Petite ligne au-dessus du titre, par exemple « Erreur 404 ». */
  eyebrow?: string;
  title: string;
  children: ReactNode;
  details?: Array<{ label: string; value: string }>;
  primary?: ErrorAction;
  secondary?: ErrorAction;
  /** Lien « Besoin d'aide ? » vers la page Contact (null pour le masquer). */
  helpHref?: string | null;
}

const BUTTON =
  'inline-flex h-12 items-center justify-center gap-2 rounded-lg px-6 text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950';
const PRIMARY = `${BUTTON} bg-orange-500 text-white hover:bg-orange-600`;
const SECONDARY = `${BUTTON} border border-zinc-700 text-zinc-100 hover:bg-zinc-800`;

function ActionButton({ action, primary }: { action: ErrorAction; primary?: boolean }) {
  const className = primary ? PRIMARY : SECONDARY;
  const Icon = action.icon;
  const content = (
    <>
      {Icon && <Icon className="h-4 w-4" aria-hidden="true" />}
      {action.label}
    </>
  );
  if (action.onClick) {
    return (
      <button type="button" onClick={action.onClick} className={className}>
        {content}
      </button>
    );
  }
  if (action.externalHref) {
    return (
      <a href={action.externalHref} className={className}>
        {content}
      </a>
    );
  }
  return (
    <Link href={action.href ?? '/'} className={className}>
      {content}
    </Link>
  );
}

export function ErrorPanel({ icon: Icon, tone = 'info', eyebrow, title, children, details, primary, secondary, helpHref = '/contact' }: Props) {
  return (
    <main className="flex min-h-[60vh] items-center justify-center px-4 py-16">
      <div className="w-full max-w-lg text-center">
        <div className={`mx-auto flex h-16 w-16 items-center justify-center rounded-2xl ring-1 ${TONES[tone]}`}>
          <Icon className="h-8 w-8" aria-hidden="true" />
        </div>
        {eyebrow && <p className="mt-6 text-xs font-semibold uppercase tracking-widest text-zinc-500">{eyebrow}</p>}
        <h1 className={`${eyebrow ? 'mt-2' : 'mt-6'} text-2xl font-bold tracking-tight text-white sm:text-3xl`}>{title}</h1>
        <div className="mt-4 space-y-3 leading-relaxed text-zinc-400">{children}</div>

        {details && details.length > 0 && (
          <dl className="mx-auto mt-6 max-w-sm divide-y divide-zinc-800 rounded-xl border border-zinc-800 bg-zinc-900/60 text-left text-sm">
            {details.map((detail) => (
              <div key={detail.label} className="flex justify-between gap-4 px-4 py-2.5">
                <dt className="text-zinc-500">{detail.label}</dt>
                <dd className="text-right font-medium text-zinc-200">{detail.value}</dd>
              </div>
            ))}
          </dl>
        )}

        {(primary || secondary) && (
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
            {primary && <ActionButton action={primary} primary />}
            {secondary && <ActionButton action={secondary} />}
          </div>
        )}

        {helpHref && (
          <p className="mt-8 text-sm text-zinc-500">
            Besoin d&apos;aide ?{' '}
            <Link href={helpHref} className="font-medium text-orange-400 hover:underline">
              Écrivez-nous
            </Link>
            , nous répondons par e-mail.
          </p>
        )}
      </div>
    </main>
  );
}
