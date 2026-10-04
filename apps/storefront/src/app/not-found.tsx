import type { Metadata } from 'next';
import { Compass, LayoutGrid } from 'lucide-react';
import { ErrorPanel } from '@/components/errors/error-panel';

export const metadata: Metadata = {
  title: 'Page introuvable',
  robots: { index: false },
};

export default function NotFound() {
  return (
    <ErrorPanel
      icon={Compass}
      eyebrow="Erreur 404"
      title="Page introuvable"
      primary={{ label: 'Voir le catalogue', href: '/', icon: LayoutGrid }}
      secondary={{ label: 'Nous contacter', href: '/contact' }}
      helpHref={null}
    >
      <p>Cette adresse ne correspond à aucune page de BlackStore : elle est peut-être mal écrite, ou la page a été déplacée.</p>
    </ErrorPanel>
  );
}
