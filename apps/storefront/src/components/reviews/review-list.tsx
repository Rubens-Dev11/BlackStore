'use client';

import { Star } from 'lucide-react';
import { Review } from '@/lib/api/reviews';

interface Props {
  reviews: Review[];
  ratingAvg: number;
  ratingCount: number;
}

export function ReviewList({ reviews, ratingAvg, ratingCount }: Props) {
  const formatDate = (dateStr: string) => {
    try {
      return new Intl.DateTimeFormat('fr-FR', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }).format(new Date(dateStr));
    } catch {
      return dateStr;
    }
  };

  if (ratingCount === 0) {
    return (
      <div className="rounded-xl border border-dashed border-zinc-800 p-8 text-center text-zinc-500">
        Aucun avis pour le moment. Soyez le premier à donner votre avis !
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Synthèse */}
      <div className="flex items-center gap-6 rounded-xl border border-zinc-800 bg-zinc-900/30 p-6">
        <div className="text-center">
          <div className="text-4xl font-bold text-white">{Number(ratingAvg).toFixed(1)}</div>
          <div className="mt-1 flex justify-center gap-0.5">
            {[1, 2, 3, 4, 5].map((s) => (
              <Star
                key={s}
                className={`h-4 w-4 ${
                  s <= Math.round(ratingAvg) ? 'fill-orange-400 text-orange-400' : 'text-zinc-700'
                }`}
              />
            ))}
          </div>
          <div className="mt-1 text-xs text-zinc-500">{ratingCount} avis</div>
        </div>

        <div className="flex-1 space-y-2">
          {[5, 4, 3, 2, 1].map((n) => {
            const count = reviews.filter((r) => r.rating === n).length;
            const percentage = ratingCount > 0 ? (count / ratingCount) * 100 : 0;
            return (
              <div key={n} className="flex items-center gap-3 text-xs text-zinc-400">
                <span className="w-3">{n}</span>
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-zinc-800">
                  <div
                    className="h-full bg-orange-400"
                    style={{ width: `${percentage}%` }}
                  />
                </div>
                <span className="w-8 text-right">{count}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Liste des avis */}
      <div className="space-y-6">
        {reviews.map((review) => (
          <div key={review.id} className="border-b border-zinc-800 pb-6 last:border-0">
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex gap-0.5">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <Star
                      key={s}
                      className={`h-3 w-3 ${
                        s <= review.rating ? 'fill-orange-400 text-orange-400' : 'text-zinc-700'
                      }`}
                    />
                  ))}
                </div>
                <span className="text-sm font-medium text-white">
                  {review.buyerEmail.split('@')[0]}
                  <span className="text-zinc-600">***@{review.buyerEmail.split('@')[1]}</span>
                </span>
              </div>
              <span className="text-xs text-zinc-500">
                {formatDate(review.createdAt)}
              </span>
            </div>
            {review.comment && (
              <p className="text-sm italic text-zinc-400 leading-relaxed">
                &ldquo;{review.comment}&rdquo;
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
