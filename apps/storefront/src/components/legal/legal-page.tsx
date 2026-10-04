import Link from 'next/link';
import { formatLegalDate } from '@/lib/api/legal';

export const LEGAL_LINKS = [
  { href: '/conditions-generales', label: 'Conditions générales' },
  { href: '/remboursements', label: 'Remboursements' },
  { href: '/confidentialite', label: 'Confidentialité' },
  { href: '/conditions-vendeurs', label: 'Conditions vendeurs' },
  { href: '/mentions-legales', label: 'Mentions légales' },
  { href: '/contact', label: 'Contact' },
];

interface Props {
  title: string;
  /** Version des textes (date de publication) ; absente pour une page sans texte légal. */
  version?: string;
  /** Phrase d'introduction, sous le titre. */
  intro: string;
  current: string;
  children: React.ReactNode;
}

/** Mise en page commune des pages légales : titre, version, texte, liens vers les autres pages. */
export function LegalPage({ title, version, intro, current, children }: Props) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <nav aria-label="Pages légales" className="mb-8 flex flex-wrap gap-2 text-xs">
        {LEGAL_LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            aria-current={link.href === current ? 'page' : undefined}
            className={`rounded-full border px-3 py-1 transition-colors ${
              link.href === current ? 'border-orange-500 text-white' : 'border-zinc-800 text-zinc-400 hover:border-zinc-600 hover:text-white'
            }`}
          >
            {link.label}
          </Link>
        ))}
      </nav>
      <h1 className="text-3xl font-bold text-white">{title}</h1>
      {version && <p className="mt-2 text-sm text-zinc-500">Version du {formatLegalDate(version)}</p>}
      <p className="mt-6 text-zinc-300">{intro}</p>
      <div className="legal-text mt-8 space-y-8 text-sm leading-relaxed text-zinc-400">{children}</div>
    </div>
  );
}

/** Section numérotée d'un texte légal. */
export function LegalSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold text-white">{title}</h2>
      {children}
    </section>
  );
}
