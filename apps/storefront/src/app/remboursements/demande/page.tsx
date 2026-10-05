import type { Metadata } from 'next';
import { LegalPage } from '@/components/legal/legal-page';
import { DisputeForm } from './dispute-form';

export const metadata: Metadata = {
  title: 'Demander un remboursement',
  description: 'Produit inutilisable, non conforme ou non reçu ? Demandez son remboursement dans les 7 jours qui suivent l’achat.',
  robots: { index: false },
};

interface Props {
  searchParams: { commande?: string };
}

export default function DisputeRequestPage({ searchParams }: Props) {
  const orderNumber = /^BS-\d{4}-\d{5}$/i.test(searchParams.commande ?? '') ? searchParams.commande!.toUpperCase() : '';
  return (
    <LegalPage
      title="Demander un remboursement"
      current="/remboursements"
      intro="Produit inutilisable, non conforme, non reçu, payé deux fois ou retiré du site : faites votre demande dans les 7 jours qui suivent l’achat (30 jours pour un double paiement). Le vendeur peut répondre pendant 5 jours, puis notre équipe décide et vous écrit."
    >
      <DisputeForm initialOrderNumber={orderNumber} />
    </LegalPage>
  );
}
