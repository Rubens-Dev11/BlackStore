import type { Metadata } from 'next';
import Link from 'next/link';
import type { ComponentProps } from 'react';
import { Ban, Clock, Download, FileX, LayoutGrid, Link2Off, Mail, RotateCw, ShieldCheck } from 'lucide-react';
import { ErrorPanel } from '@/components/errors/error-panel';
import { downloadFileUrl, fetchDownloadStatus, type DownloadStatus } from '@/lib/api/downloads';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Téléchargement',
  robots: { index: false, follow: false },
  // L'adresse contient le lien personnel du client : elle ne doit pas partir vers d'autres sites.
  referrer: 'no-referrer',
};

interface Props {
  params: { token: string };
}

const formatDate = (iso: string) =>
  new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Africa/Douala',
  }).format(new Date(iso));

const CATALOGUE = { label: 'Voir le catalogue', href: '/', icon: LayoutGrid };

/** Demande de réactivation : le formulaire de contact arrive prérempli avec la commande. */
const contactFor = (status: DownloadStatus) => ({
  label: 'Demander un nouveau lien',
  href: `/contact?sujet=order${status.commande ? `&commande=${encodeURIComponent(status.commande)}` : ''}`,
  icon: Mail,
});

function detailsOf(status: DownloadStatus, withExpiry: boolean) {
  const details: Array<{ label: string; value: string }> = [];
  if (status.produit) details.push({ label: 'Produit', value: status.produit });
  if (status.commande) details.push({ label: 'Commande', value: status.commande });
  if (withExpiry && status.expireLe) details.push({ label: 'Valable jusqu’au', value: formatDate(status.expireLe) });
  return details;
}

/**
 * Page d'un lien de téléchargement : l'API y renvoie le client quand son lien
 * ne marche pas (expiré, épuisé, remboursé…), avec l'explication et la marche à suivre.
 */
export default async function DownloadPage({ params }: Props) {
  const status = await fetchDownloadStatus(params.token);
  const fileUrl = downloadFileUrl(params.token);
  const panel = describe(status, fileUrl);
  return <ErrorPanel {...panel} />;
}

function describe(status: DownloadStatus, fileUrl: string): ComponentProps<typeof ErrorPanel> {
  switch (status.etat) {
    case 'valide': {
      const remaining = status.telechargementsRestants ?? 0;
      const details = detailsOf(status, true);
      details.push({ label: 'Téléchargements restants', value: `${remaining} sur ${status.telechargementsMax ?? remaining}` });
      return {
        icon: Download,
        tone: 'success',
        title: 'Votre fichier est prêt',
        details,
        primary: { label: 'Télécharger', externalHref: fileUrl, icon: Download },
        secondary: CATALOGUE,
        children: (
          <>
            <p>Le téléchargement démarre dès que vous appuyez sur le bouton. Chaque appui compte comme un téléchargement.</p>
            <p className="text-sm">
              Le fichier ne fonctionne pas ou ne correspond pas à sa description ?{' '}
              <Link
                href={`/remboursements/demande${status.commande ? `?commande=${encodeURIComponent(status.commande)}` : ''}`}
                className="font-medium text-orange-400 hover:underline"
              >
                Demandez un remboursement
              </Link>{' '}
              dans les 7 jours qui suivent l&apos;achat.
            </p>
          </>
        ),
      };
    }
    case 'verification':
      return {
        icon: ShieldCheck,
        tone: 'warning',
        eyebrow: 'Vérification en cours',
        title: 'Votre fichier est en cours de vérification',
        details: detailsOf(status, false),
        primary: { label: 'Réessayer', externalHref: fileUrl, icon: RotateCw },
        secondary: CATALOGUE,
        children: (
          <>
            <p>Le vendeur vient de mettre ce fichier à jour : notre antivirus l&apos;analyse avant de vous le livrer. Cela prend en général quelques minutes.</p>
            <p>Votre lien reste valable : réessayez un peu plus tard.</p>
          </>
        ),
      };
    case 'expire':
      return {
        icon: Clock,
        tone: 'warning',
        eyebrow: 'Lien expiré',
        title: 'Ce lien de téléchargement a expiré',
        details: [...detailsOf(status, false), ...(status.expireLe ? [{ label: 'Expiré le', value: formatDate(status.expireLe) }] : [])],
        primary: contactFor(status),
        secondary: CATALOGUE,
        helpHref: null,
        children: (
          <>
            <p>Pour votre sécurité, chaque lien ne fonctionne que pendant une durée limitée après l&apos;achat.</p>
            <p>Votre achat reste enregistré : écrivez-nous avec votre numéro de commande et nous réactiverons ce lien.</p>
          </>
        ),
      };
    case 'quota':
      return {
        icon: Ban,
        tone: 'warning',
        eyebrow: 'Limite atteinte',
        title: 'Tous les téléchargements de ce lien ont été utilisés',
        details: detailsOf(status, false),
        primary: contactFor(status),
        secondary: CATALOGUE,
        helpHref: null,
        children: (
          <>
            <p>
              Ce lien permet {status.telechargementsMax ?? 3} téléchargements, et ils ont tous servi. Le fichier ne s&apos;est pas téléchargé correctement, ou vous
              l&apos;avez perdu ?
            </p>
            <p>Écrivez-nous avec votre numéro de commande : nous réactiverons votre lien.</p>
          </>
        ),
      };
    case 'annule':
      return {
        icon: Ban,
        tone: 'danger',
        eyebrow: 'Lien désactivé',
        title: "Ce lien n'est plus valable",
        details: detailsOf(status, false),
        primary: { label: 'Nous contacter', href: contactFor(status).href, icon: Mail },
        secondary: CATALOGUE,
        helpHref: null,
        children: <p>La commande liée à ce lien a été remboursée ou annulée : le téléchargement n&apos;est plus possible. S&apos;il s&apos;agit d&apos;une erreur, écrivez-nous avec votre numéro de commande.</p>,
      };
    case 'indisponible':
      return {
        icon: FileX,
        tone: 'danger',
        eyebrow: 'Fichier indisponible',
        title: "Ce fichier n'est pas disponible pour le moment",
        details: detailsOf(status, false),
        primary: { label: 'Nous contacter', href: contactFor(status).href, icon: Mail },
        secondary: CATALOGUE,
        helpHref: null,
        children: <p>Le fichier de ce produit est en cours de remplacement, ou il a été retiré après une vérification. Écrivez-nous avec votre numéro de commande : nous vous aiderons.</p>,
      };
    default:
      return {
        icon: Link2Off,
        tone: 'danger',
        eyebrow: 'Lien introuvable',
        title: "Ce lien de téléchargement n'existe pas",
        primary: { label: 'Nous contacter', href: '/contact?sujet=order', icon: Mail },
        secondary: CATALOGUE,
        helpHref: null,
        children: (
          <>
            <p>Ouvrez le lien directement depuis votre e-mail de confirmation : quand on le copie, il arrive qu&apos;il soit coupé.</p>
            <p>Toujours bloqué ? Écrivez-nous avec votre numéro de commande.</p>
          </>
        ),
      };
  }
}
