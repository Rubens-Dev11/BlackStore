import { apiFetch, responseError } from './errors';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

export interface Review {
  id: string;
  /** Prénom et initiale du nom de l'acheteur (son e-mail n'est jamais affiché). */
  author: string;
  rating: number;
  comment?: string;
  createdAt: string;
}

export interface ReviewResponse {
  reviews: Review[];
  ratingAvg: number;
  ratingCount: number;
}

export async function fetchReviews(productId: string): Promise<ReviewResponse> {
  const res = await fetch(`${API_URL}/reviews/product/${productId}`);
  if (!res.ok) throw new Error('Erreur lors de la récupération des avis');
  return res.json();
}

export async function submitReview(productId: string, data: { buyerEmail: string; rating: number; comment?: string }) {
  const res = await apiFetch(`${API_URL}/reviews/${productId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    throw await responseError(res, "Votre avis n'a pas pu être envoyé. Réessayez.");
  }
  
  return res.json();
}
