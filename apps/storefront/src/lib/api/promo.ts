import { apiFetch, responseError } from './errors';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';

/** Réduction calculée par l'API sur le panier ; le montant définitif est recalculé à la commande. */
export interface PromoPreview {
  code: string;
  /** « −20 % » ou « −1 500 FCFA ». */
  label: string;
  /** Boutique du code, ou null pour un code de BlackStore. */
  storeName: string | null;
  oncePerCustomer: boolean;
  subtotal: number;
  discount: number;
  total: number;
  discountByProduct: Record<string, number>;
}

export async function applyPromoCode(payload: {
  code: string;
  items: Array<{ productId: string; quantity: number }>;
  email?: string;
}): Promise<PromoPreview> {
  const res = await apiFetch(`${API}/promo-codes/apply`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw await responseError(res, "Ce code promo n'a pas pu être vérifié. Réessayez.");
  }
  return res.json();
}
