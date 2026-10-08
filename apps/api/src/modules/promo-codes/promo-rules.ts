import { PromoDiscountType } from '@prisma/client';

/** CinetPay refuse les paiements de moins de 100 FCFA : une commande est gratuite ou atteint ce montant. */
export const MIN_PAYABLE_AMOUNT = 100;
/** Une commande en attente de paiement « réserve » son code pendant 30 minutes, puis ne compte plus. */
export const PENDING_HOLD_MS = 30 * 60_000;
export const MAX_PERCENT = 100;
export const MAX_AMOUNT = 1_000_000;

export interface PromoRule {
  discountType: PromoDiscountType;
  value: number;
}

/** « NoEl 10 » → « NOEL10 ». */
export function normalizePromoCode(raw: string): string {
  return raw.replace(/\s+/g, '').toUpperCase();
}

/** Libellé court de la réduction : « −20 % » ou « −1 500 FCFA ». */
export function promoLabel(rule: PromoRule): string {
  return rule.discountType === 'percent'
    ? `−${rule.value} %`
    : `−${rule.value.toLocaleString('fr-FR').replace(/\s/g, ' ')} FCFA`;
}

/**
 * Réduction de chaque article (même ordre que `items`) ; les articles hors du code et les articles
 * gratuits n'en ont pas.
 * - pourcentage : appliqué à chaque article, arrondi au multiple de 5 inférieur (les prix des vendeurs
 *   sont des multiples de 5, le montant payé le reste) ; 100 % rend l'article gratuit ;
 * - montant : déduit une seule fois par commande, en commençant par l'article le plus cher, sans
 *   jamais rendre un prix négatif.
 */
export function computeDiscounts(rule: PromoRule, items: { price: number; eligible: boolean }[]): number[] {
  const discounts = items.map(() => 0);
  if (rule.discountType === 'percent') {
    items.forEach((item, i) => {
      if (!item.eligible || item.price <= 0) return;
      discounts[i] = rule.value >= MAX_PERCENT ? item.price : Math.floor((item.price * rule.value) / 500) * 5;
    });
    return discounts;
  }
  let remaining = rule.value;
  const order = items
    .map((item, i) => ({ ...item, i }))
    .filter((item) => item.eligible && item.price > 0)
    .sort((a, b) => b.price - a.price || a.i - b.i);
  for (const item of order) {
    if (remaining <= 0) break;
    discounts[item.i] = Math.min(remaining, item.price);
    remaining -= discounts[item.i];
  }
  return discounts;
}
