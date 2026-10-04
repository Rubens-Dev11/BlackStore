import type { Metadata } from 'next';
import Link from 'next/link';
import { LegalPage, LegalSection } from '@/components/legal/legal-page';
import { fetchLegalInfo } from '@/lib/api/legal';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Politique de remboursement',
  description: 'Dans quels cas un produit acheté sur BlackStore est remboursé, et comment le demander.',
};

const LIST = 'list-disc space-y-1 pl-5';
const LINK = 'text-orange-400 hover:underline';

export default async function RefundsPage() {
  const info = await fetchLegalInfo();

  return (
    <LegalPage
      title="Politique de remboursement"
      version={info.version}
      current="/remboursements"
      intro="Un produit numérique est livré tout de suite et ne peut pas être « rendu ». Nous remboursons donc dans des cas précis : produit inutilisable, non conforme, non reçu, payé deux fois ou retiré du site."
    >
      <LegalSection title="1. Cas remboursés">
        <ul className={LIST}>
          <li>
            <strong className="text-zinc-200">Produit inutilisable</strong> : fichier vide, abîmé ou qui ne fonctionne pas sur un appareil prévu par
            la configuration requise, quand le vendeur ne le corrige pas dans les 5 jours.
          </li>
          <li>
            <strong className="text-zinc-200">Produit non conforme</strong> : très différent de sa description (contenu manquant, mauvaise version,
            mauvaise langue…).
          </li>
          <li>
            <strong className="text-zinc-200">Produit non reçu</strong> : liens jamais reçus ou inutilisables, quand notre équipe ne parvient pas à
            vous les renvoyer.
          </li>
          <li>
            <strong className="text-zinc-200">Double paiement</strong> : vous avez payé deux fois la même commande, ou vous avez été débité sans
            commande confirmée.
          </li>
          <li>
            <strong className="text-zinc-200">Produit retiré</strong> : produit retiré du site après votre achat parce qu'il était piraté ou
            dangereux.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="2. Cas non remboursés">
        <ul className={LIST}>
          <li>Changement d'avis après le téléchargement.</li>
          <li>Incompatibilité avec un appareil que la configuration requise ne prévoit pas.</li>
          <li>Produit gratuit.</li>
          <li>Demande envoyée plus de 7 jours après l'achat (30 jours pour un double paiement).</li>
        </ul>
      </LegalSection>

      <LegalSection title="3. Comment demander un remboursement">
        <p>
          Utilisez le <Link href="/contact?sujet=refund" className={LINK}>formulaire de contact</Link>, sujet « Demande de remboursement », dans les
          7 jours qui suivent l'achat. Indiquez :
        </p>
        <ul className={LIST}>
          <li>votre numéro de commande (il commence par BS-, il figure dans l'e-mail de confirmation) ;</li>
          <li>l'adresse e-mail utilisée pour la commande ;</li>
          <li>le problème rencontré (une capture d'écran du message d'erreur aide beaucoup).</li>
        </ul>
      </LegalSection>

      <LegalSection title="4. Traitement de la demande">
        <ul className={LIST}>
          <li>Nous vous répondons par e-mail sous 5 jours ouvrés. Nous pouvons demander des précisions au vendeur, ou lui laisser 5 jours pour corriger son produit.</li>
          <li>Si la demande est acceptée, le montant payé vous est renvoyé par Mobile Money, sur le numéro qui a servi au paiement ou sur un autre numéro à votre nom que vous nous indiquez, sous 10 jours ouvrés.</li>
          <li>Les liens de téléchargement de la commande remboursée cessent alors de fonctionner.</li>
          <li>La vente est retirée du solde du vendeur, comme le prévoient les <Link href="/conditions-vendeurs" className={LINK}>conditions vendeurs</Link>.</li>
        </ul>
      </LegalSection>

      <LegalSection title="5. Demandes abusives">
        <p>BlackStore peut refuser les demandes manifestement abusives ou répétées, par exemple après avoir téléchargé et utilisé plusieurs produits.</p>
      </LegalSection>
    </LegalPage>
  );
}
