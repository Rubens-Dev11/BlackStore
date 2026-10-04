import type { Metadata } from 'next';
import Link from 'next/link';
import { LegalPage, LegalSection } from '@/components/legal/legal-page';
import { fetchLegalInfo, whatsappUrl } from '@/lib/api/legal';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Mentions légales',
  description: 'Éditeur, hébergeur et contact du site BlackStore.',
};

const LINK = 'text-orange-400 hover:underline';
const ROW = 'grid gap-1 border-b border-zinc-800 py-2 sm:grid-cols-[12rem_1fr]';

export default async function LegalNoticePage() {
  const info = await fetchLegalInfo();
  const { operator, contact } = info;
  const whatsapp = whatsappUrl(contact.phone);

  return (
    <LegalPage
      title="Mentions légales"
      version={info.version}
      current="/mentions-legales"
      intro="Qui édite et héberge BlackStore, et comment nous joindre."
    >
      <LegalSection title="Éditeur du site">
        <div>
          <div className={ROW}>
            <span className="text-zinc-500">Nom</span>
            <span className="text-zinc-200">{operator.name ?? 'BlackStore'}</span>
          </div>
          <div className={ROW}>
            <span className="text-zinc-500">Statut</span>
            <span className="text-zinc-200">{operator.form ?? 'Activité en cours d’immatriculation'}</span>
          </div>
          {operator.address && (
            <div className={ROW}>
              <span className="text-zinc-500">Adresse</span>
              <span className="text-zinc-200">{operator.address}</span>
            </div>
          )}
          <div className={ROW}>
            <span className="text-zinc-500">RCCM</span>
            <span className="text-zinc-200">{operator.rccm ?? 'Immatriculation en cours'}</span>
          </div>
          {operator.niu && (
            <div className={ROW}>
              <span className="text-zinc-500">NIU</span>
              <span className="text-zinc-200">{operator.niu}</span>
            </div>
          )}
          <div className={ROW}>
            <span className="text-zinc-500">Directeur de la publication</span>
            <span className="text-zinc-200">{operator.name ?? 'Le responsable de BlackStore'}</span>
          </div>
        </div>
      </LegalSection>

      <LegalSection title="Contact">
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <Link href="/contact" className={LINK}>Formulaire de contact</Link> : réponse par e-mail, en général sous 2 jours ouvrés.
          </li>
          {contact.email && (
            <li>
              E-mail : <a href={`mailto:${contact.email}`} className={LINK}>{contact.email}</a>
            </li>
          )}
          {contact.phone && (
            <li>
              Téléphone et WhatsApp : {contact.phone}
              {whatsapp && (
                <>
                  {' '}(<a href={whatsapp} target="_blank" rel="noopener noreferrer" className={LINK}>écrire sur WhatsApp</a>)
                </>
              )}
            </li>
          )}
        </ul>
      </LegalSection>

      <LegalSection title="Hébergement">
        <p>{info.hosting ?? 'Serveur situé à Douala (Cameroun).'}</p>
      </LegalSection>

      <LegalSection title="Propriété intellectuelle">
        <p>
          La marque BlackStore, le site et ses textes appartiennent à leur éditeur. Les produits vendus, leurs noms, images et vidéos appartiennent
          à leurs vendeurs ou à leurs auteurs. Toute reproduction sans autorisation est interdite.
        </p>
      </LegalSection>

      <LegalSection title="Signaler un contenu">
        <p>
          Un produit vous semble piraté, dangereux ou illégal ? Utilisez le lien « Signaler ce produit » sur sa fiche, ou le{' '}
          <Link href="/contact" className={LINK}>formulaire de contact</Link>. Chaque signalement est examiné.
        </p>
      </LegalSection>

      <LegalSection title="Droit applicable">
        <p>
          Le site est soumis au droit camerounais. Voir aussi les <Link href="/conditions-generales" className={LINK}>conditions générales</Link> et
          la <Link href="/confidentialite" className={LINK}>politique de confidentialité</Link>.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
