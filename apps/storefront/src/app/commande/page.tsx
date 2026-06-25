'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Loader2, ShieldCheck } from 'lucide-react';
import { formatFcfa } from '@/lib/format';
import { useCartStore } from '@/stores/use-cart-store';
import { createOrder, initiatePayment } from '@/lib/api/orders';

interface FormData {
  buyerName: string;
  buyerEmail: string;
  buyerPhone: string;
}

interface FormErrors {
  buyerName?: string;
  buyerEmail?: string;
  buyerPhone?: string;
}

function validate(data: FormData): FormErrors {
  const errors: FormErrors = {};
  if (!data.buyerName.trim() || data.buyerName.trim().length < 2)
    errors.buyerName = 'Nom requis (minimum 2 caractères)';
  if (!data.buyerEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.buyerEmail))
    errors.buyerEmail = 'Adresse email invalide';
  if (!data.buyerPhone.trim() || data.buyerPhone.replace(/\D/g, '').length < 8)
    errors.buyerPhone = 'Numéro de téléphone invalide (min. 8 chiffres)';
  return errors;
}

export default function CheckoutPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const { items, getTotalAmount, clearCart } = useCartStore();
  const [form, setForm] = useState<FormData>({
    buyerName: '',
    buyerEmail: '',
    buyerPhone: '',
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);

  useEffect(() => setMounted(true), []);

  // Rediriger si panier vide (après mount)
  useEffect(() => {
    if (mounted && items.length === 0) {
      router.replace('/panier');
    }
  }, [mounted, items, router]);

  if (!mounted || items.length === 0) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
      </div>
    );
  }

  const total = getTotalAmount();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (errors[name as keyof FormErrors]) {
      setErrors((prev) => ({ ...prev, [name]: undefined }));
    }
  };

  const handleSubmit = async () => {
    setGlobalError(null);
    const validation = validate(form);
    if (Object.keys(validation).length > 0) {
      setErrors(validation);
      return;
    }

    setIsSubmitting(true);

    try {
      // ⚠️ OrderItem n'a PAS de champ quantity — on répète les items selon la quantité
      const orderItems = items.flatMap((item) =>
        Array.from({ length: item.quantity }, () => ({
          productId: item.productId,
          priceAtPurchase: item.price,
        })),
      );

      // 1. Créer la commande
      const order = await createOrder({
        buyerName: form.buyerName.trim(),
        buyerEmail: form.buyerEmail.toLowerCase().trim(),
        buyerPhone: form.buyerPhone.trim(),
        items: orderItems,
        totalAmount: total,
        currency: 'XAF',
      });

      // 2. Stocker en sessionStorage pour la page succès (Option A)
      sessionStorage.setItem(
        'blackstore_pending_order',
        JSON.stringify({
          orderNumber: order.orderNumber,
          buyerEmail: order.buyerEmail,
        }),
      );

      // 3. Initier le paiement
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
    }
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      {/* Retour */}
      <Link
        href="/panier"
        className="mb-6 inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-white transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Retour au panier
      </Link>

      <h1 className="mb-8 text-2xl font-bold text-white">
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
              name="buyerName"
              value={form.buyerName}
              onChange={handleChange}
              placeholder="Ex : Jean Dupont"
              className={`w-full rounded-lg border px-4 py-2.5 text-sm text-white bg-zinc-800 placeholder-zinc-500 outline-none transition-colors ${
                errors.buyerName
                  ? 'border-red-500 focus:border-red-400'
                  : 'border-zinc-700 focus:border-orange-500'
              }`}
            />
            {errors.buyerName && (
              <p className="mt-1 text-xs text-red-400">{errors.buyerName}</p>
            )}
          </div>

          {/* Email */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-zinc-300">
              Adresse email
            </label>
            <input
              type="email"
              name="buyerEmail"
              value={form.buyerEmail}
              onChange={handleChange}
              placeholder="vous@exemple.cm"
              className={`w-full rounded-lg border px-4 py-2.5 text-sm text-white bg-zinc-800 placeholder-zinc-500 outline-none transition-colors ${
                errors.buyerEmail
                  ? 'border-red-500 focus:border-red-400'
                  : 'border-zinc-700 focus:border-orange-500'
              }`}
            />
            {errors.buyerEmail && (
              <p className="mt-1 text-xs text-red-400">{errors.buyerEmail}</p>
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
              name="buyerPhone"
              value={form.buyerPhone}
              onChange={handleChange}
              placeholder="Ex : 655 00 00 00"
              className={`w-full rounded-lg border px-4 py-2.5 text-sm text-white bg-zinc-800 placeholder-zinc-500 outline-none transition-colors ${
                errors.buyerPhone
                  ? 'border-red-500 focus:border-red-400'
                  : 'border-zinc-700 focus:border-orange-500'
              }`}
            />
            {errors.buyerPhone && (
              <p className="mt-1 text-xs text-red-400">{errors.buyerPhone}</p>
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
                Redirection vers CinetPay…
              </>
            ) : (
              <>
                <ShieldCheck className="h-4 w-4" />
                Payer {formatFcfa(total)} — Mobile Money
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
