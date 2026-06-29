const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

export interface Review {
  id: string;
  buyerEmail: string;
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
  const res = await fetch(`${API_URL}/reviews/${productId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  
  if (!res.ok) {
    const errorData = await res.json();
    throw new Error(errorData.message || 'Erreur lors de la soumission de l\'avis');
  }
  
  return res.json();
}
