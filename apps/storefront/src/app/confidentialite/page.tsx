import type { Metadata } from 'next';
import Link from 'next/link';
import { LegalPage, LegalSection } from '@/components/legal/legal-page';
import { fetchLegalInfo, operatorName } from '@/lib/api/legal';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Politique de confidentialité',
  description: 'Quelles données BlackStore collecte, pourquoi, combien de temps, et comment exercer vos droits.',
};

const LIST = 'list-disc space-y-1 pl-5';
const LINK = 'text-orange-400 hover:underline';
const CELL = 'border-b border-zinc-800 py-2 pr-4 align-top';

export default async function PrivacyPage() {
  const info = await fetchLegalInfo();

  return (
    <LegalPage
      title="Politique de confidentialité"
      version={info.version}
      current="/confidentialite"
      intro="BlackStore collecte seulement les données nécessaires pour vendre, livrer et payer, ne les vend à personne et n'utilise aucun cookie publicitaire. Voici le détail, conformément à la loi n° 2024/017 du 23 décembre 2024 relative à la protection des données à caractère personnel au Cameroun."
    >
      <LegalSection title="1. Responsable du traitement">
        <p>
          Le responsable de vos données est {operatorName(info)}
          {info.operator.address ? `, ${info.operator.address}` : ''}. Pour toute question : le{' '}
          <Link href="/contact?sujet=personal_data" className={LINK}>formulaire de contact</Link>, sujet « Données personnelles »
          {info.contact.email && (
            <>
              , ou <a href={`mailto:${info.contact.email}`} className={LINK}>{info.contact.email}</a>
            </>
          )}
          .
        </p>
      </LegalSection>

      <LegalSection title="2. Données collectées">
        <ul className={LIST}>
          <li><strong className="text-zinc-200">Visiteurs</strong> : adresse IP, type de navigateur, produits consultés, origine de la visite (lien de campagne). Pour les statistiques, l'adresse IP est transformée de façon irréversible.</li>
          <li><strong className="text-zinc-200">Acheteurs</strong> : nom, adresse e-mail, téléphone (facultatif), produits achetés, montant, référence et date du paiement ; pour un avis, l'e-mail, la note et le commentaire.</li>
          <li><strong className="text-zinc-200">Signalements et messages</strong> : contenu du message, adresse e-mail (facultative pour un signalement), numéro de commande cité.</li>
          <li><strong className="text-zinc-200">Demandes de remboursement</strong> : produit concerné, motif et description du problème, numéro Mobile Money et nom du titulaire du compte qui recevra l'argent, réponse du vendeur et décision.</li>
          <li><strong className="text-zinc-200">Vendeurs</strong> : nom, prénom, e-mail, téléphone, mot de passe (enregistré sous une forme chiffrée irréversible), boutique (nom, description, logo, liens vers vos réseaux, WhatsApp), produits, ventes, retraits (numéro Mobile Money et nom du titulaire).</li>
          <li><strong className="text-zinc-200">Vérification d'identité des vendeurs</strong> : type de pièce, nom inscrit dessus, photos de la pièce (recto, verso) et selfie avec la pièce.</li>
          <li><strong className="text-zinc-200">Paiement</strong> : il est traité par notre prestataire de paiement ; nous recevons seulement le résultat et la référence de la transaction, jamais votre code secret.</li>
        </ul>
      </LegalSection>

      <LegalSection title="3. Pourquoi nous les utilisons">
        <ul className={LIST}>
          <li>Traiter vos commandes, vous livrer et vous envoyer les e-mails utiles (exécution de la vente).</li>
          <li>Gérer les comptes vendeurs, leurs boutiques et le paiement de leurs ventes (exécution du contrat vendeur).</li>
          <li>Vérifier l'identité des vendeurs avant un retrait, pour éviter la fraude et le vol d'argent (votre accord est demandé à l'envoi des pièces).</li>
          <li>Protéger le site et ses utilisateurs : antivirus, lutte contre la fraude et les abus (intérêt légitime).</li>
          <li>Mesurer l'audience de façon anonymisée pour améliorer le catalogue (intérêt légitime).</li>
          <li>Répondre à vos messages, et respecter nos obligations légales, notamment comptables.</li>
        </ul>
        <p>Vos données ne sont jamais vendues, ni utilisées pour de la publicité ciblée.</p>
      </LegalSection>

      <LegalSection title="4. Qui peut y accéder">
        <ul className={LIST}>
          <li>L'équipe BlackStore, pour ce qui relève de sa mission.</li>
          <li>Notre prestataire de paiement (CinetPay), pour les paiements Mobile Money.</li>
          <li>Notre hébergeur : les données sont stockées sur un serveur situé à Douala, au Cameroun ; les e-mails partent de notre propre serveur de messagerie.</li>
          <li>Les autorités, uniquement quand la loi l'exige.</li>
        </ul>
        <p>
          Les vendeurs ne reçoivent pas vos données d'acheteur : ils voient seulement le produit vendu, le montant et le numéro de commande ; pour une
          demande de remboursement, votre prénom, l'initiale de votre nom et la description du problème, jamais votre e-mail ni votre numéro.
        </p>
      </LegalSection>

      <LegalSection title="5. Données hors du Cameroun">
        <p>
          Vos données sont stockées au Cameroun. Le prestataire de paiement peut traiter la transaction dans un autre pays d'Afrique, avec des
          garanties de sécurité adaptées. Une vidéo YouTube n'est chargée que si vous appuyez sur lecture : YouTube (Google) reçoit alors les
          données de connexion habituelles, selon sa propre politique.
        </p>
      </LegalSection>

      <LegalSection title="6. Combien de temps nous les gardons">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <tbody>
              <tr><td className={CELL}>Commandes et pièces comptables</td><td className={CELL}>10 ans (obligation comptable)</td></tr>
              <tr><td className={CELL}>Demandes de remboursement</td><td className={CELL}>10 ans, avec la commande (obligation comptable)</td></tr>
              <tr><td className={CELL}>Compte vendeur</td><td className={CELL}>tant qu'il est ouvert, puis 3 ans pour les éventuels litiges</td></tr>
              <tr><td className={CELL}>Photos des pièces d'identité</td><td className={CELL}>effacées dès qu'une vérification est refusée ; sinon gardées tant que le compte est ouvert, et au plus 1 an après sa fermeture</td></tr>
              <tr><td className={CELL}>Messages de contact et signalements</td><td className={CELL}>2 ans après leur traitement</td></tr>
              <tr><td className={CELL}>Statistiques de visite (adresse IP transformée)</td><td className={CELL}>13 mois</td></tr>
              <tr><td className={CELL}>Journaux techniques du serveur</td><td className={CELL}>environ 15 jours</td></tr>
              <tr><td className={CELL}>Liens de téléchargement</td><td className={CELL}>valables 72 heures en général</td></tr>
            </tbody>
          </table>
        </div>
      </LegalSection>

      <LegalSection title="7. Sécurité">
        <ul className={LIST}>
          <li>Toutes les pages passent par une connexion chiffrée (HTTPS).</li>
          <li>Les mots de passe sont enregistrés sous une forme chiffrée irréversible.</li>
          <li>Les pièces d'identité sont rangées dans un espace privé : seul l'administrateur peut les voir, par des liens temporaires de 10 minutes.</li>
          <li>Chaque fichier vendu est analysé par un antivirus avant d'être proposé.</li>
        </ul>
      </LegalSection>

      <LegalSection title="8. Vos droits">
        <p>Vous pouvez à tout moment :</p>
        <ul className={LIST}>
          <li>savoir quelles données nous avons sur vous et en obtenir une copie ;</li>
          <li>les faire corriger ou effacer, sauf celles que la loi nous oblige à garder ;</li>
          <li>vous opposer à un traitement ou en demander la limitation ;</li>
          <li>récupérer vos données dans un format courant ;</li>
          <li>retirer votre accord lorsqu'un traitement repose sur lui.</li>
        </ul>
        <p>
          Écrivez-nous depuis le <Link href="/contact?sujet=personal_data" className={LINK}>formulaire de contact</Link> (sujet « Données
          personnelles ») : nous répondons sous 30 jours et pouvons vous demander de prouver votre identité. Vous pouvez aussi saisir l'autorité de
          protection des données personnelles prévue par la loi.
        </p>
      </LegalSection>

      <LegalSection title="9. Cookies et stockage dans votre navigateur">
        <ul className={LIST}>
          <li>Aucun cookie publicitaire ni outil de suivi tiers.</li>
          <li>La boutique garde votre panier et votre commande en cours dans la mémoire de votre navigateur.</li>
          <li>L'espace vendeur utilise un cookie de session et garde votre connexion dans votre navigateur.</li>
          <li>Vous pouvez effacer ces informations à tout moment dans les réglages de votre navigateur.</li>
        </ul>
      </LegalSection>

      <LegalSection title="10. Mineurs">
        <p>Les comptes vendeurs sont réservés aux personnes majeures.</p>
      </LegalSection>

      <LegalSection title="11. Modifications">
        <p>
          La date de version figure en haut de cette page. Les changements importants sont annoncés sur le site, et par e-mail aux vendeurs.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
