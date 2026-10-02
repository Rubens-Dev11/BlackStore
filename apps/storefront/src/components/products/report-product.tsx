'use client';

import { useState } from 'react';
import { Flag } from 'lucide-react';
import { toast } from 'sonner';
import { REPORT_REASONS, submitReport, type ReportReason } from '@/lib/api/reports';

const FIELD_CLASS =
  'w-full rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-sm text-white outline-none focus:border-orange-500';

/** Lien discret « Signaler ce produit », qui déplie un petit formulaire. */
export function ReportProduct({ productId }: { productId: string }) {
  const [open, setOpen] = useState(false);
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [reason, setReason] = useState<ReportReason | ''>('');
  const [details, setDetails] = useState('');
  const [email, setEmail] = useState('');

  if (sent) {
    return (
      <p className="text-sm text-zinc-400">
        Merci : votre signalement a été transmis à l&apos;équipe BlackStore, qui va examiner ce produit.
      </p>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 text-xs text-zinc-500 transition-colors hover:text-zinc-300"
      >
        <Flag className="h-3.5 w-3.5" />
        Signaler ce produit
      </button>
    );
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason) {
      toast.error('Choisissez un motif');
      return;
    }
    if (reason === 'other' && details.trim().length < 10) {
      toast.error('Décrivez le problème en quelques mots');
      return;
    }
    setSending(true);
    try {
      await submitReport({
        productId,
        reason,
        details: details.trim() || undefined,
        email: email.trim() || undefined,
      });
      setSent(true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Le signalement n’a pas pu être envoyé. Réessayez.');
    } finally {
      setSending(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-3 rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
      <p className="text-sm font-semibold text-white">Signaler ce produit</p>
      <fieldset className="space-y-2">
        <legend className="sr-only">Motif</legend>
        {REPORT_REASONS.map((r) => (
          <label key={r.value} className="flex cursor-pointer items-start gap-2 text-sm text-zinc-300">
            <input
              type="radio"
              name="report-reason"
              value={r.value}
              checked={reason === r.value}
              onChange={() => setReason(r.value)}
              className="mt-0.5 accent-orange-500"
            />
            {r.label}
          </label>
        ))}
      </fieldset>
      <textarea
        rows={3}
        maxLength={1000}
        value={details}
        onChange={(e) => setDetails(e.target.value)}
        placeholder={reason === 'other' ? 'Décrivez le problème' : 'Précisions (facultatif)'}
        className={FIELD_CLASS}
      />
      <input
        type="email"
        maxLength={150}
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Votre e-mail, pour être recontacté (facultatif)"
        className={FIELD_CLASS}
      />
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={sending}
          className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-orange-600 disabled:opacity-50"
        >
          {sending ? 'Envoi...' : 'Envoyer le signalement'}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-300 hover:border-zinc-500"
        >
          Annuler
        </button>
      </div>
    </form>
  );
}
