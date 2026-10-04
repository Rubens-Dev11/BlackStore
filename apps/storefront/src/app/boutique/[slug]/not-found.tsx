import { LayoutGrid, Store } from 'lucide-react';
import { ErrorPanel } from '@/components/errors/error-panel';

/** Boutique absente : nom mal écrit, boutique fermée ou vendeur pas encore validé. */
export default function StoreNotFound() {
  return (
    <ErrorPanel
      icon={Store}
      eyebrow="Boutique introuvable"
      title="Cette boutique n'est pas en ligne"
      primary={{ label: 'Voir le catalogue', href: '/', icon: LayoutGrid }}
      secondary={{ label: 'Nous contacter', href: '/contact' }}
      helpHref={null}
    >
      <p>Vérifiez l&apos;adresse : le nom de la boutique est peut-être mal écrit. Elle peut aussi être fermée, ou en attente de validation par notre équipe.</p>
    </ErrorPanel>
  );
}
