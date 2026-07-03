'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Loader2, ShieldCheck } from 'lucide-react';
import { formatFcfa } from '@/lib/format';
import { useCartStore } from '@/stores/use-cart-store';
import { createOrder, initiatePayment } from '@/lib/api/orders';

import { checkoutSchema, CheckoutFormData } from '@/lib/validations';

export function CheckoutPageClient() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const { items, getTotalAmount, clearCart } = useCartStore();
  const [form, setForm] = useState<CheckoutFormData>({
    customerName: '',
    customerEmail: '',
    customerPhone: '',
  });
  const [errors, setErrors] = useState<Partial<Record<keyof CheckoutFormData, string>>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [isCompletingOrder, setIsCompletingOrder] = useState(false);

  useEffect(() => setMounted(true), []);

  // Rediriger si panier vide (après mount), mais pas en cours de finalisation de commande
  useEffect(() => {
    if (mounted && items.length === 0 && !isCompletingOrder) {
      router.replace('/panier');
    }
  }, [mounted, items, router, isCompletingOrder]);

  if (!mounted || items.length === 0) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
      </div>
    );
  }

  const total = getTotalAmount();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const name = e.target.name as keyof CheckoutFormData;
    const value = e.target.value;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: undefined }));
    }
  };

  const handleSubmit = async () => {
    setGlobalError(null);

    const result = checkoutSchema.safeParse(form);
    if (!result.success) {
      const fieldErrors: Partial<Record<keyof CheckoutFormData, string>> = {};
      result.error.issues.forEach((issue) => {
        const path = issue.path[0] as keyof CheckoutFormData;
        if (!fieldErrors[path]) {
          fieldErrors[path] = issue.message;
        }
      });
      setErrors(fieldErrors);
      return;
    }

    setIsSubmitting(true);
    setIsCompletingOrder(true); // Empêche la redirection vers /panier pendant la finalisation

    try {
      // Map cart items to order items with quantity
      const orderItems = items.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
      }));

      // 1. Créer la commande
      const order = await createOrder({
        customerName: form.customerName.trim(),
        customerEmail: form.customerEmail.toLowerCase().trim(),
        customerPhone: form.customerPhone?.trim() ?? '',
        items: orderItems,
        // totalAmount and currency are removed as they are not expected by the DTO
      });

      // 2. Stocker en sessionStorage pour la page succès (Option A)
      sessionStorage.setItem(
        'blackstore_pending_order',
        JSON.stringify({
          orderNumber: order.orderNumber,
          buyerEmail: order.buyerEmail,
        }),
      );

      // 3. Pour les commandes gratuites, pas besoin de paiement - rediriger directement vers succès
      if (total === 0) {
        // 4. Vider le panier AVANT la redirection
        clearCart();

        // 5. Redirection vers la page de succès
        router.push('/commande/succes');
        return;
      }

      // 3. Initier le paiement (pour les commandes payantes)
      const payment = await initiatePayment({
        orderId: order.id,
        currency: 'XAF',
      });

      // 4. Vider le panier AVANT la redirection
      clearCart();

      // 5. Redirection vers CinetPay
      window.location.href = payment.paymentUrl;
    } catch (err) {
      setGlobalError(
        err instanceof Error ? err.message : 'Une erreur est survenue. Veuillez réessayer.',
      );
      setIsSubmitting(false);
      setIsCompletingOrder(false); // Réactive la redirection si erreur
    }
  };

  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-8 animate-fade-in">
      {/* Retour */}
      <Link
        href="/panier"
        className="mb-6 inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-white transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Retour au panier
      </Link>

      <h1 className="mb-6 text-2xl font-bold text-white sm:mb-8 sm:text-3xl">
        Finaliser la commande
      </h1>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        {/* Formulaire */}
        <div className="space-y-5">
          <h2 className="text-lg font-semibold text-white">
            Vos informations
          </h2>

          {/* Nom */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-zinc-300">
              Nom complet
            </label>
            <input
              type="text"
              name="customerName"
              value={form.customerName}
              onChange={handleChange}
              placeholder="Ex : Jean Dupont"
              className={`w-full rounded-lg border px-4 py-2.5 text-sm text-white bg-zinc-800 placeholder-zinc-500 outline-none transition-colors ${
                errors.customerName
                  ? 'border-red-500 focus:border-red-400'
                  : 'border-zinc-700 focus:border-orange-500'
              }`}
            />
            {errors.customerName && (
              <p className="mt-1 text-xs text-red-400">{errors.customerName}</p>
            )}
          </div>

          {/* Email */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-zinc-300">
              Adresse email
            </label>
            <input
              type="email"
              name="customerEmail"
              value={form.customerEmail}
              onChange={handleChange}
              placeholder="vous@exemple.cm"
              className={`w-full rounded-lg border px-4 py-2.5 text-sm text-white bg-zinc-800 placeholder-zinc-500 outline-none transition-colors ${
                errors.customerEmail
                  ? 'border-red-500 focus:border-red-400'
                  : 'border-zinc-700 focus:border-orange-500'
              }`}
            />
            {errors.customerEmail && (
              <p className="mt-1 text-xs text-red-400">{errors.customerEmail}</p>
            )}
            <p className="mt-1 text-xs text-zinc-500">
              Vos tokens de téléchargement seront envoyés à cet email.
            </p>
          </div>

          {/* Téléphone */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-zinc-300">
              Numéro de téléphone
            </label>
            <input
              type="tel"
              name="customerPhone"
              value={form.customerPhone}
              onChange={handleChange}
              placeholder="Ex : 655 00 00 00"
              className={`w-full rounded-lg border px-4 py-2.5 text-sm text-white bg-zinc-800 placeholder-zinc-500 outline-none transition-colors ${
                errors.customerPhone
                  ? 'border-red-500 focus:border-red-400'
                  : 'border-zinc-700 focus:border-orange-500'
              }`}
            />
            {errors.customerPhone && (
              <p className="mt-1 text-xs text-red-400">{errors.customerPhone}</p>
            )}
            <p className="mt-1 text-xs text-zinc-500">
              Orange Money ou MTN Mobile Money acceptés.
            </p>
          </div>

          {/* Erreur globale */}
          {globalError && (
            <div className="rounded-lg border border-red-500/30 bg-red-900/20 px-4 py-3 text-sm text-red-400">
              {globalError}
            </div>
          )}

          {/* Bouton payer */}
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-orange-500 py-3 font-semibold text-white transition-colors hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {total === 0 ? 'Préparation du téléchargement…' : 'Redirection vers CinetPay…'}
              </>
            ) : (
              <>
                <ShieldCheck className="h-4 w-4" />
                {total === 0 ? `Télécharger maintenant` : `Payer {formatFcfa(total)} — Mobile Money`}
              </>
            )}
          </button>

          {/* Rassurance */}
          <p className="text-center text-xs text-zinc-500">
            🔒 Paiement sécurisé par CinetPay · Orange Money · MTN MoMo · Carte
          </p>
        </div>

        {/* Récapitulatif */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5 h-fit">
          <h2 className="mb-4 text-lg font-semibold text-white">
            Récapitulatif
          </h2>
          <div className="space-y-3">
            {items.map((item) => (
              <div key={item.productId} className="flex items-start gap-3 text-sm">
                <span className="flex-1 text-zinc-300">
                  {item.name}
                  <span className="ml-1 text-zinc-500">× {item.quantity}</span>
                </span>
                <span className="flex-shrink-0 font-medium text-white">
                  {formatFcfa(item.price * item.quantity)}
                </span>
              </div>
            ))}
          </div>

          <div className="my-4 border-t border-zinc-700" />

          <div className="flex justify-between text-base font-bold text-white">
            <span>Total à payer</span>
            <span className="text-orange-400">{formatFcfa(total)}</span>
          </div>

          <div className="mt-5 space-y-2 text-xs text-zinc-500">
            <p>✅ Livraison instantanée après paiement confirmé</p>
            <p>✅ Lien de téléchargement par email</p>
            <p>✅ Support disponible si problème</p>
          </div>
        </div>
      </div>
    </div>
  );
}
