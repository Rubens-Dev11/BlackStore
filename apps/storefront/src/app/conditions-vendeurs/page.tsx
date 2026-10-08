import type { Metadata } from 'next';
import Link from 'next/link';
import { LegalPage, LegalSection } from '@/components/legal/legal-page';
import { fetchLegalInfo, operatorName } from '@/lib/api/legal';
import { formatFcfa } from '@/lib/format';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Conditions vendeurs',
  description: 'Contrat entre BlackStore et ses vendeurs : produits autorisés, commission, paiement des ventes, retraits Mobile Money.',
};

const LIST = 'list-disc space-y-1 pl-5';
const LINK = 'text-orange-400 hover:underline';

export default async function SellerTermsPage() {
  const info = await fetchLegalInfo();
  const { commissionRate, holdDays, minWithdrawal } = info.marketplace;
  const rate = commissionRate.toLocaleString('fr-FR');

  return (
    <LegalPage
      title="Conditions vendeurs"
      version={info.version}
      current="/conditions-vendeurs"
      intro={`Ce contrat lie BlackStore, exploité par ${operatorName(info)}, et chaque vendeur qui ouvre une boutique sur la plateforme. Vous l'acceptez en créant votre compte vendeur.`}
    >
      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 text-zinc-300">
        <p className="font-semibold text-white">L'essentiel</p>
        <ul className={`${LIST} mt-2`}>
          <li>Inscription gratuite ; commission de {rate} % sur chaque vente payée, et rien sur les produits gratuits.</li>
          <li>L'argent d'une vente devient retirable {holdDays} jours après le paiement.</li>
          <li>Retrait vers Orange Money ou MTN Mobile Money à partir de {formatFcfa(minWithdrawal)}, après vérification de votre identité.</li>
          <li>Vous ne vendez que des produits dont vous détenez les droits.</li>
        </ul>
        <a
          href={`${info.urls.sellerApp}/vendeur/inscription`}
          className="mt-4 inline-block rounded-lg bg-orange-500 px-4 py-2 font-semibold text-white transition-colors hover:bg-orange-600"
        >
          Ouvrir ma boutique
        </a>
      </div>

      <LegalSection title="1. Qui peut vendre">
        <ul className={LIST}>
          <li>Toute personne majeure (18 ans ou plus) ou toute entreprise, disposant d'une adresse e-mail et d'un téléphone valides.</li>
          <li>Pour recevoir vos gains : un compte Orange Money ou MTN Mobile Money au Cameroun, à votre nom.</li>
          <li>Un seul compte vendeur par personne.</li>
        </ul>
      </LegalSection>

      <LegalSection title="2. Compte et boutique">
        <ul className={LIST}>
          <li>Après confirmation de votre adresse e-mail, BlackStore vérifie votre compte avant de le valider. Il peut refuser une inscription incomplète, douteuse ou contraire à ces conditions.</li>
          <li>Votre boutique est publiée à l'adresse blackstore.pymail.cm/boutique/nom-de-votre-boutique une fois votre compte validé.</li>
          <li>Vous gardez votre mot de passe secret : toute action faite depuis votre compte est réputée faite par vous.</li>
        </ul>
      </LegalSection>

      <LegalSection title="3. Produits autorisés et interdits">
        <p>Vous ne pouvez vendre que des produits que vous avez créés, ou que vous avez le droit écrit de revendre. Sont notamment interdits :</p>
        <ul className={LIST}>
          <li>les copies piratées ou « crackées », les versions « Pro » ou « Premium » d'applications payantes, les clés de licence, codes ou comptes revendus ;</li>
          <li>les virus, logiciels espions et tout fichier dangereux ;</li>
          <li>les contenus pornographiques, haineux, violents, diffamatoires ou contraires à la loi camerounaise ;</li>
          <li>les produits trompeurs (gains garantis, faux diplômes…) et les données personnelles d'autrui ;</li>
          <li>les produits qui reprennent une marque ou une œuvre sans autorisation.</li>
        </ul>
        <p>Votre description, vos images et votre vidéo de présentation doivent montrer fidèlement le produit vendu.</p>
      </LegalSection>

      <LegalSection title="4. Contrôle des produits">
        <ul className={LIST}>
          <li>Votre premier produit est vérifié par BlackStore avant sa mise en ligne. Les suivants sont publiés directement, sauf un produit déjà refusé, qui repasse par la vérification.</li>
          <li>Chaque fichier est analysé par un antivirus : le produit reste invisible tant que l'analyse n'est pas terminée.</li>
          <li>BlackStore peut retirer un produit ou suspendre une boutique après un signalement ou une infraction ; le motif vous est envoyé par e-mail.</li>
        </ul>
      </LegalSection>

      <LegalSection title="5. Prix">
        <p>Vous fixez vos prix : 0 FCFA (gratuit) ou de 100 à 1 000 000 FCFA, par multiples de 5. Un prix barré doit être supérieur au prix de vente.</p>
      </LegalSection>

      <LegalSection title="6. Commission de BlackStore">
        <ul className={LIST}>
          <li>BlackStore prélève {rate} % du prix de chaque vente payée. La commission est déduite automatiquement et affichée dans « Mes gains ».</li>
          <li>Chaque vente garde le taux en vigueur au moment du paiement. Un nouveau taux s'applique seulement aux ventes suivantes, et vous est annoncé par e-mail 15 jours à l'avance.</li>
          <li>
            Codes promo : vous pouvez créer dans votre espace des codes de réduction valables sur les produits de votre boutique. La
            réduction est à votre charge : la commission est calculée sur le prix réellement payé par le client, votre solde est crédité
            de ce prix moins la commission, et un remboursement rend au client ce même prix.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="7. Paiement de vos ventes">
        <ul className={LIST}>
          <li>Chaque vente payée est créditée sur votre solde, commission déduite.</li>
          <li>Elle devient retirable {holdDays} jours après le paiement : ce délai de sécurité couvre les éventuels remboursements.</li>
          <li>Toutes vos ventes, commissions et retraits sont détaillés dans « Mes gains ».</li>
        </ul>
      </LegalSection>

      <LegalSection title="8. Retraits">
        <ul className={LIST}>
          <li>Votre identité est vérifiée avant votre premier retrait : carte nationale d'identité (recto et verso) ou passeport, et un selfie avec la pièce.</li>
          <li>Montant minimum : {formatFcfa(minWithdrawal)}, par multiples de 5 ; un seul retrait à la fois.</li>
          <li>L'argent est envoyé sur un compte Orange Money ou MTN Mobile Money à votre nom, sous 72 heures. Vous recevez un reçu par e-mail, avec la référence de la transaction.</li>
          <li>BlackStore peut refuser un retrait (titulaire du compte différent, soupçon de fraude) : le montant revient alors dans votre solde, et le motif vous est envoyé.</li>
        </ul>
      </LegalSection>

      <LegalSection title="9. Remboursements et litiges">
        <ul className={LIST}>
          <li>
            Quand un acheteur demande le remboursement d'un de vos produits, vous êtes prévenu par e-mail. Vous avez 5 jours pour répondre depuis
            « Litiges » dans votre espace vendeur : expliquer la situation, corriger votre produit ou accepter le remboursement. BlackStore décide
            ensuite, selon la <Link href="/remboursements" className={LINK}>politique de remboursement</Link>.
          </li>
          <li>Pendant le litige, le montant de cette vente reste bloqué dans votre solde, même après le délai de sécurité.</li>
          <li>
            Si l'acheteur est remboursé, la vente est retirée de votre solde. Si vous avez déjà retiré cet argent, votre solde devient négatif et se
            rééquilibre avec vos ventes suivantes. En cas de fraude, BlackStore peut vous réclamer les sommes concernées.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="10. Vos engagements">
        <ul className={LIST}>
          <li>Répondre aux questions de vos acheteurs, par les moyens de contact affichés dans votre boutique.</li>
          <li>Maintenir vos produits : corriger un fichier défectueux, mettre à jour une version dépassée.</li>
          <li>Respecter la loi, déclarer vos revenus et payer vos impôts : BlackStore ne les retient pas pour vous, sauf obligation légale.</li>
        </ul>
      </LegalSection>

      <LegalSection title="11. Propriété intellectuelle">
        <ul className={LIST}>
          <li>Vous restez propriétaire de vos produits.</li>
          <li>Vous autorisez BlackStore, gratuitement et sans exclusivité, pendant leur mise en vente, à héberger vos produits, à les montrer et à les promouvoir (site, réseaux sociaux, publicités), et à livrer vos fichiers aux acheteurs.</li>
          <li>Sauf mention contraire sur la fiche, l'acheteur reçoit un droit d'utilisation personnel, comme le prévoient les <Link href="/conditions-generales" className={LINK}>conditions générales</Link>.</li>
          <li>Vous garantissez BlackStore contre toute réclamation d'un tiers concernant vos produits.</li>
        </ul>
      </LegalSection>

      <LegalSection title="12. Données personnelles">
        <p>
          Vos données et vos pièces d'identité sont traitées comme le décrit la <Link href="/confidentialite" className={LINK}>politique de confidentialité</Link>.
          Vous ne recevez pas les données personnelles des acheteurs : seulement le produit vendu, le montant et le numéro de commande.
        </p>
      </LegalSection>

      <LegalSection title="13. Suspension et fermeture">
        <ul className={LIST}>
          <li>Vous pouvez fermer votre compte à tout moment depuis le formulaire de contact. Votre solde vous est versé après le délai de sécurité, déduction faite des remboursements.</li>
          <li>En cas d'infraction grave (piratage, fichier dangereux, fraude), BlackStore peut suspendre votre compte immédiatement. Votre solde peut alors être retenu le temps de régler les remboursements et réclamations.</li>
        </ul>
      </LegalSection>

      <LegalSection title="14. Responsabilité">
        <p>
          BlackStore fournit la plateforme et fait de son mieux pour qu'elle reste disponible. Sauf faute lourde, il ne répond pas des pertes
          indirectes (ventes manquées, interruption du site) ; sa responsabilité est limitée aux commissions perçues sur vos ventes des 12 derniers mois.
        </p>
      </LegalSection>

      <LegalSection title="15. Modification et droit applicable">
        <p>
          Toute modification importante de ce contrat vous est annoncée par e-mail 15 jours avant son entrée en vigueur ; continuer à vendre vaut
          acceptation. Ce contrat est soumis au droit camerounais. En cas de désaccord, nous cherchons d'abord une solution amiable ; à défaut, les
          tribunaux compétents du Cameroun pourront être saisis.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
