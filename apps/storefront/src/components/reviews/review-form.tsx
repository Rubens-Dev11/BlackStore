'use client';

import { useState } from 'react';
import { Star } from 'lucide-react';
import { toast } from 'sonner';
import { reviewSchema, ReviewFormData } from '@/lib/validations';
import { submitReview } from '@/lib/api/reviews';

interface Props {
  productId: string;
  onSuccess?: () => void;
}

export function ReviewForm({ productId, onSuccess }: Props) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hoverRating, setHoverRating] = useState(0);
  const [form, setForm] = useState<ReviewFormData>({
    buyerEmail: '',
    rating: 5,
    comment: '',
  });
  const [errors, setErrors] = useState<Partial<Record<keyof ReviewFormData, string>>>({});

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    
    // Validation Zod manual
    const result = reviewSchema.safeParse(form);
    if (!result.success) {
      const fieldErrors: any = {};
      result.error.issues.forEach((issue) => {
        fieldErrors[issue.path[0]] = issue.message;
      });
      setErrors(fieldErrors);
      return;
    }

    setIsSubmitting(true);
    try {
      await submitReview(productId, result.data);
      toast.success('Merci pour votre avis ! Il sera visible après modération.');
      setForm({ buyerEmail: '', rating: 5, comment: '' });
      onSuccess?.();
    } catch (error: any) {
      toast.error(error.message || 'Une erreur est survenue');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
      <h3 className="mb-4 text-lg font-semibold text-white">Laisser un avis</h3>
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Email */}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-zinc-400">
            Email de commande <span className="text-orange-500">*</span>
          </label>
          <input
            type="email"
            value={form.buyerEmail}
            onChange={(e) => setForm({ ...form, buyerEmail: e.target.value })}
            placeholder="votre@email.com"
            className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-white outline-none transition-focus focus:border-orange-500"
          />
          {errors.buyerEmail && (
            <p className="mt-1 text-xs text-red-500">{errors.buyerEmail}</p>
          )}
          <p className="mt-1 text-[10px] text-zinc-500">
            Seuls les clients ayant acheté ce produit peuvent laisser un avis.
          </p>
        </div>

        {/* Note */}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-zinc-400">
            Note <span className="text-orange-500">*</span>
          </label>
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                className="p-1 transition-transform hover:scale-110 active:scale-95"
                onMouseEnter={() => setHoverRating(star)}
                onMouseLeave={() => setHoverRating(0)}
                onClick={() => setForm({ ...form, rating: star })}
              >
                <Star
                  className={`h-6 w-6 ${
                    star <= (hoverRating || form.rating)
                      ? 'fill-orange-400 text-orange-400'
                      : 'text-zinc-600'
                  }`}
                />
              </button>
            ))}
          </div>
          {errors.rating && (
            <p className="mt-1 text-xs text-red-500">{errors.rating}</p>
          )}
        </div>

        {/* Commentaire */}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-zinc-400">
            Commentaire
          </label>
          <textarea
            rows={3}
            value={form.comment}
            onChange={(e) => setForm({ ...form, comment: e.target.value })}
            placeholder="Partagez votre expérience avec ce produit..."
            className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-white outline-none transition-focus focus:border-orange-500"
          />
          {errors.comment && (
            <p className="mt-1 text-xs text-red-500">{errors.comment}</p>
          )}
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded-lg bg-orange-500 py-3 font-semibold text-white transition-all hover:bg-orange-600 disabled:opacity-50"
        >
          {isSubmitting ? 'Envoi...' : 'Publier mon avis'}
        </button>
      </form>
    </div>
  );
}
