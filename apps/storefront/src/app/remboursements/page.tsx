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
          Remplissez le <Link href="/remboursements/demande" className={LINK}>formulaire de demande de remboursement</Link> dans les 7 jours qui
          suivent l'achat (30 jours pour un double paiement). Il vous demande :
        </p>
        <ul className={LIST}>
          <li>votre numéro de commande (il commence par BS-, il figure dans l'e-mail de confirmation) et l'adresse e-mail utilisée pour la commande ;</li>
          <li>le produit concerné et le problème rencontré (le message d'erreur affiché aide beaucoup) ;</li>
          <li>le compte Mobile Money qui recevra le remboursement : celui qui a servi au paiement, ou un autre compte à votre nom.</li>
        </ul>
        <p>
          Vous recevez aussitôt un e-mail avec la référence de votre demande (elle commence par LIT-). Débité sans commande confirmée ? Écrivez-nous
          depuis le <Link href="/contact?sujet=refund" className={LINK}>formulaire de contact</Link>.
        </p>
        <p>
          <Link
            href="/remboursements/demande"
            className="inline-flex items-center rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-orange-600"
          >
            Demander un remboursement
          </Link>
        </p>
      </LegalSection>

      <LegalSection title="4. Traitement de la demande">
        <ul className={LIST}>
          <li>
            Le vendeur est prévenu : il a 5 jours pour vous répondre, corriger son produit ou accepter le remboursement. Pour un produit vendu par
            BlackStore, notre équipe examine directement la demande.
          </li>
          <li>Notre équipe prend ensuite la décision et vous l'annonce par e-mail, en général sous 5 jours ouvrés.</li>
          <li>Si la demande est acceptée, le montant payé vous est renvoyé par Mobile Money sous 10 jours ouvrés ; un e-mail vous donne la référence de l'envoi.</li>
          <li>Les liens de téléchargement du produit remboursé cessent alors de fonctionner.</li>
          <li>La vente est retirée du solde du vendeur, comme le prévoient les <Link href="/conditions-vendeurs" className={LINK}>conditions vendeurs</Link>.</li>
        </ul>
      </LegalSection>

      <LegalSection title="5. Demandes abusives">
        <p>BlackStore peut refuser les demandes manifestement abusives ou répétées, par exemple après avoir téléchargé et utilisé plusieurs produits.</p>
      </LegalSection>
    </LegalPage>
  );
}
