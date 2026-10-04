import type { Metadata } from 'next';
import { Mail, MessageCircle } from 'lucide-react';
import { LegalPage } from '@/components/legal/legal-page';
import { fetchLegalInfo, whatsappUrl } from '@/lib/api/legal';
import { CONTACT_TOPICS, type ContactTopic } from '@/lib/api/contact';
import { ContactForm } from './contact-form';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Contact',
  description: 'Une question sur une commande, un remboursement ou vos données ? Écrivez à l’équipe BlackStore.',
};

interface Props {
  searchParams: { sujet?: string; commande?: string };
}

export default async function ContactPage({ searchParams }: Props) {
  const info = await fetchLegalInfo();
  const topic = CONTACT_TOPICS.some((t) => t.value === searchParams.sujet) ? (searchParams.sujet as ContactTopic) : 'order';
  const orderNumber = /^BS-\d{4}-\d{5}$/i.test(searchParams.commande ?? '') ? searchParams.commande!.toUpperCase() : '';
  const whatsapp = whatsappUrl(info.contact.phone);

  return (
    <LegalPage
      title="Nous contacter"
      current="/contact"
      intro="Une question sur une commande, un téléchargement, un remboursement ou vos données personnelles ? Écrivez-nous : nous répondons par e-mail, en général sous 2 jours ouvrés."
    >
      {(info.contact.email || whatsapp) && (
        <div className="flex flex-wrap gap-3">
          {info.contact.email && (
            <a href={`mailto:${info.contact.email}`} className="inline-flex items-center gap-2 rounded-lg border border-zinc-800 px-3 py-2 text-zinc-300 hover:border-orange-500 hover:text-white">
              <Mail className="h-4 w-4" /> {info.contact.email}
            </a>
          )}
          {whatsapp && (
            <a href={whatsapp} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-lg border border-zinc-800 px-3 py-2 text-zinc-300 hover:border-orange-500 hover:text-white">
              <MessageCircle className="h-4 w-4" /> WhatsApp
            </a>
          )}
        </div>
      )}
      <ContactForm initialTopic={topic} initialOrderNumber={orderNumber} />
    </LegalPage>
  );
}
