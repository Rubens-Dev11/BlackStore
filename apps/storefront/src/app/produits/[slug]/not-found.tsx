import { LayoutGrid, PackageX } from 'lucide-react';
import { ErrorPanel } from '@/components/errors/error-panel';

/** Produit absent : retiré, en attente de validation, ou lien erroné. */
export default function ProductNotFound() {
  return (
    <ErrorPanel
      icon={PackageX}
      eyebrow="Produit introuvable"
      title="Ce produit n'est plus disponible"
      primary={{ label: 'Voir le catalogue', href: '/', icon: LayoutGrid }}
      secondary={{ label: 'Nous contacter', href: '/contact' }}
      helpHref={null}
    >
      <p>Il a peut-être été retiré de la vente par son vendeur, ou le lien que vous avez suivi est incorrect.</p>
      <p>Vous l&apos;avez déjà acheté ? Vos liens de téléchargement se trouvent toujours dans votre e-mail de confirmation.</p>
    </ErrorPanel>
  );
}
