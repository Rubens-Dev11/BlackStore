import type { Metadata } from 'next';
import Link from 'next/link';
import { LegalPage, LegalSection } from '@/components/legal/legal-page';
import { fetchLegalInfo, operatorName } from '@/lib/api/legal';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Conditions générales',
  description: "Conditions générales d'utilisation et de vente de BlackStore, la place de marché de produits numériques.",
};

const LIST = 'list-disc space-y-1 pl-5';
const LINK = 'text-orange-400 hover:underline';

export default async function TermsPage() {
  const info = await fetchLegalInfo();

  return (
    <LegalPage
      title="Conditions générales d'utilisation et de vente"
      version={info.version}
      current="/conditions-generales"
      intro="Ces conditions s'appliquent à toute personne qui visite BlackStore ou y achète un produit numérique. En passant commande, vous les acceptez, ainsi que la politique de remboursement."
    >
      <LegalSection title="1. Ce qu'est BlackStore">
        <p>
          BlackStore est une place de marché de produits numériques (applications, logiciels, livres numériques, modèles, formations…),
          exploitée par {operatorName(info)} (voir les <Link href="/mentions-legales" className={LINK}>mentions légales</Link>). Des vendeurs
          indépendants y proposent leurs produits dans leur propre boutique ; BlackStore y vend aussi ses propres produits. Le vendeur de chaque
          produit est indiqué sur sa fiche (« Vendu par … »).
        </p>
      </LegalSection>

      <LegalSection title="2. Rôle de BlackStore">
        <p>Pour les produits des vendeurs, BlackStore agit comme intermédiaire :</p>
        <ul className={LIST}>
          <li>il héberge la boutique du vendeur, encaisse le paiement pour son compte, livre le fichier et lui reverse le prix, diminué de sa commission ;</li>
          <li>la vente est conclue entre vous et le vendeur, qui répond du contenu de son produit, de sa description et des droits nécessaires pour le vendre ;</li>
          <li>BlackStore contrôle chaque nouveau vendeur et son premier produit, analyse chaque fichier avec un antivirus avant de le proposer, et retire les produits qui ne respectent pas ses règles.</li>
        </ul>
      </LegalSection>

      <LegalSection title="3. Commande">
        <ul className={LIST}>
          <li>Aucun compte n'est nécessaire : vous indiquez votre nom, votre adresse e-mail et, si vous le souhaitez, votre téléphone.</li>
          <li>Vérifiez bien votre adresse e-mail : c'est là que vos liens de téléchargement sont envoyés.</li>
          <li>Avant de payer, vous voyez le récapitulatif de votre commande et vous acceptez ces conditions en cochant la case prévue.</li>
          <li>La commande devient définitive dès que le paiement est confirmé.</li>
        </ul>
      </LegalSection>

      <LegalSection title="4. Prix et paiement">
        <ul className={LIST}>
          <li>Les prix sont indiqués en francs CFA (FCFA) et fixés par chaque vendeur. Le prix affiché est le prix total à payer : BlackStore n'ajoute aucun frais.</li>
          <li>Le paiement se fait par Mobile Money (Orange Money, MTN Mobile Money) auprès de notre prestataire de paiement agréé. BlackStore ne voit jamais votre code secret.</li>
          <li>Un produit gratuit s'obtient sans paiement, après avoir indiqué votre adresse e-mail.</li>
        </ul>
      </LegalSection>

      <LegalSection title="5. Livraison des produits">
        <ul className={LIST}>
          <li>Dès que le paiement est confirmé, vos liens de téléchargement s'affichent et vous sont envoyés par e-mail.</li>
          <li>
            Chaque lien est personnel, valable pour une durée et un nombre de téléchargements limités (en général 72 heures et 3 téléchargements) :
            ces limites figurent dans l'e-mail. Téléchargez et gardez votre fichier dès réception.
          </li>
          <li>
            Vos achats restent consultables dans votre espace <Link href="/mon-espace" className={LINK}>« Mes achats »</Link>, ouvert par un lien
            envoyé à l'adresse e-mail de la commande.
          </li>
          <li>
            E-mail non reçu (pensez aux courriers indésirables) ou lien expiré : <Link href="/contact?sujet=order" className={LINK}>écrivez-nous</Link>{' '}
            avec votre numéro de commande.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="6. Accès immédiat et droit de rétractation">
        <p>
          Un produit numérique est livré dès le paiement. En commandant, vous demandez expressément cet accès immédiat et vous reconnaissez que,
          une fois le téléchargement commencé, vous ne pouvez plus vous rétracter, dans la mesure permise par la loi. Cela ne vous prive pas des
          remboursements prévus par la <Link href="/remboursements" className={LINK}>politique de remboursement</Link> (produit inutilisable,
          non conforme, non reçu, double paiement…).
        </p>
      </LegalSection>

      <LegalSection title="7. Utilisation des produits achetés">
        <ul className={LIST}>
          <li>Sauf mention contraire sur la fiche du produit, vous recevez un droit d'utilisation personnel, non exclusif et non transférable.</li>
          <li>Il est interdit de revendre un produit, de le partager publiquement ou de contourner ses protections.</li>
          <li>Les produits restent la propriété de leurs auteurs.</li>
        </ul>
      </LegalSection>

      <LegalSection title="8. Règles d'utilisation du site">
        <p>Sont interdits, sous peine de blocage et de poursuites : la fraude au paiement, toute tentative d'accès non autorisé au site ou aux comptes, l'envoi de contenus illicites, et l'usage de robots qui gênent le fonctionnement du site.</p>
      </LegalSection>

      <LegalSection title="9. Avis des clients">
        <p>
          Seuls les acheteurs d'un produit peuvent donner leur avis. Les avis sont publiés après vérification, avec le prénom et l'initiale du nom
          de l'acheteur. BlackStore peut refuser un avis injurieux, hors sujet ou contenant des informations personnelles.
        </p>
      </LegalSection>

      <LegalSection title="10. Signaler un problème">
        <p>
          Chaque fiche produit propose un lien « Signaler ce produit » (copie piratée, fichier dangereux, arnaque, contenu illégal, fichier qui ne
          fonctionne pas…). Chaque signalement est examiné ; le produit est retiré s'il ne respecte pas nos règles.
        </p>
      </LegalSection>

      <LegalSection title="11. Responsabilité">
        <ul className={LIST}>
          <li>BlackStore fait de son mieux pour garder le site disponible et sûr, mais ne peut garantir l'absence de toute interruption.</li>
          <li>Avant d'acheter, vérifiez la configuration requise indiquée sur la fiche : un produit incompatible avec un appareil non prévu n'est pas un produit défectueux.</li>
          <li>Sauf faute lourde ou disposition légale contraire, la responsabilité de BlackStore est limitée au montant payé pour la commande concernée.</li>
        </ul>
      </LegalSection>

      <LegalSection title="12. Données personnelles">
        <p>
          Les informations de votre commande servent à la traiter et à vous livrer. Pour en savoir plus et exercer vos droits, lisez la{' '}
          <Link href="/confidentialite" className={LINK}>politique de confidentialité</Link>.
        </p>
      </LegalSection>

      <LegalSection title="13. Modification des conditions">
        <p>Les conditions applicables sont celles en vigueur le jour de votre commande ; leur date de version figure en haut de cette page.</p>
      </LegalSection>

      <LegalSection title="14. Droit applicable et litiges">
        <p>
          Ces conditions sont soumises au droit camerounais, notamment à la loi n° 2010/021 du 21 décembre 2010 régissant le commerce électronique
          au Cameroun et à la loi-cadre n° 2011/012 du 6 mai 2011 portant protection du consommateur. En cas de désaccord, écrivez-nous d'abord :
          nous cherchons une solution amiable dans les 30 jours. À défaut, les tribunaux compétents du Cameroun pourront être saisis.
        </p>
      </LegalSection>

      <LegalSection title="15. Nous contacter">
        <p>
          Une question sur une commande ou sur ces conditions ? Utilisez le <Link href="/contact" className={LINK}>formulaire de contact</Link>
          {info.contact.email && (
            <>
              {' '}ou écrivez à <a href={`mailto:${info.contact.email}`} className={LINK}>{info.contact.email}</a>
            </>
          )}
          .
        </p>
      </LegalSection>
    </LegalPage>
  );
}
