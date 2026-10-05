'use client';
import { useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, Loader2, Search, Send } from 'lucide-react';
import { formatFcfa } from '@/lib/format';
import {
  DISPUTE_REASONS,
  createDispute,
  findDisputableOrder,
  type DisputableOrder,
  type DisputeReason,
  type MobileMoneyOperator,
} from '@/lib/api/disputes';

const FIELD =
  'w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2.5 text-white placeholder-zinc-500 outline-none transition-colors focus:border-orange-500';
const LABEL = 'mb-1 block text-sm font-medium text-zinc-300';
const CHOICE =
  'flex cursor-pointer gap-3 rounded-lg border border-zinc-800 bg-zinc-900/60 p-3 transition-colors hover:border-zinc-600 has-[:checked]:border-orange-500 has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-50';
const BUTTON =
  'flex w-full items-center justify-center gap-2 rounded-lg bg-orange-500 px-6 py-3 font-semibold text-white transition-colors hover:bg-orange-600 disabled:opacity-60 sm:w-auto';

const formatDate = (iso: string) =>
  new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Douala' }).format(new Date(iso));

/**
 * Demande de remboursement en deux étapes : retrouver la commande (numéro + e-mail), puis choisir le
 * produit, le motif et le compte Mobile Money qui recevra l'argent.
 */
export function DisputeForm({ initialOrderNumber }: { initialOrderNumber: string }) {
  const [orderNumber, setOrderNumber] = useState(initialOrderNumber);
  const [email, setEmail] = useState('');
  const [order, setOrder] = useState<DisputableOrder | null>(null);
  const [itemId, setItemId] = useState('');
  const [reason, setReason] = useState<DisputeReason | ''>('');
  const [description, setDescription] = useState('');
  const [operator, setOperator] = useState<MobileMoneyOperator | ''>('');
  const [phone, setPhone] = useState('');
  const [accountName, setAccountName] = useState('');
  const [website, setWebsite] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ reference: string | null; withSeller: boolean } | null>(null);

  const find = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const number = orderNumber.trim().toUpperCase();
    if (!/^BS-\d{4}-\d{5}$/.test(number)) return setError('Indiquez le numéro de commande tel qu’il figure dans l’e-mail (ex. : BS-2026-12345).');
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setError('Indiquez l’adresse e-mail utilisée pour la commande.');
    setBusy(true);
    try {
      const found = await findDisputableOrder(number, email.trim());
      setOrder(found);
      setItemId(found.items.find((item) => !item.blocker)?.id ?? '');
      setReason(found.open ? '' : 'double_payment');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Commande introuvable pour le moment.');
    } finally {
      setBusy(false);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!order) return;
    setError(null);
    if (!itemId) return setError('Choisissez le produit concerné.');
    if (!reason) return setError('Choisissez le motif de votre demande.');
    if (description.trim().length < 20) return setError('Décrivez le problème en quelques phrases (20 caractères au moins).');
    if (!operator) return setError('Choisissez le compte qui recevra le remboursement : Orange Money ou MTN Mobile Money.');
    if (phone.replace(/\D/g, '').length < 9) return setError('Indiquez le numéro Mobile Money qui recevra le remboursement.');
    if (accountName.trim().length < 3) return setError('Indiquez le nom du titulaire du compte Mobile Money.');
    setBusy(true);
    try {
      const result = await createDispute({
        orderNumber: order.orderNumber,
        email: email.trim(),
        orderItemId: itemId,
        reason,
        description: description.trim(),
        refundOperator: operator,
        refundPhone: phone.trim(),
        refundAccountName: accountName.trim(),
        website,
      });
      setDone({ reference: result.reference, withSeller: result.withSeller });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'La demande n’a pas pu être envoyée.');
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <div className="rounded-xl border border-green-800 bg-green-950/40 p-6 text-green-200" role="status">
        <CheckCircle2 className="mb-3 h-6 w-6" aria-hidden="true" />
        <p className="font-semibold">
          Demande enregistrée{done.reference ? <> sous la référence <strong>{done.reference}</strong></> : null}.
        </p>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-green-300/90">
          <li>Un e-mail de confirmation vient de vous être envoyé (pensez à regarder dans les courriers indésirables).</li>
          <li>
            {done.withSeller
              ? 'Le vendeur a 5 jours pour vous répondre ou corriger son produit ; notre équipe décide ensuite et vous écrit.'
              : 'Notre équipe examine votre demande et vous écrit, en général sous 5 jours ouvrés.'}
          </li>
          <li>Si la demande est acceptée, l’argent vous est renvoyé par Mobile Money sous 10 jours ouvrés.</li>
        </ul>
      </div>
    );
  }

  const errorBox = error && (
    <p className="rounded-lg border border-red-900 bg-red-950/50 px-3 py-2 text-sm text-red-300" role="alert">
      {error}
    </p>
  );

  if (!order) {
    return (
      <form onSubmit={find} noValidate className="space-y-4">
        <h2 className="text-lg font-semibold text-white">1. Retrouvez votre commande</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="orderNumber" className={LABEL}>Numéro de commande</label>
            <input id="orderNumber" value={orderNumber} onChange={(e) => setOrderNumber(e.target.value)} maxLength={20} placeholder="BS-2026-12345" autoComplete="off" className={FIELD} />
          </div>
          <div>
            <label htmlFor="email" className={LABEL}>E-mail utilisé pour la commande</label>
            <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={150} autoComplete="email" className={FIELD} />
          </div>
        </div>
        <p className="text-xs text-zinc-500">
          Le numéro commence par BS- : il figure dans l’e-mail de confirmation de la commande. Débité sans commande confirmée ?{' '}
          <Link href="/contact?sujet=refund" className="text-orange-400 hover:underline">Écrivez-nous</Link>.
        </p>
        {errorBox}
        <button type="submit" disabled={busy} className={BUTTON}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Search className="h-4 w-4" aria-hidden="true" />}
          {busy ? 'Recherche…' : 'Retrouver ma commande'}
        </button>
      </form>
    );
  }

  const eligibleItems = order.items.filter((item) => !item.blocker);
  const canRequest = eligibleItems.length > 0 && (order.open || order.openForDoublePayment);

  return (
    <form onSubmit={submit} noValidate className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-zinc-800 bg-zinc-900/60 px-4 py-3 text-sm">
        <p className="text-zinc-300">
          Commande <strong className="text-white">{order.orderNumber}</strong>, payée le {formatDate(order.paidAt)}
        </p>
        <button type="button" onClick={() => { setOrder(null); setError(null); }} className="text-orange-400 hover:underline">
          Changer de commande
        </button>
      </div>

      {!order.open && (
        <p className="rounded-lg border border-amber-900 bg-amber-950/40 px-3 py-2 text-sm text-amber-200">
          {order.openForDoublePayment
            ? `Le délai de 7 jours est dépassé (il courait jusqu’au ${formatDate(order.deadline)}) : seule une demande pour double paiement est encore possible, jusqu’au ${formatDate(order.doublePaymentDeadline)}.`
            : `Le délai pour demander un remboursement est dépassé : 7 jours après l’achat, 30 jours pour un double paiement (jusqu’au ${formatDate(order.doublePaymentDeadline)}).`}
        </p>
      )}

      <fieldset className="space-y-2">
        <legend className="mb-2 text-lg font-semibold text-white">2. Produit concerné</legend>
        {order.items.map((item) => (
          <label key={item.id} className={CHOICE}>
            <input type="radio" name="item" value={item.id} checked={itemId === item.id} disabled={!!item.blocker} onChange={() => setItemId(item.id)} className="mt-1 accent-orange-500" />
            <span className="text-sm">
              <span className="font-medium text-white">{item.productName}</span>
              <span className="text-zinc-400"> — {formatFcfa(item.price)}</span>
              {item.blocker && <span className="block text-xs text-zinc-500">{item.blocker}</span>}
            </span>
          </label>
        ))}
      </fieldset>

      {canRequest && (
        <>
          <fieldset className="space-y-2">
            <legend className="mb-2 text-lg font-semibold text-white">3. Motif</legend>
            {DISPUTE_REASONS.map((r) => {
              const disabled = r.value === 'double_payment' ? !order.openForDoublePayment : !order.open;
              return (
                <label key={r.value} className={CHOICE}>
                  <input type="radio" name="reason" value={r.value} checked={reason === r.value} disabled={disabled} onChange={() => setReason(r.value)} className="mt-1 accent-orange-500" />
                  <span className="text-sm">
                    <span className="font-medium text-white">{r.label}</span>
                    <span className="block text-xs text-zinc-400">{r.hint}</span>
                  </span>
                </label>
              );
            })}
            <p className="text-xs text-zinc-500">
              Un changement d’avis après le téléchargement n’est pas remboursé (voir la{' '}
              <Link href="/remboursements" className="text-orange-400 hover:underline">politique de remboursement</Link>).
            </p>
          </fieldset>

          <div>
            <label htmlFor="description" className="mb-1 block text-lg font-semibold text-white">4. Le problème</label>
            <textarea
              id="description"
              rows={5}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={3000}
              placeholder="Que se passe-t-il ? Message d’erreur affiché, appareil utilisé, ce que vous attendiez…"
              className={FIELD}
            />
            <p className="mt-1 text-right text-xs text-zinc-600">{description.length} / 3 000</p>
          </div>

          <fieldset className="space-y-3">
            <legend className="mb-1 text-lg font-semibold text-white">5. Compte qui recevra le remboursement</legend>
            <p className="text-xs text-zinc-500">Le compte qui a servi au paiement, ou un autre compte Mobile Money à votre nom.</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {(
                [
                  ['orange', 'Orange Money'],
                  ['mtn', 'MTN Mobile Money'],
                ] as const
              ).map(([value, label]) => (
                <label key={value} className={CHOICE}>
                  <input type="radio" name="operator" value={value} checked={operator === value} onChange={() => setOperator(value)} className="accent-orange-500" />
                  <span className="text-sm font-medium text-white">{label}</span>
                </label>
              ))}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="phone" className={LABEL}>Numéro Mobile Money</label>
                <input id="phone" type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={20} placeholder="6 99 00 00 00" autoComplete="tel" className={FIELD} />
              </div>
              <div>
                <label htmlFor="accountName" className={LABEL}>Nom du titulaire du compte</label>
                <input id="accountName" value={accountName} onChange={(e) => setAccountName(e.target.value)} maxLength={160} autoComplete="name" className={FIELD} />
              </div>
            </div>
          </fieldset>

          {/* Champ piège invisible : seuls les robots le remplissent. */}
          <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
            <label htmlFor="website">Ne pas remplir</label>
            <input id="website" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
          </div>

          {errorBox}
          <button type="submit" disabled={busy} className={BUTTON}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Send className="h-4 w-4" aria-hidden="true" />}
            {busy ? 'Envoi…' : 'Envoyer ma demande'}
          </button>
          <p className="text-xs text-zinc-500">
            Vos informations servent seulement à traiter cette demande (voir la{' '}
            <Link href="/confidentialite" className="text-orange-400 hover:underline">politique de confidentialité</Link>). Le vendeur voit votre
            prénom et votre message, jamais votre e-mail ni votre numéro.
          </p>
        </>
      )}

      {!canRequest && errorBox}
      {!canRequest && order.open && eligibleItems.length === 0 && (
        <p className="text-sm text-zinc-400">
          Aucun produit de cette commande ne peut faire l’objet d’une nouvelle demande. Une question ?{' '}
          <Link href={`/contact?sujet=refund&commande=${order.orderNumber}`} className="text-orange-400 hover:underline">Écrivez-nous</Link>.
        </p>
      )}
    </form>
  );
}
