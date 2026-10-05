'use client';
import { useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, Loader2, Send } from 'lucide-react';
import { CONTACT_TOPICS, sendContactMessage, type ContactMessage, type ContactTopic } from '@/lib/api/contact';

const FIELD =
  'w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2.5 text-white placeholder-zinc-500 outline-none transition-colors focus:border-orange-500';

interface Props {
  initialTopic: ContactTopic;
  initialOrderNumber: string;
}

/** Formulaire de contact : la réponse arrive par e-mail. */
export function ContactForm({ initialTopic, initialOrderNumber }: Props) {
  const [form, setForm] = useState<ContactMessage>({
    topic: initialTopic,
    name: '',
    email: '',
    orderNumber: initialOrderNumber,
    message: '',
    website: '',
  });
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<string | null>(null);

  const set = (field: keyof ContactMessage) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (form.name.trim().length < 2) return setError('Indiquez votre nom.');
    if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) return setError("Indiquez une adresse e-mail valide : c'est là que nous vous répondrons.");
    if (form.message.trim().length < 10) return setError('Décrivez votre demande en quelques mots.');
    setSending(true);
    try {
      setSent(await sendContactMessage({ ...form, orderNumber: form.orderNumber.trim().toUpperCase() }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Envoi impossible pour le moment.');
    } finally {
      setSending(false);
    }
  };

  if (sent) {
    return (
      <div className="rounded-xl border border-green-800 bg-green-950/40 p-6 text-green-200" role="status">
        <CheckCircle2 className="mb-3 h-6 w-6" />
        <p className="font-semibold">{sent}</p>
        <p className="mt-2 text-sm text-green-300/80">Pensez à regarder dans vos courriers indésirables si vous ne voyez pas notre réponse.</p>
      </div>
    );
  }

  const needsOrder = form.topic === 'order' || form.topic === 'refund';

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <div>
        <label htmlFor="topic" className="mb-1 block text-sm font-medium text-zinc-300">Sujet</label>
        <select id="topic" value={form.topic} onChange={set('topic')} className={FIELD}>
          {CONTACT_TOPICS.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
        {form.topic === 'refund' && (
          <p className="mt-2 rounded-lg border border-orange-900/60 bg-orange-950/30 px-3 py-2 text-sm text-orange-200">
            Pour demander le remboursement d'un produit acheté, utilisez le{' '}
            <Link
              href={`/remboursements/demande${/^BS-\d{4}-\d{5}$/i.test(form.orderNumber) ? `?commande=${form.orderNumber.toUpperCase()}` : ''}`}
              className="font-semibold text-orange-400 hover:underline"
            >
              formulaire de remboursement
            </Link>{' '}
            : votre demande est suivie jusqu'au versement. Ce formulaire-ci sert aux autres questions (par exemple un débit sans commande confirmée).
          </p>
        )}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="name" className="mb-1 block text-sm font-medium text-zinc-300">Votre nom</label>
          <input id="name" value={form.name} onChange={set('name')} maxLength={100} autoComplete="name" className={FIELD} />
        </div>
        <div>
          <label htmlFor="email" className="mb-1 block text-sm font-medium text-zinc-300">Votre e-mail</label>
          <input id="email" type="email" value={form.email} onChange={set('email')} maxLength={150} autoComplete="email" className={FIELD} />
        </div>
      </div>
      <div>
        <label htmlFor="orderNumber" className="mb-1 block text-sm font-medium text-zinc-300">
          Numéro de commande {needsOrder ? '' : '(facultatif)'}
        </label>
        <input id="orderNumber" value={form.orderNumber} onChange={set('orderNumber')} maxLength={30} placeholder="BS-2026-12345" className={FIELD} />
      </div>
      <div>
        <label htmlFor="message" className="mb-1 block text-sm font-medium text-zinc-300">Votre message</label>
        <textarea id="message" rows={6} value={form.message} onChange={set('message')} maxLength={3000} className={FIELD} />
        <p className="mt-1 text-right text-xs text-zinc-600">{form.message.length} / 3 000</p>
      </div>
      {/* Champ piège invisible : seuls les robots le remplissent. */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label htmlFor="website">Ne pas remplir</label>
        <input id="website" tabIndex={-1} autoComplete="off" value={form.website} onChange={set('website')} />
      </div>
      {error && <p className="rounded-lg border border-red-900 bg-red-950/50 px-3 py-2 text-sm text-red-300" role="alert">{error}</p>}
      <button
        type="submit"
        disabled={sending}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-orange-500 px-6 py-3 font-semibold text-white transition-colors hover:bg-orange-600 disabled:opacity-60 sm:w-auto"
      >
        {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        {sending ? 'Envoi…' : 'Envoyer'}
      </button>
      <p className="text-xs text-zinc-500">
        Vos informations servent seulement à répondre à votre demande (voir la{' '}
        <Link href="/confidentialite" className="text-orange-400 hover:underline">politique de confidentialité</Link>).
      </p>
    </form>
  );
}
